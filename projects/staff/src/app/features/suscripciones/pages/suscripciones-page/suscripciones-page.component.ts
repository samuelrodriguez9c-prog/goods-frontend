import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { TableModule } from 'primeng/table';
import { DataTableComponent, StatusBadgeComponent, StatusBadgeTone, dataTablePt } from 'shared-ui';
import { forkJoin } from 'rxjs';
import { IconSettings, TablerIconComponent } from '@tabler/icons-angular';
import {
  EstadoAsignableSuscripcion,
  SuscripcionService,
} from '../../../../core/catalog/suscripcion.service';
import { EmpresaService } from '../../../../core/catalog/empresa.service';
import { PlanService } from '../../../../core/catalog/plan.service';
import { Suscripcion } from '../../../../core/catalog/models/suscripcion.model';
import { Plan } from '../../../../core/catalog/models/plan.model';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';

const TONO_POR_ESTADO: Record<string, StatusBadgeTone> = {
  activa: 'success',
  pendiente: 'warning',
  cancelada: 'neutral',
  vencida: 'critical',
};

const ESTADOS_ASIGNABLES: EstadoAsignableSuscripcion[] = ['activa', 'cancelada', 'vencida'];

interface FilaSuscripcion extends Suscripcion {
  empresaNombre: string;
  planNombre: string;
}

/**
 * Historial de Suscripciones de todas las Empresas (§7.2,
 * PIVOTE_SAAS_MULTITENANT.md) — a diferencia de Empresas/Altas
 * pendientes (que solo necesitan la suscripción activa/pendiente de cada
 * fila para mostrar el plan), acá se ve el historial completo, incluidas
 * las canceladas/vencidas, con la acción de upgrade/downgrade manual y
 * cambio de estado que pidió gerencia en §7.2 — pantalla "Suscripciones"
 * del sidebar de staff.
 *
 * No hay "crear" ni "eliminar" acá a propósito: una Suscripción nace
 * sola con el alta de una Empresa o con un cambio de plan (que cierra la
 * vieja y abre una nueva, ver `SuscripcionController.cambiarPlan` del
 * backend) — nunca se crea a mano ni se borra, es historial.
 */
@Component({
  selector: 'app-suscripciones-page',
  standalone: true,
  imports: [TableModule, DataTableComponent, StatusBadgeComponent, DatePipe, TablerIconComponent, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './suscripciones-page.component.html',
})
export class SuscripcionesPageComponent {
  private readonly suscripcionService = inject(SuscripcionService);
  private readonly empresaService = inject(EmpresaService);
  private readonly planService = inject(PlanService);

  protected readonly tablePt = dataTablePt();
  protected readonly tonoPorEstado = TONO_POR_ESTADO;
  protected readonly iconGestionar = IconSettings;
  protected readonly estadosAsignables = ESTADOS_ASIGNABLES;

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly filas = signal<FilaSuscripcion[]>([]);
  protected readonly planesActivos = signal<Plan[]>([]);

  // Modal "Gestionar" — cambiar de plan o de estado, ambos sobre la
  // misma fila (ver el comentario de la clase: por qué un solo modal
  // cubre las dos acciones de §7.2 en vez de dos modales separados).
  protected readonly filaGestionando = signal<FilaSuscripcion | null>(null);
  protected readonly nuevoPlanId = signal<number | null>(null);
  protected readonly nuevoEstado = signal<EstadoAsignableSuscripcion | null>(null);
  protected readonly guardando = signal(false);
  protected readonly errorGestionar = signal<string | null>(null);

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    forkJoin({
      suscripciones: this.suscripcionService.listar(),
      empresas: this.empresaService.listar(),
      planes: this.planService.listarTodos(),
    }).subscribe({
      next: ({ suscripciones, empresas, planes }) => {
        const nombreEmpresa = new Map(empresas.data.map((e) => [e.id, e.nombre]));
        const nombrePlan = new Map(planes.data.map((p) => [p.id, p.nombre]));
        this.filas.set(
          suscripciones.data
            .map((s) => ({
              ...s,
              empresaNombre: nombreEmpresa.get(s.empresaId) ?? `Empresa #${s.empresaId}`,
              planNombre: nombrePlan.get(s.planId) ?? `Plan #${s.planId}`,
            }))
            .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn)),
        );
        this.planesActivos.set(planes.data.filter((p) => p.activo));
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el historial de suscripciones. Intenta de nuevo.');
        this.cargando.set(false);
      },
    });
  }

  protected tonoDe(estado: string): StatusBadgeTone {
    return this.tonoPorEstado[estado] ?? 'neutral';
  }

  protected abrirGestionar(fila: FilaSuscripcion): void {
    this.filaGestionando.set(fila);
    this.nuevoPlanId.set(fila.planId);
    this.nuevoEstado.set(null);
    this.errorGestionar.set(null);
  }

  protected cerrarGestionar(): void {
    this.filaGestionando.set(null);
  }

  protected confirmarCambioPlan(): void {
    const fila = this.filaGestionando();
    const planId = this.nuevoPlanId();
    if (!fila || !planId || planId === fila.planId || this.guardando()) {
      return;
    }
    this.guardando.set(true);
    this.errorGestionar.set(null);
    this.suscripcionService.cambiarPlan(fila.empresaId, planId).subscribe({
      next: () => {
        this.guardando.set(false);
        this.filaGestionando.set(null);
        this.cargar();
      },
      error: (err: unknown) => {
        this.guardando.set(false);
        this.errorGestionar.set(this.mensajeDeError(err));
      },
    });
  }

  protected confirmarCambioEstado(): void {
    const fila = this.filaGestionando();
    const estado = this.nuevoEstado();
    if (!fila || !estado || estado === fila.estado || this.guardando()) {
      return;
    }
    this.guardando.set(true);
    this.errorGestionar.set(null);
    this.suscripcionService.cambiarEstado(fila.id, estado).subscribe({
      next: () => {
        this.guardando.set(false);
        this.filaGestionando.set(null);
        this.cargar();
      },
      error: (err: unknown) => {
        this.guardando.set(false);
        this.errorGestionar.set(this.mensajeDeError(err));
      },
    });
  }

  private mensajeDeError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const mensaje = (err.error as { message?: string } | null)?.message;
      if (mensaje) {
        return Array.isArray(mensaje) ? mensaje.join(' ') : mensaje;
      }
    }
    return 'No se pudo completar la acción. Intenta de nuevo.';
  }
}
