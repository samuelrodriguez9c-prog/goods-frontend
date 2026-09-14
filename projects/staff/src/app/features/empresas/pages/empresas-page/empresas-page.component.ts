import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TableModule } from 'primeng/table';
import { DataTableComponent, StatusBadgeComponent, StatusBadgeTone, dataTablePt } from 'shared-ui';
import { forkJoin } from 'rxjs';
import { EmpresaService } from '../../../../core/catalog/empresa.service';
import { PlanService } from '../../../../core/catalog/plan.service';
import { SuscripcionService } from '../../../../core/catalog/suscripcion.service';
import { construirMapaPlanPorEmpresa } from '../../../../core/catalog/plan-lookup.util';
import { Empresa } from '../../../../core/catalog/models/empresa.model';

const TONO_POR_ESTADO: Record<string, StatusBadgeTone> = {
  activa: 'success',
  pendiente: 'warning',
  suspendida: 'critical',
  cancelada: 'neutral',
};

interface FilaEmpresa extends Empresa {
  /** `null` cuando no hay una Suscripción en estado 'activa' para esta
   * Empresa (pendiente/suspendida/cancelada) — ver
   * `construirMapaPlanPorEmpresa`. Se muestra como "—" en la tabla, no
   * como error: es información real (no tiene plan activo ahora mismo),
   * no un dato que falló al cargar. */
  planNombre: string | null;
}

/**
 * Listado de Empresas (clientes de Goods) — núcleo del panel de staff
 * aprobado en §7.2 (PIVOTE_SAAS_MULTITENANT.md), primera pantalla real
 * del paso 5 de §8. Incluye TODOS los estados (activa/suspendida/
 * cancelada/pendiente) — a diferencia de "Altas pendientes"
 * (`features/altas-pendientes/`), acá no hay acción de activar, es solo
 * la vista general; "pendiente" también aparece acá para no esconder
 * información, pero sin plan activo (ver `planNombre`).
 *
 * El plan de cada fila no viene de `GET /empresas` (esa tabla no lo
 * tiene — el plan vive en `Suscripcion`, historial aparte, ver
 * `Empresa.entity.ts` del backend): se resuelve cruzando
 * `GET /suscripciones?estado=activa` + `GET /planes/todos` en memoria —
 * ver `construirMapaPlanPorEmpresa` para el porqué de este enfoque en
 * vez de N llamadas (una por Empresa).
 */
@Component({
  selector: 'app-empresas-page',
  standalone: true,
  imports: [TableModule, DataTableComponent, StatusBadgeComponent, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './empresas-page.component.html',
})
export class EmpresasPageComponent {
  private readonly empresaService = inject(EmpresaService);
  private readonly suscripcionService = inject(SuscripcionService);
  private readonly planService = inject(PlanService);

  protected readonly tablePt = dataTablePt();
  protected readonly tonoPorEstado = TONO_POR_ESTADO;

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly filas = signal<FilaEmpresa[]>([]);

  protected readonly totalEmpresas = computed(() => this.filas().length);

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    forkJoin({
      empresas: this.empresaService.listar(),
      suscripcionesActivas: this.suscripcionService.listar('activa'),
      planes: this.planService.listarTodos(),
    }).subscribe({
      next: ({ empresas, suscripcionesActivas, planes }) => {
        const mapaPlan = construirMapaPlanPorEmpresa(suscripcionesActivas.data, planes.data);
        this.filas.set(
          empresas.data.map((empresa) => ({
            ...empresa,
            planNombre: mapaPlan.get(empresa.id) ?? null,
          })),
        );
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el listado de Empresas. Intenta de nuevo.');
        this.cargando.set(false);
      },
    });
  }

  protected tonoDe(estado: string): StatusBadgeTone {
    return this.tonoPorEstado[estado] ?? 'neutral';
  }
}
