import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IconCheck,
  IconLoader2,
  IconMessagePlus,
  IconPaperclip,
  IconRobot,
  IconSend2,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { finalize, of, switchMap } from 'rxjs';
import { AsistenteStaffService } from '../../core/asistente-staff/asistente-staff.service';
import {
  AsistenteStaffConversacion,
  AsistenteStaffMensaje,
  ComprobantePagoExtraido,
} from '../../core/asistente-staff/models/asistente-staff.model';
import { EmpresaService } from '../../core/catalog/empresa.service';
import { Empresa } from '../../core/catalog/models/empresa.model';
import { SuscripcionService } from '../../core/catalog/suscripcion.service';
import { UploadService } from '../../core/upload/upload.service';

/** Nombre de tool → etiqueta corta en español para "Consulté: …" — mismo
 * criterio que `admin/layout/asistente-panel/` (§4.7/§5.1 paso 13: citar
 * siempre de dónde salió la respuesta). Las 4 tools de la Fase 4 (§5.4).
 * Si algún día se suma una tool nueva y no está acá, se muestra el
 * nombre crudo — nunca se cae ni se esconde la cita. */
const ETIQUETAS_HERRAMIENTA: Record<string, string> = {
  empresasPorEstado: 'las Empresas por estado',
  altasPendientes: 'las altas pendientes',
  resumenSuscripciones: 'las suscripciones',
  resumenIngresos: 'los ingresos',
};

/** Mismo criterio que `admin` (`ACCEPT_ARCHIVO_FACTURA`) — espejo de
 * `MIME_TYPES_IMAGEN`/`application/pdf` del backend
 * (`ExtraccionComprobantePagoService`). */
const ACCEPT_ARCHIVO_COMPROBANTE = 'image/jpeg,image/png,image/webp,image/gif,application/pdf';

/** Pasos del modo documento (§5.5 de `PROPUESTA_ASISTENTE_IA_RAG.md`,
 * "comprobante de pago → registrar Pago de una Empresa"):
 * - `empresa`: buscar y elegir a qué Empresa corresponde el pago — PASO
 *   OBLIGATORIO ANTES de poder adjuntar nada (decisión tomada con el
 *   usuario: a diferencia de `admin`, acá no hay cruce automático contra
 *   catálogo — el nombre en un comprobante bancario suele ser el del
 *   dueño, no el nombre comercial, así que adivinar la Empresa sería más
 *   riesgoso que simplemente pedírselo a quien ya sabe para qué Empresa
 *   es).
 * - `adjuntar`: Empresa ya elegida, esperando que se adjunte el
 *   comprobante.
 * - `extrayendo`: subiendo + esperando la respuesta del modelo.
 * - `revisando`: formulario prellenado, editable, esperando confirmación.
 * - `guardando`: confirmando (subiendo el archivo original, registrando
 *   el pago — lo que además renueva la suscripción, ver
 *   `SuscripcionService.registrarPago`).
 */
type PasoDocumento = 'empresa' | 'adjuntar' | 'extrayendo' | 'revisando' | 'guardando';

/**
 * Panel lateral del Asistente de IA para `staff` (§5.4 de
 * `PROPUESTA_ASISTENTE_IA_RAG.md`) — calcado casi textual de
 * `admin/layout/asistente-panel/asistente-panel.component.ts` (mismo
 * layout, mismas animaciones, mismo criterio de "Nueva conversación" sin
 * pegarle al backend hasta el primer `enviar()`). Se abre desde el ícono
 * `IconRobot` del topbar de staff (`TopbarComponent.abrirAsistenteIa()`)
 * y se monta siempre en `ShellComponent`, condicionado acá adentro por
 * `asistenteStaffService.abierto()`.
 *
 * Diferencia real con la versión de `admin`: el servicio/modelo no tiene
 * `empresaId` en ningún lado (conversaciones de staff no están atadas a
 * una Empresa — ver el docblock del modelo).
 *
 * Modo documento (§5.5, 2026-09-29): mismo criterio general que `admin`
 * ("Nuevo modo dentro del mismo panel"), pero con un paso extra AL
 * PRINCIPIO — elegir la Empresa — porque acá no hay ningún cruce
 * automático contra catálogo que lo resuelva solo (ver `PasoDocumento`
 * arriba).
 */
