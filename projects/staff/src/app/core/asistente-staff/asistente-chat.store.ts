import { AsistenteStaffDocumentoService } from './asistente-staff-documento.service';
import { AsistenteStaffDocumento } from './models/asistente-staff.model';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Subscription, of, switchMap } from 'rxjs';
import { AsistenteStaffService } from './asistente-staff.service';
import { AsistenteStaffConversacion, AsistenteStaffMensaje } from './models/asistente-staff.model';

/** Nombre de tool → etiqueta para "Consulté …" (mismo mapa que el panel viejo). */
export const ETIQUETAS_HERRAMIENTA: Record<string, string> = {
  empresasPorEstado: 'las Empresas por estado',
  altasPendientes: 'las altas pendientes',
  resumenSuscripciones: 'las suscripciones',
  resumenIngresos: 'los ingresos',
};

const KEY_FIJADAS = 'goods-ia-fijadas';
const VELOCIDAD_MS = 34;

/**
 * Estado compartido del Asistente de IA de staff. Lo usan los DOS
 * componentes del rediseño: el mini chat (`AsistenteDockComponent`,
 * montado en el Shell) y la pantalla completa (`AsistentePageComponent`,
 * ruta `/asistente`). Al ser `providedIn: 'root'`, maximizar el mini
 * chat conserva la conversación activa, los mensajes y la respuesta en
 * curso: la pantalla completa lee lo mismo.
 *
 * El backend devuelve el mensaje FINAL (sin streaming), así que la
 * "escritura progresiva" es solo visual: `escribir()` revela el texto ya
 * recibido de a dos tokens cada 34 ms.
 */
@Injectable({ providedIn: 'root' })
export class AsistenteChatStore {
  private readonly api = inject(AsistenteStaffService);
  private readonly documentosApi = inject(AsistenteStaffDocumentoService);

  /** Documentos internos (v3): alimentan el submenú "Documentos internos" del +. */
  readonly documentos = signal<AsistenteStaffDocumento[]>([]);

  readonly conversaciones = signal<AsistenteStaffConversacion[]>([]);
  readonly activaId = signal<number | null>(null);
  readonly mensajes = signal<AsistenteStaffMensaje[]>([]);
  readonly cargandoHilo = signal(false);
  readonly error = signal<string | null>(null);
  /** Texto que hay que devolver al composer cuando un envío falla. */
  readonly borradorDevuelto = signal<string | null>(null);

  /** `pensando`: esperando al backend · `escribiendo`: revelando el texto. */
  readonly fase = signal<'pensando' | 'escribiendo' | null>(null);
  readonly escribiendoId = signal<number | null>(null);
  readonly visible = signal('');
  readonly generando = computed(() => this.fase() !== null);

  readonly fijadas = signal<ReadonlySet<number>>(this.leerFijadas());
  /** Comprobante adjuntado en el mini chat: la pantalla completa lo toma
   * al montar y arranca el flujo de pago con él. */
  readonly archivoPendiente = signal<File | null>(null);
  readonly activa = computed(() => this.conversaciones().find((c) => c.id === this.activaId()) ?? null);

  private envio?: Subscription;
  private timer?: ReturnType<typeof setInterval>;
  private cargado = false;

