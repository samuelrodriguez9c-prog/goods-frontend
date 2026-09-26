import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { Paginator, PaginatorState } from 'primeng/paginator';
import {
  IconArrowRight,
  IconBolt,
  IconBuilding,
  IconChevronRight,
  IconDownload,
  IconPlus,
  IconSortAscending,
  IconSortDescending,
  TablerIconComponent,
} from '@tabler/icons-angular';
import {
  AppliedFilterChip,
  SearchToolbarComponent,
  StatusBadgeComponent,
  StatusBadgeTone,
  filterSelectPt,
  paginatorPt,
} from 'shared-ui';
import { forkJoin } from 'rxjs';
import { Router } from '@angular/router';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { PantallaEstadoComponent } from '../../../../shared/ui/pantalla-estado/pantalla-estado.component';
import {
  CabeceraModuloComponent,
  MetricaCabecera,
  recientes,
  serieAcumulada,
} from '../../../../shared/ui/cabecera-modulo/cabecera-modulo.component';
import { EmpresaService } from '../../../../core/catalog/empresa.service';
import { PlanService } from '../../../../core/catalog/plan.service';
import { SuscripcionService } from '../../../../core/catalog/suscripcion.service';
import { construirMapaPlanPorEmpresa } from '../../../../core/catalog/plan-lookup.util';
import { Empresa, EstadoEmpresa } from '../../../../core/catalog/models/empresa.model';
import { EmpresaDetallePanelComponent } from '../empresa-detalle-panel/empresa-detalle-panel.component';
import { ActivarEmpresaWizardComponent } from '../../../altas-pendientes/pages/activar-empresa-wizard/activar-empresa-wizard.component';

/** Los 7 estados reales (ver `EstadoEmpresa`), en el mismo orden en que
 * recorre el flujo de alta asistida (§1/§5.1 de
 * PROPUESTA_FLUJO_ALTA_ASISTIDA.md) — es el orden del `p-select` de
 * estado de §3.1. */
const TODOS_LOS_ESTADOS: EstadoEmpresa[] = [
  'solicitud_recibida',
  'pendiente',
  'informacion_corroborada',
  'activa',
  'rechazada',
  'suspendida',
  'cancelada',
];

/** Los 3 estados del flujo de alta todavía sin terminar — base del
 * embudo, de "N esperando revisión"/"la más vieja espera" del header, y
 * de la urgencia/orden por defecto de la lista. */
const EN_ALTA: EstadoEmpresa[] = ['solicitud_recibida', 'pendiente', 'informacion_corroborada'];
const GRUPO_ACTIVA: EstadoEmpresa[] = ['activa'];
const INACTIVAS: EstadoEmpresa[] = ['suspendida', 'rechazada', 'cancelada'];

/** Días de espera a partir de los cuales una fila "en alta" se marca en
 * ámbar — confirmado con el cliente al integrar el segundo handoff de
 * diseño de esta pantalla (2026-09-17). */
const UMBRAL_ESPERA_DIAS = 10;


