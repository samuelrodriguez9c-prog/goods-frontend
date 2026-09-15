import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TableModule } from 'primeng/table';
import { DataTableComponent, StatusBadgeComponent, StatusBadgeTone, dataTablePt } from 'shared-ui';
import { IconPencil, IconPlus, IconRotate, IconTrash, TablerIconComponent } from '@tabler/icons-angular';
import { GuardarPlanPayload, PlanService } from '../../../../core/catalog/plan.service';
import { Plan } from '../../../../core/catalog/models/plan.model';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';

/** Mismo formato que `formatCop` de `admin` (registro-publico-page) —
 * repetido a propósito, no vale la pena compartirlo entre dos proyectos
 * Angular por una función de una línea (ver el mismo criterio en
 * `RespuestaPaginada`, `core/catalog/models/empresa.model.ts`). */
function formatCop(value: number): string {
  return `$${value.toLocaleString('es-CO')}`;
}

interface FormularioPlan {
  nombre: string;
  descripcion: string;
  precioMensual: string;
  /** Una característica por línea — se separa en array recién al armar
   * el payload (ver `armarPayload`), así el textarea puede quedar con
   * líneas vacías mientras el staff escribe sin que se filtren solas. */
  caracteristicas: string;
}

const FORMULARIO_VACIO: FormularioPlan = {
  nombre: '',
  descripcion: '',
  precioMensual: '',
  caracteristicas: '',
};

/**
 * CRUD del catálogo de planes (Base/Plus hoy, ver
 * `scripts/seed-planes.sql` del backend) — pantalla "Planes" del sidebar
 * de staff (PIVOTE_SAAS_MULTITENANT.md §8). "Eliminar" en realidad
 * desactiva (ver `PlanService.desactivar` del frontend / `PlanService
 * .remove` del backend: un plan con Suscripciones apuntándole no se
 * puede borrar de verdad), por eso el botón dice "Desactivar" y hay uno
 * de "Reactivar" para los planes ya desactivados, en vez de un checkbox
 * "activo" dentro del formulario de editar.
 */
@Component({
  selector: 'app-planes-page',
  standalone: true,
  imports: [TableModule, DataTableComponent, StatusBadgeComponent, TablerIconComponent, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './planes-page.component.html',
})
export class PlanesPageComponent {
  private readonly planService = inject(PlanService);

  protected readonly tablePt = dataTablePt();
  protected readonly formatCop = formatCop;
  protected readonly iconPlus = IconPlus;
  protected readonly iconEdit = IconPencil;
  protected readonly iconDesactivar = IconTrash;
  protected readonly iconReactivar = IconRotate;

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly planes = signal<Plan[]>([]);

  // Modal de crear/editar — `planEditando` en `null` es "creando uno
  // nuevo", con valor es "editando ese plan" (mismo patrón que
  // `AltasPendientesPageComponent.errorActivar` para el estado por fila,
  // pero acá es un único formulario modal, no por fila).
  protected readonly modalAbierto = signal(false);
  protected readonly planEditando = signal<Plan | null>(null);
  protected readonly formulario = signal<FormularioPlan>({ ...FORMULARIO_VACIO });
  protected readonly guardando = signal(false);
  protected readonly errorGuardar = signal<string | null>(null);

  // Id del plan que se está desactivando/reactivando ahora mismo (para
  // deshabilitar solo ESE botón, no toda la tabla) — `null` cuando
  // ninguno está en vuelo.
  protected readonly accionandoId = signal<number | null>(null);

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.planService.listarTodos().subscribe({
      next: (respuesta) => {
        this.planes.set(respuesta.data);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el catálogo de planes. Intenta de nuevo.');
        this.cargando.set(false);
      },
    });
  }

  protected abrirCrear(): void {
    this.planEditando.set(null);
    this.formulario.set({ ...FORMULARIO_VACIO });
    this.errorGuardar.set(null);
    this.modalAbierto.set(true);
  }

  protected abrirEditar(plan: Plan): void {
    this.planEditando.set(plan);
    this.formulario.set({
      nombre: plan.nombre,
      descripcion: plan.descripcion ?? '',
      precioMensual: plan.precioMensual === null ? '' : String(plan.precioMensual),
      caracteristicas: (plan.caracteristicas ?? []).join('\n'),
    });
    this.errorGuardar.set(null);
    this.modalAbierto.set(true);
  }

  protected cerrarModal(): void {
    this.modalAbierto.set(false);
  }

  protected actualizarCampo(campo: keyof FormularioPlan, valor: string): void {
    this.formulario.update((actual) => ({ ...actual, [campo]: valor }));
  }

  protected guardar(): void {
    const f = this.formulario();
    if (!f.nombre.trim() || this.guardando()) {
      return;
    }

    this.guardando.set(true);
    this.errorGuardar.set(null);
    const payload = this.armarPayload(f);
    const editando = this.planEditando();
    const request = editando
      ? this.planService.actualizar(editando.id, payload)
      : this.planService.crear(payload);

    request.subscribe({
      next: (plan) => {
        this.guardando.set(false);
        this.modalAbierto.set(false);
        this.planes.update((actuales) =>
          editando
            ? actuales.map((p) => (p.id === plan.id ? plan : p))
            : [...actuales, plan],
        );
      },
      error: (err: unknown) => {
        this.guardando.set(false);
        this.errorGuardar.set(this.mensajeDeError(err));
      },
    });
  }

  private armarPayload(f: FormularioPlan): GuardarPlanPayload {
    const caracteristicas = f.caracteristicas
      .split('\n')
      .map((linea) => linea.trim())
      .filter((linea) => linea.length > 0);
    const precio = f.precioMensual.trim();
    return {
      nombre: f.nombre.trim(),
      descripcion: f.descripcion.trim() || undefined,
      precioMensual: precio ? Number(precio) : undefined,
      caracteristicas,
    };
  }

  protected desactivar(plan: Plan): void {
    if (this.accionandoId() !== null) {
      return;
    }
    this.accionandoId.set(plan.id);
    this.planService.desactivar(plan.id).subscribe({
      next: () => {
        this.accionandoId.set(null);
        this.planes.update((actuales) =>
          actuales.map((p) => (p.id === plan.id ? { ...p, activo: false } : p)),
        );
      },
      error: () => {
        this.accionandoId.set(null);
        this.error.set('No se pudo desactivar el plan. Intenta de nuevo.');
      },
    });
  }

  protected reactivar(plan: Plan): void {
    if (this.accionandoId() !== null) {
      return;
    }
    this.accionandoId.set(plan.id);
    this.planService.reactivar(plan.id).subscribe({
      next: (actualizado) => {
        this.accionandoId.set(null);
        this.planes.update((actuales) =>
          actuales.map((p) => (p.id === plan.id ? actualizado : p)),
        );
      },
      error: () => {
        this.accionandoId.set(null);
        this.error.set('No se pudo reactivar el plan. Intenta de nuevo.');
      },
    });
  }

  protected tonoActivo(activo: boolean): StatusBadgeTone {
    return activo ? 'success' : 'neutral';
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
