import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IconChevronDown, IconChevronRight, IconRepeat, TablerIconComponent } from '@tabler/icons-angular';
import { forkJoin } from 'rxjs';
import { SuscripcionService } from '../../../../core/catalog/suscripcion.service';
import { EmpresaService } from '../../../../core/catalog/empresa.service';
import { PlanService } from '../../../../core/catalog/plan.service';
import { Suscripcion } from '../../../../core/catalog/models/suscripcion.model';
import { Plan } from '../../../../core/catalog/models/plan.model';
import { PantallaEstadoComponent } from '../../../../shared/ui/pantalla-estado/pantalla-estado.component';
import { GestionarSuscripcionPanelComponent } from '../gestionar-suscripcion-panel/gestionar-suscripcion-panel.component';
import {
  CabeceraModuloComponent,
  MetricaCabecera,
} from '../../../../shared/ui/cabecera-modulo/cabecera-modulo.component';

/** Mismo formato que `formatCop` de Planes / `admin` — repetido a propósito
 * (ver el criterio ya documentado en `PlanesPageComponent`). */
function formatCop(value: number): string {
  return `$${value.toLocaleString('es-CO')}`;
}

type FiltroSuscripciones = 'cobrando' | 'pendiente' | 'vencidas' | 'todas';

interface HitoHistorial {
  suscripcionId: number;
  titulo: string;
  detalle: string;
  monto: string;
  punto: string;
  tinta: string;
}

/** Una fila = una Empresa con su suscripción VIGENTE al frente y el resto
 * del historial detrás. Reemplaza a la vieja `FilaSuscripcion` (que era
 * una fila por registro). */
interface FilaEmpresa {
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
  pie: string;
  estadoTexto: string;
  estadoTinta: string;
  puntoEstado: string;
  montoNota: string;
  accionTexto: string;
  historial: HitoHistorial[];
}

const ESTADO_UI: Record<string, { texto: string; punto: string; tinta: string }> = {
  activa: { texto: 'Cobrando', punto: 'bg-success-solid', tinta: 'text-success-solid' },
  pendiente: { texto: 'Sin cobrar aún', punto: 'bg-badge-warning-solid', tinta: 'text-amber-700' },
  cancelada: { texto: 'Cancelada', punto: 'bg-gray-300', tinta: 'text-gray-500' },
  vencida: { texto: 'Vencida', punto: 'bg-badge-error-solid', tinta: 'text-badge-error-solid' },
};

/**
 * Suscripciones — rediseño del 2026-09-18 ("ingresos por Empresa"),
 * integrado 2026-09-21 (LEEME.md §7, siguiente componente del mismo
 * handoff tras `planes-page`).
 *
 * Dos cambios de tesis respecto de la tabla anterior:
 *
 * 1. **Una fila por Empresa, no por registro.** El historial venía ordenado
 *    por `creadoEn desc` con todas las Empresas mezcladas, así que las dos
 *    suscripciones de una misma Empresa (Básico cancelada → Pro activa)
 *    quedaban separadas por filas de otras Empresas — justo la historia que
 *    uno quiere leer, desarmada. Acá se agrupa por `empresaId`
 *    (`filas()`), la vigente al frente y el resto en una línea de tiempo
 *    que se despliega con el chevron.
 * 2. **Esto es plata.** Es la pantalla de ingresos recurrentes de Goods y no
 *    mostraba dinero en ninguna parte. Ahora cruza `Plan.precioMensual` y
 *    expone el MRR total, el desglose por plan y el monto de cada Empresa.
 *
 * Además:
 * - **Los estados hablan castellano y dicen la consecuencia** (`ESTADO_UI`):
 *   "Cobrando", "Sin cobrar aún" — no `activa`/`pendiente` crudos.
 * - **Orden por facturación**, no por fecha de creación.
 * - **Cambiar de plan muestra el delta ANTES de aplicar**: el cambio cierra
 *   una suscripción y abre otra, es un hecho contable, no un dropdown. El
 *   botón dice "Subir a Empresa", no "Aplicar".
 * - **Ya no usa `ModalComponent`, `p-table`, `dataTablePt()` ni
 *   `DataTableComponent`** (siguen en uso en el resto del panel): el panel
 *   lateral necesita cabecera fija + pie contextual.
 *
 * No hay "crear" ni "eliminar" acá, igual que antes: una Suscripción nace
 * con el alta de una Empresa o con un cambio de plan (que cierra la vieja y
 * abre una nueva, ver `SuscripcionController.cambiarPlan` del backend) —
 * nunca se crea a mano ni se borra, es historial.
 *
 * **A pedido explícito (distinto del resto de los handoffs, que sí traían
 * el panel embebido en el `@if` de la página): el panel de "Mover a otro
 * plan / cambiar el estado" se separó en su propio componente,
 * `GestionarSuscripcionPanelComponent` (`../gestionar-suscripcion-panel/`),
 * mismo patrón que `EmpresaDetallePanelComponent` y
 * `ActivarEmpresaWizardComponent` — un componente por panel, no un `@if`
 * más dentro de la página. Ver el docstring de esa clase para el detalle
 * de qué carga por su cuenta y qué recibe por `input` (`empresaId` y
 * `mrrTotal`).** Esta página le pasa el `empresaId` de la fila elegida y
 * escucha `(cerrar)`/`(actualizada)` — el aviso de éxito y el `cargar()`
 * de refresco siguen viviendo acá — el aviso de éxito ya no (lo muestra el
 * panel directo con `AlertaService`, ver su docstring).
 */
