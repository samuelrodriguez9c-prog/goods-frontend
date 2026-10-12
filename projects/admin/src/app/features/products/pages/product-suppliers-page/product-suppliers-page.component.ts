import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TablerIconComponent } from '@tabler/icons-angular';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { CatalogoStore } from '../../shared/catalogo.store';
import { esGuardar, vigilarCambios } from '../../shared/cambios-sin-guardar';
import { cop, dias, hace, num, pl } from '../../shared/formato';
import { CompraV5, LineaCompra, ProveedorV5 } from '../../shared/modelos';
import { AccionProveedor, DIAS, accionProveedor, proximaEntrega, statProveedor } from '../../shared/proveedores.util';
import { EstadoPaginaComponent } from '../../shared/ui/estado-pagina.component';
import { FranjaMetricasComponent, MetricaFranja } from '../../shared/ui/franja-metricas.component';
import { icono } from '../../shared/ui/iconos';
import { ModuloCabeceraComponent } from '../../shared/ui/modulo-cabecera.component';
import { PestanaHojaV5, PestanasHojaComponent } from '../../shared/ui/pestanas-hoja.component';
import { PopoverDirective } from '../../shared/ui/popover.directive';
import { AccionProveedorComponent } from './components/accion-proveedor.component';
import { FilaProveedorComponent } from './components/fila-proveedor.component';
import { GrupoProveedoresComponent } from './components/grupo-proveedores.component';
import { ModalCompraRapidaComponent } from './components/modal-compra-rapida.component';
import { ModalBajaComponent } from './components/modal-baja.component';
import { PestanaComprasComponent } from './components/pestana-compras.component';
import { PestanaGeneralComponent } from './components/pestana-general.component';
import { PestanaProductosComponent } from './components/pestana-productos.component';
import { TarjetaContactoComponent } from './components/tarjeta-contacto.component';
import { TarjetaProveedorComponent } from './components/tarjeta-proveedor.component';
import {
  Agrupacion, CampoTexto, ETIQUETAS_CAMPOS, Errores, FilaProveedor, FiltroCompras, GrupoProveedores, MESES_CORTOS, Menu, Metrica, Modal,
  PestanaProveedor, Vista, borradorDe, proveedorVacio, puntosSpark,
} from './proveedores.modelo';

const AGRUPACIONES: { k: Agrupacion; titulo: string; detalle: string; icono: string }[] = [
  { k: 'estado', titulo: 'Estado', detalle: 'Activos e inactivos', icono: 'circle-check' },
  { k: 'accion', titulo: 'Próxima acción', detalle: 'Recibir, reponer, sin compras recientes', icono: 'bolt' },
  { k: 'dia', titulo: 'Día de entrega', detalle: 'Para planear los pedidos de la semana', icono: 'calendar-event' },
];
/** Grupos por próxima acción: [clave, título, ícono, fondo, tinta, detalle]. */
const GRUPOS_ACCION = [
  ['recibir', 'Por recibir', 'package-import', '#fff6d1', '#8a5a00', 'Tienen mercancía en camino'],
  ['reponer', 'Por reponer', 'truck-delivery', '#ffe6e5', '#b42318', 'Surten productos bajo el mínimo'],
  ['frio', 'Sin compras recientes', 'zzz', '#f1f1f1', '#6b7280', 'Hace más de 30 días o nunca'],
  ['ok', 'Al día', 'circle-check', '#e6f6ec', '#087b5d', 'Nada pendiente'],
] as const;
const VISTAS: { k: Vista; icono: string; titulo: string }[] = [
  { k: 'lista', icono: 'list', titulo: 'Lista' },
  { k: 'tarjetas', icono: 'layout-grid', titulo: 'Tarjetas' },
];
/** Opciones del menú de estado de la hoja. */
const ESTADOS = [
  { activo: true, titulo: 'Activo', detalle: 'Aparece al crear compras' },
  { activo: false, titulo: 'Inactivo', detalle: 'Se oculta; conserva su historial' },
];
/** Texto del chip de la métrica que filtra la lista. */
const FILTRO_METRICA: Record<Metrica, string> = {
  activos: 'Solo activos', inactivos: 'Solo inactivos', pend: 'Con compras por recibir', mes: 'Compraste en 30 días',
};

