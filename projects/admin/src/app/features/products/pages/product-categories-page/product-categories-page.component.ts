import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TablerIconComponent } from '@tabler/icons-angular';
import { firstValueFrom } from 'rxjs';
import { CategoriaService } from '../../../../core/categoria/categoria.service';
import { ProductoService } from '../../../../core/producto/producto.service';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { UploadService } from '../../../../core/upload/upload.service';
import { CatalogoStore } from '../../shared/catalogo.store';
import { esGuardar, vigilarCambios } from '../../shared/cambios-sin-guardar';
import { num, pl } from '../../shared/formato';
import { Categoria, ProductoV5 } from '../../shared/modelos';
import { EstadoPaginaComponent } from '../../shared/ui/estado-pagina.component';
import { FranjaMetricasComponent, MetricaFranja } from '../../shared/ui/franja-metricas.component';
import { icono } from '../../shared/ui/iconos';
import { ModuloCabeceraComponent } from '../../shared/ui/modulo-cabecera.component';
import { PestanasHojaComponent } from '../../shared/ui/pestanas-hoja.component';
import { PopoverDirective } from '../../shared/ui/popover.directive';
import {
  Borrador,
  Miniatura,
  Tono,
  miniaturaCategoria,
  nombreCategoria,
  ordenarArbol,
  productosPorCategoria,
  puntoEstado,
  tonoCategoria,
} from './categorias.util';
import { BarraSeleccionComponent } from './components/barra-seleccion.component';
import { CabeceraGrupoComponent } from './components/cabecera-grupo.component';
import { DesplegableComponent } from './components/desplegable.component';
import { FilaCategoria, FilaCategoriaComponent } from './components/fila-categoria.component';
import { MiniaturaComponent } from './components/miniatura.component';
import { ModalBorrarCategoriaComponent } from './components/modal-borrar-categoria.component';
import { PestanaGeneralComponent } from './components/pestana-general.component';
import { PestanaImagenComponent } from './components/pestana-imagen.component';
import { PestanaProductosComponent } from './components/pestana-productos.component';
import { PestanaTiendaComponent } from './components/pestana-tienda.component';
import { MenuActivo } from './menu-activo';
import { ProductosCategoria } from './productos-categoria';

type Pestana = 'general' | 'imagen' | 'productos' | 'tienda';
type Metrica = 'activas' | 'sub' | 'inactivas' | 'vacias';
type Agrupacion = 'arbol' | 'estado';

const ETIQUETA_METRICA: Record<Metrica, string> = {
  activas: 'Solo activas',
  sub: 'Solo subcategorías',
  inactivas: 'Solo inactivas',
  vacias: 'Sin productos',
};
const AGRUPACIONES: { k: Agrupacion; titulo: string; detalle: string; icono: string }[] = [
  { k: 'arbol', titulo: 'Árbol', detalle: 'Cada principal con sus subcategorías', icono: 'hierarchy-2' },
  { k: 'estado', titulo: 'Estado', detalle: 'Activas e inactivas', icono: 'eye' },
];
/** Columnas lista | hoja: solo la tarjeta de estado / la hoja a página completa, con hoja abierta, sin hoja. */
const COLUMNAS = {
  una: 'grid-cols-[minmax(0,1fr)]',
  conHoja: 'grid-cols-[minmax(300px,0.86fr)_minmax(0,1.34fr)]',
  sinHoja: 'grid-cols-[minmax(320px,1.3fr)_minmax(240px,0.7fr)]',
};
/** Miniatura de una categoría nueva sin imagen. */
const TONO_NUEVA: Tono = { fondo: '#f4f4f4', tinta: '#8a8a8a', icono: 'folder-plus' };
const ETIQUETAS: Partial<Record<keyof Borrador, string>> = {
  nombre: 'Nombre',
  descripcion: 'Descripción',
  categoriaPadreId: 'Categoría padre',
  activo: 'Activa',
  imagen: 'Imagen',
};

const vacio = (padre = ''): Borrador => ({ nombre: '', descripcion: '', categoriaPadreId: padre, activo: true, imagen: null });
const aBorrador = (c: Categoria): Borrador => ({
  nombre: c.nombre,
  descripcion: c.descripcion || '',
  categoriaPadreId: c.categoriaPadreId == null ? '' : String(c.categoriaPadreId),
  activo: c.activo,
  imagen: c.imagen,
});

/** Un bloque de la lista: una principal con sus hijas (árbol) o un grupo Activas / Inactivas (estado). */
interface Nodo {
  clave: string;
  /** Solo en la vista por estado. */
  activas: boolean | null;
  principal: Categoria | null;
  /** La principal no coincide con el filtro: se muestra atenuada por sus hijas. */
  enContexto: boolean;
  /** Hijas que pasan el filtro. */
  hijas: Categoria[];
  /** Todas sus hijas (para saber si se puede plegar). */
  todas: Categoria[];
  abierto: boolean;
}