const TONO_POR_ESTADO: Record<EstadoEmpresa, StatusBadgeTone> = {
  solicitud_recibida: 'neutral',
  pendiente: 'warning',
  // Antes 'warning' (no existía el tono 'info' todavía) — se corrige acá
  // de paso porque ya no describe bien el estado: la llamada ya se hizo,
  // no hay nada pendiente del lado del staff, solo se espera al cliente.
  informacion_corroborada: 'info',
  activa: 'success',
  rechazada: 'critical',
  suspendida: 'critical',
  cancelada: 'neutral',
};

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
 * Próximo paso por fila — el segundo handoff de diseño (2026-09-17)
 * traía esto como una suposición propia del autor del handoff, no como
 * un reflejo del flujo real ya aprobado por gerencia
 * (PROPUESTA_FLUJO_ALTA_ASISTIDA.md §1): asumía que en
 * `informacion_corroborada` todavía faltaba llamar al dueño, cuando en
 * realidad esa llamada YA se hizo para llegar a ese estado — ahí se está
 * esperando que el cliente confirme por el enlace que se le mandó.
 * Decisiones confirmadas con el cliente al integrar este handoff:
 * - `solicitud_recibida` → un solo clic que manda la Empresa a la cola
 *   de Altas pendientes (`EmpresaService.enviarAAltasPendientes`), sin
 *   abrir ningún asistente.
 * - `pendiente` → abre `ActivarEmpresaWizardComponent` (§4/§11 Paso 3),
 *   que YA estaba construido de una tarea anterior — esta pantalla solo
 *   necesitaba engancharlo, no construirlo de nuevo.
 * - `informacion_corroborada` → sin botón, es de solo lectura (ver
 *   `esEsperandoCliente` más abajo) — retomar esa Empresa (reenviar el
 *   enlace, rechazarla) se hace desde "Altas pendientes", que ya la
 *   muestra con esta misma etiqueta.
 * - `suspendida` → sin próximo paso — el handoff suponía "Revisar el
 *   pago", pero no existe ninguna pantalla de facturación todavía.
 */
const PASO: Partial<Record<EstadoEmpresa, string>> = {
  solicitud_recibida: 'Mandar a Altas pendientes',
  pendiente: 'Llamar / verificar datos',
};

interface FilaEmpresa extends Empresa {
  /** `null` cuando no hay una Suscripción en estado 'activa' para esta
   * Empresa — ver `construirMapaPlanPorEmpresa`. */
  planNombre: string | null;
}

const FILAS_POR_PAGINA = 10;

type Orden = 'urgencia' | 'desc' | 'asc';

/**
 * Listado de Empresas (clientes de Goods) — núcleo del panel de staff.
 * Incluye TODOS los estados (los 7 de `EstadoEmpresa`) — a diferencia de
 * "Altas pendientes" (`features/altas-pendientes/`), acá no hay cola de
 * trabajo, es la vista general + el panel de detalle de solo lectura
 * (clic en una fila) + acceso directo al próximo paso de cada Empresa
 * en alta (clic en el botón de la derecha de la fila).
 *
 * El plan de cada fila no viene de `GET /empresas` (esa tabla no lo
 * tiene — el plan vive en `Suscripcion`, historial aparte): se resuelve
 * cruzando `GET /suscripciones?estado=activa` + `GET /planes/todos` en
 * memoria — ver `construirMapaPlanPorEmpresa`.
 *
 * Segundo rediseño 2026-09-17, sobre un segundo handoff de diseño que
 * reemplaza tarjetas de métricas clicables por un "embudo de alta"
 * (barras proporcionales al conteo de cada etapa, ver ADMIN_DISENO.md >
 * "Barra de búsqueda y filtros" para el detalle completo de qué cambió
 * y por qué, incluidas las correcciones de flujo real y el próximo paso
 * de cada fila).
 *
 * `EmpresaService.listar()` ya trae `pageSize=100` de una, así que
 * alcanza para traer todo de una sola vez y resolver estado/plan/
 * búsqueda/orden/paginación en memoria con `computed()`.
 */
@Component({
  selector: 'app-empresas-page',
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    StatusBadgeComponent,
    SearchToolbarComponent,
    Select,
    Paginator,
    TablerIconComponent,
    EmpresaDetallePanelComponent,
    ActivarEmpresaWizardComponent,
    PantallaEstadoComponent,
    CabeceraModuloComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './empresas-page.component.html',
})
export class EmpresasPageComponent {
  private readonly empresaService = inject(EmpresaService);
  private readonly suscripcionService = inject(SuscripcionService);
  private readonly planService = inject(PlanService);
  private readonly alertas = inject(AlertaService);
  private readonly router = inject(Router);

  protected readonly selectPt = filterSelectPt();
  protected readonly paginatorPt = paginatorPt();
  protected readonly tonoPorEstado = TONO_POR_ESTADO;
  protected readonly hoy = new Date();