  cargarDocumentos(): void {
    this.documentosApi.listar().subscribe({
      next: (l) => this.documentos.set([...l].sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn))),
      error: () => this.documentos.set([]), // sin permiso / sin red: el submenú muestra "Todavía no hay documentos"
    });
  }

  cargar(): void {
    if (this.cargado) return;
    this.cargado = true;
    this.cargarDocumentos();
    this.refrescarConversaciones();
  }

  refrescarConversaciones(): void {
    this.api.listarConversaciones().subscribe({
      next: (lista) => this.conversaciones.set(lista),
      error: () => this.error.set('No se pudo cargar tu historial con el asistente.'),
    });
  }

  seleccionar(id: number): void {
    if (id === this.activaId()) return;
    this.detener();
    this.activaId.set(id);
    this.cargandoHilo.set(true);
    this.api.listarMensajes(id).subscribe({
      next: (lista) => {
        this.mensajes.set(lista);
        this.cargandoHilo.set(false);
      },
      error: () => {
        this.mensajes.set([]);
        this.cargandoHilo.set(false);
      },
    });
  }

  nueva(): void {
    this.detener();
    this.activaId.set(null);
    this.mensajes.set([]);
    this.error.set(null);
  }

  /** Devuelve `false` si no se pudo enviar (vacío o ya generando). */
  enviar(texto: string): boolean {
    const cuerpo = texto.trim();
    if (!cuerpo || this.generando()) return false;
    this.error.set(null);
    const optimista: AsistenteStaffMensaje = {
      id: -Date.now(),
      conversacionId: this.activaId() ?? 0,
      rol: 'usuario',
      cuerpo,
      herramientasUsadas: null,
      creadoEn: new Date().toISOString(),
    };
    this.mensajes.update((m) => [...m, optimista]);
    this.fase.set('pensando');

    this.envio = this.conversacionId$()
      .pipe(switchMap((id) => this.api.enviarMensaje(id, cuerpo)))
      .subscribe({
        next: (respuesta) => {
          this.mensajes.update((m) => [...m, respuesta]);
          this.escribir(respuesta);
          this.refrescarConversaciones();
        },
        error: () => {
          this.fase.set(null);
          this.mensajes.update((m) => m.filter((x) => x.id !== optimista.id));
          this.borradorDevuelto.set(cuerpo);
          this.error.set('El asistente no pudo responder. Probá de nuevo en un momento.');
        },
      });
    return true;
  }

  /** Confirmación de rol 'asistente' sin pasar por el modelo (pago registrado). */
  agregarMensajeSistema(cuerpo: string): void {
    this.conversacionId$()
      .pipe(switchMap((id) => this.api.registrarMensajeSistema(id, cuerpo)))
      .subscribe({
        next: (m) => {
          this.mensajes.update((actual) => [...actual, m]);
          this.escribir(m);
          this.refrescarConversaciones();
        },
        error: () => undefined, // el pago ya quedó guardado; solo falló el aviso
      });
  }

  detener(): void {
    this.envio?.unsubscribe();
    clearInterval(this.timer);
    this.fase.set(null);
    this.escribiendoId.set(null);
  }

  textoDe(m: AsistenteStaffMensaje): string {
    return m.id === this.escribiendoId() ? this.visible() : m.cuerpo;
  }

  herramientasTexto(m: AsistenteStaffMensaje): string | null {
    if (!m.herramientasUsadas?.length) return null;
    const etq = [...new Set(m.herramientasUsadas.map((h) => ETIQUETAS_HERRAMIENTA[h.nombre] ?? h.nombre))];
    return `Consulté ${etq.join(' y ')}`;
  }


  toggleFijada(id: number): void {
    const s = new Set(this.fijadas());
    s.has(id) ? s.delete(id) : s.add(id);
    this.fijadas.set(s);
    try {
      localStorage.setItem(KEY_FIJADAS, JSON.stringify([...s]));
    } catch {
      /* sin storage */
    }
  }

  /** Requiere `PATCH /asistente-staff/conversaciones/:id` (no existe aún). */
  renombrar(id: number, titulo: string): void {
    const previo = this.conversaciones();
    this.conversaciones.update((l) => l.map((c) => (c.id === id ? { ...c, titulo } : c)));
    this.api.renombrarConversacion(id, titulo).subscribe({ error: () => this.conversaciones.set(previo) });
  }

  /** Requiere `DELETE /asistente-staff/conversaciones/:id` (no existe aún). */
  eliminar(id: number): void {
    const previo = this.conversaciones();
    this.conversaciones.update((l) => l.filter((c) => c.id !== id));
    if (this.activaId() === id) this.nueva();
    this.api.eliminarConversacion(id).subscribe({ error: () => this.conversaciones.set(previo) });
  }

  private conversacionId$() {
    const id = this.activaId();
    if (id) return of(id);
    return this.api.crearConversacion().pipe(
      switchMap((c) => {
        this.conversaciones.update((a) => [c, ...a]);
        this.activaId.set(c.id);
        return of(c.id);
      }),
    );
  }

  private escribir(m: AsistenteStaffMensaje): void {
    const tokens = m.cuerpo.split(/(\s+)/);
    let i = 0;
    clearInterval(this.timer);
    this.visible.set('');
    this.escribiendoId.set(m.id);
    this.fase.set('escribiendo');
    this.timer = setInterval(() => {
      i += 2;
      if (i >= tokens.length) {
        clearInterval(this.timer);
        this.escribiendoId.set(null);
        this.fase.set(null);
      } else {
        this.visible.set(tokens.slice(0, i).join(''));
      }
    }, VELOCIDAD_MS);
  }

  private leerFijadas(): ReadonlySet<number> {
    try {
      return new Set<number>(JSON.parse(localStorage.getItem(KEY_FIJADAS) ?? '[]'));
    } catch {
      return new Set();
    }
  }
}