/**
 * Categorías (Productos v5): cabecera con franja de métricas · lista en árbol
 * (o por estado) con arrastrar y soltar para cambiar de principal · hoja con
 * pestañas General / Imagen / Productos / Tienda. Datos en `CatalogoStore`.
 */
@Component({
  selector: 'app-product-categories-page',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    TablerIconComponent,
    PopoverDirective,
    ModuloCabeceraComponent,
    FranjaMetricasComponent,
    EstadoPaginaComponent,
    PestanasHojaComponent,
    BarraSeleccionComponent,
    CabeceraGrupoComponent,
    DesplegableComponent,
    FilaCategoriaComponent,
    MiniaturaComponent,
    ModalBorrarCategoriaComponent,
    PestanaGeneralComponent,
    PestanaImagenComponent,
    PestanaProductosComponent,
    PestanaTiendaComponent,
  ],
  providers: [MenuActivo, ProductosCategoria],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-categories-page.component.html',
  host: {
    class:
      'flex h-full min-h-0 flex-col overflow-hidden px-6 pt-6 font-[Inter] text-[13px] leading-[normal] text-[#111827] [&_tabler-icon]:inline-flex [&_tabler-icon]:shrink-0 [&_tabler-icon]:leading-[0] [&_:is(input,textarea)::placeholder]:text-[#9ca3af] [&_:is(input,textarea):disabled]:cursor-not-allowed',
  },
})
export class ProductCategoriesPageComponent {
  protected readonly s = inject(CatalogoStore);
  protected readonly menu = inject(MenuActivo);
  private readonly productos = inject(ProductosCategoria);
  private readonly alertas = inject(AlertaService);
  private readonly router = inject(Router);
  private readonly upload = inject(UploadService);
  private readonly categoriasApi = inject(CategoriaService);
  private readonly productosApi = inject(ProductoService);

  protected readonly icono = icono;
  protected readonly pl = pl;
  protected readonly num = num;
  protected readonly puntoEstado = puntoEstado;
  protected readonly agrupaciones = AGRUPACIONES;

  // ── estado de la lista ─────────────────────────────────────────────────
  protected readonly busqueda = signal('');
  protected readonly metrica = signal<Metrica | null>(null);
  protected readonly agrupacion = signal<Agrupacion>('arbol');
  /** Nodos plegados por clave ('r-<id>' en el árbol, 'e-on' / 'e-off' por estado). */
  private readonly plegados = signal<Record<string, boolean>>({});
  protected readonly periodo = signal('hoy');
  /** Fila con el mouse encima. */
  protected readonly encima = signal<number | null>(null);
  /** Categoría que se está arrastrando y destino bajo el puntero (0 = zona "principal"). */
  protected readonly arrastrada = signal<number | null>(null);
  protected readonly destino = signal<number | null>(null);
  /** Fila recién guardada (se ilumina un momento). */
  private readonly destello = signal<number | null>(null);
  protected readonly borrando = signal<{ id: number; productos: number; subcategorias: number } | null>(null);

  // ── estado de la hoja ──────────────────────────────────────────────────
  protected readonly seleccionada = signal<number | 'nueva' | null>(null);
  protected readonly borrador = signal<Borrador | null>(null);
  private readonly guardado = signal<Borrador | null>(null);
  /** Se intentó guardar con errores: se muestran aunque el campo no haya cambiado. */
  private readonly intento = signal(false);
  protected readonly pestana = signal<Pestana>('general');
  protected readonly completa = signal(false);
  private readonly guardando = signal(false);

  /** `creadoEn` de cada categoría (el store no lo guarda): solo para las sparklines. */
  private readonly creadas = signal<Map<number, number>>(new Map());
  private readonly general = viewChild(PestanaGeneralComponent);

  // ── permisos ───────────────────────────────────────────────────────────
  protected readonly puedeEditar = computed(() => this.s.puede('categorias.editar'));
  protected readonly puedeCrear = computed(() => this.s.puede('categorias.crear'));
  protected readonly puedeEliminar = computed(() => this.s.puede('categorias.eliminar'));

  // ── conteos ────────────────────────────────────────────────────────────
  private readonly conteos = computed(() => productosPorCategoria(this.s.productos()));
  private productosDe = (id: number) => this.conteos().get(id) ?? 0;
  /** Productos de la categoría más los de sus subcategorías. */
  private totalDe = (c: Categoria) =>
    this.productosDe(c.id) + this.s.categorias().filter((k) => k.categoriaPadreId === c.id).reduce((a, k) => a + this.productosDe(k.id), 0);
  /** En una subcategoría, sus productos; en una principal, el total. */
  private productosVisiblesDe = (c: Categoria) => (c.categoriaPadreId ? this.productosDe(c.id) : this.totalDe(c));
  private readonly nombre = (id: number | null) => nombreCategoria(this.s, id);
  private hijasDe = (id: number) => this.s.categorias().filter((c) => c.categoriaPadreId === id).sort((a, b) => a.id - b.id);
  private readonly principales = computed(() => this.s.categorias().filter((c) => !c.categoriaPadreId).sort((a, b) => a.id - b.id));
  private readonly arbol = computed(() => ordenarArbol(this.s.categorias()));