  protected readonly iconEmpresas = IconBuilding;
  protected readonly iconDescargar = IconDownload;
  protected readonly iconAgregar = IconPlus;
  protected readonly iconChevron = IconChevronRight;
  protected readonly iconOrdenDesc = IconSortDescending;
  protected readonly iconOrdenAsc = IconSortAscending;
  protected readonly iconUrgencia = IconBolt;
  protected readonly iconProximoPaso = IconArrowRight;

  protected readonly opcionesEstado = [
    { label: 'Estado: todos', value: null },
    ...TODOS_LOS_ESTADOS.map((estado) => ({ label: ETIQUETA_POR_ESTADO[estado], value: estado })),
  ];

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly filas = signal<FilaEmpresa[]>([]);
  protected readonly skeletons = [1, 2, 3, 4, 5, 6];

  /** Estado para `app-pantalla-estado` (LEEME.md §12, integrado
   *  2026-09-22) — el esqueleto de abajo sigue siendo el de ESTA página
   *  (embudo + toolbar + filas), proyectado en `[esqueleto]`. */
  protected readonly estadoPantalla = computed<'cargando' | 'error' | 'listo'>(() =>
    this.error() ? 'error' : this.cargando() ? 'cargando' : 'listo',
  );

  // --- Filtros (todos en memoria) -------------------------------------------
  protected readonly filtroBuscar = signal('');
  protected readonly filtroEstados = signal<EstadoEmpresa[] | null>(null);
  protected readonly filtroPlan = signal<string | null>(null);
  protected readonly orden = signal<Orden>('urgencia');
  protected readonly primeraFila = signal(0);

  // Panel de detalle de solo lectura (clic en la fila) — `null` = cerrado.
  protected readonly empresaSeleccionadaId = signal<number | null>(null);
  // Asistente de activación (§4/§11 Paso 3) — `null` = cerrado. Mismo
  // patrón que `AltasPendientesPageComponent.empresaSeleccionadaWizard`.
  protected readonly empresaSeleccionadaWizard = signal<number | null>(null);
  // Id de la fila con un "Mandar a Altas pendientes" en curso, para
  // deshabilitar el botón y evitar doble clic mientras responde el server.
  protected readonly enviandoAAltas = signal<number | null>(null);

  protected readonly totalEmpresas = computed(() => this.filas().length);
  protected readonly conteoEnAlta = computed(() => this.contar(EN_ALTA));
  protected readonly conteoActivas = computed(() => this.contar(GRUPO_ACTIVA));
  protected readonly conteoInactivas = computed(() => this.contar(INACTIVAS));

  protected readonly esperaMaximaDias = computed(() =>
    Math.max(0, ...this.filas().filter((f) => EN_ALTA.includes(f.estado)).map((f) => this.dias(f.creadoEn))),
  );

  protected readonly esperaMaximaTexto = computed(() => {
    const d = this.esperaMaximaDias();
    return d === 1 ? '1 día' : `${d} días`;
  });

