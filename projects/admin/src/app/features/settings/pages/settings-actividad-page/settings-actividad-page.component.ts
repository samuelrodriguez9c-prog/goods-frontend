import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ActividadEquipoService,
  AreaActividad,
  ItemActividad,
  RespuestaActividad,
  TipoAccion,
} from '../../../../core/actividad/actividad-equipo.service';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { esTeclaDeLista, iniciales, normalizar, tonoPersona } from '../../../../shared/ui/persona';
import { EstadoPaginaComponent } from '../../../products/shared/ui/estado-pagina/estado-pagina.component';
import { IcComponent } from '../../../products/shared/ui/ic/ic.component';
import { icono } from '../../../products/shared/ui/iconos';
import { ModuloCabeceraComponent } from '../../../products/shared/ui/modulo-cabecera/modulo-cabecera.component';
import {
  Atajo,
  AtajosTecladoComponent,
} from '../../shared/ui/atajos-teclado/atajos-teclado.component';
import { BuscadorListaComponent } from '../../shared/ui/buscador-lista/buscador-lista.component';
import { ChipActivo } from '../../shared/ui/chips-filtro/chips-filtro.component';
import { FichaBarraComponent } from '../../shared/ui/ficha-barra/ficha-barra.component';
import { FichaVaciaComponent } from '../../shared/ui/ficha-vacia/ficha-vacia.component';
import { FilaListaComponent } from '../../shared/ui/fila-lista/fila-lista.component';
import {
  FiltrosPanelesComponent,
  OpcionFiltro,
  SeccionFiltro,
} from '../../shared/ui/filtros-paneles/filtros-paneles.component';
import { ListaFichaComponent } from '../../shared/ui/lista-ficha/lista-ficha.component';
import {
  ItemMenuComponent,
  MenuFichaComponent,
} from '../../shared/ui/menu-ficha/menu-ficha.component';
import { PastillaCabeceraComponent } from '../../shared/ui/pastilla-cabecera/pastilla-cabecera.component';
import {
  AREA_UI,
  Agrupar,
  PERIODOS,
  Periodo,
  TIPO_UI,
  agruparActividad,
  areaUi,
  csvActividad,
  enPeriodo,
  mismoRegistro,
  nombreCorto,
  rangoPeriodo,
  textoPeriodo,
} from './actividad.util';
import { AgruparActividadComponent } from './components/agrupar-actividad/agrupar-actividad.component';
import {
  FichaActividadComponent,
  ResumenPersona,
} from './components/ficha-actividad/ficha-actividad.component';
import { FilaActividadComponent } from './components/fila-actividad/fila-actividad.component';
import { GrupoActividadComponent } from './components/grupo-actividad/grupo-actividad.component';
import {
  MetricaActividad,
  MetricasActividadComponent,
  TarjetaActividadComponent,
} from './components/metricas-actividad/metricas-actividad.component';
import { TarjetasPlegablesComponent } from '../../../../shared/ui/tarjetas-plegables/tarjetas-plegables.component';

type Estado = 'cargando' | 'normal' | 'error' | 'sinPlan';
type SeccionF = 'persona' | 'area' | 'tipo';
/** Opción «todos» de cada sección del filtro. */
const TODOS = 'todos';
type Popover = 'menu' | 'filtros' | 'agrupar' | 'atajos';

const ATAJOS: Atajo[] = [
  { t: 'Buscar', k: '/' },
  { t: 'Acción anterior / siguiente', k: '↑ ↓' },
  { t: 'Página completa', k: 'F' },
  { t: 'Cerrar', k: 'Esc' },
];

/**
 * Actividad del equipo (Plan Plus): qué hizo cada persona, agrupado por día,
 * persona o área, y la ficha de cada acción.
 *
 * @remarks
 * - `GET /actividad-equipo` con período, persona y área; «Ver más» pide la
 *   página siguiente. La búsqueda y el tipo de acción filtran lo ya cargado
 *   (el backend no filtra por tipo).
 * - La comparación con el período anterior pide solo el total de ese período.
 * - La ficha muestra «Qué cambió» con los `cambios` del backend (las acciones
 *   viejas llegan sin cambios), el registro con sus otras acciones cargadas y
 *   la persona con sus acciones por área.
 * - «Revertir» del diseño quedó fuera a propósito en el backend.
 * - 403 → estado `sinPlan`.
 * - `?persona=<id>` llega filtrado por esa persona (lo usa Usuarios) y
 *   `?accion=<id>` abre esa acción si está en lo cargado («Copiar enlace»).
 */