  // ── lista ──────────────────────────────────────────────────────────────
  private pasaFiltros(c: Categoria): boolean {
    const m = this.metrica();
    const q = this.busqueda().trim().toLowerCase();
    const okMetrica =
      !m ||
      (m === 'activas' ? c.activo : m === 'sub' ? !!c.categoriaPadreId : m === 'inactivas' ? !c.activo : this.totalDe(c) === 0);
    return okMetrica && (!q || c.nombre.toLowerCase().includes(q) || (c.descripcion || '').toLowerCase().includes(q));
  }

  private readonly nodos = computed((): Nodo[] => {
    const plegados = this.plegados();
    const buscando = !!this.busqueda().trim();
    const pasa = (c: Categoria) => this.pasaFiltros(c);
    if (this.agrupacion() === 'estado') {
      const todas = this.arbol().filter(pasa);
      return [true, false]
        .map((activas) => {
          const clave = activas ? 'e-on' : 'e-off';
          const hijas = todas.filter((c) => c.activo === activas);
          return { clave, activas, principal: null, enContexto: false, hijas, todas: hijas, abierto: !plegados[clave] };
        })
        .filter((n) => n.hijas.length);
    }
    return this.principales().flatMap((r) => {
      const todas = this.hijasDe(r.id);
      const hijas = todas.filter(pasa);
      const rPasa = pasa(r);
      if (!rPasa && !hijas.length) return [];
      const clave = 'r-' + r.id;
      return [{ clave, activas: null, principal: r, enContexto: !rPasa, hijas, todas, abierto: !plegados[clave] || (buscando && hijas.length > 0) }];
    });
  });

  /** Ids en el orden en que se ven (↑ ↓). */
  protected readonly visibles = computed(() =>
    this.nodos().flatMap((n) => [...(n.principal ? [n.principal.id] : []), ...(n.abierto ? n.hijas.map((c) => c.id) : [])]),
  );
  protected readonly cuantasVisibles = computed(() => this.nodos().reduce((a, n) => a + (n.principal && !n.enContexto ? 1 : 0) + n.hijas.length, 0));
  private readonly maxProductos = computed(() => Math.max(1, ...this.s.categorias().map((c) => this.productosVisiblesDe(c))));

  /** Se puede soltar `id` sobre `destino` (0 = dejarla como principal). */
  private puedeSoltar(id: number | null, destino: number): boolean {
    if (id == null || id === destino) return false;
    if (this.s.categorias().some((c) => c.categoriaPadreId === id)) return false;
    const d = this.s.categoria(id);
    if (!d) return false;
    if (destino === 0) return d.categoriaPadreId != null;
    const t = this.s.categoria(destino);
    return !!t && !t.categoriaPadreId && d.categoriaPadreId !== destino;
  }

  private fila(c: Categoria, subnivel: boolean, nodo?: Nodo): FilaCategoria {
    const arbol = this.agrupacion() === 'arbol';
    const encima = this.encima(), arrastrada = this.arrastrada(), sel = this.seleccionada();
    const nHijas = this.s.categorias().filter((k) => k.categoriaPadreId === c.id).length;
    const n = this.productosVisiblesDe(c);
    const arrastrable = this.puedeEditar() && nHijas === 0;
    const valida = arrastrada != null && this.puedeSoltar(arrastrada, c.id);
    const asa = arrastrable && encima === c.id && arrastrada == null;
    const descripcion = c.descripcion || 'Sin descripción';
    const detalle = subnivel
      ? descripcion
      : c.categoriaPadreId
        ? this.nombre(c.categoriaPadreId) + ' › ' + descripcion
        : (nHijas ? pl(nHijas, 'subcategoría', 'subcategorías') : 'Sin subcategorías') + (c.descripcion ? ' · ' + c.descripcion : '');
    return {
      id: c.id,
      nombre: c.nombre,
      detalle,
      miniatura: miniaturaCategoria(this.s, c),
      activa: c.activo,
      subnivel,
      negrita: sel === c.id || (!subnivel && arbol),
      productos: n,
      barra: Math.max(n ? 4 : 0, (n / this.maxProductos()) * 100),
      resaltada: sel === c.id || encima === c.id,
      arrastrable,
      marca: nodo?.todas.length ? 'plegar' : asa ? 'asa' : subnivel ? 'flecha' : 'barra',
      abierta: !!nodo?.abierto,
      destino: arrastrada != null && this.destino() === c.id ? 'actual' : valida ? 'posible' : null,
      destello: this.destello() === c.id,
      atenuada: arrastrada === c.id ? 'arrastrada' : arrastrada != null && !valida ? 'invalida' : nodo?.enContexto ? 'contexto' : null,
    };
  }
  /** Lo que se dibuja: cada nodo con sus filas. */
  protected readonly listado = computed(() => {
    const arbol = this.agrupacion() === 'arbol';
    return this.nodos().map((n) => ({
      clave: n.clave,
      activas: n.activas,
      abierto: n.abierto,
      principal: n.principal ? this.fila(n.principal, false, n) : null,
      hijas: n.hijas.map((c) => this.fila(c, arbol)),
    }));
  });