  /** Cabecera compartida (LEEME.md §14, migrada a v2 —badge + líneas—
   *  por LEEME.md §16, 2026-09-24). Un tile por cada etapa del embudo que
   *  reemplaza, en el mismo orden y con los mismos colores: gris para
   *  "solicitud sin tocar", ámbar para "el staff tiene que llamar"
   *  (`pendiente` — el handoff original se olvidaba de este estado, igual
   *  que el anterior se había olvidado de incluirlo en sus tarjetas de
   *  métricas), `info` para "ya se llamó, esperando al cliente", verde
   *  para activa — más "Inactivas" y "Espera máxima". `alternarEtapa`/
   *  `alternarInactivas` de antes pasan a `alternarMetrica(id)` más abajo.
   *  `trazo` en Solicitudes/Activas: colores puntuales de la tabla del
   *  §16, ver el comentario de `porEstado`. */
  protected readonly metricasCabecera = computed<MetricaCabecera[]>(() => {
    const todas = this.filas();
    // `trazo` opcional: LEEME.md §16 pide colores puntuales para
    // Solicitudes/Activas que no salen del `tono` (Solicitudes va en
    // ámbar oscuro y no en el gris de `tono: 'neutro'`; Activas va en un
    // verde más oscuro que el `exito` por defecto) — el resto de las
    // etapas ya coincide con el trazo por defecto de su tono.
    const porEstado = (estado: EstadoEmpresa, etiqueta: string, tono: MetricaCabecera['tono'], trazo?: string) => {
      const fechas = todas.filter((f) => f.estado === estado).map((f) => f.creadoEn);
      const n = recientes(fechas);
      return {
        id: estado,
        etiqueta,
        valor: fechas.length,
        tono,
        trazo,
        serie: serieAcumulada(fechas),
        delta: n ? `+${n} esta semana` : null,
      };
    };

    const inactivasFechas = todas.filter((f) => INACTIVAS.includes(f.estado)).map((f) => f.creadoEn);
    const nInactivas = recientes(inactivasFechas);

    // Sin tile de "Espera máxima": con las 4 etapas + Inactivas ya son 5
    // tiles, el máximo cómodo a este ancho (LEEME.md §14, nota 3). La
    // espera máxima sigue visible en la lectura de abajo (`esperaMaximaTexto`)
    // y en el botón "Por urgencia" del listado — no se pierde información.
    return [
      porEstado('solicitud_recibida', 'Solicitudes', 'neutro', '#78350f'),
      porEstado('pendiente', 'Pendientes', 'aviso'),
      porEstado('informacion_corroborada', 'Corroboradas', 'info'),
      porEstado('activa', 'Activas', 'exito', '#064e3b'),
      {
        id: 'inactivas',
        etiqueta: 'Inactivas',
        valor: inactivasFechas.length,
        tono: 'apagado',
        serie: serieAcumulada(inactivasFechas),
        delta: nInactivas ? `+${nInactivas} esta semana` : null,
      },
    ];
  });

  /** id del tile activo en la cabecera — `null` limpia el resaltado. */
  protected readonly metricaActivaCabecera = computed<string | null>(() => {
    const filtro = this.filtroEstados();
    if (filtro === null) {
      return null;
    }
    if (mismoGrupo(filtro, INACTIVAS)) {
      return 'inactivas';
    }
    return filtro.length === 1 ? filtro[0] : null;
  });

  /** El `p-select` de estado puntual solo muestra un valor seleccionado
   * cuando `filtroEstados` es exactamente UN estado. */
  protected readonly estadoSeleccionadoUnico = computed<EstadoEmpresa | null>(() => {
    const estados = this.filtroEstados();
    return estados && estados.length === 1 ? estados[0] : null;
  });

  protected readonly planesDisponibles = computed(() => {
    const nombres = new Set<string>();
    for (const fila of this.filas()) {
      if (fila.planNombre) {
        nombres.add(fila.planNombre);
      }
    }
    return [...nombres].sort().map((nombre) => ({ label: nombre, value: nombre }));
  });

  protected readonly filasFiltradas = computed(() => {
    const term = this.filtroBuscar().trim().toLowerCase();
    const estados = this.filtroEstados();
    const plan = this.filtroPlan();

    const filtradas = this.filas().filter((e) => {
      if (estados && !estados.includes(e.estado)) return false;
      if (plan && e.planNombre !== plan) return false;
      if (!term) return true;
      return `${e.nombre} ${e.correoContacto} ${e.rubro ?? ''}`.toLowerCase().includes(term);
    });

    if (this.orden() === 'urgencia') {
      // Lo que espera trabajo del staff primero (en alta), después lo
      // suspendido (posible problema de pago), el resto al final — y
      // dentro de cada grupo, lo más viejo arriba.
      const peso = (e: FilaEmpresa) => (EN_ALTA.includes(e.estado) ? 0 : e.estado === 'suspendida' ? 1 : 2);
      return [...filtradas].sort(
        (a, b) => peso(a) - peso(b) || new Date(a.creadoEn).getTime() - new Date(b.creadoEn).getTime(),
      );
    }

    const signo = this.orden() === 'asc' ? 1 : -1;
    return [...filtradas].sort(
      (a, b) => signo * (new Date(a.creadoEn).getTime() - new Date(b.creadoEn).getTime()),
    );
  });

