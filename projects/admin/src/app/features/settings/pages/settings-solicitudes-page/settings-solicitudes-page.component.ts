import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import {
  AreaSolicitud,
  ESTADO_SOLICITUD,
  EstadoSolicitud,
  Solicitud,
  SolicitudPublica,
  TipoSolicitud,
} from '../../../../core/solicitudes/models/solicitud.model';
import { RealtimeService } from '../../../../core/realtime/realtime.service';
import {
  SolicitudesService,
  mensajeDeError,
} from '../../../../core/solicitudes/solicitudes.service';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { esTeclaDeLista, haceCuanto, normalizar } from '../../../../shared/ui/persona';
import { EstadoPaginaComponent } from '../../../products/shared/ui/estado-pagina/estado-pagina.component';
import { IcComponent } from '../../../products/shared/ui/ic/ic.component';
import { icono } from '../../../products/shared/ui/iconos';
import { ModuloCabeceraComponent } from '../../../products/shared/ui/modulo-cabecera/modulo-cabecera.component';
import { BuscadorListaComponent } from '../../shared/ui/buscador-lista/buscador-lista.component';
import {
  ChipActivo,
  ChipsFiltroComponent,
} from '../../shared/ui/chips-filtro/chips-filtro.component';
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
import { ApoyoSolicitudComponent } from './components/apoyo-solicitud/apoyo-solicitud.component';
import { CabeceraSolicitudComponent } from './components/cabecera-solicitud/cabecera-solicitud.component';
import { DetallesSolicitudComponent } from './components/detalles-solicitud/detalles-solicitud.component';
import { ConversacionSolicitudComponent } from './components/conversacion-solicitud/conversacion-solicitud.component';
import { FilaSolicitudComponent } from './components/fila-solicitud/fila-solicitud.component';
import {
  ModalNuevaSolicitudComponent,
  NuevaSolicitud,
} from './components/modal-nueva-solicitud/modal-nueva-solicitud.component';
import { ProgresoSolicitudComponent } from './components/progreso-solicitud/progreso-solicitud.component';
import {
  ICONO_AREA,
  ICONO_ESTADO,
  NOMBRE_AREA,
  SolicitudLista,
  TIPO_UI,
  TONO,
  areaDe,
  esPublica,
  iconoArea,
  nombreArea,
  refDe,
} from './solicitudes.util';

type Seccion = 'estado' | 'tipo' | 'area';
type Orden = 'recientes' | 'votadas';
/** `tienda`: las que pidió la tienda. `otras`: el tablero que publica Goods. */
type Vista = 'tienda' | 'otras';
/** `mias` filtra las que envió la persona. */
type FiltroEstado = EstadoSolicitud | 'mias';

/**
 * Solicitudes a Goods: lista de lo que la tienda pidió y ficha con el
 * progreso y la conversación con el equipo.
 *
 * @remarks
 * - «De otras tiendas» es el tablero (`/mis-solicitudes/tablero`): se ven sin
 *   autor ni conversación, se votan (una vez por tienda) y se siguen. Si la
 *   tienda ya la pidió, no se vota y se salta a su propia solicitud.
 * - El contador de votos es `votos`: las tiendas que la piden, la propia incluida.
 * - La conversación son los `eventos` (estados como pastillas, comentarios
 *   como burbujas; los de Goods con el sello «Equipo Goods»).
 * - `?solicitud=<id>` abre esa ficha (lo usan «Copiar enlace» y los avisos);
 *   con `&tablero=1`, la del tablero.
 * - `solicitud:cambio` recarga en silencio.
 */
import {
  CargarMasComponent,
  PaginaPorGrupo,
} from '../../../../shared/ui/cargar-mas/cargar-mas.component';