  protected readonly cargando = computed(() => this.s.cargando() && !this.s.cargado());
  protected readonly conError = computed(() => !!this.s.error() && !this.s.cargado() && !this.cargando());
  protected readonly sinCategorias = computed(() => this.s.cargado() && !this.s.categorias().length && !this.conError());
  /** Error o vacío: en lugar de lista y hoja va una sola tarjeta. */
  protected readonly soloEstado = computed(() => this.conError() || this.sinCategorias());
  protected readonly hayLista = computed(() => !this.soloEstado() && !this.cargando() && this.nodos().length > 0);
  protected readonly sinCoincidencias = computed(() => !this.soloEstado() && !this.cargando() && this.s.cargado() && this.nodos().length === 0);
  protected readonly esqueleto = [1, 2, 3, 4, 5, 6, 7];

  /** Pastillas de los filtros activos. */
  protected readonly filtros = computed(() => {
    const m = this.metrica(), q = this.busqueda();
    return [...(m ? [{ k: 'metrica' as const, label: ETIQUETA_METRICA[m] }] : []), ...(q ? [{ k: 'busqueda' as const, label: '«' + q + '»' }] : [])];
  });
  /** Zona "Suelta aquí para dejarla como principal" (arrastrando una subcategoría en el árbol). */
  protected readonly zonaPrincipal = computed(() => this.arrastrada() != null && this.puedeSoltar(this.arrastrada(), 0) && this.agrupacion() === 'arbol');

  // ── cabecera ───────────────────────────────────────────────────────────
  protected readonly lectura = computed(() => {
    const cs = this.s.categorias(), sinCat = this.s.productos().filter((p) => p.categoriaId == null).length;
    const mayor = this.arbol()
      .filter((c) => c.categoriaPadreId)
      .sort((a, b) => this.productosDe(b.id) - this.productosDe(a.id))[0];
    return (
      `${cs.length} categorías en ${this.principales().length} grupos principales. ` +
      `«${mayor ? mayor.nombre : '—'}» concentra ${mayor ? this.productosDe(mayor.id) : 0} productos. ` +
      (sinCat ? sinCat + (sinCat === 1 ? ' producto no tiene categoría.' : ' productos no tienen categoría.') : 'Todos los productos tienen categoría.')
    );
  });

  /**
   * Sparklines: el backend no guarda historia de categorías, así que la serie se
   * deriva de lo que sí hay — cuántas de las categorías / productos de hoy ya
   * existían (por `creadoEn`) en 12 puntos del período. Sin cambios = línea plana.
   */
  private serie(fn: (t: number) => number): string {
    const ahora = Date.now(), p = this.periodo();
    const inicio = p === 'hoy' ? new Date(new Date().setHours(0, 0, 0, 0)).getTime() : ahora - (p === '7' ? 7 : 30) * 864e5;
    const xs = Array.from({ length: 12 }, (_, i) => fn(inicio + ((ahora - inicio) * i) / 11));
    const mn = Math.min(...xs), mx = Math.max(...xs);
    return xs.map((x, i) => (i * (62 / 11) + 1).toFixed(1) + ',' + (20 - (mx === mn ? 0.5 : 0.1 + (0.8 * (x - mn)) / (mx - mn)) * 18).toFixed(1)).join(' ');
  }
  protected readonly metricas = computed((): MetricaFranja[] => {
    const cs = this.s.categorias(), ps = this.s.productos(), m = this.metrica();
    const inactivas = cs.filter((c) => !c.activo).length;
    const vacias = cs.filter((c) => this.totalDe(c) === 0).length;
    const sinCat = ps.filter((p) => p.categoriaId == null).length;
    const nPrincipales = this.principales().length;
    const creadas = this.creadas();
    const existia = (t: number) => (c: Categoria) => (creadas.get(c.id) ?? 0) <= t;
    const creadoEn = (p: ProductoV5) => new Date(p.creadoEn).getTime();
    const vaciaEn = (t: number) => (c: Categoria) => {
      const ids = new Set([c.id, ...cs.filter((k) => k.categoriaPadreId === c.id).map((k) => k.id)]);
      return !ps.some((p) => p.categoriaId != null && ids.has(p.categoriaId) && creadoEn(p) <= t);
    };
    const metrica = (k: string, label: string, value: string, delta: string, sparkColor: string, tinta: string, spark: string): MetricaFranja => ({
      k, label, value, delta, sparkColor, tinta, spark, activa: m === k,
    });
    return [
      metrica('activas', 'Activas en la tienda', String(cs.length - inactivas), 'de ' + cs.length + ' categorías', '#087b5d', '#303030',
        this.serie((t) => cs.filter((c) => c.activo && existia(t)(c)).length)),
      metrica('sub', 'Subcategorías', String(cs.length - nPrincipales), 'en ' + pl(nPrincipales, 'principal', 'principales'), '#303030', '#303030',
        this.serie((t) => cs.filter((c) => c.categoriaPadreId && existia(t)(c)).length)),
      metrica('inactivas', 'Inactivas', String(inactivas), inactivas ? 'Ocultas en la tienda' : 'Ninguna', '#9ca3af', '#303030',
        this.serie((t) => cs.filter((c) => !c.activo && existia(t)(c)).length)),
      metrica('vacias', 'Sin productos', String(vacias), vacias ? 'Candidatas a eliminar' : 'Todas tienen productos', '#ffb904', vacias ? '#8a5a00' : '#303030',
        this.serie((t) => cs.filter((c) => existia(t)(c) && vaciaEn(t)(c)).length)),
      metrica('sincat', 'Productos sin categoría', String(sinCat), 'clic: verlos en Products', '#d82c0d', sinCat ? '#b42318' : '#303030',
        this.serie((t) => ps.filter((p) => p.categoriaId == null && creadoEn(p) <= t).length)),
    ];
  });

