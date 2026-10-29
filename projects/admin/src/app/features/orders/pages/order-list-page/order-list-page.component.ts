import { ChangeDetectionStrategy, Component, HostListener, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { textoValor } from '../../../../core/campos/campo-personalizado.model';
import { AjustesModuloService } from '../../../../core/modulos/ajustes-modulo.service';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { FranjaMetricasComponent, MetricaFranja, OpcionPeriodo, puntosSpark } from '../../../../shared/ui/franja-metricas/franja-metricas.component';
import { ModuloCabeceraComponent } from '../../../products/shared/ui/modulo-cabecera/modulo-cabecera.component';
import { CatalogoStore } from '../../../products/shared/catalogo.store';
import { cop, dias, norm, pl } from '../../../products/shared/formato';
import { ChipFiltro, FilaModulo, GrupoModulo } from '../../../products/shared/modelos';
import { EstadoPaginaComponent } from '../../../products/shared/ui/estado-pagina/estado-pagina.component';
import { HojaComponent } from '../../../products/shared/ui/hoja/hoja.component';
import { IcComponent } from '../../../products/shared/ui/ic/ic.component';
import { icono } from '../../../products/shared/ui/iconos';
import { ListaModuloComponent } from '../../../products/shared/ui/lista-modulo/lista-modulo.component';
import { T, extraPedido } from '../../../products/shared/filas';
import { AnchoDirective } from '../../../../shared/ui/despegue/despegue.directive';
import { PestanaHojaV5, PestanasHojaComponent } from '../../../products/shared/ui/pestanas-hoja/pestanas-hoja.component';
import { PieFormularioComponent } from '../../../products/shared/ui/pie-formulario/pie-formulario.component';
import { FormularioPedidoComponent } from '../../components/formulario-pedido/formulario-pedido.component';
import { IconoCanalComponent } from '../../shared/ui/icono-canal/icono-canal.component';
import { InsigniaPagoComponent } from '../../shared/ui/insignia-pago/insignia-pago.component';
import { ComprobantePedidoComponent } from '../../shared/ui/comprobante-pedido/comprobante-pedido.component';
import { DIAS, MESES, completa, iniCliente, pnum, relativo, tel } from '../../shared/ventas.formato';
import { BorradorPedido, CANAL, Canal, EST, EstadoPago, PAGO, Pedido, SIGUIENTE, muerto, nuevoDeTienda, tonoCliente } from '../../shared/ventas.modelos';
import { VentasStore } from '../../shared/ventas.store';
import { AccionesPedidoComponent } from './components/acciones-pedido/acciones-pedido.component';
import { AgruparPedidos, FiltrosPedidosComponent, OrdenPedidos, RangoPedidos } from './components/filtros-pedidos/filtros-pedidos.component';
import { PestanaActividadComponent } from './components/pestana-actividad/pestana-actividad.component';
import { PestanaClienteEntregaComponent } from './components/pestana-cliente-entrega/pestana-cliente-entrega.component';
import { PestanaProductosComponent } from './components/pestana-productos/pestana-productos.component';
import { ProgresoPedidoComponent } from './components/progreso-pedido/progreso-pedido.component';
import { migaDeHoja } from '../../../../core/navigation/navigation-trail.service';

type Metrica = 'pendiente' | 'confirmado' | 'enviado' | 'vendido';
type Pestana = 'productos' | 'cliente' | 'actividad';
type Periodo = 'hoy' | '7d' | '30d';

/** Ajustes del módulo `orders` que Goods configura por Empresa. */
interface AjustesPedidos {
  agrupar: AgruparPedidos;
  orden: OrdenPedidos;
  periodo: Periodo;
  cerrados: 'plegados' | 'abiertos';
}

/**
 * Pedidos: lista agrupable (Estado · Canal ·
 * Día) + hoja con cabecera (avatar con canal, total y pago), progreso,
 * «Próximo paso» y 3 pestañas: Productos (Alistamiento + Comprobante),
 * Cliente y entrega, y Actividad. El pedido nuevo y la edición de uno
 * pendiente se arman en la misma hoja.
 *
 * Rutas: `?pedido=ID` abre la hoja · `?nuevo=1&cliente=ID` pedido nuevo ·
 * `?nuevo=1&repetir=ID` repite un pedido · `?cliente=ID` filtra ·
 * `?completa=1` página completa.
 *
 * Atajos: N (nuevo), Esc, ↑/↓ o j/k (pedido anterior/siguiente), / (buscar), Ctrl+S.
 */
@Component({
  selector: 'app-order-list-page',
  standalone: true,
  imports: [
    ModuloCabeceraComponent, FranjaMetricasComponent, ListaModuloComponent, HojaComponent, PestanasHojaComponent, EstadoPaginaComponent, IcComponent,
    FiltrosPedidosComponent, ProgresoPedidoComponent, AccionesPedidoComponent, PestanaProductosComponent, PestanaClienteEntregaComponent,
    PestanaActividadComponent, FormularioPedidoComponent, PieFormularioComponent, ComprobantePedidoComponent, IconoCanalComponent, InsigniaPagoComponent,
    AnchoDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-list-page.component.html',
  host: { class: 'flex h-full min-h-0 flex-col gap-4 px-6 pt-6 leading-[normal]' },
})
export class OrderListPageComponent {
  protected readonly v = inject(VentasStore);
  protected readonly cat = inject(CatalogoStore);
  private readonly alertas = inject(AlertaService);
  private readonly ajustes = inject(AjustesModuloService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly acciones = viewChild(AccionesPedidoComponent);
  protected readonly icono = icono;
  protected readonly cop = cop;
  protected readonly pl = pl;
  protected readonly lectura =
    'Lo que te compran por el panel, la tienda en línea y WhatsApp. Confirmar un pedido descuenta el stock; cancelarlo o recibir una devolución lo regresa.';
  protected readonly periodos: OpcionPeriodo[] = [
    { k: 'hoy', label: 'Hoy' },
    { k: '7d', label: 'Últimos 7 días' },
    { k: '30d', label: 'Últimos 30 días' },
  ];

  // Lista
  protected readonly q = signal('');
  protected readonly metrica = signal<Metrica | null>(null);
  protected readonly agrupar = signal<AgruparPedidos>('estado');
  protected readonly orden = signal<OrdenPedidos>('reciente');
  protected readonly fCanal = signal<Canal | null>(null);
  protected readonly fPago = signal<EstadoPago | 'todos'>('todos');
  protected readonly fRango = signal<RangoPedidos>('todo');
  protected readonly fCliente = signal<number | null>(null);
  protected readonly colapsados = signal<Set<string>>(new Set(['e-cerr']));
  protected readonly periodo = signal<Periodo>('hoy');
  /** Si «Cancelados y devueltos» empieza plegado al agrupar por estado. */
  private cerradosPlegados = true;

  private enPeriodo(iso: string) {
    const d = dias(iso, this.v.hoy()), k = this.periodo();
    return k === 'hoy' ? d === 0 : k === '7d' ? d < 7 : d < 30;
  }
  private rel = (iso: string) => relativo(iso, this.v.hoy());

  protected readonly filtrados = computed(() => {
    const qq = norm(this.q()).replace(/^#/, '').replace(/\s/g, ''), m = this.metrica();
    return this.v
      .pedidos()
      .filter((p) => {
        if (qq && ![String(p.numero), p.cliente.nombre, p.cliente.telefono].some((x) => norm(x).replace(/\s/g, '').includes(qq))) return false;
        if (this.fCanal() && p.canal !== this.fCanal()) return false;
        if (this.fPago() !== 'todos' && p.estadoPago !== this.fPago()) return false;
        if (this.fRango() !== 'todo' && dias(p.creadoEn, this.v.hoy()) >= +this.fRango()) return false;
        if (this.fCliente() != null && p.clienteId !== this.fCliente()) return false;
        if (m === 'vendido') return !muerto(p) && this.enPeriodo(p.creadoEn);
        if (m) return p.estado === m;
        return true;
      })
      .sort(this.orden() === 'total' ? (a, b) => b.total - a.total : (a, b) => b.creadoEn.localeCompare(a.creadoEn));
  });

  private fila(p: Pedido): FilaModulo<Pedido> {
    const dead = muerto(p);
    const x = extraPedido(p);
    return {
      ...x,
      id: p.id,
      nombre: p.cliente.nombre,
      sub: '',
      mini: { iniciales: iniCliente(p.cliente.nombre) },
      // «Nuevo» de la tienda: todavía no aparta stock.
      etiquetas: nuevoDeTienda(p)
        ? [...(x.etiquetas ?? []), { texto: 'Nuevo', icono: 'building-store', tono: T.turquesa }]
        : x.etiquetas,
      accion: this.bloqueado() || this.v.ocupado(p.id) ? null : x.accion,
      valor: cop(p.total),
      valorColor: dead ? '#9ca3af' : '#111827',
      valorSub: this.rel(p.creadoEn),
      dato: p,
    };
  }

  protected readonly grupos = computed<GrupoModulo<Pedido>[]>(() => {
    const xs = this.filtrados(), g = this.agrupar();
    const suma = (ps: Pedido[]) => cop(ps.filter((p) => !muerto(p)).reduce((a, p) => a + p.total, 0));
    const armar = (clave: string, titulo: string, icono: string, fondo: string, color: string, ps: Pedido[], sub?: string): GrupoModulo<Pedido> =>
      ({ clave, titulo, icono, fondo, color, sub: sub ?? suma(ps), filas: ps.map((p) => this.fila(p)) });
    let gs: GrupoModulo<Pedido>[];
    if (g === 'canal') {
      gs = (['tienda', 'whatsapp', 'panel'] as Canal[]).map((k) => {
        const ps = xs.filter((p) => p.canal === k);
        return armar('c-' + k, CANAL[k].t, CANAL[k].ic, CANAL[k].bg, CANAL[k].fg, ps, `${suma(ps)} · ${CANAL[k].d}`);
      });
    } else if (g === 'dia') {
      const por = new Map<string, Pedido[]>();
      xs.forEach((p) => { const d = new Date(p.creadoEn), k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; por.set(k, [...(por.get(k) ?? []), p]); });
      gs = [...por.keys()].sort().reverse().map((k) => {
        const ps = por.get(k)!, d = new Date(ps[0].creadoEn), n = dias(ps[0].creadoEn, this.v.hoy());
        const t = n === 0 ? 'Hoy' : n === 1 ? 'Ayer' : `${DIAS[d.getDay()][0].toUpperCase()}${DIAS[d.getDay()].slice(1)} ${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()}`;
        return armar('d-' + k, t, 'calendar', '#f1f1f1', '#4b5563', ps, `${suma(ps)} · ${pl(ps.length, 'pedido', 'pedidos')}`);
      });
    } else {
      const pend = xs.filter((p) => p.estado === 'pendiente'), nT = pend.filter(nuevoDeTienda).length;
      gs = [
        // Con los colores de `EST`, como el prototipo.
        armar('e-pend', 'Por confirmar', 'clock', EST.pendiente.bg, EST.pendiente.fg, pend, nT ? `${pl(nT, 'llegó', 'llegaron')} por la tienda · aún sin apartar stock` : 'Confirmar descuenta el stock'),
        armar('e-conf', 'Confirmados', 'check', EST.confirmado.bg, EST.confirmado.fg, xs.filter((p) => p.estado === 'confirmado')),
        armar('e-env', 'En camino', 'truck-delivery', EST.enviado.bg, EST.enviado.fg, xs.filter((p) => p.estado === 'enviado')),
        armar('e-ent', 'Entregados', 'package', EST.entregado.bg, EST.entregado.fg, xs.filter((p) => p.estado === 'entregado')),
        armar('e-cerr', 'Cancelados y devueltos', 'circle-x', EST.cancelado.bg, EST.cancelado.fg, xs.filter(muerto), 'No suman a lo vendido'),
      ];
    }
    return gs.filter((x) => x.filas.length);
  });
  protected readonly visibles = computed(() => this.grupos().flatMap((g) => (this.colapsados().has(g.clave) ? [] : g.filas.map((f) => f.id))));
  protected readonly resultados = computed(() => {
    const n = this.filtrados().length, total = this.v.resumen()?.cantidad ?? 0;
    return pl(n, 'pedido', 'pedidos') + (total > this.v.pedidos().length && !this.hayFiltros() ? ` · los ${this.v.pedidos().length} más recientes de ${total}` : '');
  });
  private readonly hayFiltros = computed(() => !!(this.q() || this.metrica() || this.fCanal() || this.fCliente() != null || this.fPago() !== 'todos' || this.fRango() !== 'todo'));
  protected readonly chips = computed<ChipFiltro[]>(() => {
    const c: ChipFiltro[] = [];
    const MT: Record<Metrica, string> = { pendiente: 'Por confirmar', confirmado: 'Por enviar', enviado: 'Enviados', vendido: 'Vendido · ' + this.periodoTexto().toLowerCase() };
    const m = this.metrica();
    if (m) c.push({ texto: MT[m], quitar: () => this.metrica.set(null) });
    if (this.fCliente() != null) c.push({ texto: 'Cliente: ' + (this.v.cliente(this.fCliente()!)?.nombre ?? '—'), quitar: () => this.quitarCliente() });
    if (this.fCanal()) c.push({ texto: CANAL[this.fCanal()!].t, quitar: () => this.fCanal.set(null) });
    if (this.fPago() !== 'todos') c.push({ texto: PAGO[this.fPago() as EstadoPago].t, quitar: () => this.fPago.set('todos') });
    if (this.fRango() !== 'todo') c.push({ texto: this.fRango() === '1' ? 'Hoy' : `Últimos ${this.fRango()} días`, quitar: () => this.fRango.set('todo') });
    return c;
  });
  protected readonly periodoTexto = computed(() => ({ hoy: 'Hoy', '7d': 'Últimos 7 días', '30d': 'Últimos 30 días' })[this.periodo()]);
  /** Total de pedidos del negocio (el resumen cuenta todos, no solo los cargados). */
  protected readonly cuenta = computed(() => this.v.resumen()?.cantidad ?? this.v.pedidos().length);
  /** Pedidos de la tienda sin confirmar, el más nuevo primero (los tiquetes de «Por confirmar»). */
  protected readonly nuevosTienda = computed(() =>
    this.v.pedidos().filter(nuevoDeTienda).sort((a, b) => b.creadoEn.localeCompare(a.creadoEn)),
  );
  /** Serie de los últimos 8 días (por fecha de creación) para el sparkline de cada métrica. */
  private serie(valor: (p: Pedido) => number): string | null {
    const s = Array(8).fill(0) as number[], hoy = this.v.hoy();
    for (const p of this.v.pedidos()) {
      const d = dias(p.creadoEn, hoy);
      if (d < 8) s[7 - d] += valor(p);
    }
    return puntosSpark(s);
  }
  /** Las cuentas salen del resumen del servidor (todos los pedidos, no solo los cargados). */
  protected readonly metricas = computed<MetricaFranja[]>(() => {
    const r = this.v.resumen(), e = r?.porEstado ?? {}, vend = this.v.vendido(), m = this.metrica(), hoy = this.v.hoy();
    const pend = e.pendiente ?? 0, nuevos = this.nuevosTienda(), nT = Math.max(r?.tiendaPorConfirmar ?? 0, nuevos.length), tk = nuevos.slice(0, 4);
    const es = (estado: string) => (p: Pedido) => (p.estado === estado ? 1 : 0);
    return [
      {
        k: 'pendiente', label: 'Por confirmar', value: String(pend), delta: nT ? pl(nT, 'nuevo', 'nuevos') + ' de la tienda' : 'confirmar descuenta stock',
        tinta: pend ? '#8a5a00' : '#303030', activa: m === 'pendiente', spark: this.serie(es('pendiente')), sparkColor: '#ffb904',
        vivo: nT
          ? {
              texto: pl(nT, 'nuevo', 'nuevos') + ' de la tienda',
              mas: nT - tk.length,
              tiquetes: tk.map((p) => ({
                id: p.id, titulo: '#' + p.numero, monto: cop(p.total), tip: 'Abrir #' + p.numero + ' · ' + p.cliente.nombre,
                hace: relativo(p.creadoEn, hoy).replace('hace ', '').replace(' min', ' m'),
              })),
            }
          : undefined,
      },
      { k: 'confirmado', label: 'Por enviar', value: String(e.confirmado ?? 0), delta: 'ya confirmados', tinta: '#303030', activa: m === 'confirmado', spark: this.serie(es('confirmado')), sparkColor: '#2be0d5' },
      { k: 'enviado', label: 'Enviados', value: String(e.enviado ?? 0), delta: 'en camino al cliente', tinta: '#303030', activa: m === 'enviado', spark: this.serie(es('enviado')), sparkColor: '#0ea5e9' },
      {
        k: 'vendido', label: 'Vendido', value: vend ? cop(vend.vendido) : '—', tinta: '#303030', activa: m === 'vendido',
        delta: vend ? pl(vend.cantidad, 'pedido', 'pedidos') + ' · ' + this.periodoTexto().toLowerCase() : '',
        spark: this.serie((p) => (muerto(p) ? 0 : p.total)), sparkColor: '#087b5d',
      },
    ];
  });

  // Hoja
  protected readonly selId = signal<number | 'nuevo' | null>(null);
  protected readonly pestana = signal<Pestana>('productos');
  protected readonly completa = signal(false);
  protected readonly menu = signal(false);
  protected readonly borrador = signal<BorradorPedido | null>(null);
  private readonly guardado = signal<string | null>(null);
  protected readonly errorForm = signal('');
  protected readonly intento = signal(false);
  protected readonly guardando = signal(false);
  /** Abriendo por enlace un pedido que no está en la lista. */
  protected readonly buscandoPedido = signal(false);

  protected readonly esNuevo = computed(() => this.selId() === 'nuevo');
  protected readonly sel = computed(() => { const id = this.selId(); return typeof id === 'number' ? this.v.pedido(id) ?? null : null; });
  protected readonly abierta = computed(() => this.esNuevo() || !!this.sel());
  protected readonly enForm = computed(() => !!this.borrador());
  protected readonly sucio = computed(() => { const b = this.borrador(); return !!b && JSON.stringify(b) !== this.guardado(); });
  /** Ancho de la grilla lista + hoja: hasta ahí crece la franja al desplegarse. */
  protected readonly anchoGrid = signal(0);
  /** Cuánto baja la hoja cuando la franja se despliega encima. */
  protected readonly bajar = signal(0);
  protected readonly cols = computed(() =>
    this.completa() && this.abierta() ? 'minmax(0,1fr)' : this.abierta() ? 'minmax(300px,.86fr) minmax(0,1.34fr)' : 'minmax(320px,1.3fr) minmax(240px,.7fr)',
  );
  protected readonly posicion = computed(() => ({ i: this.visibles().indexOf(this.sel()?.id ?? -1), n: this.visibles().length }));
  /** El círculo de la fila: avanzar el pedido al siguiente paso. */
  protected accionFila(id: number): void {
    const p = this.v.pedido(id);
    if (p) this.avanzar(p);
  }

  protected readonly cab = computed(() => {
    const p = this.sel(), d = this.borrador();
    const cid = d ? d.clienteId : p?.clienteId ?? null, c = cid ? this.v.cliente(cid) : undefined;
    const nombre = c?.nombre ?? (d?.cliMode === 'nuevo' && d.nuevo.nombre ? d.nuevo.nombre : p && !d ? p.cliente.nombre : 'Cliente sin elegir');
    const conNombre = !!c || !!(d?.cliMode === 'nuevo' && d.nuevo.nombre) || (!!p && !d);
    const dead = !!p && muerto(p), t = tonoCliente(cid ?? 0);
    const k = d ? this.v.calcular(d, p) : null;
    const por = p?.creadoPor ? 'cargado por ' + p.creadoPor.split(' ')[0] : p?.canal === 'tienda' ? 'por la tienda' : p?.canal === 'whatsapp' ? 'desde WhatsApp' : '';
    return {
      nombre,
      nombreC: conNombre ? '#111827' : '#b5b5b5',
      ini: conNombre ? iniCliente(nombre) : '?',
      fondo: dead ? '#f1f1f1' : cid ? t[0] : '#f4f4f4',
      tinta: dead ? '#9ca3af' : cid ? t[1] : '#9ca3af',
      canal: d ? d.canal : p!.canal,
      sub: p ? [pnum(p.numero), completa(p.creadoEn), por].filter(Boolean).join(' · ') : 'Sin guardar',
      total: cop(k ? k.total : p!.total),
      unidades: d ? pl(d.items.reduce((a, it) => a + it.cantidad, 0), 'unidad', 'unidades') + ' · ' + pl(d.items.length, 'producto', 'productos') : '',
    };
  });

  protected readonly pestanas = computed<PestanaHojaV5[]>(() => {
    const p = this.sel(), d = this.borrador();
    return [
      { k: 'productos', label: 'Productos', n: String((d ? d.items : p?.items ?? []).length), err: this.intento() && !!d && !d.items.length },
      { k: 'cliente', label: 'Cliente y entrega', err: this.intento() && !!d && !!this.v.erroresBorrador(d).cliente },
      ...(this.esNuevo() ? [] : [{ k: 'actividad', label: 'Actividad', n: p?.detalle ? String(p.eventos.length) : null }]),
    ];
  });

  constructor() {
    // Miga del pedido abierto: «Pedidos › #123».
    migaDeHoja(() => (this.selId() === 'nuevo' ? 'Nuevo pedido' : this.sel() ? `#${this.sel()!.numero}` : null), () => this.cerrar());
    this.cat.asegurar();
    this.v.asegurar();
    this.ajustes.de<AjustesPedidos>('orders').pipe(takeUntilDestroyed()).subscribe((a) => this.aplicarAjustes(a));
    const qp = this.ruta.snapshot.queryParamMap;
    const pedido = qp.get('pedido'), repetir = qp.get('repetir'), cliente = qp.get('cliente');
    if (qp.get('completa')) this.completa.set(true);
    if (pedido) this.abrirPorEnlace(+pedido);
    if (qp.get('nuevo') && repetir) {
      this.v.alListo(() => this.cat.alListo(async () => {
        const r = this.v.pedido(+repetir) ?? (await this.v.cargarDetalle(+repetir));
        if (r) this.empezarForm(this.v.borradorRepetir(r), 'nuevo', true);
      }));
    } else if (qp.get('nuevo')) {
      this.v.alListo(() => this.nuevo(cliente ? +cliente : null));
    } else if (cliente) {
      this.fCliente.set(+cliente);
    }
    // «Vendido» según el período de la cabecera.
    effect(() => this.v.cargarVendido(this.desde(this.periodo())));
    // Abrir un pedido trae su detalle (eventos, pagos, código, quién lo cargó).
    effect(() => { const id = this.selId(); if (typeof id === 'number') void this.v.cargarDetalle(id); });
    // Pila «Cambios sin guardar».
    effect(() => {
      const d = this.borrador();
      this.alertas.fijarCambios(
        this.sucio() && d
          ? { titulo: 'Cambios sin guardar', texto: this.esNuevo() ? 'Pedido nuevo sin crear' : 'Editaste el pedido', guardar: () => void this.guardar(), descartar: () => this.descartar() }
          : null,
      );
    });
  }

  private desde(k: Periodo): string {
    const d = new Date();
    d.setDate(d.getDate() - (k === 'hoy' ? 0 : k === '7d' ? 6 : 29));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private abrirPorEnlace(id: number): void {
    this.selId.set(id);
    this.buscandoPedido.set(true);
    void this.v.cargarDetalle(id).then((p) => {
      this.buscandoPedido.set(false);
      if (!p) {
        this.selId.set(null);
        this.alertas.mostrar({ estado: 'warning', titulo: 'No encontramos ese pedido', texto: 'Puede que lo hayan borrado o que sea de otra empresa.' });
      }
    });
  }

  // Navegación
  private bloqueado(): boolean {
    if (this.sucio()) { this.alertas.sacudir(); return true; }
    return false;
  }
  protected abrir(id: number): void {
    if (this.selId() === id || this.bloqueado()) return;
    this.borrador.set(null);
    this.menu.set(false);
    this.errorForm.set('');
    this.intento.set(false);
    if (this.pestana() !== 'cliente') this.pestana.set('productos');
    this.selId.set(id);
    void this.router.navigate([], { queryParams: { pedido: id, nuevo: null, repetir: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }
  protected cerrar(): void {
    if (this.bloqueado()) return;
    this.selId.set(null);
    this.borrador.set(null);
    this.completa.set(false);
    this.menu.set(false);
    void this.router.navigate([], { queryParams: { pedido: null, nuevo: null, repetir: null, completa: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }
  protected paso(d: 1 | -1): void {
    const ids = this.visibles(), { i } = this.posicion();
    if (!ids.length) return;
    const n = i < 0 ? ids[d > 0 ? 0 : ids.length - 1] : ids[Math.min(ids.length - 1, Math.max(0, i + d))];
    if (n != null) this.abrir(n);
  }
  protected alternarCompleta(): void {
    this.completa.update((x) => !x);
    void this.router.navigate([], { queryParams: { completa: this.completa() ? 1 : null }, queryParamsHandling: 'merge', replaceUrl: true });
  }
  protected elegirMetrica(id: string): void {
    this.metrica.update((m) => (m === id ? null : (id as Metrica)));
    this.colapsados.set(new Set());
  }
  /** Estado vacío: la tienda en línea es por donde llegan los pedidos. */
  protected irTienda(): void {
    void this.router.navigateByUrl('/tienda');
  }
  /** Un tiquete de «Por confirmar»: filtra por confirmar y abre ese pedido. */
  protected abrirTiquete(id: number): void {
    this.metrica.set('pendiente');
    this.agrupar.set('estado');
    this.colapsados.set(new Set());
    this.abrir(id);
  }
  protected alternarGrupo(k: string): void {
    this.colapsados.update((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  }
  protected limpiar(): void {
    this.metrica.set(null);
    this.q.set('');
    this.quitarCliente();
    this.fCanal.set(null);
    this.fPago.set('todos');
    this.fRango.set('todo');
  }
  private quitarCliente(): void {
    this.fCliente.set(null);
    void this.router.navigate([], { queryParams: { cliente: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }
  protected elegirAgrupar(k: AgruparPedidos): void {
    this.agrupar.set(k);
    this.colapsados.set(k === 'estado' && this.cerradosPlegados ? new Set(['e-cerr']) : new Set());
  }
  /** Cómo arranca la lista para esta Empresa; después cada quien la cambia. */
  private aplicarAjustes(a: Partial<AjustesPedidos>): void {
    if (a.orden) this.orden.set(a.orden);
    if (a.periodo) this.periodo.set(a.periodo);
    if (a.cerrados) this.cerradosPlegados = a.cerrados === 'plegados';
    this.elegirAgrupar(a.agrupar ?? this.agrupar());
  }
  protected plegarTodos(on: boolean): void {
    this.colapsados.set(on ? new Set(this.grupos().map((g) => g.clave)) : new Set());
  }

  // Acciones
  protected avanzar(p: Pedido): void {
    const nx = SIGUIENTE[p.estado];
    if (nx && !this.bloqueado()) void this.v.cambiarEstado(p.id, nx[0]);
  }
  protected cancelarDesdeMenu(): void {
    this.menu.set(false);
    this.pestana.set('productos');
    this.acciones()?.abrir('cancelar');
  }
  protected verCliente(): void {
    const p = this.sel();
    if (p && !this.bloqueado()) void this.router.navigate(['/customers'], { queryParams: { cliente: p.clienteId } });
  }
  /** Con el contacto vinculado abre la bandeja de Goods; si no, WhatsApp con el número. */
  protected whatsapp(): void {
    const p = this.sel();
    if (!p) return;
    if (this.v.cliente(p.clienteId)?.whatsappContactoId) void this.router.navigate(['/whatsapp']);
    else if (p.cliente.telefono) window.open(`https://wa.me/${p.cliente.telefono}`, '_blank', 'noopener');
  }
  /** Abre WhatsApp con el resumen del pedido listo para enviar. */
  protected enviarComprobante(): void {
    const p = this.sel();
    if (!p?.cliente.telefono) return;
    const lineas = p.items.map((it) => `• ${it.cantidad} × ${it.productoNombre} — ${cop(it.subtotal)}`);
    const texto = [
      `Hola ${p.cliente.nombre.split(' ')[0]}, este es el comprobante de tu pedido ${pnum(p.numero)}:`,
      '',
      ...lineas,
      ...(p.costoEnvio ? [`Envío: ${cop(p.costoEnvio)}`] : []),
      ...(p.descuento ? [`Descuento: −${cop(p.descuento)}`] : []),
      `*Total: ${cop(p.total)}*`,
      `Pago: ${PAGO[p.estadoPago].t}${p.metodoPago ? ' · ' + p.metodoPago : ''}`,
    ].join('\n');
    window.open(`https://wa.me/${p.cliente.telefono}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
  }

  protected nuevo(cid: number | null = null): void {
    if (this.bloqueado() || this.cat.niega('pedidos.editar')) return;
    const c = cid ? this.v.cliente(cid) : undefined;
    if (c?.archivadoEn) this.alertas.mostrar({ estado: 'warning', titulo: 'Cliente archivado', texto: `Desarchiva a ${c.nombre.split(' ')[0]} para crearle pedidos` });
    this.empezarForm(this.v.borradorVacio(cid), 'nuevo');
  }
  protected editar(): void {
    const p = this.sel();
    if (!p) return;
    this.menu.set(false);
    if (p.estado !== 'pendiente') {
      this.alertas.mostrar({ estado: 'info', titulo: 'Solo se edita mientras está pendiente', texto: 'Confirmado ya descontó stock' });
      return;
    }
    if (this.cat.niega('pedidos.editar')) return;
    this.empezarForm(this.v.borradorDe(p), p.id);
  }
  protected duplicar(): void {
    const p = this.sel();
    if (!p || this.cat.niega('pedidos.editar')) return;
    this.menu.set(false);
    this.empezarForm(this.v.borradorRepetir(p), 'nuevo', true);
  }
  private empezarForm(d: BorradorPedido, id: number | 'nuevo', marcarSucio = false): void {
    this.selId.set(id);
    this.borrador.set(d);
    this.guardado.set(marcarSucio ? null : JSON.stringify(d));
    this.pestana.set('productos');
    this.errorForm.set('');
    this.intento.set(false);
  }
  protected cambiarBorrador(d: BorradorPedido): void {
    this.borrador.set(d);
    this.errorForm.set('');
  }
  protected async guardar(): Promise<void> {
    const d = this.borrador();
    if (!d || this.guardando()) return;
    this.intento.set(true);
    this.guardando.set(true);
    const r = await this.v.guardarPedido(d, this.esNuevo() ? null : (this.selId() as number));
    this.guardando.set(false);
    if ('error' in r) {
      this.errorForm.set(r.error);
      this.pestana.set(r.pestana);
      return;
    }
    this.borrador.set(null);
    this.guardado.set(null);
    this.intento.set(false);
    this.selId.set(r.id);
    void this.router.navigate([], { queryParams: { pedido: r.id, nuevo: null, repetir: null, cliente: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }
  protected descartar(): void {
    const nuevo = this.esNuevo();
    this.borrador.set(null);
    this.guardado.set(null);
    this.errorForm.set('');
    this.intento.set(false);
    if (nuevo) {
      this.selId.set(null);
      void this.router.navigate([], { queryParams: { nuevo: null, repetir: null }, queryParamsHandling: 'merge', replaceUrl: true });
    }
  }
  protected elegirPestana(k: string): void {
    this.pestana.set(k as Pestana);
  }

  protected exportar(): void {
    const esc = (x: unknown) => '"' + String(x ?? '').replace(/"/g, '""') + '"';
    const campos = this.v.camposPedido();
    const filas = this.filtrados().map((p) =>
      [pnum(p.numero), p.cliente.nombre, tel(p.cliente.telefono), CANAL[p.canal].t, EST[p.estado].t, PAGO[p.estadoPago].t, p.items.length, p.total, p.creadoEn.slice(0, 10), ...campos.map((c) => textoValor(c, p.atributos[c.clave]))].map(esc).join(','),
    );
    const url = URL.createObjectURL(new Blob(['﻿numero,cliente,celular,canal,estado,pago,productos,total,fecha' + campos.map((c) => ',' + esc(c.etiqueta)).join('') + '\n' + filas.join('\n')], { type: 'text/csv' }));
    Object.assign(document.createElement('a'), { href: url, download: 'pedidos.csv' }).click();
    URL.revokeObjectURL(url);
    this.alertas.mostrar({ estado: 'success', titulo: pl(filas.length, 'pedido exportado', 'pedidos exportados'), texto: 'CSV' });
  }

  @HostListener('document:keydown', ['$event'])
  protected teclas(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key === 's' && this.enForm()) { e.preventDefault(); void this.guardar(); return; }
    const t = e.target as HTMLElement;
    if (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); this.nuevo(); }
    else if ((e.key === 'ArrowDown' || e.key === 'j') && !this.enForm()) { e.preventDefault(); this.paso(1); }
    else if ((e.key === 'ArrowUp' || e.key === 'k') && !this.enForm()) { e.preventDefault(); this.paso(-1); }
    else if (e.key === 'Escape') { if (this.menu()) this.menu.set(false); else if (this.abierta()) this.cerrar(); }
  }
}
