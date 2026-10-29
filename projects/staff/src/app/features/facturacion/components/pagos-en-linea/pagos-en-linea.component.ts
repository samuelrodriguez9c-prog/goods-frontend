import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, of } from 'rxjs';
import {
  IconAlertTriangle,
  IconCheck,
  IconCircleCheck,
  IconCircleX,
  IconClock,
  IconCopy,
  IconLink,
  IconSearch,
  IconWorld,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { FacturacionService, mensajeDeError } from '../../../../core/facturacion/facturacion.service';
import {
  EstadoTransaccionWompi,
  IntentoPagoEnLinea,
  PagoEnLineaEmpresa,
} from '../../../../core/facturacion/models/facturacion.model';
import { CambiosEnVivoService } from '../../../../core/realtime/cambios-en-vivo.service';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { cuando, hace, plata } from '../../../../shared/ui/lista-hoja/formato';

const ESTADO: Record<EstadoTransaccionWompi, { texto: string; color: string; icono: typeof IconClock }> = {
  APPROVED: { texto: 'Pago aprobado', color: '#087b5d', icono: IconCircleCheck },
  PENDING: { texto: 'Pago pendiente', color: '#b45309', icono: IconClock },
  DECLINED: { texto: 'Pago rechazado', color: '#d82c0d', icono: IconCircleX },
  VOIDED: { texto: 'Pago anulado', color: '#d82c0d', icono: IconCircleX },
  ERROR: { texto: 'Error en el pago', color: '#d82c0d', icono: IconAlertTriangle },
};
const PASO: Record<EstadoTransaccionWompi, string> = {
  APPROVED: 'Aprobado', PENDING: 'Pendiente', DECLINED: 'Rechazado', VOIDED: 'Anulado', ERROR: 'Error',
};
const ORIGEN = { aviso: 'aviso de Wompi', consulta: 'al volver a Goods', staff: 'verificado por staff' } as const;

interface Fila {
  id: number;
  icono: typeof IconClock;
  color: string;
  titulo: string;
  cuando: string;
  monto: string | null;
  /** Líneas grises debajo del título. */
  detalle: string[];
  /** Motivo del rechazo o advertencia, en color. */
  nota: { texto: string; color: string } | null;
  chips: string[];
  transaccionId: string | null;
  pagoId: number | null;
}

/**
 * Pago en línea (Wompi) de una Empresa, como lo necesita quien atiende al
 * cliente: qué está pasando ahora, cada link que creó con «Pagar» y cada
 * transacción (aprobada, pendiente o rechazada, con el motivo del banco), y
 * un campo para verificar el número del comprobante que manda el cliente.
 * Se refresca solo con cada aviso de Wompi (`datos:cambio` de facturación).
 *
 * Lo usan la pestaña «En línea» de Facturación y la de la ficha de la Empresa.
 */
@Component({
  selector: 'app-pagos-en-linea',
  standalone: true,
  imports: [TablerIconComponent],
  templateUrl: './pagos-en-linea.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PagosEnLineaComponent {
  private readonly facturacion = inject(FacturacionService);
  private readonly alertas = inject(AlertaService);
  private readonly auth = inject(AuthService);

  readonly empresaId = input.required<number>();
  /** Clic en «Pago #N» de una transacción registrada. */
  readonly verPago = output<number>();

  protected readonly i = { link: IconLink, copiar: IconCopy, check: IconCheck, buscar: IconSearch, mundo: IconWorld };
  protected readonly datos = signal<PagoEnLineaEmpresa | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal(false);
  protected readonly numero = signal('');
  protected readonly verificando = signal(false);
  protected readonly copiado = signal<string | null>(null);

  protected readonly puedeVerificar = computed(() => (this.auth.currentUser()?.permisos ?? []).includes('facturacion.gestionar'));

  constructor() {
    effect(() => {
      const id = this.empresaId();
      untracked(() => {
        this.datos.set(null);
        this.cargar(id);
      });
    });
    inject(CambiosEnVivoService)
      .huboCambio(['facturacion'])
      .pipe(debounceTime(400), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.cargar(this.empresaId(), true));
  }

  private cargar(id: number, silencioso = false): void {
    if (!silencioso) this.cargando.set(true);
    this.facturacion
      .pagosEnLinea(id)
      .pipe(catchError(() => of(null)))
      .subscribe((d) => {
        if (this.empresaId() !== id) return;
        this.cargando.set(false);
        if (d) {
          this.datos.set(d);
          this.error.set(false);
        } else if (!silencioso) {
          this.error.set(true);
        }
      });
  }

  protected reintentar(): void {
    this.cargar(this.empresaId());
  }

  /** Una frase con lo que está pasando hoy, que es lo primero que pregunta el cliente. */
  protected readonly ahora = computed<{ titulo: string; texto: string; color: string; icono: typeof IconClock } | null>(() => {
    const d = this.datos();
    if (!d) return null;
    const txs = d.intentos.filter((x) => x.tipo === 'transaccion');
    const ultima = txs[0];
    const links = d.intentos.filter((x) => x.tipo === 'link');
    if (!d.habilitado) {
      return { titulo: 'Pago en línea apagado', texto: 'Faltan las llaves de Wompi en el backend: el cliente no ve el botón «Pagar».', color: '#6b7280', icono: IconAlertTriangle };
    }
    if (d.cobroPendiente?.transaccionEnCurso) {
      return { titulo: 'Registrando un pago aprobado', texto: `La transacción ${d.cobroPendiente.transaccionEnCurso} se aprobó y se está registrando.`, color: '#087b5d', icono: IconClock };
    }
    if (ultima?.estado === 'PENDING') {
      return {
        titulo: 'Pago en curso',
        texto: `${ultima.medio ?? 'En línea'} por ${plata(ultima.monto ?? 0)}, esperando la respuesta del banco desde ${cuando(ultima.creadoEn).toLowerCase()}. Si no cambia, el cliente puede tocar «Pagar» otra vez: se crea un link nuevo.`,
        color: '#b45309',
        icono: IconClock,
      };
    }
    if (ultima && ultima.estado !== 'APPROVED' && ultima.estado) {
      return {
        titulo: 'El último intento no pasó',
        texto: `${ESTADO[ultima.estado].texto} con ${ultima.medio ?? 'su medio de pago'} ${hace(ultima.creadoEn)}${ultima.mensaje ? `: «${ultima.mensaje}»` : ''}. Puede intentar de nuevo con «Pagar» o con otro medio.`,
        color: '#d82c0d',
        icono: IconCircleX,
      };
    }
    if (ultima?.estado === 'APPROVED' && ultima.resultado && ultima.resultado !== 'registrado') {
      return { titulo: 'Pago aprobado sin registrar', texto: this.textoResultado(ultima) ?? '', color: '#d82c0d', icono: IconAlertTriangle };
    }
    const pendiente = d.cobroPendiente;
    if (pendiente) {
      const link = links.find((l) => l.linkUrl && l.linkUrl === pendiente.linkUrl);
      const tras = ultima && link && ultima.creadoEn > link.creadoEn;
      return link && !tras
        ? { titulo: 'Link abierto, sin intentos', texto: `Tocó «Pagar» ${cuando(link.creadoEn).toLowerCase()} por ${plata(pendiente.monto)} y todavía no ha intentado pagar.`, color: '#b45309', icono: IconLink }
        : { titulo: 'Cobro pendiente', texto: `Debe ${plata(pendiente.monto)}. ${link ? 'Ya tiene link de pago.' : 'Todavía no ha tocado «Pagar».'}`, color: '#6b7280', icono: IconClock };
    }
    if (ultima?.estado === 'APPROVED') {
      return { titulo: 'Al día', texto: `Su último pago en línea se aprobó ${hace(ultima.creadoEn)} y quedó registrado.`, color: '#087b5d', icono: IconCircleCheck };
    }
    return { titulo: 'Sin pagos en línea', texto: 'Todavía no ha usado el pago en línea.', color: '#6b7280', icono: IconWorld };
  });

  protected readonly linkVigente = computed(() => this.datos()?.cobroPendiente?.linkUrl ?? null);

  protected readonly filas = computed<Fila[]>(() => {
    const d = this.datos();
    if (!d) return [];
    return d.intentos.map((x) => (x.tipo === 'link' ? this.filaLink(x, d) : this.filaTransaccion(x)));
  });

  private filaLink(x: IntentoPagoEnLinea, d: PagoEnLineaEmpresa): Fila {
    const vigente = !!x.linkUrl && x.linkUrl === d.cobroPendiente?.linkUrl;
    return {
      id: x.id,
      icono: IconLink,
      color: '#6b7280',
      titulo: `${x.creadoPor?.nombre ?? 'El cliente'} tocó «Pagar»`,
      cuando: cuando(x.creadoEn),
      monto: x.monto === null ? null : plata(x.monto),
      detalle: [
        x.reemplazadoEn ? `Link reemplazado ${cuando(x.reemplazadoEn).toLowerCase()} por uno nuevo` : vigente ? 'Link vigente' : 'Link de un cobro ya cerrado',
      ],
      nota: null,
      chips: vigente ? ['Vigente'] : [],
      transaccionId: null,
      pagoId: null,
    };
  }

  private filaTransaccion(x: IntentoPagoEnLinea): Fila {
    const e = ESTADO[x.estado ?? 'PENDING'];
    const pasos = x.historial.map((h) => `${PASO[h.estado]} ${cuando(h.en).toLowerCase()} (${ORIGEN[h.origen]})`);
    const resultado = this.textoResultado(x);
    return {
      id: x.id,
      icono: e.icono,
      color: e.color,
      titulo: `${e.texto}${x.medio ? ` · ${x.medio}` : ''}`,
      cuando: cuando(x.creadoEn),
      monto: x.monto === null ? null : plata(x.monto),
      detalle: [...(x.correoPagador ? [`Correo del pagador: ${x.correoPagador}`] : []), ...(pasos.length > 1 ? [pasos.join(' → ')] : [])],
      nota: x.mensaje && x.estado !== 'APPROVED'
        ? { texto: `Motivo: ${x.mensaje}`, color: '#d82c0d' }
        : resultado && x.resultado !== 'registrado'
          ? { texto: resultado, color: '#d82c0d' }
          : null,
      chips: x.linkReemplazado ? ['Con un link anterior'] : [],
      transaccionId: x.transaccionId,
      pagoId: x.resultado === 'registrado' ? x.pagoId : null,
    };
  }

  private textoResultado(x: IntentoPagoEnLinea): string | null {
    switch (x.resultado) {
      case 'cobro_ya_pagado': return 'El cobro ya estaba pagado cuando entró esta plata: revisa si hay que reembolsar.';
      case 'sin_cobro': return 'El link no corresponde a ningún cobro: regístralo a mano o reembólsalo.';
      case 'error': return 'Se aprobó pero no se pudo registrar. Usa «Verificar» con este número para reintentarlo.';
      default: return null;
    }
  }

  protected copiar(texto: string): void {
    void navigator.clipboard?.writeText(texto);
    this.copiado.set(texto);
    setTimeout(() => this.copiado.update((c) => (c === texto ? null : c)), 1500);
  }

  /** Verifica el número del comprobante del cliente contra Wompi. */
  protected verificar(numero = this.numero()): void {
    const tx = numero.trim();
    if (!tx || this.verificando()) return;
    this.verificando.set(true);
    const id = this.alertas.mostrar({ titulo: 'Consultando a Wompi', texto: `Transacción ${tx}` });
    this.facturacion.verificarPagoEnLinea(tx).subscribe({
      next: (r) => {
        this.verificando.set(false);
        this.numero.set('');
        const e = r.estado ? ESTADO[r.estado].texto : 'Sin estado';
        this.alertas.resolver(id, r.registrado
          ? { estado: 'success', titulo: 'Pago registrado', texto: `${e} por ${plata(r.monto ?? 0)}: quedó cargado y el plan renovado.` }
          : { estado: r.estado === 'PENDING' ? 'warning' : 'error', titulo: e, texto: r.mensaje ?? this.textoResultado(r) ?? 'Wompi todavía no lo aprueba: no se registró nada.' });
        this.cargar(this.empresaId(), true);
      },
      error: (err) => {
        this.verificando.set(false);
        this.alertas.resolver(id, { estado: 'error', titulo: 'No se pudo verificar', texto: mensajeDeError(err) });
      },
    });
  }
}
