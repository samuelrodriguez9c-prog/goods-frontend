import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  IconCheck,
  IconCircleOff,
  IconClockX,
  IconCopy,
  IconFilePlus,
  IconHistory,
  IconLockOpen,
  IconPlayerPlay,
  IconPuzzle,
  IconTrendingDown,
  IconTrendingUp,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { forkJoin, of, switchMap } from 'rxjs';
import {
  EstadoAsignableSuscripcion,
  SuscripcionService,
} from '../../../../core/catalog/suscripcion.service';
import { EmpresaService } from '../../../../core/catalog/empresa.service';
import { PlanService } from '../../../../core/catalog/plan.service';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { PistaService } from '../../../../core/ui/pista.service';
import { ModuloService } from '../../../../core/catalog/modulo.service';
import { PantallaEstadoComponent } from '../../../../shared/ui/pantalla-estado/pantalla-estado.component';
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
  fechaFin: string | null;
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
 * `actualizada` — desde la integración del sistema de alertas transversal
 * (LEEME.md §12), el aviso de éxito ya no lo da la página: lo muestra este
 * panel directo con `AlertaService.seguir()` (misma pila que el resto del
 * staff), así que `actualizada` volvió a ser un evento vacío — la página
 * solo lo usa para recargar su lista.
 *
 * Rediseño 2026-09-27 — reactivar: si la Suscripción vigente está
 * `vencida` o `cancelada`, el mismo selector de planes pasa a ser
 * "Reactivar con un plan" (preseleccionado el último), con aviso arriba,
 * delta de cobro y consecuencias propias. Mismo plan →
 * `cambiarEstado(id, 'activa')`; otro plan → reactiva y después
 * `cambiarPlan()` (ver LEEME §19: conviene un `POST /reactivar` atómico).
 * La cabecera suma ID copiable y franja Estado · Plan · Cobro/Sin acceso.
 */