  // ── hoja ───────────────────────────────────────────────────────────────
  protected readonly abierta = computed(() => this.seleccionada() != null && !!this.borrador());
  protected readonly columnas = computed(() =>
    this.soloEstado() || (this.abierta() && this.completa()) ? COLUMNAS.una : this.abierta() ? COLUMNAS.conHoja : COLUMNAS.sinHoja,
  );
  /** La hoja a página completa tapa cabecera y lista. */
  protected readonly aPaginaCompleta = computed(() => this.abierta() && this.completa());
  protected readonly sucio = computed(() => {
    const d = this.borrador(), o = this.guardado();
    return !!d && !!o && JSON.stringify(d) !== JSON.stringify(o);
  });
  private readonly errorNombre = computed(() => {
    const d = this.borrador();
    if (!d) return '';
    const id = this.seleccionada() === 'nueva' ? null : this.seleccionada();
    if (!d.nombre.trim()) return 'Escribe el nombre.';
    if (this.s.categorias().some((c) => c.id !== id && c.nombre.toLowerCase() === d.nombre.trim().toLowerCase())) return 'Ya existe una categoría con este nombre.';
    return '';
  });
  /** El error se muestra al intentar guardar o en cuanto se toca el nombre. */
  protected readonly errorNombreVisible = computed(() => {
    const e = this.errorNombre();
    return e && (this.intento() || this.borrador()?.nombre !== this.guardado()?.nombre) ? e : '';
  });
  protected readonly pestanas = computed(() => [
    { k: 'general', label: 'General', err: !!this.errorNombreVisible() },
    { k: 'imagen', label: 'Imagen' },
    { k: 'productos', label: 'Productos' },
    { k: 'tienda', label: 'Tienda' },
  ]);

  protected readonly hoja = computed(() => {
    const d = this.borrador(), sel = this.seleccionada();
    if (!d || sel == null) return null;
    const nueva = sel === 'nueva', id = nueva ? null : sel;
    const c = id == null ? undefined : this.s.categoria(id);
    if (!nueva && !c) return null;
    const padreId = d.categoriaPadreId === '' ? null : +d.categoriaPadreId;
    const esPrincipal = padreId == null;
    const hijas = id == null ? [] : this.s.categorias().filter((k) => k.categoriaPadreId === id);
    const productos = c ? (esPrincipal ? this.totalDe(c) : this.productosDe(c.id)) : 0;
    const totalCatalogo = this.s.productos().length;
    const ids = this.visibles(), pos = id == null ? -1 : ids.indexOf(id);
    const tono = nueva ? TONO_NUEVA : tonoCategoria(this.s, { id: id!, categoriaPadreId: padreId });
    const miniatura: Miniatura = d.imagen ? { tipo: 'imagen', url: d.imagen } : { tipo: 'icono', ...tono };
    return {
      nueva,
      id,
      esPrincipal,
      soloLectura: !this.s.puede(nueva ? 'categorias.crear' : 'categorias.editar'),
      etiqueta: nueva ? 'Nueva categoría' : (esPrincipal ? 'Categoría principal' : 'Subcategoría') + ' · #' + id,
      posicion: !nueva && pos >= 0 && ids.length > 1 ? { indice: pos, total: ids.length } : null,
      titulo: d.nombre.trim() || (nueva ? 'Nueva categoría' : c!.nombre),
      nombrePadre: esPrincipal ? 'Principal' : this.nombre(padreId),
      resumen: nueva ? 'Sin guardar' : pl(productos, 'producto', 'productos') + (hijas.length ? ' · ' + pl(hijas.length, 'subcategoría', 'subcategorías') : ''),
      productos,
      /** Parte del catálogo, en % (ancho de la barra y texto redondeado). */
      parteCatalogo: Math.min(100, (productos / (totalCatalogo || 1)) * 100),
      porcentaje: Math.round((productos / (totalCatalogo || 1)) * 100),
      totalCatalogo,
      tono,
      miniatura,
      subcategorias: hijas.map((k) => ({
        id: k.id,
        nombre: k.nombre,
        miniatura: miniaturaCategoria(this.s, k),
        activa: k.activo,
        productos: pl(this.productosDe(k.id), 'producto', 'productos'),
      })),
      subcategoriasEnTienda: esPrincipal ? hijas.filter((k) => k.activo).map((k) => k.nombre) : [],
    };
  });