  protected readonly totalFiltradas = computed(() => this.filasFiltradas().length);

  protected readonly filasPaginadas = computed(() =>
    this.filasFiltradas().slice(this.primeraFila(), this.primeraFila() + FILAS_POR_PAGINA),
  );

  protected readonly filasPorPagina = FILAS_POR_PAGINA;

  protected readonly resumenResultados = computed(() => {
    const n = this.totalFiltradas();
    return `${n} ${n === 1 ? 'resultado' : 'resultados'}`;
  });

  protected readonly rangoVisible = computed(() => {
    const total = this.totalFiltradas();
    if (!total) return 'Sin resultados';
    const desde = this.primeraFila() + 1;
    const hasta = Math.min(this.primeraFila() + FILAS_POR_PAGINA, total);
    return `${desde}–${hasta} de ${total}`;
  });

  protected readonly iconoOrden = computed(() => {
    switch (this.orden()) {
      case 'urgencia':
        return this.iconUrgencia;
      case 'desc':
        return this.iconOrdenDesc;
      default:
        return this.iconOrdenAsc;
    }
  });

  protected readonly etiquetaOrden = computed(() => {
    switch (this.orden()) {
      case 'urgencia':
        return 'Por urgencia';
      case 'desc':
        return 'Más recientes';
      default:
        return 'Más antiguas';
    }
  });

  protected readonly filtrosAplicados = computed<AppliedFilterChip[]>(() => {
    const chips: AppliedFilterChip[] = [];
    const estados = this.filtroEstados();
    if (estados && estados.length === 1) {
      chips.push({ key: 'estado', label: `Estado: ${ETIQUETA_POR_ESTADO[estados[0]]}` });
    } else if (estados) {
      chips.push({ key: 'estado', label: `Estado: ${estados.map((e) => ETIQUETA_POR_ESTADO[e]).join(', ')}` });
    }
    if (this.filtroPlan()) {
      chips.push({ key: 'plan', label: `Plan: ${this.filtroPlan()}` });
    }
    return chips;
  });

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

  private contar(estados: EstadoEmpresa[]): number {
    return this.filas().filter((f) => estados.includes(f.estado)).length;
  }

  private dias(fecha: string): number {
    return Math.round((Date.now() - new Date(fecha).getTime()) / 86_400_000);
  }

  private reset(): void {
    this.primeraFila.set(0);
  }

  protected onBuscarChange(valor: string): void {
    this.filtroBuscar.set(valor);
    this.reset();
  }

  protected onEstadoChange(estado: EstadoEmpresa | null): void {
    this.filtroEstados.set(estado ? [estado] : null);
    this.reset();
  }

  protected onPlanChange(plan: string | null): void {
    this.filtroPlan.set(plan);
    this.reset();
  }

  /** Clic en un tile de la cabecera — cada uno es un estado real o el
   *  grupo "Inactivas". */
  protected alternarMetrica(id: string): void {
    if (id === 'inactivas') {
      this.filtroEstados.update((actual) => (mismoGrupo(actual, INACTIVAS) ? null : INACTIVAS));
      this.reset();
      return;
    }
    const estado = id as EstadoEmpresa;
    this.filtroEstados.update((actual) => (mismoGrupo(actual, [estado]) ? null : [estado]));
    this.reset();
  }

  protected quitarFiltro(clave: string): void {
    if (clave === 'estado') {
      this.filtroEstados.set(null);
    } else if (clave === 'plan') {
      this.filtroPlan.set(null);
    }
    this.reset();
  }

  protected limpiarFiltros(): void {
    this.filtroBuscar.set('');
    this.filtroEstados.set(null);
    this.filtroPlan.set(null);
    this.reset();
  }

