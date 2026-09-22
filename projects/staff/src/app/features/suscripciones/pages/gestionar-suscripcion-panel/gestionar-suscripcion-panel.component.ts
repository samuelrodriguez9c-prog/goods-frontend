import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  IconCheck,
  IconCircleOff,
  IconClockX,
  IconFilePlus,
  IconHistory,
  IconTrendingDown,
  IconTrendingUp,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { forkJoin } from 'rxjs';
import {
  EstadoAsignableSuscripcion,
  SuscripcionService,
} from '../../../../core/catalog/suscripcion.service';
import { EmpresaService } from '../../../../core/catalog/empresa.service';
import { PlanService } from '../../../../core/catalog/plan.service';
import { Plan } from '../../../../core/catalog/models/plan.model';

/** Mismo formato que `formatCop` de `PlanesPageComponent` — repetido a
 * propósito, mismo criterio ya documentado ahí. */
function formatCop(value: number): string {
  return `$${value.toLocaleString('es-CO')}`;
}

/** Mismo mapa que `SuscripcionesPageComponent.ESTADO_UI` — duplicado a
 * propósito (mismo criterio que `TONO_POR_ESTADO`/`ETIQUETA_POR_ESTADO`
 * en `EmpresasPageComponent`/`EmpresaDetallePanelComponent`): este panel
 * carga su propia Suscripción vigente en vez de recibir la fila ya armada
 * de la página, así que necesita su propia traducción de estado. */
const ESTADO_UI: Record<string, { texto: string }> = {
  activa: { texto: 'Cobrando' },
  pendiente: { texto: 'Sin cobrar aún' },
  cancelada: { texto: 'Cancelada' },
  vencida: { texto: 'Vencida' },
};

/** La Suscripción vigente de la Empresa que se está gestionando — versión
 * liviana de la `FilaEmpresa` de la página, sin el historial (ese se ve
 * desplegado en la fila de la lista, no acá). */
interface FilaGestion {
  empresaId: number;
  empresaNombre: string;
  suscripcionId: number;
  planId: number;
  planNombre: string;
  precioMensual: number;
  estado: string;
  cobra: boolean;
  fechaInicio: string | null;
  estadoTexto: string;
}

/**
 * Panel de gestión de una Suscripción — extraído de
 * `SuscripcionesPageComponent` como componente aparte, mismo patrón que
 * `EmpresaDetallePanelComponent` (`features/empresas/pages/`) y
 * `ActivarEmpresaWizardComponent` (`features/altas-pendientes/pages/`):
 * el handoff (LEEME.md §7) traía el panel de "Mover a otro plan / cambiar
 * el estado" como un `@if` más dentro del template de la página, igual
 * que traía `empresa-detalle-panel` y `activar-empresa-wizard` en sus
 * handoffs originales antes de separarlos — acá se separó directamente al
 * integrar, a pedido explícito, para no repetir el paso de "extraerlo
 * después".
 *
 * Mismo criterio de carga que `EmpresaDetallePanelComponent`: recibe solo
 * `[empresaId]` y carga su propia Suscripción vigente, la Empresa y el
 * catálogo de planes — no depende de que la página ya los tenga en
 * memoria. La única excepción es `[mrrTotal]`: la nota del cambio de plan
 * dice a cuánto pasa la facturación mensual de TODO Goods, no solo de
 * esta Empresa, y ese número ya está calculado en la página
 * (`SuscripcionesPageComponent.mrrTotal`) — recalcularlo acá exigiría
 * traer las Suscripciones de todas las Empresas otra vez, por un solo
 * número que la página ya tiene. Se pasa como `input` en vez de
 * recargarlo.
 *
 * `actualizada` emite el mensaje de éxito (para el aviso de la página,
 * que sigue viviendo ahí porque aparece DESPUÉS de que este panel ya se
 * cerró) en vez de un evento vacío — la página lo usa tal cual para el
 * toast y recarga su lista.
 */
