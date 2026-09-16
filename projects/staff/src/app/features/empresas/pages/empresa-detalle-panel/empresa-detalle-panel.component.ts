import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { StatusBadgeComponent, StatusBadgeTone } from 'shared-ui';
import { SidePanelComponent } from '../../../../shared/ui/side-panel/side-panel.component';
import { CampoDetalleComponent } from '../../../../shared/ui/campo-detalle/campo-detalle.component';
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

/**
 * Panel de detalle de una Empresa (§3.2/§11 Paso 2,
 * PROPUESTA_FLUJO_ALTA_ASISTIDA.md) — se abre desde una fila de
 * `EmpresasPageComponent`. Arma el panel con `CampoDetalleComponent` por
 * cada campo: rubro/correo/teléfono editables (llaman
 * `EmpresaService.actualizar()` con un botón "Guardar cambios" explícito,
 * no en cada tecla — mismo criterio que el formulario modal de
 * `PlanesPageComponent`), el resto de solo lectura, más la sección del
 * Usuario dueño real (`duenoUsuario`, ver `EmpresaConDueno` — resuelto en
 * `GET /empresas/:id` desde §11 Paso 1).
 *
 * Recarga sola si `empresaId` cambia mientras el panel sigue abierto
 * (clic en otra fila sin cerrar antes) — ver el `effect()` del
 * constructor.
 */
@Component({
  selector: 'app-empresa-detalle-panel',
  standalone: true,
  imports: [DatePipe, StatusBadgeComponent, SidePanelComponent, CampoDetalleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './empresa-detalle-panel.component.html',
})
export class EmpresaDetallePanelComponent {
  private readonly empresaService = inject(EmpresaService);

  readonly empresaId = input.required<number>();
  readonly cerrar = output<void>();
  /** Emite la Empresa ya guardada después de un "Guardar cambios" exitoso
   * — `EmpresasPageComponent` la usa para actualizar la fila en la tabla
   * sin tener que releer el listado completo. */
  readonly actualizada = output<Empresa>();

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly empresa = signal<EmpresaConDueno | null>(null);

  // Copia editable local de los tres campos que permite `actualizar()` —
  // se inicializa al cargar la Empresa y se compara contra ella en
  // `hayCambios` para habilitar "Guardar cambios" solo cuando hace falta.
  protected readonly rubro = signal('');
  protected readonly correoContacto = signal('');
  protected readonly telefonoContacto = signal('');

  protected readonly guardando = signal(false);
  protected readonly errorGuardar = signal<string | null>(null);

  protected readonly hayCambios = computed(() => {
    const actual = this.empresa();
    if (!actual) {
      return false;
    }
    return (
      this.rubro() !== (actual.rubro ?? '') ||
      this.correoContacto() !== actual.correoContacto ||
      this.telefonoContacto() !== (actual.telefonoContacto ?? '')
    );
  });

  constructor() {
    effect(() => {
      this.cargar(this.empresaId());
    });
  }

  private cargar(id: number): void {
    this.cargando.set(true);
    this.error.set(null);
    this.errorGuardar.set(null);
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

    this.empresaService.actualizar(actual.id, datos).subscribe({
      next: (empresaActualizada) => {
        this.guardando.set(false);
        this.empresa.update((e) => (e ? { ...e, ...empresaActualizada } : e));
        this.actualizada.emit(empresaActualizada);
      },
      error: (err: unknown) => {
        this.guardando.set(false);
        this.errorGuardar.set(this.mensajeDeError(err));
      },
    });
  }

  protected tonoEstado(estado: EstadoEmpresa): StatusBadgeTone {
    return TONO_POR_ESTADO[estado] ?? 'neutral';
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