  protected alternarOrden(): void {
    this.orden.update((o) => (o === 'urgencia' ? 'desc' : o === 'desc' ? 'asc' : 'urgencia'));
    this.reset();
  }

  protected onPagina(event: PaginatorState): void {
    this.primeraFila.set(event.first ?? 0);
  }

  protected iniciales(nombre: string): string {
    return nombre
      .split(' ')
      .filter((w) => w.length > 2)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }

  protected esUrgente(fila: FilaEmpresa): boolean {
    return EN_ALTA.includes(fila.estado) && this.dias(fila.creadoEn) >= UMBRAL_ESPERA_DIAS;
  }

  protected textoEspera(fila: FilaEmpresa): string {
    if (EN_ALTA.includes(fila.estado)) {
      const d = this.dias(fila.creadoEn);
      return d <= 0 ? 'Hoy' : d === 1 ? '1 día esperando' : `${d} días esperando`;
    }
    if (fila.estado === 'activa') {
      return `Cliente desde ${new Date(fila.creadoEn).toLocaleDateString('es', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })}`;
    }
    return 'Sin actividad';
  }

  /** Texto + acción del botón de la derecha — `null` cuando ese estado no
   * tiene un próximo paso accionable (ver el comentario de `PASO`). */
  protected proximoPaso(fila: FilaEmpresa): string | null {
    return PASO[fila.estado] ?? null;
  }

  /** `informacion_corroborada` sí tiene algo que mostrar en esa misma
   * columna, pero de solo lectura — ver el comentario de `PASO`. */
  protected esEsperandoCliente(fila: FilaEmpresa): boolean {
    return fila.estado === 'informacion_corroborada';
  }

  protected ejecutarPaso(fila: FilaEmpresa): void {
    if (fila.estado === 'solicitud_recibida') {
      this.mandarAAltasPendientes(fila);
    } else if (fila.estado === 'pendiente') {
      this.abrirWizard(fila);
    }
  }

  private mandarAAltasPendientes(fila: FilaEmpresa): void {
    if (this.enviandoAAltas() === fila.id) return;
    this.enviandoAAltas.set(fila.id);
    this.alertas
      .seguir(this.empresaService.enviarAAltasPendientes(fila.id), {
        titulo: 'Mandando a Altas pendientes',
        texto: fila.nombre,
        exito: { titulo: 'Enviada a Altas pendientes' },
        error: { titulo: 'No se pudo mandar la Empresa', texto: 'Intenta de nuevo.' },
      })
      .subscribe({
        next: () => {
          this.enviandoAAltas.set(null);
          this.cargar();
        },
        error: () => this.enviandoAAltas.set(null),
      });
  }

  /** `(volver)` de `app-pantalla-estado` en el error de carga — acá mismo
   *  es "el inicio", así que reintentar y volver terminan haciendo lo
   *  mismo; se deja separado por consistencia con el resto de páginas. */
  protected volver(): void {
    this.router.navigateByUrl('/empresas');
  }

  protected abrirWizard(fila: FilaEmpresa): void {
    this.empresaSeleccionadaWizard.set(fila.id);
  }

  protected cerrarWizard(): void {
    this.empresaSeleccionadaWizard.set(null);
  }

  /** Mismo criterio que `AltasPendientesPageComponent`: cualquier cambio
   * del wizard recarga la lista entera en vez de tratar de reflejar cada
   * transición a mano. */
  protected onWizardActualizada(): void {
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

  /** TODO: modal de creación manual de Empresa — no forma parte de este
   * rediseño, queda pendiente de una tarea aparte (ver el mismo TODO en
   * el handoff original). */
  protected abrirNuevaEmpresa(): void {}

  /** TODO: exportar `filasFiltradas()` a CSV — no forma parte de este
   * rediseño, queda pendiente de una tarea aparte (ver el mismo TODO en
   * el handoff original). */
  protected exportar(): void {}
}

function mismoGrupo(a: EstadoEmpresa[] | null, b: EstadoEmpresa[]): boolean {
  if (a === null) return false;
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((estado) => setB.has(estado));
}