@Component({
  selector: 'app-gestionar-suscripcion-panel',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gestionar-suscripcion-panel.component.html',
})
export class GestionarSuscripcionPanelComponent {
  private readonly suscripcionService = inject(SuscripcionService);
  private readonly empresaService = inject(EmpresaService);
  private readonly planService = inject(PlanService);

  readonly empresaId = input.required<number>();
  readonly mrrTotal = input.required<number>();
  readonly cerrar = output<void>();
  readonly actualizada = output<string>();

  protected readonly formatCop = formatCop;
  protected readonly iconCerrar = IconX;
  protected readonly iconTilde = IconCheck;

  protected readonly opcionesEstado: {
    estado: EstadoAsignableSuscripcion;
    texto: string;
    icono: typeof IconCircleOff;
  }[] = [
    { estado: 'cancelada', texto: 'Marcar cancelada', icono: IconCircleOff },
    { estado: 'vencida', texto: 'Marcar vencida', icono: IconClockX },
  ];

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly guardando = signal(false);
  protected readonly errorGestionar = signal<string | null>(null);
  protected readonly nuevoPlanId = signal<number | null>(null);
  protected readonly planesActivos = signal<Plan[]>([]);

  protected readonly fila = signal<FilaGestion | null>(null);
  private readonly planesPorId = signal<Map<number, Plan>>(new Map());

  protected readonly subtituloPanel = computed(() => {
    const fila = this.fila();
    if (!fila) {
      return '';
    }
    return fila.cobra
      ? `${fila.planNombre} · ${formatCop(fila.precioMensual)}/mes · cliente ${this.antiguedad(fila.fechaInicio)}`
      : `${fila.planNombre} · ${fila.estadoTexto.toLowerCase()}`;
  });

  /** El efecto en plata del cambio elegido — `null` si no hay cambio. */
  protected readonly delta = computed(() => {
    const fila = this.fila();
    const nuevoId = this.nuevoPlanId();
    if (!fila || !nuevoId || nuevoId === fila.planId) {
      return null;
    }
    const nuevo = this.planesPorId().get(nuevoId);
    if (!nuevo) {
      return null;
    }
    const diferencia = (nuevo.precioMensual ?? 0) - fila.precioMensual;
    if (!diferencia) {
      return null;
    }
    const sube = diferencia > 0;
    return {
      titulo: `${sube ? '+' : '−'}${formatCop(Math.abs(diferencia)).slice(1)} por mes`,
      nota: `${fila.planNombre} ${formatCop(fila.precioMensual)} → ${nuevo.nombre} ${formatCop(nuevo.precioMensual ?? 0)}. La facturación mensual de Goods pasa a ${formatCop(this.mrrTotal() + diferencia)}.`,
      icono: sube ? IconTrendingUp : IconTrendingDown,
      caja: sube ? 'border-badge-success-bg bg-emerald-50' : 'border-badge-warning-bg bg-[#fffdf2]',
      tinta: sube ? 'text-emerald-900' : 'text-amber-900',
      notaTinta: sube ? 'text-emerald-800' : 'text-amber-800',
      nuevoNombre: nuevo.nombre,
      sube,
    };
  });

  protected readonly consecuencias = computed(() => {
    const fila = this.fila();
    const nuevo = this.nuevoPlanId() ? this.planesPorId().get(this.nuevoPlanId()!) : null;
    return [
      { icono: IconCircleOff, texto: `Se cierra la suscripción a ${fila?.planNombre ?? ''} con fecha de hoy.` },
      { icono: IconFilePlus, texto: `Se abre una nueva a ${nuevo?.nombre ?? ''}, vigente desde hoy.` },
      { icono: IconHistory, texto: 'Las dos quedan en el historial de la Empresa — nada se borra.' },
    ];
  });

  protected readonly textoBotonAplicar = computed(() => {
    if (this.guardando()) {
      return 'Aplicando…';
    }
    const d = this.delta();
    return d ? `${d.sube ? 'Subir a ' : 'Bajar a '}${d.nuevoNombre}` : 'Aplicar el cambio';
  });

  constructor() {
    effect(() => {
      this.cargar(this.empresaId());
    });
  }