  /** Productos marcados en la pestaña Productos (muestra la barra de selección). */
  protected readonly seleccionados = computed(() => (this.hoja() && this.pestana() === 'productos' ? this.productos.seleccion().size : 0));

  constructor() {
    this.s.asegurar();
    vigilarCambios({
      borrador: this.borrador,
      guardado: this.guardado,
      etiquetas: ETIQUETAS,
      nuevo: () => false,
      tituloNuevo: 'Categoría sin guardar',
      textoNuevo: 'Todavía no se ha creado. Guárdala para que aparezca en la lista y en la tienda.',
      guardar: () => this.guardar(),
      descartar: () => this.descartar(),
      invalido: () => (this.intento() && this.errorNombre() ? { titulo: 'Revisa los campos marcados', texto: this.errorNombre() } : null),
    });
    // ?categoria=ID abre su hoja.
    const pedida = Number(inject(ActivatedRoute).snapshot.queryParamMap.get('categoria'));
    if (pedida) this.s.alListo(() => this.s.categoria(pedida) && this.abrir(pedida));
    // creadoEn para las sparklines (se vuelve a pedir si cambia la cantidad).
    effect(() => {
      if (this.s.categorias().length) untracked(() => this.traerFechas());
    });
    // La barra de selección empuja la pila de alertas hacia arriba.
    effect(() => this.alertas.desplazamiento.set(this.seleccionados() ? 54 : 0));
    inject(DestroyRef).onDestroy(() => this.alertas.desplazamiento.set(0));
  }

  private traerFechas(): void {
    this.categoriasApi.listar().subscribe({
      next: (xs) => this.creadas.set(new Map(xs.map((c) => [c.id, new Date((c as unknown as { creadoEn?: string }).creadoEn ?? Date.now()).getTime()]))),
      error: () => {},
    });
  }

  // ── acciones: lista ────────────────────────────────────────────────────
  @HostListener('document:click')
  protected cerrarMenus(): void {
    this.menu.cerrar();
  }
  protected elegirMetrica(k: string): void {
    if (k === 'sincat') return this.irProductos(0);
    this.metrica.update((x) => (x === k ? null : (k as Metrica)));
    this.plegados.set({});
  }
  protected quitarFiltro(k: 'metrica' | 'busqueda'): void {
    if (k === 'metrica') this.metrica.set(null);
    else this.busqueda.set('');
  }
  protected limpiarFiltros(): void {
    this.metrica.set(null);
    this.busqueda.set('');
  }
  protected alternarNodo(clave: string): void {
    this.plegados.update((c) => ({ ...c, [clave]: !c[clave] }));
  }
  protected elegirAgrupacion(k: Agrupacion): void {
    this.agrupacion.set(k);
    this.menu.cerrar();
    this.plegados.set({});
  }
  protected plegarTodos(plegar: boolean): void {
    this.plegados.set(plegar ? Object.fromEntries(this.nodos().map((n) => [n.clave, true])) : {});
    this.menu.cerrar();
  }
  protected salirDeFila(id: number): void {
    if (this.encima() === id) this.encima.set(null);
  }

  // ── arrastrar una categoría a otra principal ───────────────────────────
  private inicioArrastre: ReturnType<typeof setTimeout> | undefined;
  protected iniciarArrastre(ev: DragEvent, f: FilaCategoria): void {
    if (!f.arrastrable) return ev.preventDefault();
    if (ev.dataTransfer) {
      ev.dataTransfer.effectAllowed = 'move';
      try {
        ev.dataTransfer.setData('text/plain', String(f.id));
      } catch {
        /* algunos navegadores no dejan escribir aquí */
      }
    }
    // Después del dragstart, para que la imagen fantasma salga sin atenuar.
    clearTimeout(this.inicioArrastre);
    this.inicioArrastre = setTimeout(() => {
      this.arrastrada.set(f.id);
      this.encima.set(null);
    }, 0);
  }
  protected terminarArrastre(): void {
    clearTimeout(this.inicioArrastre);
    this.arrastrada.set(null);
    this.destino.set(null);
  }
  protected arrastrarSobre(ev: DragEvent, id: number): void {
    if (!this.puedeSoltar(this.arrastrada(), id)) return;
    ev.preventDefault();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
    this.destino.set(id);
  }
  protected salirDeDestino(ev: DragEvent, id: number): void {
    if ((ev.currentTarget as HTMLElement).contains(ev.relatedTarget as Node)) return;
    if (this.destino() === id) this.destino.set(null);
  }
  protected soltar(ev: DragEvent, id: number): void {
    ev.preventDefault();
    ev.stopPropagation();
    const d = this.arrastrada();
    this.arrastrada.set(null);
    this.destino.set(null);
    if (d == null || !this.puedeSoltar(d, id)) return;
    const padre = id === 0 ? null : id;
    this.s.moverCategoria(d, padre);
    if (this.seleccionada() === d) {
      const v = padre == null ? '' : String(padre);
      this.borrador.update((b) => (b ? { ...b, categoriaPadreId: v } : b));
      this.guardado.update((b) => (b ? { ...b, categoriaPadreId: v } : b));
    }
  }
  protected readonly textoArrastre = computed(() => 'Moviendo «' + this.nombre(this.arrastrada()) + '» · suéltala sobre una principal');