/**
 * Proveedores (Productos v5): cabecera, franja de métricas, lista agrupable
 * (Lista / Tarjetas) con la próxima acción de cada proveedor y la hoja
 * (tarjeta de contacto · General · Compras · Productos). La ficha queda como
 * borrador hasta guardar ("Cambios sin guardar"); compra rápida y baja van en modales.
 */
@Component({
  selector: 'app-product-suppliers-page',
  standalone: true,
  imports: [
    TablerIconComponent, ModuloCabeceraComponent, FranjaMetricasComponent, EstadoPaginaComponent, PestanasHojaComponent, PopoverDirective,
    GrupoProveedoresComponent, FilaProveedorComponent, TarjetaProveedorComponent, AccionProveedorComponent, TarjetaContactoComponent,
    PestanaGeneralComponent, PestanaComprasComponent, PestanaProductosComponent, ModalCompraRapidaComponent, ModalBajaComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-suppliers-page.component.html',
  host: {
    class: 'flex h-full min-h-0 flex-col [&_tabler-icon]:inline-flex [&_tabler-icon]:shrink-0 [&_tabler-icon_svg]:block',
    '(document:click)': 'menu.set(null)',
    '(document:keydown)': 'atajos($event)',
  },
})
export class ProductSuppliersPageComponent {
  protected readonly catalogo = inject(CatalogoStore);
  private readonly alertas = inject(AlertaService);
  private readonly router = inject(Router);

  protected readonly icono = icono;
  protected readonly num = num;
  protected readonly pl = pl;
  protected readonly estados = ESTADOS;
  protected readonly agrupaciones = AGRUPACIONES;
  protected readonly vistas = VISTAS;
  protected readonly filtroMetrica = FILTRO_METRICA;

  private readonly franja = viewChild(FranjaMetricasComponent);
  private readonly general = viewChild(PestanaGeneralComponent);
  private readonly buscador = viewChild<ElementRef<HTMLInputElement>>('buscador');

  // ── Estado de la pantalla ──
  /** Período de la franja: 'hoy' · '7' · '30' (días por tramo de las sparklines). */
  protected readonly periodo = signal('hoy');
  protected readonly busqueda = signal('');
  protected readonly metrica = signal<Metrica | null>(null);
  protected readonly agrupacion = signal<Agrupacion>('estado');
  /** Grupos plegados, por clave. */
  protected readonly plegados = signal<Record<string, boolean>>({});
  protected readonly vista = signal<Vista>('lista');
  protected readonly menu = signal<Menu | null>(null);
  /** La hoja ocupa toda la pantalla (sin cabecera ni lista). */
  protected readonly expandida = signal(false);
  protected readonly modal = signal<Modal>(null);
  // Hoja
  protected readonly seleccionado = signal<number | 'nuevo' | null>(null);
  private readonly pestana = signal<PestanaProveedor>('general');
  /** Se conserva al cambiar de pestaña o de proveedor. */
  protected readonly filtroCompras = signal<FiltroCompras>('todas');
  // Borrador de la ficha (alimenta "Cambios sin guardar").
  private readonly guardado = signal<ProveedorV5 | null>(null);
  private readonly borrador = signal<ProveedorV5 | null>(null);
  /** Pidió editar con "Editar" (con cambios o errores visibles también se queda en edición). */
  private readonly editando = signal(false);
  /** Intentó guardar: muestra todos los errores, no solo los de campos tocados. */
  private readonly intento = signal(false);
  private readonly guardando = signal(false);

  // ── Datos ──
  private readonly stat = (id: number) => statProveedor(this.catalogo, id);
  private readonly proxima = (ds: number[] | undefined) => proximaEntrega(ds ?? [], this.catalogo.hoy());

  protected readonly cuenta = computed(() => this.catalogo.proveedores().length);
  protected readonly puedeCrear = computed(() => this.catalogo.puede('proveedores.crear'));
  protected readonly puedeEditar = computed(() => this.catalogo.puede('proveedores.editar'));
  protected readonly puedeComprar = computed(() => this.catalogo.puede('compras.crear'));
  protected readonly puedeEliminar = computed(() => this.catalogo.puede('proveedores.eliminar'));
  private readonly esNuevo = computed(() => this.seleccionado() === 'nuevo');
  private readonly sucio = computed(() => {
    const b = this.borrador(), g = this.guardado();
    return !!b && !!g && JSON.stringify(b) !== JSON.stringify(g);
  });

  protected readonly carga = computed<'cargando' | 'error' | 'vacio' | 'lista'>(() => {
    const c = this.catalogo;
    if (!c.cargado()) return c.error() ? 'error' : 'cargando';
    return c.proveedores().length === 0 && !this.esNuevo() ? 'vacio' : 'lista';
  });
  /** Error o vacío: solo la tarjeta de estado, sin lista ni hoja. */
  protected readonly soloEstado = computed(() => this.carga() === 'error' || this.carga() === 'vacio');

  // ── Cabecera y métricas ──
  protected readonly lectura = computed(() => {
    const ps = this.catalogo.proveedores(), cs = this.catalogo.compras(), hoy = this.catalogo.hoy();
    if (!ps.length) return '';
    const activos = ps.filter((p) => p.activo).length, pendientes = cs.filter((c) => c.estado === 'pendiente').length;
    const mes = cs.filter((c) => c.estado === 'recibida' && dias(c.fecha, hoy) < 30);
    const principal = ps.map((p) => [p, this.stat(p.id).total] as const).sort((a, b) => b[1] - a[1])[0];
    return (
      `${activos} activos. En el último mes recibiste ${cop(mes.reduce((t, c) => t + this.catalogo.totalCompra(c), 0))} en ${pl(mes.length, 'compra', 'compras')}; ` +
      (principal && principal[1] > 0 ? `«${principal[0].nombre}» es tu principal proveedor. ` : '') +
      `${pl(pendientes, 'compra sigue pendiente', 'compras siguen pendientes')} por recibir.`
    );
  });
  protected readonly metricas = computed<MetricaFranja[]>(() => {
    const ps = this.catalogo.proveedores(), cs = this.catalogo.compras(), hoy = this.catalogo.hoy(), m = this.metrica();
    const activos = ps.filter((p) => p.activo).length, inactivos = ps.length - activos;
    const conPendientes = ps.filter((p) => this.stat(p.id).pendientes.length > 0).length;
    const pendientes = cs.filter((c) => c.estado === 'pendiente').length;
    const mes = cs.filter((c) => c.estado === 'recibida' && dias(c.fecha, hoy) < 30);
    // Sparklines: 12 tramos (día · semana · mes según el período) hasta hoy.
    const tramo = this.periodo() === 'hoy' ? 1 : +this.periodo();
    const tramoDe = (c: CompraV5) => 11 - Math.floor(dias(c.fecha, hoy) / tramo);
    const serie = (incluye: (c: CompraV5) => boolean, valor: (c: CompraV5) => number) => {
      const out = Array<number>(12).fill(0);
      for (const c of cs) {
        const i = tramoDe(c);
        if (i >= 0 && i < 12 && incluye(c)) out[i] += valor(c);
      }
      return out;
    };
    const conCompras = Array.from({ length: 12 }, () => new Set<number>());
    for (const c of cs) {
      const i = tramoDe(c);
      if (i >= 0 && i < 12 && c.estado !== 'cancelada') conCompras[i].add(c.proveedorId);
    }
    const metrica = (k: Metrica, label: string, value: string, delta: string, sparkColor: string, valores: number[], tinta = '#303030') => ({
      k, label, value, delta, tinta, sparkColor, spark: puntosSpark(valores), activa: m === k,
    });
    return [
      metrica('activos', 'Activos', String(activos), 'aparecen al crear compras', '#087b5d', conCompras.map((s) => s.size)),
      metrica('inactivos', 'Inactivos', String(inactivos), inactivos ? 'se conserva su historial' : 'ninguno', '#9ca3af', Array(12).fill(inactivos)),
      metrica('pend', 'Con compras por recibir', String(conPendientes), pl(pendientes, 'compra en camino', 'compras en camino'), '#ffb904',
        serie((c) => c.estado === 'pendiente', () => 1), conPendientes ? '#8a5a00' : '#303030'),
      metrica('mes', 'Recibido en 30 días', cop(mes.reduce((t, c) => t + this.catalogo.totalCompra(c), 0)), pl(mes.length, 'compra', 'compras'), '#303030',
        serie((c) => c.estado === 'recibida', (c) => this.catalogo.totalCompra(c))),
    ];
  });

  // ── Lista ──
  private coincide(p: ProveedorV5): boolean {
    const q = this.busqueda().trim().toLowerCase(), m = this.metrica(), st = this.stat(p.id);
    if (q && ![p.nombre, p.nit, p.contactoNombre, p.correo].some((v) => (v || '').toLowerCase().includes(q))) return false;
    if (m === 'activos') return p.activo;
    if (m === 'inactivos') return !p.activo;
    if (m === 'pend') return st.pendientes.length > 0;
    if (m === 'mes') return st.recibidas.some((c) => dias(c.fecha, this.catalogo.hoy()) < 30);
    return true;
  }
  private readonly mayorTotal = computed(() => Math.max(1, ...this.catalogo.proveedores().map((p) => this.stat(p.id).total)));
  private fila(p: ProveedorV5): FilaProveedor {
    const st = this.stat(p.id), proxima = p.activo ? this.proxima(p.diasEntrega) : null;
    return {
      proveedor: p,
      detalle: (p.contactoNombre || 'Sin contacto') + ' · ' + (st.ultima ? 'última ' + hace(st.ultima.fecha, this.catalogo.hoy()) : 'sin compras'),
      total: st.total,
      proporcion: Math.max(st.total ? 4 : 0, (st.total / this.mayorTotal()) * 100),
      accion: accionProveedor(this.catalogo, p),
      proxima: proxima ? proxima.texto : p.activo ? 'Sin días de entrega' : 'No recibe pedidos',
      proximaPronto: !!proxima && proxima.k <= 1,
    };
  }
  protected readonly grupos = computed<GrupoProveedores[]>(() => {
    const por = this.agrupacion(), plegados = this.plegados(), hoy = this.catalogo.hoy();
    const lista = this.catalogo.proveedores()
      .filter((p) => this.coincide(p))
      .sort((a, b) => this.stat(b.id).total - this.stat(a.id).total || a.nombre.localeCompare(b.nombre, 'es'));
    const grupo = (clave: string, titulo: string, icono: string, fondo: string, tinta: string, ps: ProveedorV5[], detalle: string): GrupoProveedores => ({
      clave, titulo, icono, fondo, tinta, detalle, filas: ps.map((p) => this.fila(p)), abierto: !plegados[clave],
    });

    if (por === 'dia') {
      // Un grupo por día de entrega, empezando por el más cercano; los inactivos al final.
      const cercania = (n: number) => proximaEntrega([n], hoy)?.k ?? 9;
      const grupos = [...DIAS].sort((a, b) => cercania(a[0]) - cercania(b[0])).map(([n, , largo]) => {
        const ps = lista.filter((p) => p.activo && this.proxima(p.diasEntrega)?.dow === n);
        const entrega = proximaEntrega([n], hoy);
        const detalle = ps.length && entrega ? 'Próxima entrega ' + (entrega.k === 1 ? 'mañana' : 'el ' + entrega.fecha.getDate() + ' ' + MESES_CORTOS[entrega.fecha.getMonth()]) : '';
        return grupo('d-' + n, largo, 'calendar-event', '#e0f7f5', '#00605b', ps, detalle);
      });
      grupos.push(grupo('d-off', 'Inactivos', 'player-pause', '#f1f1f1', '#6b7280', lista.filter((p) => !p.activo), 'No reciben pedidos'));
      return grupos.filter((g) => g.filas.length);
    }
    if (por === 'accion') {
      const claves = new Map(lista.map((p) => [p.id, accionProveedor(this.catalogo, p).k]));
      return GRUPOS_ACCION
        .map(([k, titulo, icono, fondo, tinta, detalle]) => grupo('a-' + k, titulo, icono, fondo, tinta, lista.filter((p) => claves.get(p.id) === k), detalle))
        .filter((g) => g.filas.length);
    }
    return [
      grupo('e-on', 'Activos', 'circle-check', '#e6f6ec', '#087b5d', lista.filter((p) => p.activo), 'Aparecen al crear compras'),
      grupo('e-off', 'Inactivos', 'player-pause', '#f1f1f1', '#6b7280', lista.filter((p) => !p.activo), 'Se conserva su historial'),
    ].filter((g) => g.filas.length);
  });
  /** Ids en el orden de la lista (solo grupos abiertos): para ↑ ↓. */
  private readonly idsVisibles = computed(() => this.grupos().flatMap((g) => (g.abierto ? g.filas.map((f) => f.proveedor.id) : [])));
  protected readonly cuentaVisibles = computed(() => pl(this.grupos().reduce((t, g) => t + g.filas.length, 0), 'proveedor', 'proveedores'));

  // ── Hoja ──
  private readonly errores = computed<Errores>(() => {
    const d = this.borrador(), e: Errores = {};
    if (!d) return e;
    const id = this.esNuevo() ? null : d.id;
    if (!d.nombre.trim()) e.nombre = 'Escribe el nombre o razón social.';
    if (d.correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.correo)) e.correo = 'Revisa el correo.';
    if (d.nit && this.catalogo.proveedores().some((p) => p.id !== id && (p.nit || '') === d.nit.trim())) e.nit = 'Ya existe un proveedor con este NIT.';
    return e;
  });
  /** Errores que se muestran: los de campos que cambiaron, o todos si ya intentó guardar. */
  protected readonly erroresVisibles = computed(() => {
    const e = this.errores(), d = this.borrador(), g = this.guardado(), visibles: Partial<Record<CampoTexto, string>> = {};
    for (const k of Object.keys(e) as CampoTexto[])
      if (this.intento() || JSON.stringify(d?.[k]) !== JSON.stringify(g?.[k])) visibles[k] = e[k];
    return visibles;
  });

  /** Con el correo mal escrito no se ofrece escribirle (aunque el error todavía no se muestre). */
  protected readonly correoConError = computed(() => !!this.errores().correo);

  protected readonly hoja = computed(() => {
    const d = this.borrador(), sel = this.seleccionado();
    if (!d || !this.guardado() || sel == null || this.soloEstado()) return null;
    const nuevo = sel === 'nuevo', id = nuevo ? 0 : sel, proveedor = nuevo ? null : this.catalogo.proveedor(id);
    const ids = this.idsVisibles(), posicion = ids.indexOf(id), st = this.stat(id);
    const recibido = this.catalogo.compras().filter((c) => c.estado === 'recibida').reduce((t, c) => t + this.catalogo.totalCompra(c), 0);
    const conError = Object.keys(this.erroresVisibles()).length > 0;
    return {
      nuevo, id, borrador: d, proveedor, conError,
      editable: this.catalogo.puede(nuevo ? 'proveedores.crear' : 'proveedores.editar'),
      editando: nuevo || this.editando() || this.sucio() || conError,
      navegacion: !nuevo && posicion >= 0 && ids.length > 1 ? { posicion, total: ids.length } : null,
      /** Con el estado del borrador: si lo desactiva, deja de pedir reponer. */
      accion: nuevo ? null : accionProveedor(this.catalogo, { ...(proveedor ?? d), activo: d.activo }),
      proxima: this.proxima(d.diasEntrega)?.texto ?? 'Sin días de entrega',
      total: st.total ? cop(st.total) : '$0',
      participacion: Math.round((st.total / Math.max(1, recibido)) * 100),
      compras: st.compras.length,
      /** El nuevo toma el tono del id que tendrá. */
      idTono: nuevo ? Math.max(0, ...this.catalogo.proveedores().map((p) => p.id)) + 1 : id,
    };
  });
  protected readonly completa = computed(() => !!this.hoja() && this.expandida());
  /** Pestaña visible (un proveedor nuevo solo tiene General). */
  protected readonly pestanaActiva = computed<PestanaProveedor>(() => (this.esNuevo() ? 'general' : this.pestana()));
  protected readonly pestanas = computed<PestanaHojaV5[]>(() => {
    const h = this.hoja();
    return [
      { k: 'general', label: 'General', err: !!h?.conError },
      { k: 'compras', label: 'Compras', n: String(h?.compras ?? 0), deshabilitada: !!h?.nuevo },
      { k: 'productos', label: 'Productos', deshabilitada: !!h?.nuevo },
    ];
  });

  constructor() {
    vigilarCambios({
      borrador: this.borrador, guardado: this.guardado, etiquetas: ETIQUETAS_CAMPOS, nuevo: () => this.esNuevo(),
      tituloNuevo: 'Proveedor sin guardar', textoNuevo: 'Todavía no se ha creado. Guárdalo para que aparezca al crear compras.',
      guardar: () => this.guardar(), descartar: () => this.descartar(),
      invalido: () => (this.intento() && Object.keys(this.errores()).length ? { titulo: 'Revisa los campos marcados', texto: Object.values(this.errores())[0]! } : null),
    });
    this.catalogo.asegurar();
    const id = Number(inject(ActivatedRoute).snapshot.queryParamMap.get('proveedor'));
    if (id) this.catalogo.alListo(() => this.abrir(id));
    // Un menú a la vez: al abrir el del período se cierran los de la página.
    effect(() => {
      if (this.franja()?.abierto()) untracked(() => this.menu.set(null));
    });
  }

  // ── Selección y navegación ──
  /** Hay cambios que se perderían: sacude la alerta y no deja seguir. */
  private bloqueado(): boolean {
    if (!this.sucio()) return false;
    this.alertas.sacudir();
    return true;
  }
  private cargarBorrador(id: number | 'nuevo', d: ProveedorV5): void {
    this.seleccionado.set(id);
    this.guardado.set(structuredClone(d));
    this.borrador.set(d);
    this.intento.set(false);
    this.menu.set(null);
  }
  protected abrir(id: number): void {
    if (id === this.seleccionado() || this.bloqueado()) return;
    const p = this.catalogo.proveedor(id);
    if (!p) return;
    this.cargarBorrador(id, borradorDe(p));
    this.editando.set(false);
  }
  protected nuevo(): void {
    if (this.catalogo.niega('proveedores.crear') || this.bloqueado()) return;
    this.cargarBorrador('nuevo', proveedorVacio());
    this.pestana.set('general');
    this.editando.set(true);
    setTimeout(() => this.general()?.enfocarNombre(), 80);
  }
  private soltar(): void {
    this.seleccionado.set(null);
    this.borrador.set(null);
    this.guardado.set(null);
    this.expandida.set(false);
    this.menu.set(null);
  }
  protected cerrar(): void {
    if (!this.bloqueado()) this.soltar();
  }
  protected mover(d: number): void {
    const ids = this.idsVisibles();
    if (!ids.length) return;
    const i = ids.indexOf(this.seleccionado() as number);
    const siguiente = i < 0 ? ids[d > 0 ? 0 : ids.length - 1] : ids[Math.min(ids.length - 1, Math.max(0, i + d))];
    if (siguiente != null && siguiente !== this.seleccionado()) this.abrir(siguiente);
  }
  protected elegirPestana(k: string): void {
    if (!this.esNuevo()) this.pestana.set(k as PestanaProveedor);
  }
  protected verCompra(id: number): void {
    if (!this.bloqueado()) this.router.navigate(['/products/compras'], { queryParams: { compra: id } });
  }
  protected verProducto(id: number): void {
    if (!this.bloqueado()) this.router.navigate(['/products/inventario'], { queryParams: { producto: id } });
  }
  /** Etiqueta "próxima acción": recibir abre la compra; reponer o sin compras, la compra rápida. */
  protected ejecutar(proveedorId: number, a: AccionProveedor): void {
    if (a.k === 'recibir' && a.compraId) this.verCompra(a.compraId);
    else this.compraRapida(proveedorId);
  }

  // ── Ficha ──
  protected editar(cambio: Partial<ProveedorV5>): void {
    this.borrador.update((b) => (b ? { ...b, ...cambio } : b));
  }
  protected ponerActivo(activo: boolean): void {
    if (!this.hoja()?.editable) return;
    this.menu.set(null);
    this.editar({ activo });
  }
  protected alternarEdicion(): void {
    if (this.catalogo.niega('proveedores.editar')) return;
    if (!this.hoja()?.editando) return this.editando.set(true);
    if (this.sucio()) return this.alertas.sacudir();
    this.editando.set(false);
    this.intento.set(false);
  }
  protected async guardar(): Promise<void> {
    const b = this.borrador();
    if (!b || this.guardando()) return;
    const nuevo = this.esNuevo();
    if (this.catalogo.niega(nuevo ? 'proveedores.crear' : 'proveedores.editar')) return;
    if (Object.keys(this.errores()).length) {
      this.intento.set(true);
      this.pestana.set('general');
      return this.alertas.sacudir();
    }
    const limpio = { ...b, nombre: b.nombre.trim(), nit: b.nit.trim(), correo: b.correo.trim(), telefono: b.telefono.trim(), direccion: b.direccion.trim(), contactoNombre: b.contactoNombre.trim() };
    this.guardando.set(true);
    const r = await this.catalogo.guardarProveedor(
      limpio,
      nuevo,
      nuevo ? { texto: `${limpio.nombre} ya aparece al crear compras`, accion: (p) => ({ label: 'Nueva compra', ejecutar: () => this.compraRapida(p.id) }) } : {},
    );
    this.guardando.set(false);
    if (!r) return; // el error ya está en la pila; el borrador queda para corregir
    const d = borradorDe(r);
    this.seleccionado.set(r.id);
    this.guardado.set(structuredClone(d));
    this.borrador.set(d);
    this.editando.set(false);
    this.intento.set(false);
  }
  protected descartar(): void {
    if (this.esNuevo()) this.soltar();
    else this.borrador.set(structuredClone(this.guardado()!));
    this.intento.set(false);
  }
  protected copiarNit(): void {
    const nit = this.borrador()?.nit.trim();
    if (!nit) return;
    navigator.clipboard?.writeText(nit).catch(() => undefined);
    this.alertas.mostrar({ estado: 'info', titulo: 'NIT copiado', texto: nit });
  }

  // ── Compra rápida y baja ──
  protected compraRapida(id: number): void {
    if (this.catalogo.niega('compras.crear') || this.bloqueado()) return;
    this.menu.set(null);
    this.modal.set({ tipo: 'compra', proveedorId: id });
  }
  protected crearCompra(proveedorId: number, lineas: LineaCompra[]): void {
    this.modal.set(null);
    void this.catalogo.crearCompra(proveedorId, lineas, 'Creada desde Proveedores', {}, { accion: (c) => ({ label: 'Ver compra', ejecutar: () => this.verCompra(c.id) }) });
  }
  protected armarEnCompras(proveedorId: number): void {
    this.modal.set(null);
    this.router.navigate(['/products/compras'], { queryParams: { nueva: 1, proveedor: proveedorId } });
  }
  protected pedirBaja(): void {
    if (this.catalogo.niega('proveedores.eliminar')) return;
    this.menu.set(null);
    this.modal.set({ tipo: 'baja', proveedorId: this.seleccionado() as number });
  }
  protected desactivar(id: number): void {
    this.modal.set(null);
    if (!this.catalogo.proveedor(id)?.activo) return;
    this.catalogo.desactivarProveedor(id);
    if (this.seleccionado() === id) {
      this.guardado.update((g) => (g ? { ...g, activo: false } : g));
      this.borrador.update((b) => (b ? { ...b, activo: false } : b));
    }
  }
  protected eliminar(id: number): void {
    this.catalogo.eliminarProveedor(id);
    this.modal.set(null);
    if (this.seleccionado() === id) this.soltar();
  }

  protected exportar(): void {
    const celda = (v: unknown) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const filas = this.catalogo.proveedores().map((p) => {
      const st = this.stat(p.id), dias = (p.diasEntrega ?? []).map((n) => DIAS.find((x) => x[0] === n)?.[1] ?? '').join(' ');
      return [p.nombre, p.nit, p.contactoNombre, p.correo, p.telefono, p.direccion, dias, p.activo ? 'si' : 'no', st.total, st.pendientes.length].map(celda).join(',');
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿nombre,nit,contacto,correo,telefono,direccion,dias_entrega,activo,total_recibido,pendientes\n' + filas.join('\n')], { type: 'text/csv' }));
    a.download = 'proveedores.csv';
    a.click();
    this.alertas.mostrar({ estado: 'success', titulo: `${filas.length} proveedores exportados a CSV` });
  }

  // ── Filtros, grupos y menús ──
  protected alternarMetrica(k: string): void {
    this.metrica.update((m) => (m === k ? null : (k as Metrica)));
    this.plegados.set({});
  }
  protected limpiarFiltros(): void {
    this.metrica.set(null);
    this.busqueda.set('');
  }
  protected alternarMenu(k: Menu, e: Event): void {
    e.stopPropagation();
    this.menu.update((m) => (m === k ? null : k));
    this.franja()?.abierto.set(false);
  }
  protected agrupar(k: Agrupacion): void {
    this.agrupacion.set(k);
    this.plegados.set({});
    this.menu.set(null);
  }
  protected plegarTodos(plegar: boolean): void {
    this.plegados.set(plegar ? Object.fromEntries(this.grupos().map((g) => [g.clave, true])) : {});
    this.menu.set(null);
  }
  protected alternarGrupo(clave: string): void {
    this.plegados.update((p) => ({ ...p, [clave]: !p[clave] }));
  }

  // ── Atajos ──
  protected atajos(e: KeyboardEvent): void {
    if (esGuardar(e)) {
      e.preventDefault();
      if (this.sucio()) void this.guardar();
      return;
    }
    if (this.modal()) {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.modal.set(null);
      }
      return;
    }
    const tag = (document.activeElement as HTMLElement | null)?.tagName ?? '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === '/') {
      const campo = this.buscador()?.nativeElement;
      if (campo) {
        e.preventDefault();
        campo.focus();
      }
      return;
    }
    if (e.key === 'n' && this.puedeCrear()) {
      e.preventDefault();
      this.nuevo();
      return;
    }
    if (e.key === 'Escape') {
      // Con un menú abierto, Esc solo lo cierra (el del período se cierra solo).
      if (this.menu() || this.franja()?.abierto()) return this.menu.set(null);
      if (this.seleccionado() == null) return;
      if (this.expandida()) return this.expandida.set(false);
      return this.cerrar();
    }
    const d = e.key === 'ArrowDown' || e.key === 'j' ? 1 : e.key === 'ArrowUp' || e.key === 'k' ? -1 : 0;
    if (d) {
      e.preventDefault();
      this.mover(d);
    }
  }
}