@Component({
  selector: 'app-asistente-staff-panel',
  standalone: true,
  imports: [FormsModule, TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './asistente-panel.component.html',
})
export class AsistenteStaffPanelComponent {
  protected readonly asistenteService = inject(AsistenteStaffService);
  private readonly empresaService = inject(EmpresaService);
  private readonly suscripcionService = inject(SuscripcionService);
  private readonly uploadService = inject(UploadService);

  protected readonly iconBot = IconRobot;
  protected readonly iconNueva = IconMessagePlus;
  protected readonly iconEnviar = IconSend2;
  protected readonly iconCerrar = IconX;
  protected readonly iconClip = IconPaperclip;
  protected readonly iconCargando = IconLoader2;
  protected readonly iconConfirmar = IconCheck;

  protected readonly conversaciones = signal<AsistenteStaffConversacion[]>([]);
  protected readonly conversacionActivaId = signal<number | null>(null);
  protected readonly mensajes = signal<AsistenteStaffMensaje[]>([]);
  protected readonly texto = signal('');

  protected readonly cargandoConversaciones = signal(false);
  protected readonly cargandoHilo = signal(false);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Ya se cargó al menos una vez desde que el panel está abierto — mismo
   * motivo que en `admin`: evita volver a pedir `listarConversaciones`
   * cada vez que Angular reevalúa el `@if` del template. */
  private cargoAlAbrir = false;

  // --- Modo documento (§5.5) ---------------------------------------
  protected readonly modo = signal<'chat' | 'documento'>('chat');
  protected readonly pasoDocumento = signal<PasoDocumento>('empresa');
  protected readonly errorDocumento = signal<string | null>(null);

  protected readonly busquedaEmpresa = signal('');
  protected readonly resultadosEmpresa = signal<Empresa[]>([]);
  protected readonly buscandoEmpresa = signal(false);
  protected readonly empresaSeleccionada = signal<Empresa | null>(null);

  protected readonly montoDraft = signal<number | null>(null);
  protected readonly fechaDraft = signal('');
  protected readonly referenciaDraft = signal('');
  protected readonly entidadBancariaDraft = signal('');
  protected readonly notasDraft = signal('');

  /** El `File` elegido — mismo motivo que en `admin`: no se relee del
   * `<input type="file">` al confirmar porque ese input ya se vació en
   * `onArchivoSeleccionado` (para poder elegir el mismo archivo dos
   * veces seguidas). */
  private archivoSeleccionado: File | null = null;

  @ViewChild('hiloScroll') private readonly hiloScrollRef?: ElementRef<HTMLDivElement>;
  @ViewChild('inputMensaje') private readonly inputMensajeRef?: ElementRef<HTMLInputElement>;
  @ViewChild('inputArchivoComprobante') private readonly inputArchivoRef?: ElementRef<HTMLInputElement>;

  protected readonly conversacionActiva = computed(
    () => this.conversaciones().find((c) => c.id === this.conversacionActivaId()) ?? null,
  );

  constructor() {
    effect(() => {
      if (this.asistenteService.abierto() && !this.cargoAlAbrir) {
        this.cargoAlAbrir = true;
        this.cargarConversaciones();
      }
    });
    effect(() => {
      this.mensajes();
      setTimeout(() => {
        const el = this.hiloScrollRef?.nativeElement;
        if (el) {
          el.scrollTop = el.scrollHeight;
        }
      });
    });
  }

  protected cerrar(): void {
    this.asistenteService.cerrarPanel();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cerrar();
    }
  }

  protected cargarConversaciones(mostrarCargando = true): void {
    if (mostrarCargando) {
      this.cargandoConversaciones.set(true);
      this.error.set(null);
    }
    this.asistenteService
      .listarConversaciones()
      .pipe(finalize(() => this.cargandoConversaciones.set(false)))
      .subscribe({
        next: (lista) => {
          this.conversaciones.set(lista);
          if (this.conversacionActivaId() === null && lista.length) {
            this.seleccionar(lista[0].id);
          }
        },
        error: () => {
          if (mostrarCargando) {
            this.error.set('No se pudo cargar tu historial con el asistente.');
          }
        },
      });
  }

  protected seleccionar(id: number): void {
    this.conversacionActivaId.set(id);
    this.cargandoHilo.set(true);
    this.asistenteService
      .listarMensajes(id)
      .pipe(finalize(() => this.cargandoHilo.set(false)))
      .subscribe({
        next: (lista) => this.mensajes.set(lista),
        error: () => this.mensajes.set([]),
      });
  }

  protected nuevaConversacion(): void {
    this.conversacionActivaId.set(null);
    this.mensajes.set([]);
    this.texto.set('');
    this.error.set(null);
    this.inputMensajeRef?.nativeElement.focus();
  }

  protected enviar(): void {
    const cuerpo = this.texto().trim();
    if (!cuerpo || this.enviando()) {
      return;
    }
    this.enviando.set(true);
    this.error.set(null);
    this.texto.set('');

    const idActivo = this.conversacionActivaId();
    const conFlujo$ = idActivo
      ? this.asistenteService.enviarMensaje(idActivo, cuerpo)
      : this.asistenteService.crearConversacion().pipe(
          switchMap((conversacion) => {
            this.conversaciones.update((actual) => [conversacion, ...actual]);
            this.conversacionActivaId.set(conversacion.id);
            return this.asistenteService.enviarMensaje(conversacion.id, cuerpo);
          }),
        );

    conFlujo$.pipe(finalize(() => this.enviando.set(false))).subscribe({
      next: () => {
        const id = this.conversacionActivaId();
        if (id !== null) {
          this.asistenteService.listarMensajes(id).subscribe((lista) => this.mensajes.set(lista));
        }
        this.cargarConversaciones(false);
        this.inputMensajeRef?.nativeElement.focus();
      },
      error: () => {
        this.error.set('El asistente no pudo responder. Probá de nuevo en un momento.');
        this.texto.set(cuerpo);
      },
    });
  }

  /** "Consulté: las Empresas por estado, los ingresos" — `null` si el
   * mensaje no usó ninguna tool. */
  protected herramientasTexto(m: AsistenteStaffMensaje): string | null {
    if (!m.herramientasUsadas?.length) {
      return null;
    }
    const etiquetas = [
      ...new Set(
        m.herramientasUsadas.map((h) => ETIQUETAS_HERRAMIENTA[h.nombre] ?? h.nombre),
      ),
    ];
    return `Consulté ${etiquetas.join(' y ')}`;
  }

  protected horaCorta(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  }

  protected tituloConversacion(c: AsistenteStaffConversacion): string {
    return c.titulo ?? 'Nueva conversación';
  }

  // --- Modo documento (§5.5) ---------------------------------------

  protected readonly acceptArchivoComprobante = ACCEPT_ARCHIVO_COMPROBANTE;

  /** El clip abre el modo documento directo en el paso "elegir Empresa"
   * — a diferencia de `admin`, acá NUNCA dispara el diálogo de archivo
   * de una: no hay ningún archivo que procesar hasta que se sepa de qué
   * Empresa es. */
  protected abrirModoDocumento(): void {
    this.modo.set('documento');
    this.pasoDocumento.set('empresa');
    this.errorDocumento.set(null);
    this.busquedaEmpresa.set('');
    this.resultadosEmpresa.set([]);
    this.empresaSeleccionada.set(null);
  }

  protected buscarEmpresa(): void {
    const texto = this.busquedaEmpresa().trim();
    if (!texto) {
      this.resultadosEmpresa.set([]);
      return;
    }
    this.buscandoEmpresa.set(true);
    this.errorDocumento.set(null);
    this.empresaService
      .listar({ buscar: texto })
      .pipe(finalize(() => this.buscandoEmpresa.set(false)))
      .subscribe({
        next: (respuesta) => this.resultadosEmpresa.set(respuesta.data),
        error: () => this.errorDocumento.set('No se pudo buscar la Empresa.'),
      });
  }

  protected elegirEmpresa(empresa: Empresa): void {
    this.empresaSeleccionada.set(empresa);
    this.pasoDocumento.set('adjuntar');
    this.errorDocumento.set(null);
  }

  /** "Cambiar" desde el paso de adjuntar/revisar — vuelve al paso de
   * buscar Empresa sin cerrar todo el modo documento. */
  protected cambiarEmpresa(): void {
    this.empresaSeleccionada.set(null);
    this.pasoDocumento.set('empresa');
    this.archivoSeleccionado = null;
  }

  protected elegirArchivoComprobante(): void {
    this.inputArchivoRef?.nativeElement.click();
  }

  protected onArchivoSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;
    input.value = '';
    if (archivo) {
      this.procesarComprobante(archivo);
    }
  }

  private procesarComprobante(archivo: File): void {
    this.archivoSeleccionado = archivo;
    this.pasoDocumento.set('extrayendo');
    this.errorDocumento.set(null);

    this.asistenteService.extraerComprobantePago(archivo).subscribe({
      next: (extraccion) => {
        this.prellenarDesdeExtraccion(extraccion);
        this.pasoDocumento.set('revisando');
      },
      error: (err: unknown) => {
        this.errorDocumento.set(this.mensajeError(err, 'No se pudo leer el comprobante.'));
        this.pasoDocumento.set('adjuntar');
      },
    });
  }

  private prellenarDesdeExtraccion(extraccion: ComprobantePagoExtraido): void {
    this.montoDraft.set(extraccion.monto);
    this.fechaDraft.set(extraccion.fecha ?? '');
    this.referenciaDraft.set(extraccion.referencia ?? '');
    this.entidadBancariaDraft.set(extraccion.entidadBancaria ?? '');
    this.notasDraft.set(extraccion.notas ?? '');
  }

  protected cancelarDocumento(): void {
    this.modo.set('chat');
    this.pasoDocumento.set('empresa');
    this.errorDocumento.set(null);
    this.empresaSeleccionada.set(null);
    this.archivoSeleccionado = null;
  }

  /** Espejo de `AsistentePanelComponent.confirmarEnHilo` de `admin` (ver
   * su docblock) — deja `cuerpo` como un mensaje real de rol 'asistente'
   * en el hilo de chat, en vez del "banner" que se probó primero: el
   * usuario pidió que la confirmación quede DENTRO de la conversación. Si
   * no hay conversación activa, crea una primero. */
  private confirmarEnHilo(cuerpo: string): void {
    const idActivo = this.conversacionActivaId();
    const conversacionId$ = idActivo
      ? of(idActivo)
      : this.asistenteService.crearConversacion().pipe(
          switchMap((conversacion) => {
            this.conversaciones.update((actual) => [conversacion, ...actual]);
            this.conversacionActivaId.set(conversacion.id);
            return of(conversacion.id);
          }),
        );

    conversacionId$
      .pipe(switchMap((id) => this.asistenteService.registrarMensajeSistema(id, cuerpo)))
      .subscribe({
        next: (mensaje) => {
          this.mensajes.update((actual) => [...actual, mensaje]);
          this.cargarConversaciones(false);
          this.error.set(null);
          this.cancelarDocumento();
        },
        error: () => {
          // El Pago ya está guardado — esto solo afectó el aviso en el
          // chat, no la operación en sí.
          this.cancelarDocumento();
        },
      });
  }

  protected confirmarDocumento(): void {
    if (this.pasoDocumento() === 'guardando') {
      return;
    }
    const empresa = this.empresaSeleccionada();
    if (!empresa) {
      this.errorDocumento.set('Elegí una Empresa primero.');
      return;
    }
    const monto = this.montoDraft();
    if (monto === null || monto <= 0) {
      this.errorDocumento.set('Ingresá el monto del pago.');
      return;
    }
    const fecha = this.fechaDraft().trim();
    if (!fecha) {
      this.errorDocumento.set('Ingresá la fecha del pago.');
      return;
    }

    this.pasoDocumento.set('guardando');
    this.errorDocumento.set(null);

    const registrar = (archivoUrl?: string) =>
      this.suscripcionService
        .registrarPago({
          empresaId: empresa.id,
          monto,
          fechaPago: fecha,
          referencia: this.referenciaDraft() || undefined,
          entidadBancaria: this.entidadBancariaDraft() || undefined,
          notas: this.notasDraft() || undefined,
          archivoUrl,
        })
        .subscribe({
          next: () => {
            const montoTexto = monto.toLocaleString('es-CO');
            this.confirmarEnHilo(
              `Listo, registré el pago de ${empresa.nombre} — $${montoTexto} el ${fecha}.`,
            );
          },
          error: (err: unknown) => {
            this.errorDocumento.set(this.mensajeError(err, 'No se pudo registrar el pago.'));
            this.pasoDocumento.set('revisando');
          },
        });

    // Siempre se sube el archivo original de nuevo (esta vez a disco) para
    // que quede como adjunto del pago — mismo criterio que `admin`
    // ("Guardarlo como adjunto").
    if (!this.archivoSeleccionado) {
      registrar(undefined);
      return;
    }
    this.uploadService.subir(this.archivoSeleccionado).subscribe({
      next: (subido) => registrar(subido.url),
      error: (err: unknown) => {
        this.errorDocumento.set(this.mensajeError(err, 'No se pudo subir el archivo original.'));
        this.pasoDocumento.set('revisando');
      },
    });
  }

  private mensajeError(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse && typeof err.error?.message === 'string') {
      return err.error.message;
    }
    return fallback;
  }
}