  // ── acciones: hoja ─────────────────────────────────────────────────────
  protected abrir(id: number): void {
    if (this.seleccionada() === id) return;
    if (this.sucio()) return this.alertas.sacudir();
    const c = this.s.categoria(id);
    if (!c) return;
    this.mostrar(id, aBorrador(c));
    this.menu.cerrar();
    this.productos.reiniciar();
  }
  protected nueva(padre = ''): void {
    if (this.s.niega('categorias.crear')) return;
    if (this.sucio()) return this.alertas.sacudir();
    this.mostrar('nueva', vacio(padre));
    this.pestana.set('general');
    this.enfocarNombre();
  }
  private mostrar(sel: number | 'nueva' | null, d: Borrador | null): void {
    this.seleccionada.set(sel);
    this.borrador.set(d);
    this.guardado.set(d && { ...d });
    this.intento.set(false);
  }
  private enfocarNombre(): void {
    setTimeout(() => this.general()?.enfocarNombre(), 60);
  }
  protected cerrar(): void {
    if (this.sucio()) return this.alertas.sacudir();
    this.completa.set(false);
    this.mostrar(null, null);
  }
  protected paso(d: number): void {
    const ids = this.visibles(), cur = this.seleccionada();
    if (!ids.length) return;
    const i = typeof cur === 'number' ? ids.indexOf(cur) : -1;
    const n = i < 0 ? ids[d > 0 ? 0 : ids.length - 1] : ids[Math.min(ids.length - 1, Math.max(0, i + d))];
    if (n != null && n !== cur) this.abrir(n);
  }
  protected cambiar(cambios: Partial<Borrador>): void {
    this.borrador.update((b) => (b ? { ...b, ...cambios } : b));
  }
  protected alternarMenuEstado(e: Event): void {
    if (!this.hoja()?.soloLectura) this.menu.alternar('estado', e);
  }
  protected elegirEstado(activo: boolean): void {
    if (this.hoja()?.soloLectura) return;
    this.cambiar({ activo });
    this.menu.cerrar();
  }
  protected irPestana(k: string): void {
    this.pestana.set(k as Pestana);
    if (k === 'general' && this.seleccionada() === 'nueva') this.enfocarNombre();
  }

  protected async guardar(): Promise<void> {
    const d = this.borrador(), sel = this.seleccionada();
    if (!d || sel == null || this.guardando()) return;
    const nueva = sel === 'nueva';
    if (this.s.niega(nueva ? 'categorias.crear' : 'categorias.editar')) return;
    if (this.errorNombre()) {
      this.intento.set(true);
      this.pestana.set('general');
      this.alertas.sacudir();
      return;
    }
    this.guardando.set(true);
    const base: Categoria = {
      id: nueva ? 0 : sel,
      nombre: d.nombre,
      descripcion: d.descripcion,
      categoriaPadreId: d.categoriaPadreId === '' ? null : +d.categoriaPadreId,
      imagen: d.imagen,
      activo: d.activo,
    };
    const r = await this.s.guardarCategoria(base, nueva);
    this.guardando.set(false);
    if (!r) return;
    this.mostrar(r.id, aBorrador(r));
    this.iluminar(r.id);
  }
  private iluminar(id: number): void {
    this.destello.set(id);
    setTimeout(() => this.destello() === id && this.destello.set(null), 1200);
  }
  protected descartar(): void {
    if (this.seleccionada() === 'nueva') this.mostrar(null, null);
    else {
      this.borrador.set({ ...this.guardado()! });
      this.intento.set(false);
    }
  }

  protected subirImagen(f: File | undefined): void {
    if (!f) return;
    if (!/^image\//.test(f.type)) {
      this.alertas.mostrar({ estado: 'warning', titulo: 'Solo se aceptan imágenes', texto: 'JPG, PNG o WebP · hasta 8 MB' });
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      this.alertas.mostrar({ estado: 'warning', titulo: 'La imagen pesa más de 8 MB', texto: f.name });
      return;
    }
    const aviso = this.alertas.mostrar({ titulo: 'Subiendo imagen', texto: f.name });
    this.upload.subir(f).subscribe({
      next: (r) => {
        this.cambiar({ imagen: r.url });
        this.alertas.resolver(aviso, { estado: 'success', titulo: 'Imagen lista', texto: 'Guarda para aplicarla' });
      },
      error: () => this.alertas.resolver(aviso, { estado: 'error', titulo: 'No se pudo subir la imagen', texto: f.name }),
    });
  }

