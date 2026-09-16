import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TableModule } from 'primeng/table';
import { DataTableComponent, StatusBadgeComponent, StatusBadgeTone, dataTablePt } from 'shared-ui';
import { forkJoin } from 'rxjs';
import { EmpresaService } from '../../../../core/catalog/empresa.service';
import { PlanService } from '../../../../core/catalog/plan.service';
import { SuscripcionService } from '../../../../core/catalog/suscripcion.service';
import { construirMapaPlanPorEmpresa } from '../../../../core/catalog/plan-lookup.util';
import { Empresa, EstadoEmpresa } from '../../../../core/catalog/models/empresa.model';
import { EmpresaDetallePanelComponent } from '../empresa-detalle-panel/empresa-detalle-panel.component';

/** Los 7 estados reales (ver `EstadoEmpresa`), en el mismo orden en que
 * recorre el flujo de alta asistida (§1/§5.1) — es el orden en que se
 * muestran las pills de filtro de §3.1. */
const ESTADOS_FILTRO: EstadoEmpresa[] = [
  'solicitud_recibida',
  'pendiente',
  'informacion_corroborada',
  'activa',
  'rechazada',
  'suspendida',
  'cancelada',
];

const TONO_POR_ESTADO: Record<EstadoEmpresa, StatusBadgeTone> = {
  solicitud_recibida: 'neutral',
  pendiente: 'warning',
  informacion_corroborada: 'warning',
  activa: 'success',
  rechazada: 'critical',
  suspendida: 'critical',
  cancelada: 'neutral',
};

/** Etiqueta legible por estado — antes de §11 Paso 2 la columna Estado
 * mostraba el valor crudo (`empresa.estado`, ej. "informacion_corroborada"
 * tal cual); ahora que las pills de filtro también necesitan texto
 * legible, se corrige acá de una vez para las dos cosas. */
const ETIQUETA_POR_ESTADO: Record<EstadoEmpresa, string> = {
  solicitud_recibida: 'Solicitud recibida',
  pendiente: 'Pendiente',
  informacion_corroborada: 'Información corroborada',
  activa: 'Activa',
  rechazada: 'Rechazada',
  suspendida: 'Suspendida',
  cancelada: 'Cancelada',
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
 * del paso 5 de §8. Incluye TODOS los estados (los 7 de `EstadoEmpresa`)
 * — a diferencia de "Altas pendientes" (`features/altas-pendientes/`),
 * acá no hay acción de activar, es solo la vista general + el panel de
 * detalle de §3.2/§11 Paso 2 (clic en una fila).
 *
 * El plan de cada fila no viene de `GET /empresas` (esa tabla no lo
 * tiene — el plan vive en `Suscripcion`, historial aparte, ver
 * `Empresa.entity.ts` del backend): se resuelve cruzando
 * `GET /suscripciones?estado=activa` + `GET /planes/todos` en memoria —
 * ver `construirMapaPlanPorEmpresa` para el porqué de este enfoque en
 * vez de N llamadas (una por Empresa). El filtro de plan de §3.1 por eso
 * también se resuelve en memoria (`filasFiltradas`), no como query param
 * — el backend no tiene ahí ni el cruce para hacerlo en servidor (ver el
 * comentario en `ListarEmpresasQueryDto`).
 */
@Component({
  selector: 'app-empresas-page',
  standalone: true,
  imports: [
    TableModule,
    DataTableComponent,
    StatusBadgeComponent,
    DatePipe,
    EmpresaDetallePanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './empresas-page.component.html',
})
export class EmpresasPageComponent {
  private readonly empresaService = inject(EmpresaService);
  private readonly suscripcionService = inject(SuscripcionService);
  private readonly planService = inject(PlanService);

  protected readonly tablePt = dataTablePt();
  protected readonly tonoPorEstado = TONO_POR_ESTADO;
  protected readonly estadosFiltro = ESTADOS_FILTRO;

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly filas = signal<FilaEmpresa[]>([]);

  // Filtros de servidor (§3.1) — se mandan a `EmpresaService.listar()`.
  // La pill de estado filtra al tocarla (una sola acción); buscar/desde/
  // hasta filtran al tocar "Filtrar", mismo patrón que
  // `AuditoriaPageComponent` (no en cada tecla, porque es una llamada al
  // servidor).
  protected readonly filtroEstado = signal<EstadoEmpresa | null>(null);
  protected readonly filtroBuscar = signal('');
  protected readonly filtroDesde = signal('');
  protected readonly filtroHasta = signal('');

  // Filtro de plan — en memoria, ver el comentario de la clase.
  protected readonly filtroPlan = signal<string | null>(null);

  // Panel de detalle (§3.2) — `null` significa cerrado.
  protected readonly empresaSeleccionadaId = signal<number | null>(null);

  protected readonly planesDisponibles = computed(() => {
    const nombres = new Set<string>();
    for (const fila of this.filas()) {
      if (fila.planNombre) {
        nombres.add(fila.planNombre);
      }
    }
    return [...nombres].sort();
  });

  protected readonly filasFiltradas = computed(() => {
    const plan = this.filtroPlan();
    const todas = this.filas();
    return plan ? todas.filter((fila) => fila.planNombre === plan) : todas;
  });

  protected readonly totalEmpresas = computed(() => this.filasFiltradas().length);

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    forkJoin({
      empresas: this.empresaService.listar({
        estado: this.filtroEstado() ?? undefined,
        buscar: this.filtroBuscar().trim() || undefined,
        desde: this.filtroDesde() || undefined,
        hasta: this.filtroHasta() || undefined,
      }),
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

  protected seleccionarEstado(estado: EstadoEmpresa | null): void {
    if (this.filtroEstado() === estado) {
      return;
    }
    this.filtroEstado.set(estado);
    this.cargar();
  }

  protected limpiarFiltros(): void {
    this.filtroEstado.set(null);
    this.filtroBuscar.set('');
    this.filtroDesde.set('');
    this.filtroHasta.set('');
    this.filtroPlan.set(null);
    this.cargar();
  }

  protected abrirDetalle(empresa: FilaEmpresa): void {
    this.empresaSeleccionadaId.set(empresa.id);
  }

  protected cerrarDetalle(): void {
    this.empresaSeleccionadaId.set(null);
  }

  /** Actualiza la fila en memoria con lo que devolvió `PATCH /empresas/:id`
   * desde el panel de detalle — evita releer el listado completo solo
   * porque cambió el rubro/correo/teléfono de una fila. */
  protected onEmpresaActualizada(actualizada: Empresa): void {
    this.filas.update((actuales) =>
      actuales.map((fila) => (fila.id === actualizada.id ? { ...fila, ...actualizada } : fila)),
    );
  }

  protected tonoDe(estado: string): StatusBadgeTone {
    return this.tonoPorEstado[estado as EstadoEmpresa] ?? 'neutral';
  }

  protected etiquetaDe(estado: string): string {
    return ETIQUETA_POR_ESTADO[estado as EstadoEmpresa] ?? estado;
  }
}