@Component({
  selector: 'app-suscripciones-page',
  standalone: true,
  imports: [TablerIconComponent, GestionarSuscripcionPanelComponent, PantallaEstadoComponent, CabeceraModuloComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './suscripciones-page.component.html',
})
export class SuscripcionesPageComponent {
  private readonly suscripcionService = inject(SuscripcionService);
  private readonly empresaService = inject(EmpresaService);
  private readonly planService = inject(PlanService);
  private readonly router = inject(Router);

  protected readonly formatCop = formatCop;
  protected readonly mostrarDesglose = true;
  protected readonly skeletons = [0, 1, 2, 3, 4];

  protected readonly iconModulo = IconRepeat;
  protected readonly iconAbajo = IconChevronDown;
  protected readonly iconDerecha = IconChevronRight;

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly estadoPantalla = computed<'cargando' | 'error' | 'listo'>(() =>
    this.error() ? 'error' : this.cargando() ? 'cargando' : 'listo',
  );
  protected readonly filtro = signal<FiltroSuscripciones>('cobrando');
  protected readonly desplegadas = signal<Set<number>>(new Set());

  private readonly suscripciones = signal<Suscripcion[]>([]);
  private readonly nombrePorEmpresa = signal<Map<number, string>>(new Map());
  private readonly planesPorId = signal<Map<number, Plan>>(new Map());

  /** Id de la Empresa cuya Suscripción se está gestionando — `null` si el
   * panel está cerrado. Se le pasa tal cual a
   * `GestionarSuscripcionPanelComponent`, que carga el resto por su
   * cuenta (ver el docstring de la clase). */
  protected readonly empresaGestionandoId = signal<number | null>(null);

  /** Una entrada por Empresa: la suscripción vigente (activa/pendiente si
   * existe, si no la más reciente) y el resto como historial. */
  protected readonly filas = computed<FilaEmpresa[]>(() => {
    const planes = this.planesPorId();
    const nombres = this.nombrePorEmpresa();

    const porEmpresa = new Map<number, Suscripcion[]>();
    for (const s of this.suscripciones()) {
      const lista = porEmpresa.get(s.empresaId) ?? [];
      lista.push(s);
      porEmpresa.set(s.empresaId, lista);
    }

    const filas: FilaEmpresa[] = [];
    for (const [empresaId, lista] of porEmpresa) {
      const ordenadas = [...lista].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
      const vigente =
        ordenadas.find((s) => s.estado === 'activa' || s.estado === 'pendiente') ?? ordenadas[0];
      const plan = planes.get(vigente.planId);
      const precio = plan?.precioMensual ?? 0;
      const ui = ESTADO_UI[vigente.estado] ?? ESTADO_UI['cancelada'];
      const cobra = vigente.estado === 'activa';

      filas.push({
        empresaId,
        empresaNombre: nombres.get(empresaId) ?? `Empresa #${empresaId}`,
        suscripcionId: vigente.id,
        planId: vigente.planId,
        planNombre: plan?.nombre ?? `Plan #${vigente.planId}`,
        precioMensual: precio,
        estado: vigente.estado,
        cobra,
        fechaInicio: vigente.fechaInicio,
        fechaFin: vigente.fechaFin,
        pie: this.piePara(vigente, cobra),
        estadoTexto: ui.texto,
        estadoTinta: ui.tinta,
        puntoEstado: ui.punto,
        montoNota: cobra ? 'por mes' : vigente.estado === 'pendiente' ? 'sin facturar' : 'dejó de pagar',
        accionTexto: cobra ? 'Gestionar' : vigente.estado === 'pendiente' ? 'Ver el alta' : 'Recuperar',
        historial: this.historialPara(vigente, ordenadas),
      });
    }
    return filas;
  });

  protected readonly mrrTotal = computed(() =>
    this.filas()
      .filter((f) => f.cobra)
      .reduce((total, f) => total + f.precioMensual, 0),
  );

  protected readonly notaCabecera = computed(() => {
    const cobrando = this.filas().filter((f) => f.cobra).length;
    const total = this.filas().length;
    return `${cobrando} ${cobrando === 1 ? 'Empresa cobrando' : 'Empresas cobrando'} · ${total} ${total === 1 ? 'Empresa en total' : 'Empresas en total'}`;
  });

  protected readonly notaMrr = computed(() => {
    const cobrando = this.filas().filter((f) => f.cobra).length;
    const promedio = cobrando ? Math.round(this.mrrTotal() / cobrando) : 0;
    return `promedio ${formatCop(promedio)} por Empresa`;
  });

  protected readonly desglosePorPlan = computed(() => {
    const total = this.mrrTotal() || 1;
    return [...this.planesPorId().values()]
      .filter((plan) => plan.activo)
      .map((plan) => {
        const enPlan = this.filas().filter((f) => f.cobra && f.planId === plan.id);
        const monto = enPlan.length * (plan.precioMensual ?? 0);
        return {
          planId: plan.id,
          nombre: plan.nombre,
          monto,
          textoConteo: `${enPlan.length} ${enPlan.length === 1 ? 'Empresa' : 'Empresas'}`,
          barra: Math.max(4, Math.round((monto / total) * 56)),
        };
      });
  });

  protected readonly atencion = computed(() => {
    const vencidas = this.filas().filter((f) => f.estado === 'vencida').length;
    const pendientes = this.filas().filter((f) => f.estado === 'pendiente').length;
    if (vencidas) {
      return {
        titulo: `${vencidas} ${vencidas === 1 ? 'suscripción vencida' : 'suscripciones vencidas'}`,
        nota: 'Dejaron de pagar y siguen con acceso.',
      };
    }
    if (pendientes) {
      return {
        titulo: `${pendientes} ${pendientes === 1 ? 'alta sin cobrar' : 'altas sin cobrar'}`,
        nota: 'Esperan que la Empresa se active.',
      };
    }
    return null;
  });

  /** Cabecera compartida (LEEME.md §14) — se lleva el bloque "Facturación
   *  mensual" y el aviso ámbar de abajo: los dos quedan dentro de la
   *  tira de tiles. El filtro de chips (`filtros()`/`filtro`) sigue
   *  aparte, es una dimensión distinta (estado de la fila, no facturación). */
  protected readonly metricasCabecera = computed<MetricaCabecera[]>(() => {
    const metricas: MetricaCabecera[] = [
      {
        id: 'mrr',
        etiqueta: 'Facturación mensual',
        valor: formatCop(this.mrrTotal()),
        tono: 'exito',
        delta: this.notaMrr(),
        deltaTono: 'apagado',
      },
    ];
    if (this.mostrarDesglose) {
      for (const linea of this.desglosePorPlan()) {
        metricas.push({
          id: `plan-${linea.planId}`,
          etiqueta: linea.nombre,
          valor: formatCop(linea.monto),
          delta: linea.textoConteo,
          deltaTono: 'apagado',
        });
      }
    }
    const aviso = this.atencion();
    if (aviso) {
      const vencidas = aviso.titulo.includes('vencida');
      metricas.push({
        id: 'atencion',
        etiqueta: vencidas ? 'Vencidas' : 'Sin cobrar aún',
        valor: aviso.titulo.split(' ')[0],
        tono: vencidas ? 'peligro' : 'aviso',
        delta: aviso.nota.includes('activ') ? 'esperan activación' : 'siguen con acceso',
        deltaTono: vencidas ? 'peligro' : 'aviso',
      });
    }
    return metricas;
  });

  /** Clic en el tile de "atención" filtra la lista de abajo por lo mismo
   *  que describe — el resto de los tiles son solo lectura (facturación). */
  protected metricaCabeceraClick(id: string): void {
    if (id !== 'atencion') {
      return;
    }
    const aviso = this.atencion();
    this.filtro.set(aviso?.titulo.includes('vencida') ? 'vencidas' : 'pendiente');
  }

  protected readonly filtros = computed(() => {
    const filas = this.filas();
    return [
      { clave: 'cobrando' as const, texto: 'Cobrando', contador: filas.filter((f) => f.cobra).length },
      { clave: 'pendiente' as const, texto: 'Sin cobrar aún', contador: filas.filter((f) => f.estado === 'pendiente').length },
      { clave: 'vencidas' as const, texto: 'Vencidas', contador: filas.filter((f) => f.estado === 'vencida').length },
      { clave: 'todas' as const, texto: 'Todas', contador: filas.length },
    ];
  });

  /** Lo que más plata mueve, arriba. */
  protected readonly filasVisibles = computed(() => {
    const filtro = this.filtro();
    const filas = this.filas().filter((f) => {
      if (filtro === 'cobrando') return f.cobra;
      if (filtro === 'pendiente') return f.estado === 'pendiente';
      if (filtro === 'vencidas') return f.estado === 'vencida';
      return true;
    });
    return filas.sort((a, b) => b.precioMensual - a.precioMensual);
  });

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
        this.suscripciones.set(suscripciones.data);
        this.nombrePorEmpresa.set(new Map(empresas.data.map((e) => [e.id, e.nombre])));
        this.planesPorId.set(new Map(planes.data.map((p) => [p.id, p])));
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el historial de suscripciones. Intenta de nuevo.');
        this.cargando.set(false);
      },
    });
  }

  private piePara(vigente: Suscripcion, cobra: boolean): string {
    if (cobra) {
      return `Cliente ${this.antiguedad(vigente.fechaInicio)} · desde el ${this.fechaCorta(vigente.fechaInicio)}`;
    }
    if (vigente.estado === 'pendiente') {
      return 'Se activa cuando el dueño confirme su cuenta';
    }
    return `Última facturación el ${this.fechaCorta(vigente.fechaFin ?? vigente.fechaInicio)}`;
  }

  private historialPara(vigente: Suscripcion, ordenadas: Suscripcion[]): HitoHistorial[] {
    const planes = this.planesPorId();
    const hito = (s: Suscripcion, esVigente: boolean): HitoHistorial => {
      const plan = planes.get(s.planId);
      const ui = ESTADO_UI[s.estado] ?? ESTADO_UI['cancelada'];
      const cobra = s.estado === 'activa';
      const detalle = s.fechaInicio
        ? s.fechaFin
          ? `Del ${this.fechaCorta(s.fechaInicio)} al ${this.fechaCorta(s.fechaFin)}`
          : `Desde el ${this.fechaCorta(s.fechaInicio)} · ${this.antiguedad(s.fechaInicio)}`
        : 'Todavía no arrancó';
      return {
        suscripcionId: s.id,
        titulo: `${plan?.nombre ?? `Plan #${s.planId}`} · ${esVigente && cobra ? 'vigente' : ui.texto.toLowerCase()}`,
        detalle,
        monto: `${formatCop(plan?.precioMensual ?? 0)}/mes`,
        punto: esVigente && cobra ? 'border-success-solid bg-success-solid' : 'border-gray-300 bg-card-bg',
        tinta: esVigente ? 'text-gray-900' : 'text-gray-500',
      };
    };

    return [
      hito(vigente, true),
      ...ordenadas.filter((s) => s.id !== vigente.id).map((s) => hito(s, false)),
    ];
  }

  protected alternarHistorial(empresaId: number): void {
    this.desplegadas.update((actual) => {
      const copia = new Set(actual);
      copia.has(empresaId) ? copia.delete(empresaId) : copia.add(empresaId);
      return copia;
    });
  }

  protected estaDesplegada(empresaId: number): boolean {
    return this.desplegadas().has(empresaId);
  }

  protected abrirGestionar(empresaId: number): void {
    this.empresaGestionandoId.set(empresaId);
  }

  protected cerrarGestionar(): void {
    this.empresaGestionandoId.set(null);
  }

  /** El panel ya aplicó el cambio, mostró su propio aviso de éxito
   * (`AlertaService`) y se cerró solo (ver
   * `GestionarSuscripcionPanelComponent.confirmarCambioPlan`/
   * `confirmarCambioEstado`) — acá solo queda refrescar la lista con los
   * montos/estados nuevos. */
  protected onGestionActualizada(): void {
    this.empresaGestionandoId.set(null);
    this.cargar();
  }

  /** `(reintentar)` de `app-pantalla-estado`. */
  protected reintentar(): void {
    this.cargar();
  }

  /** `(volver)` — mismo criterio que `EmpresasPageComponent.volver()`. */
  protected volver(): void {
    this.router.navigateByUrl('/suscripciones');
  }

  private fechaCorta(fechaIso: string | null): string {
    if (!fechaIso) {
      return '—';
    }
    return new Date(fechaIso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
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
}