@Component({
  selector: 'app-settings-solicitudes-page',
  standalone: true,
  imports: [
    IcComponent,
    ModuloCabeceraComponent,
    EstadoPaginaComponent,
    ListaFichaComponent,
    BuscadorListaComponent,
    FiltrosPanelesComponent,
    ChipsFiltroComponent,
    FilaListaComponent,
    FichaVaciaComponent,
    FichaBarraComponent,
    MenuFichaComponent,
    ItemMenuComponent,
    ApoyoSolicitudComponent,
    DetallesSolicitudComponent,
    FilaSolicitudComponent,
    CabeceraSolicitudComponent,
    ProgresoSolicitudComponent,
    ConversacionSolicitudComponent,
    ModalNuevaSolicitudComponent,
    CargarMasComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-solicitudes-page.component.html',
  host: {
    class: 'flex h-full min-h-0 flex-col gap-4 px-6 pt-6 leading-[normal]',
    '(document:keydown)': 'tecla($event)',
    '(document:click)': 'cerrarMenus()',
  },
})
export class SettingsSolicitudesPageComponent {
  private readonly servicio = inject(SolicitudesService);
  private readonly alerta = inject(AlertaService);
  private readonly auth = inject(AuthService);
  private readonly realtime = inject(RealtimeService);

  protected readonly icono = icono;
  protected readonly areaDe = areaDe;
  protected readonly iconoArea = iconoArea;
  protected readonly tiposUi = TIPO_UI;
  protected readonly estados = ESTADO_SOLICITUD;
  protected readonly lectura =
    'Cuéntale al equipo de Goods qué mejorar, qué cambiar o con qué herramientas conectar tu tienda. Sigue cada solicitud paso a paso, apoya las de otras tiendas con tu voto y conversa con el equipo cuando necesiten más contexto. Respondemos en 2 días hábiles.';
  private readonly modulos = Object.entries(NOMBRE_AREA).map(([k, t]) => ({ k, t }));

  // Datos
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly items = signal<Solicitud[]>([]);
  /** La solicitud abierta con sus `eventos` (la lista no los trae). */
  protected readonly detalle = signal<Solicitud | null>(null);
  /** El tablero; `null` hasta que se abre «De otras tiendas». */
  protected readonly tablero = signal<SolicitudPublica[] | null>(null);
  protected readonly cargandoTablero = signal(false);
  protected readonly errorTablero = signal(false);

  // UI
  protected readonly vista = signal<Vista>('tienda');
  /** 15 filas por grupo y «Cargar 15 más · quedan N» (como Productos); la abierta siempre se ve. */
  protected readonly pagina = new PaginaPorGrupo();
  protected readonly sel = signal<number | null>(null);
  protected readonly busqueda = signal('');
  protected readonly fEstado = signal<FiltroEstado | null>(null);
  protected readonly fTipo = signal<TipoSolicitud | null>(null);
  protected readonly fArea = signal<string | null>(null);
  protected readonly filtros = signal(false);
  protected readonly seccion = signal<Seccion>('estado');
  protected readonly orden = signal<Orden>('recientes');
  protected readonly completa = signal(false);
  protected readonly menu = signal(false);
  protected readonly comentario = signal('');
  protected readonly comentando = signal(false);
  protected readonly nueva = signal(false);
  protected readonly creando = signal(false);
  protected readonly votando = signal(false);
  protected readonly siguiendo = signal(false);
  protected readonly subiendo = signal(false);
  /** Áreas y secciones del modal (`GET /mis-solicitudes/areas`). */
  protected readonly areas = signal<AreaSolicitud[]>([]);
  /** Tamaño del panel de la ficha (lo mide un `ResizeObserver`). */
  private readonly fichaTam = signal({ h: 0, w: 0 });
  private readonly fichaEl = viewChild<ElementRef<HTMLElement>>('fichaEl');
  /**
   * Como en el handoff: con espacio (≥ 600 × 720) la ficha va en rejilla al
   * alto del panel y el scroll queda dentro de la conversación.
   */
  protected readonly alta = computed(() => this.fichaTam().h >= 600 && this.fichaTam().w >= 720);
  /** Sin espacio: alto de los mensajes para que la conversación quepa en el panel. */
  protected readonly altoConversacion = computed(() =>
    this.alta() ? null : Math.max(200, this.fichaTam().h - 172),
  );
  /** Lo que pidió abrir el enlace mientras la lista cargaba. */
  private pendiente: number | null = null;

  protected readonly yoId = computed(() => this.auth.currentUser()?.id ?? -1);

  /** Lo que se lista según la vista. */
  protected readonly fuente = computed<SolicitudLista[]>(() =>
    this.vista() === 'otras' ? (this.tablero() ?? []) : this.items(),
  );
  protected readonly visibles = computed(() => {
    const q = normalizar(this.busqueda().trim());
    const e = this.fEstado();
    const t = this.fTipo();
    const a = this.fArea();
    const yo = this.yoId();
    const l = this.fuente().filter(
      (s) =>
        (!q || normalizar(`${s.titulo} ${s.descripcion} ${refDe(s.id)} #${s.id}`).includes(q)) &&
        (!e || (e === 'mias' ? !esPublica(s) && s.creadaPor?.id === yo : s.estado === e)) &&
        (!t || s.tipo === t) &&
        (!a || s.modulo?.codigo === a),
    );
    const fecha = (s: SolicitudLista) =>
      esPublica(s) ? (s.publicadaEn ?? s.actualizadoEn) : s.actualizadoEn;
    return this.orden() === 'votadas'
      ? l.sort((x, y) => y.votos - x.votos || fecha(y).localeCompare(fecha(x)))
      : l.sort((x, y) => fecha(y).localeCompare(fecha(x)));
  });
  protected readonly s = computed<SolicitudLista | null>(() => {
    const id = this.sel();
    if (this.vista() === 'otras') return this.tablero()?.find((x) => x.id === id) ?? null;
    const d = this.detalle();
    return d && d.id === id ? d : (this.items().find((x) => x.id === id) ?? null);
  });
  /** La abierta, si es de la tienda. */
  protected readonly propia = computed(() => {
    const x = this.s();
    return x && !esPublica(x) ? x : null;
  });
  /** La abierta, si es del tablero. */
  protected readonly publica = computed(() => {
    const x = this.s();
    return x && esPublica(x) ? x : null;
  });
  /** Las del tablero no traen fecha de envío: el primer paso queda sin fecha. */
  protected readonly progreso = computed(() => {
    const x = this.s();
    if (!x) return null;
    return esPublica(x) ? { estado: x.estado, creadoEn: '' } : x;
  });
  protected readonly pos = computed(
    () => this.visibles().findIndex((x) => x.id === this.sel()) + 1,
  );
  protected readonly mias = computed(
    () => this.items().filter((x) => x.creadaPor?.id === this.yoId()).length,
  );
  protected readonly vacioLista = computed(() => {
    if (this.busqueda().trim() || this.hayFiltros())
      return { t: 'Nada por aquí', d: 'Prueba otro estado o búsqueda.', nueva: false };
    return this.vista() === 'otras'
      ? {
          t: 'Aún no hay solicitudes de otras tiendas',
          d: 'Cuando Goods publique una, podrás votarla y seguirla desde aquí.',
          nueva: false,
        }
      : {
          t: 'Aún no le has pedido nada a Goods',
          d: 'Cuéntanos qué te falta y síguela paso a paso.',
          nueva: true,
        };
  });
  protected readonly hayFiltros = computed(
    () => !!(this.fEstado() || this.fTipo() || this.fArea()),
  );
  protected readonly chips = computed<ChipActivo[]>(() => {
    const out: ChipActivo[] = [];
    const e = this.fEstado();
    const t = this.fTipo();
    const a = this.fArea();
    if (e) out.push({ t: this.textoEstado(e), quitar: () => this.fEstado.set(null) });
    if (t) out.push({ t: TIPO_UI[t].t, quitar: () => this.fTipo.set(null) });
    if (a) out.push({ t: nombreArea(a), quitar: () => this.fArea.set(null) });
    return out;
  });
  protected readonly secciones = computed<SeccionFiltro[]>(() => {
    const e = this.fEstado();
    const t = this.fTipo();
    const a = this.fArea();
    return [
      {
        k: 'estado',
        t: 'Estado',
        icono: 'progress',
        sub: e ? this.textoEstado(e) : 'Todos',
        activo: !!e,
      },
      { k: 'tipo', t: 'Tipo', icono: 'category', sub: t ? TIPO_UI[t].t : 'Todos', activo: !!t },
      {
        k: 'area',
        t: 'Área',
        icono: 'layout-grid',
        sub: a ? nombreArea(a) : 'Todas',
        activo: !!a,
      },
    ];
  });
  protected readonly opciones = computed<OpcionFiltro[]>(() => {
    const cuenta = (f: (s: SolicitudLista) => boolean) => this.fuente().filter(f).length;
    const gris = { bg: '#f1f1f1', fg: '#4b5563' };
    switch (this.seccion()) {
      case 'estado': {
        const yo = this.yoId();
        const base: OpcionFiltro[] = [
          {
            k: 'todas',
            t: 'Todas',
            icono: 'layout-list',
            ...gris,
            n: this.fuente().length,
            on: !this.fEstado(),
          },
        ];
        if (this.vista() === 'tienda')
          base.push({
            k: 'mias',
            t: 'Enviadas por mí',
            icono: 'user',
            ...gris,
            n: cuenta((s) => !esPublica(s) && s.creadaPor?.id === yo),
            on: this.fEstado() === 'mias',
          });
        const estados = (Object.keys(ESTADO_SOLICITUD) as EstadoSolicitud[]).map((k) => {
          const tn = TONO[ESTADO_SOLICITUD[k].tono];
          return {
            k,
            t: ESTADO_SOLICITUD[k].texto,
            icono: ICONO_ESTADO[k],
            bg: tn.bg,
            fg: tn.fg,
            n: cuenta((s) => s.estado === k),
            on: this.fEstado() === k,
          };
        });
        // El tablero no muestra las no aprobadas ni las canceladas.
        return [...base, ...estados.filter((o) => this.vista() === 'tienda' || o.n)];
      }
      case 'tipo':
        return (Object.keys(TIPO_UI) as TipoSolicitud[]).map((k) => ({
          k,
          t: TIPO_UI[k].t,
          icono: TIPO_UI[k].icono,
          bg: TIPO_UI[k].bg,
          fg: TIPO_UI[k].fg,
          n: cuenta((s) => s.tipo === k),
          on: this.fTipo() === k,
        }));
      default:
        return this.modulos
          .map((m) => ({
            k: m.k,
            t: m.t,
            icono: ICONO_AREA[m.k] ?? 'layout-grid',
            bg: '#f1f1f1',
            fg: '#4b5563',
            n: cuenta((s) => s.modulo?.codigo === m.k),
            on: this.fArea() === m.k,
          }))
          .filter((o) => o.n);
    }
  });
  protected readonly resumenFiltro = computed(
    () => `${this.visibles().length} ${this.visibles().length === 1 ? 'solicitud' : 'solicitudes'}`,
  );
  protected readonly siguienteId = computed(
    () => Math.max(0, ...this.items().map((x) => x.id)) + 1,
  );

  constructor() {
    let primera = true;
    inject(ActivatedRoute)
      .queryParamMap.pipe(takeUntilDestroyed())
      .subscribe((q) => {
        const id = Number(q.get('solicitud') ?? q.get('id')) || null;
        const enTablero = q.has('tablero');
        if (primera) {
          primera = false;
          this.cargar(enTablero ? null : id);
          if (enTablero) this.cambiarVista('otras', id);
        } else if (id) {
          if (enTablero) this.cambiarVista('otras', id);
          else this.verPropia(id);
        }
      });
    let ro: ResizeObserver | null = null;
    effect(() => {
      const el = this.fichaEl()?.nativeElement.parentElement;
      ro?.disconnect();
      ro = null;
      if (!el || typeof ResizeObserver === 'undefined') return;
      ro = new ResizeObserver(([e]) =>
        this.fichaTam.set({ h: e.contentRect.height, w: e.contentRect.width }),
      );
      ro.observe(el);
    });
    inject(DestroyRef).onDestroy(() => ro?.disconnect());
    this.servicio
      .areas()
      .pipe(catchError(() => of([] as AreaSolicitud[])))
      .subscribe((a) => this.areas.set(a));
    this.realtime
      .escuchar<{ solicitudId: number }>('solicitud:cambio')
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.refrescar());
  }

  protected cargar(abrir: number | null = null): void {
    this.cargando.set(true);
    this.error.set(null);
    this.pendiente = abrir ?? this.pendiente;
    this.servicio.listar().subscribe({
      next: (r) => {
        this.items.set(r.data);
        this.cargando.set(false);
        const id = this.pendiente;
        this.pendiente = null;
        if (id && this.vista() === 'tienda') this.mostrar(id);
      },
      error: () => {
        this.error.set('Revisa tu conexión e intenta de nuevo.');
        this.cargando.set(false);
      },
    });
  }

  protected cargarTablero(abrir: number | null = null): void {
    this.cargandoTablero.set(true);
    this.errorTablero.set(false);
    this.servicio.tablero().subscribe({
      next: (r) => {
        this.tablero.set(r.data);
        this.cargandoTablero.set(false);
        if (abrir && this.vista() === 'otras') this.mostrar(abrir);
      },
      error: () => {
        this.cargandoTablero.set(false);
        this.errorTablero.set(true);
      },
    });
  }

  /** Tras `solicitud:cambio`: recarga sin parpadeo lo que ya estaba cargado. */
  private refrescar(): void {
    if (this.cargando() || this.error()) return;
    this.servicio.listar().subscribe((r) => this.items.set(r.data));
    const p = this.propia();
    if (p && this.vista() === 'tienda')
      this.servicio.obtener(p.id).subscribe((d) => {
        if (this.sel() === d.id) this.detalle.set(d);
      });
    if (this.tablero() && !this.cargandoTablero())
      this.servicio.tablero().subscribe((r) => this.tablero.set(r.data));
  }

  protected cambiarVista(v: Vista, abrir: number | null = null): void {
    if (v !== this.vista()) {
      this.vista.set(v);
      this.sel.set(null);
      this.completa.set(false);
      this.menu.set(false);
      if (this.fEstado() === 'mias') this.fEstado.set(null);
    }
    if (v === 'otras' && (!this.tablero() || abrir)) {
      if (this.tablero() && abrir) this.mostrar(abrir);
      else if (!this.cargandoTablero()) this.cargarTablero(abrir);
    }
  }

  /** «Ver tu solicitud»: de la del tablero a la propia, con su conversación. */
  protected verPropia(id: number): void {
    this.cambiarVista('tienda');
    this.limpiarFiltros();
    this.busqueda.set('');
    if (this.cargando()) this.pendiente = id;
    else this.mostrar(id);
  }

  private textoEstado(e: FiltroEstado): string {
    return e === 'mias' ? 'Enviadas por mí' : ESTADO_SOLICITUD[e].texto;
  }

  // Lista y ficha

  protected abrir(id: number): void {
    if (this.sel() === id) {
      this.sel.set(null);
      return;
    }
    this.mostrar(id);
  }

  /** Abre la ficha (sin alternar). Las propias traen sus `eventos` aparte. */
  private mostrar(id: number): void {
    this.sel.set(id);
    this.menu.set(false);
    this.comentario.set('');
    if (this.vista() === 'otras') return;
    this.servicio.obtener(id).subscribe((d) => {
      if (this.sel() === id && this.vista() === 'tienda') this.detalle.set(d);
    });
  }

  protected ir(d: number): void {
    const l = this.visibles();
    const i = l.findIndex((x) => x.id === this.sel());
    const n = l[Math.max(0, Math.min(l.length - 1, i + d))];
    if (n && n.id !== this.sel()) this.abrir(n.id);
  }

  protected cerrarMenus(): void {
    this.menu.set(false);
    this.filtros.set(false);
  }

  protected alternarOrden(): void {
    this.orden.update((o) => (o === 'recientes' ? 'votadas' : 'recientes'));
  }

  // Filtros

  protected elegirOpcion(k: string | number): void {
    const v = String(k);
    const s = this.seccion();
    if (s === 'estado')
      this.fEstado.update((x) => (v === 'todas' || x === v ? null : (v as FiltroEstado)));
    else if (s === 'tipo') this.fTipo.update((x) => (x === v ? null : (v as TipoSolicitud)));
    else this.fArea.update((x) => (x === v ? null : v));
  }

  protected limpiarFiltros(): void {
    this.fEstado.set(null);
    this.fTipo.set(null);
    this.fArea.set(null);
  }

  protected soloEstado(): void {
    const s = this.s();
    if (s) this.fEstado.set(s.estado);
    this.menu.set(false);
  }

  protected soloArea(): void {
    const s = this.s();
    if (s?.modulo) this.fArea.set(s.modulo.codigo);
    this.menu.set(false);
  }

  // Acciones

  protected copiarEnlace(): void {
    const s = this.s();
    if (!s) return;
    const tablero = esPublica(s) ? '&tablero=1' : '';
    navigator.clipboard?.writeText(
      `${location.origin}/settings/solicitudes?solicitud=${s.id}${tablero}`,
    );
    this.menu.set(false);
    this.alerta.mostrar({
      estado: 'success',
      titulo: 'Enlace copiado',
      texto: `${refDe(s.id)} · ${s.titulo}`,
    });
  }

  protected comentar(texto: string): void {
    const s = this.propia();
    if (!s || this.comentando()) return;
    this.comentando.set(true);
    this.servicio.comentar(s.id, texto).subscribe({
      next: (d) => {
        this.comentando.set(false);
        this.comentario.set('');
        this.detalle.set(d);
        this.reemplazar(d);
      },
      error: (e) => {
        this.comentando.set(false);
        this.alerta.mostrar({
          estado: 'error',
          titulo: 'No se envió tu mensaje',
          texto: mensajeDeError(e),
        });
      },
    });
  }

  private reemplazar(d: Solicitud): void {
    this.items.update((xs) => xs.map((x) => (x.id === d.id ? { ...x, ...d } : x)));
  }

  /** Votar o quitar el voto de una del tablero. */
  protected votar(): void {
    const s = this.publica();
    if (!s || s.esMia || this.votando()) return;
    this.votando.set(true);
    const pedido = s.voto ? this.servicio.quitarVoto(s.id) : this.servicio.votar(s.id);
    pedido.subscribe({
      next: (p) => {
        this.votando.set(false);
        this.tablero.update((xs) => xs?.map((x) => (x.id === p.id ? p : x)) ?? null);
        if (p.voto)
          this.alerta.mostrar({
            estado: 'success',
            titulo: 'Voto sumado',
            texto: 'La sigues: te avisamos cuando cambie de estado.',
          });
      },
      error: (e) => {
        this.votando.set(false);
        this.alerta.mostrar({
          estado: 'error',
          titulo: s.voto ? 'No se quitó tu voto' : 'No se sumó tu voto',
          texto: mensajeDeError(e),
        });
      },
    });
  }

  /** Seguir o dejar de seguir, propia o del tablero. */
  protected seguir(): void {
    const s = this.s();
    if (!s || this.siguiendo()) return;
    this.siguiendo.set(true);
    this.servicio.seguir(s.id, !s.sigo).subscribe({
      next: ({ sigo }) => {
        this.siguiendo.set(false);
        if (esPublica(s))
          this.tablero.update((xs) => xs?.map((x) => (x.id === s.id ? { ...x, sigo } : x)) ?? null);
        else {
          this.items.update((xs) => xs.map((x) => (x.id === s.id ? { ...x, sigo } : x)));
          this.detalle.update((d) => (d?.id === s.id ? { ...d, sigo } : d));
        }
        this.alerta.mostrar({
          estado: 'success',
          titulo: sigo ? 'La sigues' : 'Dejaste de seguirla',
          texto: sigo ? 'Te avisamos cuando cambie de estado.' : 'Ya no te llegan sus avisos.',
        });
      },
      error: (e) => {
        this.siguiendo.set(false);
        this.alerta.mostrar({
          estado: 'error',
          titulo: 'No se pudo cambiar',
          texto: mensajeDeError(e),
        });
      },
    });
  }

  protected pedirRetirar(): void {
    const s = this.propia();
    if (!s?.cancelable) return;
    this.menu.set(false);
    this.alerta.mostrar({
      estado: 'warning',
      titulo: '¿Retirar esta solicitud?',
      texto: 'El equipo de Goods deja de evaluarla. Puedes volver a pedirla cuando quieras.',
      autoCierre: null,
      abierta: true,
      accion: {
        label: 'Retirar',
        ejecutar: () =>
          this.alerta
            .seguir(this.servicio.cancelar(s.id), {
              titulo: 'Retirando…',
              exito: { titulo: 'Solicitud retirada' },
              error: { titulo: 'No se pudo retirar' },
            })
            .subscribe((d) => {
              this.detalle.set(d);
              this.reemplazar(d);
            }),
      },
    });
  }

  /** Crea la solicitud y, si hay capturas, las sube después (necesitan su id). */
  protected crear({ payload, capturas }: NuevaSolicitud): void {
    if (this.creando()) return;
    this.creando.set(true);
    this.servicio.crear(payload).subscribe({
      next: (s) => {
        if (!capturas.length) return this.creada(s, true);
        this.servicio.adjuntar(s.id, capturas).subscribe({
          next: (d) => this.creada(d, true),
          error: (e) => {
            this.creada(s, false);
            this.alerta.mostrar({
              estado: 'warning',
              titulo: 'Solicitud enviada sin capturas',
              texto: `${mensajeDeError(e)} Puedes adjuntarlas desde la conversación.`,
            });
          },
        });
      },
      error: (e) => {
        this.creando.set(false);
        this.alerta.mostrar({
          estado: 'error',
          titulo: 'No se pudo enviar',
          texto: mensajeDeError(e),
        });
      },
    });
  }

  private creada(s: Solicitud, avisar: boolean): void {
    this.creando.set(false);
    this.nueva.set(false);
    this.cambiarVista('tienda');
    this.items.update((xs) => [s, ...xs.filter((x) => x.id !== s.id)]);
    this.limpiarFiltros();
    this.busqueda.set('');
    this.sel.set(null);
    this.abrir(s.id);
    if (avisar)
      this.alerta.mostrar({
        estado: 'success',
        titulo: 'Solicitud enviada',
        texto: `${refDe(s.id)} · te avisamos cuando el equipo la revise.`,
      });
  }

  /** Capturas desde el clip de la conversación. */
  protected adjuntar(archivos: File[]): void {
    const s = this.propia();
    if (!s || this.subiendo()) return;
    this.subiendo.set(true);
    this.servicio.adjuntar(s.id, archivos).subscribe({
      next: (d) => {
        this.subiendo.set(false);
        if (this.sel() === d.id) this.detalle.set(d);
        this.reemplazar(d);
        this.alerta.mostrar({
          estado: 'success',
          titulo:
            archivos.length === 1 ? 'Captura adjuntada' : `${archivos.length} capturas adjuntadas`,
          texto: 'El equipo de Goods ya las puede ver.',
        });
      },
      error: (e) => {
        this.subiendo.set(false);
        this.alerta.mostrar({
          estado: 'error',
          titulo: 'No se subieron las capturas',
          texto: mensajeDeError(e),
        });
      },
    });
  }

  // Teclado

  protected tecla(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (this.nueva()) return this.nueva.set(false);
      if (this.filtros() || this.menu()) return this.cerrarMenus();
      if (!esTeclaDeLista(e)) return;
      if (this.completa()) return this.completa.set(false);
      if (this.sel()) this.sel.set(null);
      return;
    }
    if (!esTeclaDeLista(e) || this.nueva()) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.ir(e.key === 'ArrowDown' ? 1 : -1);
    } else if (e.key.toLowerCase() === 'n') {
      e.preventDefault();
      this.nueva.set(true);
    } else if (e.key.toLowerCase() === 'f' && this.sel()) {
      this.completa.update((c) => !c);
    }
  }
}