@Component({
  selector: 'app-gestionar-suscripcion-panel',
  standalone: true,
  imports: [TablerIconComponent, PantallaEstadoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gestionar-suscripcion-panel.component.html',
})
export class GestionarSuscripcionPanelComponent {
  private readonly suscripcionService = inject(SuscripcionService);
  private readonly empresaService = inject(EmpresaService);
  private readonly planService = inject(PlanService);
  private readonly alertas = inject(AlertaService);
  private readonly pista = inject(PistaService);
  private readonly moduloService = inject(ModuloService);

  readonly empresaId = input.required<number>();
  readonly mrrTotal = input.required<number>();
  readonly cerrar = output<void>();
  readonly actualizada = output<void>();

  protected readonly formatCop = formatCop;
  protected readonly iconCerrar = IconX;
  protected readonly iconTilde = IconCheck;
  protected readonly iconCopiar = IconCopy;
  protected readonly iconReactivar = IconPlayerPlay;

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
  protected readonly estadoPantalla = computed<'cargando' | 'error' | 'listo'>(() =>
    this.error() ? 'error' : this.cargando() ? 'cargando' : 'listo',
  );
  protected readonly guardando = signal(false);
  protected readonly errorGestionar = signal<string | null>(null);
  protected readonly nuevoPlanId = signal<number | null>(null);
  protected readonly planesActivos = signal<Plan[]>([]);

  protected readonly fila = signal<FilaGestion | null>(null);
  private readonly planesPorId = signal<Map<number, Plan>>(new Map());
  /** Cantidad de excepciones de módulos — solo para la consecuencia de reactivar. */
  private readonly excepciones = signal(0);

  protected readonly inactiva = computed(() => {
    const e = this.fila()?.estado;
    return e === 'vencida' || e === 'cancelada';
  });

  protected readonly estadosDisponibles = computed(() =>
    this.opcionesEstado.filter((o) => o.estado !== this.fila()?.estado),
  );

  /** Aviso de la cabecera del cuerpo cuando está vencida/cancelada. */
  protected readonly aviso = computed(() => {
    const fila = this.fila();
    if (!fila || !this.inactiva()) {
      return null;
    }
    const fecha = this.fechaCorta(fila.fechaFin);
    return fila.estado === 'vencida'
      ? { titulo: fecha ? `Vencida desde el ${fecha}` : 'Vencida', icono: IconClockX, caja: 'border-badge-warning-bg bg-[#fffdf2]', tinta: 'text-amber-800' }
      : { titulo: fecha ? `Cancelada el ${fecha}` : 'Cancelada', icono: IconCircleOff, caja: 'border-gray-200 bg-neutral-100', tinta: 'text-gray-600' };
  });

  /** Franja de datos de la cabecera. */
  protected readonly celdas = computed(() => {
    const fila = this.fila();
    if (!fila) {
      return [];
    }
    if (this.inactiva()) {
      return [
        { etiqueta: 'Estado', valor: fila.estadoTexto },
        { etiqueta: 'Último plan', valor: fila.planNombre },
        { etiqueta: 'Sin acceso', valor: this.haceCuanto(fila.fechaFin) },
      ];
    }
    return [
      { etiqueta: 'Estado', valor: fila.estadoTexto },
      { etiqueta: 'Plan', valor: fila.planNombre },
      { etiqueta: 'Mensual', valor: formatCop(fila.precioMensual) },
    ];
  });

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
    if (!fila || !nuevoId) {
      return null;
    }
    const nuevo = this.planesPorId().get(nuevoId);
    if (!nuevo) {
      return null;
    }
    if (this.inactiva()) {
      const dif = (nuevo.precioMensual ?? 0) - fila.precioMensual;
      return {
        titulo: `Vuelve a cobrar ${formatCop(nuevo.precioMensual ?? 0)}/mes`,
        nota:
          dif === 0
            ? `Mismo plan que tenía. Arranca hoy; la facturación de Goods pasa a ${formatCop(this.mrrTotal() + (nuevo.precioMensual ?? 0))}.`
            : `${dif > 0 ? '+' : '−'}${formatCop(Math.abs(dif)).slice(1)} frente al último plan (${fila.planNombre}). Arranca hoy.`,
        icono: IconPlayerPlay,
        caja: 'border-badge-success-bg bg-emerald-50',
        tinta: 'text-emerald-900',
        notaTinta: 'text-emerald-800',
        nuevoNombre: nuevo.nombre,
        sube: true,
      };
    }
    if (nuevoId === fila.planId) {
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
    if (this.inactiva()) {
      const n = this.excepciones();
      return [
        { icono: IconLockOpen, texto: 'El cliente recupera el acceso al instante, con los mismos usuarios y datos.' },
        { icono: IconHistory, texto: `Queda activa a ${nuevo?.nombre ?? ''} desde hoy; la ${fila?.estado ?? ''} sigue en el historial.` },
        { icono: IconPuzzle, texto: n ? `Se mantienen sus ${n} excepciones de módulos.` : 'No tiene excepciones de módulos.' },
      ];
    }
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
    if (this.inactiva()) {
      return d ? `Reactivar con ${d.nuevoNombre}` : 'Reactivar';
    }
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
      modulos: this.moduloService.listarDesglose(id),
    }).subscribe({
      next: ({ suscripciones, empresa, planes, modulos }) => {
        this.excepciones.set(modulos.filter((m) => !!m.override).length);
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
          fechaFin: vigente.fechaFin,
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

  /** `(reintentar)` de `app-pantalla-estado` — vuelve a pedir el mismo id. */
  protected reintentar(): void {
    this.cargar(this.empresaId());
  }

  protected resumenPlan(plan: Plan): string {
    const cs = plan.caracteristicas ?? [];
    if (!cs.length) {
      return plan.descripcion ?? 'Sin características cargadas';
    }
    return cs.length <= 3 ? cs.join(' · ') : `${cs.slice(0, 2).join(' · ')} y ${cs.length - 2} más`;
  }

  /** Botón principal: reactiva si está vencida/cancelada, si no cambia de plan. */
  protected aplicar(): void {
    if (this.inactiva()) {
      this.confirmarReactivar();
    } else {
      this.confirmarCambioPlan();
    }
  }

  protected confirmarReactivar(): void {
    const fila = this.fila();
    const planId = this.nuevoPlanId();
    const d = this.delta();
    if (!fila || !planId || !d || this.guardando()) {
      return;
    }
    const peticion = this.suscripcionService
      .cambiarEstado(fila.suscripcionId, 'activa')
      .pipe(switchMap((s) => (planId === fila.planId ? of(s) : this.suscripcionService.cambiarPlan(fila.empresaId, planId))));

    this.guardando.set(true);
    this.errorGestionar.set(null);
    this.alertas
      .seguir(peticion, {
        titulo: 'Reactivando la suscripción',
        texto: fila.empresaNombre,
        exito: { titulo: `${fila.empresaNombre} reactivada con ${d.nuevoNombre}` },
        error: { titulo: 'No se pudo reactivar', texto: 'Intenta de nuevo.' },
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.actualizada.emit();
        },
        error: (err: unknown) => {
          this.guardando.set(false);
          this.errorGestionar.set(this.mensajeDeError(err));
        },
      });
  }

  protected copiarId(): void {
    const id = this.empresaId();
    navigator.clipboard?.writeText(String(id));
    this.pista.hecho(`ID #${id} copiado`);
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
    this.alertas
      .seguir(this.suscripcionService.cambiarPlan(fila.empresaId, planId), {
        titulo: 'Aplicando el cambio de plan',
        texto: fila.empresaNombre,
        exito: { titulo: `${fila.empresaNombre} pasó a ${d.nuevoNombre}` },
        error: { titulo: 'No se pudo aplicar el cambio', texto: 'Intenta de nuevo.' },
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.actualizada.emit();
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
    this.alertas
      .seguir(this.suscripcionService.cambiarEstado(fila.suscripcionId, estado), {
        titulo: estado === 'cancelada' ? 'Cancelando la suscripción' : 'Marcando como vencida',
        texto: fila.empresaNombre,
        exito: {
          titulo: estado === 'cancelada' ? 'Suscripción cancelada' : 'Suscripción marcada como vencida',
        },
        error: { titulo: 'No se pudo actualizar el estado', texto: 'Intenta de nuevo.' },
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.actualizada.emit();
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

  private fechaCorta(fechaIso: string | null): string {
    return fechaIso
      ? new Date(fechaIso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
      : '';
  }

  private haceCuanto(fechaIso: string | null): string {
    if (!fechaIso) {
      return '—';
    }
    const dias = Math.max(0, Math.floor((Date.now() - new Date(fechaIso).getTime()) / 86_400_000));
    if (dias === 0) return 'desde hoy';
    if (dias < 60) return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
    return `hace ${Math.floor(dias / 30)} meses`;
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