  private cargar(id: number): void {
    this.cargando.set(true);
    this.error.set(null);

    forkJoin({
      suscripciones: this.suscripcionService.listar(undefined, id),
      empresa: this.empresaService.obtenerUno(id),
      planes: this.planService.listarTodos(),
    }).subscribe({
      next: ({ suscripciones, empresa, planes }) => {
        const planesPorId = new Map(planes.data.map((p) => [p.id, p]));
        this.planesPorId.set(planesPorId);
        this.planesActivos.set(planes.data.filter((p) => p.activo));

        const ordenadas = [...suscripciones.data].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
        const vigente = ordenadas.find((s) => s.estado === 'activa' || s.estado === 'pendiente') ?? ordenadas[0];

        if (!vigente) {
          this.fila.set(null);
          this.error.set('Esta Empresa no tiene ninguna Suscripción todavía.');
          this.cargando.set(false);
          return;
        }

        const plan = planesPorId.get(vigente.planId);
        const ui = ESTADO_UI[vigente.estado] ?? ESTADO_UI['cancelada'];
        const nueva: FilaGestion = {
          empresaId: id,
          empresaNombre: empresa.nombre,
          suscripcionId: vigente.id,
          planId: vigente.planId,
          planNombre: plan?.nombre ?? `Plan #${vigente.planId}`,
          precioMensual: plan?.precioMensual ?? 0,
          estado: vigente.estado,
          cobra: vigente.estado === 'activa',
          fechaInicio: vigente.fechaInicio,
          estadoTexto: ui.texto,
        };
        this.fila.set(nueva);
        this.nuevoPlanId.set(nueva.planId);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar la Suscripción. Intenta de nuevo.');
        this.cargando.set(false);
      },
    });
  }

  protected resumenPlan(plan: Plan): string {
    const cs = plan.caracteristicas ?? [];
    if (!cs.length) {
      return plan.descripcion ?? 'Sin características cargadas';
    }
    return cs.length <= 3 ? cs.join(' · ') : `${cs.slice(0, 2).join(' · ')} y ${cs.length - 2} más`;
  }

  protected confirmarCambioPlan(): void {
    const fila = this.fila();
    const planId = this.nuevoPlanId();
    const d = this.delta();
    if (!fila || !planId || !d || this.guardando()) {
      return;
    }

    this.guardando.set(true);
    this.errorGestionar.set(null);
    this.suscripcionService.cambiarPlan(fila.empresaId, planId).subscribe({
      next: () => {
        this.guardando.set(false);
        this.actualizada.emit(`${fila.empresaNombre} pasó a ${d.nuevoNombre}.`);
      },
      error: (err: unknown) => {
        this.guardando.set(false);
        this.errorGestionar.set(this.mensajeDeError(err));
      },
    });
  }

  protected confirmarCambioEstado(estado: EstadoAsignableSuscripcion): void {
    const fila = this.fila();
    if (!fila || estado === fila.estado || this.guardando()) {
      return;
    }

    this.guardando.set(true);
    this.errorGestionar.set(null);
    this.suscripcionService.cambiarEstado(fila.suscripcionId, estado).subscribe({
      next: () => {
        this.guardando.set(false);
        this.actualizada.emit(
          estado === 'cancelada' ? 'Suscripción cancelada.' : 'Suscripción marcada como vencida.',
        );
      },
      error: (err: unknown) => {
        this.guardando.set(false);
        this.errorGestionar.set(this.mensajeDeError(err));
      },
    });
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cerrar.emit();
    }
  }

  private antiguedad(fechaIso: string | null): string {
    if (!fechaIso) {
      return 'recién';
    }
    const inicio = new Date(fechaIso);
    const hoy = new Date();
    const meses = (hoy.getFullYear() - inicio.getFullYear()) * 12 + (hoy.getMonth() - inicio.getMonth());
    if (meses <= 0) {
      return 'este mes';
    }
    if (meses < 12) {
      return `hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
    }
    const anios = Math.floor(meses / 12);
    return `hace ${anios} ${anios === 1 ? 'año' : 'años'}`;
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
