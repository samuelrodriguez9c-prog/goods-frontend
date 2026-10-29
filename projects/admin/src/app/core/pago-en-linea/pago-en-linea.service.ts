import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { mensajeDeError } from '../solicitudes/solicitudes.service';
import { AlertaService } from '../ui/alerta.service';

interface LinkDePago {
  cobroId: number;
  url: string;
  monto: number;
  moneda: string;
}

type EstadoTransaccion = 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR';

/** Un pago que salió hacia Wompi y todavía no se confirmó en Goods. */
interface PagoEnCurso {
  desde: number;
  monto: number;
}

/** Cuántas veces y cada cuánto se pregunta por la transacción al volver de Wompi. */
const INTENTOS = 8;
const ESPERA_MS = 2500;
/** Sin volver por el enlace de Wompi, cada cuánto y hasta cuándo se mira si ya entró el aviso. */
const REVISION_MS = 8000;
const REVISION_MAX_MS = 2 * 60_000;
/** Pasado esto, un pago «en curso» se olvida (el cliente lo abandonó). */
const VIGENCIA_EN_CURSO_MS = 3 * 60 * 60_000;
const CLAVE = 'goods.pagoEnLinea';

/**
 * Pago en línea de la suscripción con Wompi (tarjeta, PSE, Nequi).
 *
 * `pagar()` pide el link del cobro pendiente y lleva al dueño a la página de
 * Wompi. Hay tres formas de que Goods se entere del resultado:
 *
 * 1. Vuelve por el botón de Wompi a `/?pago=wompi&id=<transacción>`:
 *    `confirmarRetorno()` pregunta por esa transacción y el backend la
 *    registra si se aprobó.
 * 2. Wompi avisa al backend (`transaction.updated`) aunque el cliente nunca
 *    vuelva: el panel se entera por `acceso:cambio` o al recargar. Mientras
 *    tanto, `esperarConfirmacion()` revisa el perfil cada pocos segundos.
 * 3. Si salió por otro lado (descargó el comprobante y escribió la URL a
 *    mano) y el aviso no llega, `confirmarConNumero()` registra el pago con
 *    el número de transacción del comprobante.
 *
 * Mientras un pago está «en curso» (salió a Wompi y no se confirmó), el
 * panel lo muestra en vez del botón «Pagar», para que no pague dos veces.
 */