import { CargarMasComponent } from '../../../../shared/ui/cargar-mas/cargar-mas.component';

@Component({
  selector: 'app-settings-actividad-page',
  standalone: true,
  imports: [
    IcComponent,
    ModuloCabeceraComponent,
    EstadoPaginaComponent,
    PastillaCabeceraComponent,
    AtajosTecladoComponent,
    ListaFichaComponent,
    BuscadorListaComponent,
    FiltrosPanelesComponent,
    FilaListaComponent,
    FichaVaciaComponent,
    FichaBarraComponent,
    MenuFichaComponent,
    ItemMenuComponent,
    MetricasActividadComponent,
    TarjetaActividadComponent,
    TarjetasPlegablesComponent,
    AgruparActividadComponent,
    GrupoActividadComponent,
    FilaActividadComponent,
    FichaActividadComponent,
    CargarMasComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-actividad-page.component.html',
  host: {
    class: 'flex h-full min-h-0 flex-col gap-4 px-6 pt-6 leading-[normal]',
    '(document:keydown)': 'tecla($event)',
    '(document:click)': 'cerrarMenus()',
  },
})
export class SettingsActividadPageComponent {
  private readonly servicio = inject(ActividadEquipoService);
  private readonly alerta = inject(AlertaService);
  private readonly router = inject(Router);

  protected readonly icono = icono;
  protected readonly areaUi = areaUi;
  protected readonly atajos = ATAJOS;
  protected readonly lectura =
    'Qué hizo cada persona de tu equipo: pedidos que confirmó, productos que editó, stock que ajustó y más. Toca una acción para comparar cómo estaba y cómo quedó.';

  // Datos
  protected readonly estado = signal<Estado>('cargando');
  protected readonly resp = signal<RespuestaActividad | null>(null);
  protected readonly items = signal<ItemActividad[]>([]);
  protected readonly pagina = signal(1);
  protected readonly cargandoMas = signal(false);
  /** Al cambiar período, persona o área: la lista muestra el esqueleto. */
  protected readonly recargando = signal(false);
  /** Acciones del período anterior del mismo largo (para comparar); `null` si no cargó. */
  private readonly previas = signal<number | null>(null);

  // Filtros y UI
  protected readonly periodo = signal<Periodo>('7d');
  protected readonly persona = signal<number | null>(null);
  protected readonly area = signal<AreaActividad | null>(null);
  protected readonly tipo = signal<TipoAccion | null>(null);
  protected readonly busqueda = signal('');
  protected readonly agrupar = signal<Agrupar>('dia');
  protected readonly plegados = signal<string[]>([]);
  protected readonly sel = signal<number | null>(null);
  /** Cuánto baja la ficha cuando las tarjetas se despliegan encima. */
  protected readonly bajar = signal(0);
  protected readonly completa = signal(false);
  protected readonly abierto = signal<Popover | null>(null);
  protected readonly seccionF = signal<SeccionF>('persona');
  private readonly buscador = viewChild(BuscadorListaComponent);
  /** `?accion=` pendiente de abrir cuando llegue la primera página. */
  private accionInicial: number | null = null;

  /** Lo cargado que coincide con la búsqueda (persona, acción, registro o referencia). */
  private readonly buscados = computed(() => {
    const q = normalizar(this.busqueda().trim());
    return this.items().filter(
      (a) =>
        !q ||
        normalizar(
          `${a.texto} ${a.usuario?.nombre ?? ''} ${areaUi(a).t} ${a.registro?.nombre ?? ''} ${a.registro?.ref ?? ''}`,
        ).includes(q),
    );
  });
  protected readonly visibles = computed(() =>
    this.buscados().filter((a) => !this.tipo() || a.tipo === this.tipo()),
  );
  protected readonly grupos = computed(() => {
    const buscando = !!this.busqueda().trim();
    return agruparActividad(this.visibles(), this.agrupar()).map((g) => ({
      ...g,
      abierto: buscando || !this.plegados().includes(g.k),
    }));
  });
  /** Orden de la lista abierta, para ↑ ↓. */
  protected readonly plano = computed(() =>
    this.grupos().flatMap((g) => (g.abierto ? g.filas : [])),
  );
  protected readonly a = computed(() => this.items().find((x) => x.id === this.sel()) ?? null);
  protected readonly pos = computed(() => this.plano().findIndex((x) => x.id === this.sel()) + 1);
  protected readonly restantes = computed(() =>
    Math.max(0, (this.resp()?.total ?? 0) - this.items().length),
  );
  protected readonly hayFiltros = computed(
    () => this.persona() !== null || !!this.area() || !!this.tipo(),
  );
  protected readonly periodoT = computed(() => textoPeriodo(this.periodo()));

  protected readonly metricas = computed<MetricaActividad[]>(() => {
    const r = this.resp();
    if (!r) return [];
    const top = this.masActivo();
    const topA = this.areaTop();
    const prev = this.previas();
    const delta = prev != null && prev >= 5 ? Math.round(((r.total - prev) / prev) * 100) : null;
    const elim = this.items().filter((x) => x.tipo === 'eliminar').length;
    const todas = this.items().length >= r.total;
    return [
      {
        k: 'total',
        t: 'Acciones',
        icono: 'activity',
        v: r.total.toLocaleString('es-CO'),
        sub:
          delta == null
            ? 'Sin datos suficientes para comparar'
            : `${delta >= 0 ? '+' : ''}${delta} % vs. período anterior`,
        subColor: delta == null ? '#8a8a8a' : delta >= 0 ? '#1f6e49' : '#b42318',
        titulo: 'Ver todas',
        on: false,
      },
      {
        k: 'personas',
        t: 'Personas activas',
        icono: 'users',
        v: String(r.porPersona.length),
        sub: top ? `Más activa: ${nombreCorto(top.nombre)}` : 'Nadie hizo cambios',
        titulo: top ? `Ver solo a ${nombreCorto(top.nombre)}` : '',
        on: !!top && this.persona() === top.usuarioId,
      },
      {
        k: 'area',
        t: 'Área con más movimiento',
        icono: 'layout-grid',
        v: topA ? AREA_UI[topA[0]].t : '—',
        sub:
          topA && r.total
            ? `${Math.round((topA[1] / r.total) * 100)} % de las acciones`
            : 'Sin acciones',
        titulo: topA ? `Ver solo ${AREA_UI[topA[0]].t.toLowerCase()}` : '',
        on: !!topA && this.area() === topA[0],
      },
      {
        k: 'eliminar',
        t: 'Eliminaciones',
        icono: 'trash',
        // Sin tipo en los totales del backend: se cuentan en lo cargado.
        v: `${elim}${todas ? '' : '+'}`,
        sub: elim ? 'Revisa lo que se borró' : 'No se borró nada',
        subColor: elim ? '#b42318' : '#8a8a8a',
        titulo: 'Ver solo lo eliminado',
        on: this.tipo() === 'eliminar',
      },
    ];
  });
  /** «Los 7 días anteriores hubo 42 acciones». */
  protected readonly comparacion = computed(() => {
    const prev = this.previas();
    if (prev == null || prev < 5)
      return 'Aún no hay datos suficientes del período anterior para comparar';
    const p = this.periodo();
    return p === 'hoy'
      ? `Ayer hubo ${prev} acciones`
      : `Los ${PERIODOS.find((x) => x.k === p)!.t} anteriores hubo ${prev} acciones`;
  });
  private readonly masActivo = computed(
    () => [...(this.resp()?.porPersona ?? [])].sort((x, y) => y.acciones - x.acciones)[0],
  );
  private readonly areaTop = computed(
    () =>
      (Object.entries(this.resp()?.porArea ?? {}) as [AreaActividad, number][]).sort(
        (x, y) => y[1] - x[1],
      )[0],
  );

  protected readonly secciones = computed<SeccionFiltro[]>(() => [
    {
      k: 'persona',
      t: 'Persona',
      icono: 'user',
      sub: this.persona() !== null ? nombreCorto(this.personaNombre()) : 'Todo el equipo',
      activo: this.persona() !== null,
    },
    {
      k: 'area',
      t: 'Área',
      icono: 'layout-grid',
      sub: this.area() ? AREA_UI[this.area()!].t : 'Todas',
      activo: !!this.area(),
    },
    {
      k: 'tipo',
      t: 'Tipo de acción',
      icono: 'bolt',
      sub: this.tipo() ? TIPO_UI[this.tipo()!].t : 'Todas',
      activo: !!this.tipo(),
    },
  ]);
  protected readonly opciones = computed<OpcionFiltro[]>(() => {
    const r = this.resp();
    const sec = this.seccionF();
    if (sec === 'persona') {
      const ps = r?.porPersona ?? [];
      return [
        {
          k: TODOS,
          t: 'Todo el equipo',
          n: ps.reduce((n, p) => n + p.acciones, 0),
          ini: 'T',
          tono: ['#303030', '#fff'] as [string, string],
          on: this.persona() === null,
        },
        ...ps.map((p) => ({
          k: p.usuarioId,
          t: p.nombre,
          n: p.acciones,
          ini: iniciales(p.nombre),
          tono: tonoPersona(p.nombre),
          on: this.persona() === p.usuarioId,
        })),
      ];
    }
    if (sec === 'area') {
      const as = Object.entries(r?.porArea ?? {}) as [AreaActividad, number][];
      return [
        {
          k: TODOS,
          t: 'Todas las áreas',
          n: as.reduce((n, [, x]) => n + x, 0),
          icono: 'layout-grid',
          on: !this.area(),
        },
        ...as
          .sort((x, y) => y[1] - x[1])
          .map(([k, n]) => ({
            k,
            t: AREA_UI[k]?.t ?? k,
            n,
            icono: AREA_UI[k]?.icono ?? 'point',
            on: this.area() === k,
          })),
      ];
    }
    const base = this.buscados();
    return [
      {
        k: TODOS,
        t: 'Todas',
        n: base.length,
        icono: 'list',
        bg: '#f1f1f1',
        fg: '#4b5563',
        on: !this.tipo(),
      },
      ...(Object.entries(TIPO_UI) as [TipoAccion, (typeof TIPO_UI)[TipoAccion]][]).map(
        ([k, t]) => ({
          k,
          t: t.t,
          n: base.filter((a) => a.tipo === k).length,
          icono: t.icono,
          bg: t.bg,
          fg: t.fg,
          on: this.tipo() === k,
        }),
      ),
    ];
  });
  protected readonly personaNombre = computed(
    () => this.resp()?.porPersona.find((p) => p.usuarioId === this.persona())?.nombre ?? 'Persona',
  );
  protected readonly chips = computed<ChipActivo[]>(() => {
    const out: ChipActivo[] = [];
    const ar = this.area();
    const tp = this.tipo();
    if (this.persona() !== null)
      out.push({ t: nombreCorto(this.personaNombre()), quitar: () => this.persona.set(null) });
    if (ar) out.push({ t: AREA_UI[ar].t, quitar: () => this.area.set(null) });
    if (tp) out.push({ t: TIPO_UI[tp].t, quitar: () => this.tipo.set(null) });
    return out;
  });
  /** Las acciones cargadas sobre el mismo registro, de la más vieja a la más nueva. */
  protected readonly delRegistro = computed(() => {
    const a = this.a();
    if (!a?.registro) return [];
    return this.items()
      .filter((x) => mismoRegistro(x, a))
      .sort((x, y) => x.fecha.localeCompare(y.fecha));
  });
  /** La persona de la acción: sus acciones en el período (del backend) y por área (de lo cargado). */
  protected readonly resumenPersona = computed<ResumenPersona | null>(() => {
    const a = this.a();
    if (!a?.usuario) return null;
    const id = a.usuario.id;
    const pp = this.resp()?.porPersona.find((p) => p.usuarioId === id);
    const suyas = this.items().filter((x) => x.usuario?.id === id);
    const cuenta = new Map<AreaActividad, number>();
    for (const x of suyas) cuenta.set(x.area, (cuenta.get(x.area) ?? 0) + 1);
    const max = Math.max(1, ...cuenta.values());
    return {
      nombre: a.usuario.nombre,
      acciones: pp?.acciones ?? suyas.length,
      ultimaEn: pp?.ultimaEn ?? suyas[0]?.fecha ?? null,
      areas: [...cuenta.entries()]
        .sort((x, y) => y[1] - x[1])
        .map(([k, n]) => ({ ...areaUi({ area: k }), n, w: Math.round((n / max) * 100) })),
    };
  });
  protected readonly periodoEn = computed(() => enPeriodo(this.periodo()));
  protected readonly grupoClaves = computed(() => this.grupos().map((g) => g.k));
  protected readonly corto = nombreCorto;
  protected readonly kicker = computed(() => {
    const a = this.a();
    if (!a) return '';
    return ['Acción', areaUi(a).t, a.registro?.ref].filter(Boolean).join(' · ');
  });
  protected readonly todosPlegados = computed(
    () => this.grupos().length > 0 && this.grupos().every((g) => this.plegados().includes(g.k)),
  );
  protected readonly vacioLista = computed(() =>
    this.hayFiltros() || this.busqueda().trim()
      ? { t: 'Ninguna acción coincide con estos filtros.', accion: 'Limpiar filtros' }
      : {
          t: 'Sin actividad en este período.',
          accion: this.periodo() === '90d' ? '' : 'Ver 30 días',
        },
  );

  constructor() {
    const q = inject(ActivatedRoute).snapshot.queryParamMap;
    const p = Number(q.get('persona'));
    if (p) this.persona.set(p);
    this.accionInicial = Number(q.get('accion')) || null;
    // Cada cambio de período, persona o área vuelve a pedir la primera página.
    effect(() => {
      this.periodo();
      this.persona();
      this.area();
      untracked(() => this.cargar());
    });
  }

  protected cargar(mas = false): void {
    const { desde, hasta, antes } = rangoPeriodo(this.periodo());
    const page = mas ? this.pagina() + 1 : 1;
    if (mas) this.cargandoMas.set(true);
    else if (this.estado() === 'normal') this.recargando.set(true);
    else this.estado.set('cargando');
    if (!mas) {
      // Solo el total del período anterior, con los mismos filtros.
      this.previas.set(null);
      this.servicio
        .listar({
          desde: antes,
          hasta: desde,
          usuarioId: this.persona(),
          area: this.area(),
          pageSize: 1,
        })
        .subscribe({ next: (r) => this.previas.set(r.total), error: () => undefined });
    }
    this.servicio
      .listar({ desde, hasta, usuarioId: this.persona(), area: this.area(), page })
      .subscribe({
        next: (r) => {
          this.resp.set(r);
          this.pagina.set(page);
          this.cargandoMas.set(false);
          this.recargando.set(false);
          this.items.set(mas ? [...this.items(), ...r.items] : r.items);
          this.estado.set('normal');
          if (this.accionInicial && this.items().some((x) => x.id === this.accionInicial))
            this.sel.set(this.accionInicial);
          this.accionInicial = null;
          if (!mas && this.sel() && !r.items.some((x) => x.id === this.sel())) this.sel.set(null);
        },
        error: (e: HttpErrorResponse) => {
          this.cargandoMas.set(false);
          this.recargando.set(false);
          this.estado.set(e.status === 403 ? 'sinPlan' : 'error');
        },
      });
  }

  // Lista y ficha

  protected abrir(id: number): void {
    this.sel.update((s) => (s === id ? null : id));
    this.abierto.set(null);
  }

  protected ir(d: number): void {
    const l = this.plano();
    const i = l.findIndex((x) => x.id === this.sel());
    const n = l[Math.max(0, Math.min(l.length - 1, i + d))];
    if (n) this.sel.set(n.id);
  }

  protected alternarGrupo(k: string): void {
    this.plegados.update((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  }

  protected alternar(p: Popover): void {
    this.abierto.update((x) => (x === p ? null : p));
  }

  protected cerrarMenus(): void {
    this.abierto.set(null);
  }

  protected elegirAgrupar(k: Agrupar): void {
    this.agrupar.set(k);
    this.plegados.set([]);
  }

  protected alternarTodos(): void {
    this.plegados.set(this.todosPlegados() ? [] : this.grupos().map((g) => g.k));
  }

  /** Las métricas filtran (persona más activa, área, eliminaciones); «Acciones» limpia. */
  protected elegirMetrica(k: MetricaActividad['k']): void {
    const top = this.masActivo();
    const topA = this.areaTop();
    if (k === 'total') this.limpiarFiltros();
    else if (k === 'personas' && top)
      this.persona.update((p) => (p === top.usuarioId ? null : top.usuarioId));
    else if (k === 'area' && topA) this.area.update((x) => (x === topA[0] ? null : topA[0]));
    else if (k === 'eliminar') this.tipo.update((t) => (t === 'eliminar' ? null : 'eliminar'));
  }

  /** Elegir es fijar (radio); «todos» quita el filtro de la sección. */
  protected elegirFiltro(k: string | number): void {
    const v = k === TODOS ? null : k;
    const sec = this.seccionF();
    if (sec === 'persona') this.persona.set(v === null ? null : Number(v));
    else if (sec === 'area') this.area.set(v as AreaActividad | null);
    else this.tipo.set(v as TipoAccion | null);
  }

  protected limpiarFiltros(): void {
    this.persona.set(null);
    this.area.set(null);
    this.tipo.set(null);
    this.busqueda.set('');
  }

  /** Sin resultados: limpia los filtros o, sin filtros, amplía a 30 días. */
  protected accionVacio(): void {
    if (this.hayFiltros() || this.busqueda().trim()) this.limpiarFiltros();
    else this.periodo.set('30d');
  }

  // Menú ⋯ y acciones

  protected soloPersona(): void {
    const a = this.a();
    this.abierto.set(null);
    if (!a?.usuario) return;
    this.persona.set(a.usuario.id);
    this.completa.set(false);
    this.alerta.mostrar({
      estado: 'info',
      titulo: `Solo acciones de ${nombreCorto(a.usuario.nombre)}`,
    });
  }

  protected soloArea(): void {
    const a = this.a();
    this.abierto.set(null);
    if (!a) return;
    this.area.set(a.area);
    this.completa.set(false);
    this.alerta.mostrar({ estado: 'info', titulo: `Solo ${areaUi(a).t.toLowerCase()}` });
  }

  protected abrirRegistro(): void {
    const a = this.a();
    if (a?.enlace) this.router.navigate([a.enlace.ruta], { queryParams: a.enlace.params });
  }

  protected copiarEnlace(): void {
    const a = this.a();
    if (!a) return;
    navigator.clipboard?.writeText(`${location.origin}/settings/actividad?accion=${a.id}`);
    this.abierto.set(null);
    this.alerta.mostrar({
      estado: 'info',
      titulo: 'Enlace copiado',
      texto: 'Quien lo abra verá esta acción, si tiene permiso.',
    });
  }

  /** Lo que se ve con los filtros de ahora (de lo cargado). */
  protected exportar(): void {
    const xs = this.visibles();
    const nombre = `actividad-${this.periodo()}.csv`;
    const url = URL.createObjectURL(new Blob([csvActividad(xs)], { type: 'text/csv' }));
    Object.assign(document.createElement('a'), { href: url, download: nombre }).click();
    URL.revokeObjectURL(url);
    this.alerta.mostrar({
      estado: 'success',
      titulo: 'Exportación lista',
      texto: `${nombre} · ${xs.length} ${xs.length === 1 ? 'acción' : 'acciones'} con los filtros de ahora.`,
    });
  }

  protected verPlanes(): void {
    // TODO(front): todavía no hay una página de planes en el panel; por ahora lleva a Settings.
    this.router.navigate(['/settings']);
  }

  // Teclado

  protected tecla(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (this.abierto()) return this.cerrarMenus();
      if (!esTeclaDeLista(e)) return (e.target as HTMLElement).blur();
      if (this.completa()) return this.completa.set(false);
      if (this.sel()) this.sel.set(null);
      return;
    }
    if (!esTeclaDeLista(e)) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.ir(e.key === 'ArrowDown' ? 1 : -1);
    } else if (e.key === '/') {
      e.preventDefault();
      this.buscador()?.enfocar();
    } else if (e.key.toLowerCase() === 'f' && this.sel()) {
      this.completa.update((c) => !c);
    }
  }
}