  /** A Products filtrado por categoría (0 = sin categoría) o con un producto abierto. */
  protected irProductos(categoria: number | null, producto?: number): void {
    if (this.sucio()) return this.alertas.sacudir();
    this.router.navigate(['/products'], { queryParams: producto != null ? { producto } : { categoria } });
  }

  // ── eliminar ───────────────────────────────────────────────────────────
  protected pedirBorrar(): void {
    const id = this.seleccionada();
    this.menu.cerrar();
    if (typeof id !== 'number' || this.s.niega('categorias.eliminar')) return;
    this.borrando.set({
      id,
      productos: this.productosDe(id),
      subcategorias: this.s.categorias().filter((c) => c.categoriaPadreId === id).length,
    });
  }
  /**
   * El backend solo borra categorías sin productos ni hijas (409 si no):
   * primero se mueven sus productos, después sus hijas pasan a principales
   * y recién ahí se borra.
   */
  protected async borrar(id: number, destino: number | null): Promise<void> {
    const nombre = this.nombre(id);
    this.borrando.set(null);
    const prods = this.s.productos().filter((x) => x.categoriaId === id).map((x) => x.id);
    const hijas = this.s.categorias().filter((c) => c.categoriaPadreId === id).map((c) => c.id);
    const aviso = this.alertas.mostrar({ titulo: 'Eliminando categoría', texto: nombre });
    try {
      await Promise.all(prods.map((pid) => firstValueFrom(this.productosApi.actualizar(pid, { categoriaId: destino }))));
      this.s.productos.update((xs) => xs.map((x) => (prods.includes(x.id) ? { ...x, categoriaId: destino } : x)));
      await Promise.all(hijas.map((k) => firstValueFrom(this.categoriasApi.actualizar(k, { categoriaPadreId: null }))));
      this.s.categorias.update((xs) => xs.map((c) => (hijas.includes(c.id) ? { ...c, categoriaPadreId: null } : c)));
      await firstValueFrom(this.categoriasApi.eliminar(id));
      this.s.categorias.update((xs) => xs.filter((c) => c.id !== id));
      if (this.seleccionada() === id) {
        this.completa.set(false);
        this.mostrar(null, null);
      }
      this.alertas.resolver(aviso, { estado: 'success', titulo: '«' + nombre + '» eliminada' });
    } catch (e) {
      const msg = (e as { error?: { message?: string } })?.error?.message;
      this.alertas.resolver(aviso, { estado: 'error', titulo: 'No se pudo eliminar', texto: typeof msg === 'string' && msg ? msg : nombre });
      this.s.asegurar();
    }
  }

  protected exportar(): void {
    const esc = (v: unknown) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const filas = this.arbol().map((c) =>
      [c.id, c.nombre, c.categoriaPadreId ? this.nombre(c.categoriaPadreId) : '', c.activo ? 'si' : 'no', this.productosVisiblesDe(c), c.descripcion].map(esc).join(','),
    );
    const csv = ['id,nombre,padre,activo,productos,descripcion', ...filas].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
    a.download = 'categorias.csv';
    a.click();
    this.alertas.mostrar({ estado: 'success', titulo: this.s.categorias().length + ' categorías exportadas a CSV' });
  }

  // ── teclado ────────────────────────────────────────────────────────────
  @HostListener('document:keydown', ['$event'])
  protected teclas(e: KeyboardEvent): void {
    if (esGuardar(e)) {
      e.preventDefault();
      if (this.sucio()) this.guardar();
      else this.alertas.mostrar({ estado: 'info', titulo: 'No hay cambios por guardar' });
      return;
    }
    if (e.key === 'Escape') {
      if (this.borrando()) return this.borrando.set(null);
      if (this.menu.actual()) return this.menu.cerrar();
      if (this.seleccionados()) return this.productos.seleccion.set(new Set());
      return;
    }
    const tag = (document.activeElement as HTMLElement | null)?.tagName ?? '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag) || e.metaKey || e.ctrlKey || e.altKey || this.borrando()) return;
    if (e.key === 'Home' || e.key === 'End') {
      const el = document.querySelector<HTMLElement>('[data-atajo="lista"]');
      if (el) {
        e.preventDefault();
        el.scrollTo({ top: e.key === 'Home' ? 0 : el.scrollHeight, behavior: 'smooth' });
      }
      return;
    }
    if (e.key === '/') {
      const el = document.querySelector<HTMLInputElement>('[data-atajo="cbuscar"]');
      if (el) {
        e.preventDefault();
        el.focus();
      }
      return;
    }
    if (e.key === 'n' && this.s.puede('categorias.crear')) {
      e.preventDefault();
      this.nueva();
      return;
    }
    const d = e.key === 'ArrowDown' || e.key === 'j' ? 1 : e.key === 'ArrowUp' || e.key === 'k' ? -1 : 0;
    if (d) {
      e.preventDefault();
      this.paso(d);
    }
  }
}