@Injectable({ providedIn: 'root' })
export class PagoEnLineaService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly alertas = inject(AlertaService);
  private readonly router = inject(Router);
  private readonly base = `${environment.apiUrl}/pagos-en-linea`;

  /** Saliendo hacia Wompi: evita abrir dos veces. */
  readonly abriendo = signal(false);
  /** Consultando un número de transacción escrito a mano. */
  readonly confirmando = signal(false);
  private readonly _enCurso = signal<PagoEnCurso | null>(leer());
  /** Salió a pagar y Goods todavía no tiene el resultado. */
  readonly enCurso = this._enCurso.asReadonly();
  private revisando = false;

  /** Hay un cobro que se puede pagar en línea y quien mira es el dueño (el único que paga la cuenta). */
  readonly disponible = computed(() => {
    const u = this.auth.currentUser();
    return !!u?.accesoEmpresa?.proximoCobro?.pagoEnLinea && u.rol.nombre === 'dueno_empresa';
  });

  constructor() {
    // Si el cobro desaparece (se registró el pago, por aviso de Wompi o a
    // mano), el pago en curso terminó.
    effect(() => {
      const u = this.auth.currentUser();
      if (u && !u.accesoEmpresa?.proximoCobro && this._enCurso()) this.olvidar();
    });
  }

  pagar(): void {
    if (this.abriendo()) return;
    this.abriendo.set(true);
    const aviso = this.alertas.mostrar({ titulo: 'Abriendo la página de pago', texto: 'Tarjeta, PSE o Nequi' });
    this.http.post<LinkDePago>(`${this.base}/link`, {}).subscribe({
      next: (r) => {
        this.recordar({ desde: Date.now(), monto: r.monto });
        window.location.assign(r.url);
      },
      error: (e: unknown) => {
        this.abriendo.set(false);
        this.alertas.resolver(aviso, { estado: 'error', titulo: 'No pudimos abrir el pago', texto: mensajeDeError(e, 'Intenta de nuevo en un momento.') });
      },
    });
  }

  /**
   * Al cargar el panel. Si la URL trae `?pago=wompi`, confirma ese pago y
   * limpia la URL; si no, y había un pago en curso, espera el aviso de Wompi.
   */
  async confirmarRetorno(): Promise<void> {
    const params = new URLSearchParams(window.location.search);
    if (params.get('pago') !== 'wompi') {
      void this.esperarConfirmacion();
      return;
    }
    const id = params.get('id');
    void this.router.navigate([], { queryParams: { pago: null, id: null, env: null }, queryParamsHandling: 'merge', replaceUrl: true });
    if (!id) {
      void this.esperarConfirmacion();
      return;
    }
    await this.seguir(id);
  }

  /** Con el número de transacción del comprobante de Wompi. Devuelve si quedó confirmado. */
  async confirmarConNumero(numero: string): Promise<boolean> {
    const id = numero.trim().replace(/^#/, '');
    if (!id || this.confirmando()) return false;
    this.confirmando.set(true);
    try {
      return await this.seguir(id);
    } finally {
      this.confirmando.set(false);
    }
  }

  /**
   * Volvió sin pasar por el enlace de Wompi: revisa el perfil cada pocos
   * segundos por si ya entró el aviso de Wompi. No avisa nada si no hay
   * pago en curso.
   */
  async esperarConfirmacion(): Promise<void> {
    if (!this._enCurso() || this.revisando) return;
    this.revisando = true;
    const hasta = Date.now() + REVISION_MAX_MS;
    try {
      while (Date.now() < hasta && this._enCurso()) {
        const u = await firstValueFrom(this.auth.cargarPerfil()).catch(() => null);
        if (u && !u.accesoEmpresa?.proximoCobro) {
          this.olvidar();
          this.alertas.mostrar({ estado: 'success', titulo: 'Pago recibido', texto: 'Tu plan quedó renovado. Te llega el comprobante al correo.' });
          return;
        }
        await esperar(REVISION_MS);
      }
    } finally {
      this.revisando = false;
    }
  }

  /** «Pagar de nuevo» / descartar: el pago en curso no se completó. */
  olvidar(): void {
    this._enCurso.set(null);
    try {
      localStorage.removeItem(CLAVE);
    } catch {
      /* sin almacenamiento: no hay nada que borrar */
    }
  }

  /** Pregunta por la transacción hasta que se resuelva y muestra el resultado. */
  private async seguir(id: string): Promise<boolean> {
    const aviso = this.alertas.mostrar({ titulo: 'Confirmando tu pago', texto: 'Esto toma unos segundos.' });
    let estado: EstadoTransaccion = 'PENDING';
    let registrado = false;
    for (let i = 0; i < INTENTOS; i++) {
      try {
        ({ estado, registrado } = await firstValueFrom(this.consultar(id)));
      } catch (e) {
        this.alertas.resolver(aviso, {
          estado: 'error',
          titulo: 'No pudimos confirmar el pago',
          texto: mensajeDeError(e, 'Revisa el número de transacción. Si se descontó el dinero, escríbenos y lo revisamos.'),
        });
        return false;
      }
      if (estado !== 'PENDING' && (estado !== 'APPROVED' || registrado)) break;
      await esperar(ESPERA_MS);
    }
    if (estado === 'APPROVED') {
      this.olvidar();
      this.auth.cargarPerfil().subscribe({ error: () => undefined });
      this.alertas.resolver(aviso, { estado: 'success', titulo: 'Pago recibido', texto: 'Tu plan quedó renovado. Te llega el comprobante al correo.' });
      return true;
    }
    if (estado === 'PENDING') {
      this.alertas.resolver(aviso, { estado: 'info', titulo: 'Tu banco todavía no confirma el pago', texto: 'Te avisamos apenas se apruebe. No tienes que volver a pagar.' });
      return false;
    }
    this.olvidar();
    this.alertas.resolver(aviso, {
      estado: 'error',
      titulo: 'El pago no se aprobó',
      texto: 'No se hizo ningún cobro. Puedes intentarlo de nuevo con otro medio.',
      ...(this.disponible() ? { accion: { label: 'Intentar de nuevo', ejecutar: () => this.pagar() } } : {}),
    });
    return false;
  }

  private consultar(id: string): Observable<{ estado: EstadoTransaccion; registrado: boolean }> {
    return this.http.get<{ estado: EstadoTransaccion; registrado: boolean }>(`${this.base}/wompi/transacciones/${encodeURIComponent(id)}`);
  }

  private recordar(p: PagoEnCurso): void {
    this._enCurso.set(p);
    try {
      localStorage.setItem(CLAVE, JSON.stringify(p));
    } catch {
      /* sin almacenamiento: se pierde al recargar, pero igual se puede confirmar con el número */
    }
  }
}

function leer(): PagoEnCurso | null {
  try {
    const p = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as PagoEnCurso | null;
    return p && Date.now() - p.desde < VIGENCIA_EN_CURSO_MS ? p : null;
  } catch {
    return null;
  }
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
