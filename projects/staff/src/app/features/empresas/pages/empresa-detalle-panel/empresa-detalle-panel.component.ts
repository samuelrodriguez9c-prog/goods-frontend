import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { InputTextModule } from 'primeng/inputtext';
import {
  IconAlertTriangle,
  IconCheck,
  IconCircleCheck,
  IconCircleDashed,
  IconExclamationCircle,
  IconLoader2,
  IconPointFilled,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { StatusBadgeComponent, StatusBadgeTone } from 'shared-ui';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { PantallaEstadoComponent } from '../../../../shared/ui/pantalla-estado/pantalla-estado.component';
import { DatosEditablesEmpresa, EmpresaService } from '../../../../core/catalog/empresa.service';
import { Empresa, EmpresaConDueno, EstadoEmpresa } from '../../../../core/catalog/models/empresa.model';

/** Mismo mapa de tonos que `EmpresasPageComponent.TONO_POR_ESTADO` — se
 * repite acá porque ese es `protected` del otro componente (no exportado)
 * y este panel también necesita pintar el badge de estado; no vale la
 * pena sacarlo a un tercer archivo por siete líneas, mismo criterio que
 * `formatCop`/`RespuestaPaginada` duplicados en otros lados del proyecto. */
const TONO_POR_ESTADO: Record<EstadoEmpresa, StatusBadgeTone> = {
  solicitud_recibida: 'neutral',
  pendiente: 'warning',
  informacion_corroborada: 'warning',
  activa: 'success',
  rechazada: 'critical',
  suspendida: 'critical',
  cancelada: 'neutral',
};

/** El badge de la cabecera mostraba el `estado` crudo (`informacion_corroborada`);
 * el rediseño lo muestra como lo diría una persona. Mismo duplicado que
 * `TONO_POR_ESTADO` de arriba — ya existe un mapa igual en
 * `EmpresasPageComponent`, tampoco exportado desde ahí. */
const ETIQUETA_POR_ESTADO: Record<EstadoEmpresa, string> = {
  solicitud_recibida: 'Solicitud recibida',
  pendiente: 'Pendiente',
  informacion_corroborada: 'Información corroborada',
  activa: 'Activa',
  rechazada: 'Rechazada',
  suspendida: 'Suspendida',
  cancelada: 'Cancelada',
};

/**
 * Panel de detalle de una Empresa (§3.2/§11 Paso 2,
 * PROPUESTA_FLUJO_ALTA_ASISTIDA.md) — se abre desde una fila de
 * `EmpresasPageComponent`, o desde el icono de información del Paso 1 del
 * `ActivarEmpresaWizardComponent` (`altas-pendientes`), apilado encima de
 * ese asistente igual que antes del rediseño.
 *
 * Rediseño del 2026-09-21, tres cambios de forma respecto de la versión
 * anterior:
 *
 * 1. Ya NO usa `SidePanelComponent`: ese panel scrollea todo junto y su
 *    cabecera es solo un título. Acá la cabecera (avatar + nombre + estado)
 *    y la barra de guardado quedan fijas, y solo el cuerpo scrollea — así
 *    que el overlay se arma en este template. Backdrop, z-index (`z-50`) y
 *    keyframes (`fade-in-up`, `slide-in-right`) son los mismos que usa
 *    `SidePanelComponent`, así que sigue apilando bien arriba del
 *    `app-side-panel` del asistente de activación.
 * 2. Los tres campos editables van en una sola tarjeta de filas (sin
 *    `CampoDetalleComponent`, que es una pila de bloques etiqueta/valor).
 *    `CampoDetalleComponent` y `SidePanelComponent` siguen intactos: los
 *    sigue usando el asistente de activación.
 * 3. Sección "Personas": el dato declarado en el registro y la cuenta real
 *    se muestran como dos puntos de una misma línea de tiempo, con un
 *    veredicto arriba ("coincide" / "no coincide" / "todavía no existe")
 *    para que el staff no tenga que comparar nombres a ojo antes de activar.
 *
 * La barra inferior solo aparece cuando hay algo que decir (cambios sin
 * guardar, guardando, guardado, o un error) — no ocupa lugar mientras se lee.
 */
@Component({
  selector: 'app-empresa-detalle-panel',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    InputTextModule,
    TablerIconComponent,
    StatusBadgeComponent,
    PantallaEstadoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './empresa-detalle-panel.component.html',
})
export class EmpresaDetallePanelComponent {
  private readonly empresaService = inject(EmpresaService);
  private readonly alertas = inject(AlertaService);

  readonly empresaId = input.required<number>();
  readonly cerrar = output<void>();
  /** Emite la Empresa ya guardada después de un "Guardar cambios" exitoso
   * — `EmpresasPageComponent` la usa para actualizar la fila sin tener
   * que releer el listado completo. */
  readonly actualizada = output<Empresa>();

  protected readonly iconCerrar = IconX;
  protected readonly iconGuardar = IconCheck;
  protected readonly iconError = IconExclamationCircle;

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly empresa = signal<EmpresaConDueno | null>(null);

  // Copia editable local de los tres campos que permite `actualizar()` —
  // se inicializa al cargar la Empresa y se compara contra `original()`
  // para habilitar "Guardar cambios" solo cuando hace falta.
  protected readonly rubro = signal('');
  protected readonly correoContacto = signal('');
  protected readonly telefonoContacto = signal('');

  protected readonly guardando = signal(false);
  protected readonly guardado = signal(false);
  protected readonly errorGuardar = signal<string | null>(null);

  private readonly original = computed(() => {
    const e = this.empresa();
    return e
      ? { rubro: e.rubro ?? '', correo: e.correoContacto, telefono: e.telefonoContacto ?? '' }
      : null;
  });

  protected readonly cantidadCambios = computed(() => {
    const base = this.original();
    if (!base) {
      return 0;
    }
    return (
      (this.rubro() !== base.rubro ? 1 : 0) +
      (this.correoContacto() !== base.correo ? 1 : 0) +
      (this.telefonoContacto() !== base.telefono ? 1 : 0)
    );
  });

  protected readonly hayCambios = computed(() => this.cantidadCambios() > 0);

  /** Compara el nombre declarado en el registro público contra el del Usuario
   * dueño ya creado. Comparación laxa a propósito (sin acentos, sin dobles
   * espacios, sin distinguir mayúsculas): "N. Rivas Soto" vs "Nube Rivas" sí
   * es una diferencia que hay que confirmar en la llamada, pero "José Pérez"
   * vs "Jose Perez" no. */
  protected readonly veredicto = computed(() => {
    const e = this.empresa();
    const dueno = e?.duenoUsuario ?? null;

    if (!dueno) {
      return {
        texto: 'La cuenta todavía no existe',
        icono: IconCircleDashed,
        tinta: 'text-amber-800',
        fondo: 'bg-badge-warning-bg',
        punto: 'border-amber-800 bg-white',
      };
    }

    const declarado = this.normalizar(`${e?.duenoNombres ?? ''} ${e?.duenoApellidos ?? ''}`);
    const real = this.normalizar(`${dueno.nombres} ${dueno.apellidos}`);

    return declarado && declarado === real
      ? {
          texto: 'Coincide con lo declarado',
          icono: IconCircleCheck,
          tinta: 'text-emerald-900',
          fondo: 'bg-badge-success-bg',
          punto: 'border-emerald-900 bg-emerald-900',
        }
      : {
          texto: 'No coincide con lo declarado',
          icono: IconAlertTriangle,
          tinta: 'text-badge-error-solid',
          fondo: 'bg-badge-error-solid/15',
          punto: 'border-badge-error-solid bg-white',
        };
  });

  protected readonly estadoBarra = computed(() => {
    if (this.guardando()) {
      return { texto: 'Guardando…', icono: IconLoader2, tinta: 'text-gray-500' };
    }
    if (this.guardado() && !this.hayCambios()) {
      return { texto: 'Cambios guardados.', icono: IconCircleCheck, tinta: 'text-success-solid' };
    }
    const n = this.cantidadCambios();
    return {
      texto: n === 1 ? '1 cambio sin guardar' : `${n} cambios sin guardar`,
      icono: IconPointFilled,
      tinta: 'text-gray-500',
    };
  });

  protected readonly nombreDeclarado = computed(() => {
    const e = this.empresa();
    const nombre = `${e?.duenoNombres ?? ''} ${e?.duenoApellidos ?? ''}`.trim();
    return nombre || 'Sin datos del registro';
  });

  protected readonly estadoPantalla = computed<'cargando' | 'error' | 'listo'>(() =>
    this.error() ? 'error' : this.cargando() ? 'cargando' : 'listo',
  );

  constructor() {
    effect(() => {
      this.cargar(this.empresaId());
    });
  }

  private cargar(id: number): void {
    this.cargando.set(true);
    this.error.set(null);
    this.errorGuardar.set(null);
    this.guardado.set(false);
    this.empresaService.obtenerUno(id).subscribe({
      next: (empresa) => {
        this.empresa.set(empresa);
        this.rubro.set(empresa.rubro ?? '');
        this.correoContacto.set(empresa.correoContacto);
        this.telefonoContacto.set(empresa.telefonoContacto ?? '');
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el detalle de la Empresa. Intenta de nuevo.');
        this.cargando.set(false);
      },
    });
  }

  /** `(reintentar)` de `app-pantalla-estado` — vuelve a pedir el mismo id. */
  protected reintentar(): void {
    this.cargar(this.empresaId());
  }

  protected descartar(): void {
    const base = this.original();
    if (!base) {
      return;
    }
    this.rubro.set(base.rubro);
    this.correoContacto.set(base.correo);
    this.telefonoContacto.set(base.telefono);
    this.errorGuardar.set(null);
    this.guardado.set(false);
  }

  protected guardar(): void {
    const actual = this.empresa();
    if (!actual || this.guardando() || !this.hayCambios()) {
      return;
    }

    this.guardando.set(true);
    this.errorGuardar.set(null);
    const datos: DatosEditablesEmpresa = {
      rubro: this.rubro().trim() || undefined,
      correoContacto: this.correoContacto().trim(),
      telefonoContacto: this.telefonoContacto().trim() || undefined,
    };

    this.alertas
      .seguir(this.empresaService.actualizar(actual.id, datos), {
        titulo: 'Guardando cambios',
        texto: actual.nombre,
        exito: { titulo: 'Cambios guardados' },
        error: { titulo: 'No se pudo guardar', texto: 'Intenta de nuevo.' },
      })
      .subscribe({
        next: (empresaActualizada) => {
          this.guardando.set(false);
          this.guardado.set(true);
          this.empresa.update((e) => (e ? { ...e, ...empresaActualizada } : e));
          this.actualizada.emit(empresaActualizada);
        },
        error: (err: unknown) => {
          this.guardando.set(false);
          this.errorGuardar.set(this.mensajeDeError(err));
        },
      });
  }

  protected onBackdropClick(event: MouseEvent): void {
    // Mismo criterio que SidePanelComponent/ModalComponent: solo cierra si
    // el click fue directo sobre el backdrop.
    if (event.target === event.currentTarget) {
      this.cerrar.emit();
    }
  }

  protected iniciales(nombre: string): string {
    return nombre
      .split(' ')
      .filter((palabra) => palabra.length > 2)
      .slice(0, 2)
      .map((palabra) => palabra[0])
      .join('')
      .toUpperCase();
  }

  protected tonoEstado(estado: EstadoEmpresa): StatusBadgeTone {
    return TONO_POR_ESTADO[estado] ?? 'neutral';
  }

  protected etiquetaEstado(estado: EstadoEmpresa): string {
    return ETIQUETA_POR_ESTADO[estado] ?? estado;
  }

  private normalizar(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  private mensajeDeError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const mensaje = (err.error as { message?: string } | null)?.message;
      if (mensaje) {
        return Array.isArray(mensaje) ? mensaje.join(' ') : mensaje;
      }
    }
    return 'No se pudo guardar. Intenta de nuevo.';
  }
}
