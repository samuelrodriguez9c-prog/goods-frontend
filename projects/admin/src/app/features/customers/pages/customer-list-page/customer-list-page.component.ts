import { ChangeDetectionStrategy, Component, HostListener, computed, effect, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { CabeceraModuloComponent, MetricaCabecera } from '../../../../shared/ui/cabecera-modulo/cabecera-modulo.component';
import { CatalogoStore } from '../../../products/shared/catalogo.store';
import { cop, dias, fecha, norm, pl } from '../../../products/shared/formato';
import { ChipFiltro, FilaModulo, GrupoModulo } from '../../../products/shared/modelos';
import { EstadoPaginaComponent } from '../../../products/shared/ui/estado-pagina/estado-pagina.component';
import { HojaComponent } from '../../../products/shared/ui/hoja/hoja.component';
import { IcComponent } from '../../../products/shared/ui/ic/ic.component';
import { icono } from '../../../products/shared/ui/iconos';
import { ListaModuloComponent } from '../../../products/shared/ui/lista-modulo/lista-modulo.component';
import { PestanaHojaV5, PestanasHojaComponent } from '../../../products/shared/ui/pestanas-hoja/pestanas-hoja.component';
import { iniCliente, relativo, tel } from '../../../orders/shared/ventas.formato';
import { BorradorCliente, Cliente, Pedido, tonoCliente } from '../../../orders/shared/ventas.modelos';
import { VentasStore } from '../../../orders/shared/ventas.store';
import { FiltrosClientesComponent, OrdenClientes } from './components/filtros-clientes/filtros-clientes.component';
import { FormularioClienteComponent } from './components/formulario-cliente/formulario-cliente.component';
import { PestanaDatosComponent } from './components/pestana-datos/pestana-datos.component';
import { PestanaNotasComponent } from './components/pestana-notas/pestana-notas.component';
import { PestanaPedidosComponent } from './components/pestana-pedidos/pestana-pedidos.component';

type Metrica = 'nuevos' | 'activos' | 'promo';
type Pestana = 'resumen' | 'pedidos' | 'notas';
type Periodo = 'hoy' | '7d' | '30d';

/**
 * Clientes (handoff-pedidos-clientes). Lista agrupada (Nuevos · Frecuentes ·
 * Ocasionales, o Archivados) + hoja con 3 pestañas: Resumen (cifras,
 * contacto, dirección, promociones; edición en la misma hoja), Pedidos
 * (huella de compras + línea de tiempo con «Repetir») y Notas (libreta).
 *
 * Rutas: `?cliente=ID` abre la hoja · `?nuevo=1` · `?completa=1`.
 * Atajos: N (nuevo), Esc, ↑/↓ o j/k, / (buscar), Ctrl+S.
 */
@Component({
  selector: 'app-customer-list-page',
  standalone: true,
  imports: [
    CabeceraModuloComponent, ListaModuloComponent, HojaComponent, PestanasHojaComponent, EstadoPaginaComponent, IcComponent,
    FiltrosClientesComponent, FormularioClienteComponent, PestanaDatosComponent, PestanaPedidosComponent, PestanaNotasComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customer-list-page.component.html',
  host: { class: 'flex h-full min-h-0 flex-col gap-4 px-6 pt-5 leading-[normal]' },
})
export class CustomerListPageComponent {
  protected readonly v = inject(VentasStore);
  protected readonly cat = inject(CatalogoStore);
  private readonly alertas = inject(AlertaService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly libreta = viewChild(PestanaNotasComponent);
  protected readonly icono = icono;
  protected readonly f = { cop, pl, tel, rel: (iso: string) => relativo(iso, this.v.hoy()) };

  // ── Lista ───────────────────────────────────────────────────────────
  protected readonly q = signal('');
  protected readonly metrica = signal<Metrica | null>(null);
  protected readonly orden = signal<OrdenClientes>('reciente');
  protected readonly archivados = signal(false);
  protected readonly colapsados = signal<Set<string>>(new Set());
  protected readonly periodo = signal<Periodo>('hoy');

  private enPeriodo(iso: string) {
    const d = dias(iso, this.v.hoy()), k = this.periodo();
    return k === 'hoy' ? d === 0 : k === '7d' ? d < 7 : d < 30;
  }
  private nuevoC = (c: Cliente) => dias(c.creadoEn, this.v.hoy()) < 30;
  private frecuente = (c: Cliente) => c.cantidadPedidos >= 3;

  protected readonly filtrados = computed(() => {
    const qq = norm(this.q()).replace(/\s/g, ''), m = this.metrica();
    const SO: Record<OrdenClientes, (a: Cliente, b: Cliente) => number> = {
      reciente: (a, b) => (b.ultimoPedidoEn ?? '').localeCompare(a.ultimoPedidoEn ?? '') || b.creadoEn.localeCompare(a.creadoEn),
      nombre: (a, b) => a.nombre.localeCompare(b.nombre, 'es'),
      gasto: (a, b) => b.totalGastado - a.totalGastado,
      pedidos: (a, b) => b.cantidadPedidos - a.cantidadPedidos,
    };
    return this.v
      .clientes()
      .filter((c) => {
        if (!!c.archivadoEn !== this.archivados()) return false;
        if (qq && ![c.nombre, c.telefono, tel(c.telefono), c.correo, c.documento].some((x) => norm(x).replace(/\s/g, '').includes(qq))) return false;
        if (m === 'nuevos') return this.nuevoC(c);
        if (m === 'activos') return !!c.ultimoPedidoEn && this.enPeriodo(c.ultimoPedidoEn);
        if (m === 'promo') return c.aceptaPromociones;
        return true;
      })
      .sort(SO[this.orden()]);
  });

  private fila(c: Cliente): FilaModulo<Cliente> {
    const t = tonoCliente(c.id), arch = !!c.archivadoEn;
    return {
      id: c.id,
      nombre: c.nombre,
      sub: `${tel(c.telefono) || 'Sin celular'} · ${pl(c.cantidadPedidos, 'pedido', 'pedidos')}`,
      barra: 'transparent',
      mini: { fondo: arch ? '#f1f1f1' : t[0], tinta: arch ? '#9ca3af' : t[1], iniciales: iniCliente(c.nombre) },
      etiqueta: c.whatsappContactoId ? 'WhatsApp' : null,
      valor: cop(c.totalGastado),
      valorColor: c.totalGastado ? '#111827' : '#9ca3af',
      gauge: null,
      gaugeColor: '',
      dato: c,
    };
  }
  protected readonly grupos = computed<GrupoModulo<Cliente>[]>(() => {
    const xs = this.filtrados();
    const armar = (clave: string, titulo: string, icono: string, fondo: string, color: string, cs: Cliente[], sub: string): GrupoModulo<Cliente> =>
      ({ clave, titulo, icono, fondo, color, sub, filas: cs.map((c) => this.fila(c)) });
    if (this.archivados()) return [armar('a', 'Archivados', 'archive', '#f1f1f1', '#6b7280', xs, 'No aparecen al crear pedidos')].filter((g) => g.filas.length);
    return [
      armar('n', 'Nuevos', 'sparkles', '#e0f7f5', '#00605b', xs.filter(this.nuevoC), 'Llegaron en los últimos 30 días'),
      armar('f', 'Frecuentes', 'repeat', '#e6f6ec', '#087b5d', xs.filter((c) => !this.nuevoC(c) && this.frecuente(c)), '3 pedidos o más'),
      armar('o', 'Ocasionales', 'user', '#f1f1f1', '#4b5563', xs.filter((c) => !this.nuevoC(c) && !this.frecuente(c)), 'Menos de 3 pedidos'),
    ].filter((g) => g.filas.length);
  });
  protected readonly visibles = computed(() => this.grupos().flatMap((g) => (this.colapsados().has(g.clave) ? [] : g.filas.map((x) => x.id))));
  protected readonly chips = computed<ChipFiltro[]>(() => {
    const MT: Record<Metrica, string> = { nuevos: 'Nuevos del mes', activos: 'Con pedidos · ' + this.periodoTexto().toLowerCase(), promo: 'Aceptan promociones' }, c: ChipFiltro[] = [];
    if (this.metrica()) c.push({ texto: MT[this.metrica()!], quitar: () => this.metrica.set(null) });
    if (this.archivados()) c.push({ texto: 'Archivados', quitar: () => this.archivados.set(false) });
    return c;
  });
  protected readonly periodoTexto = computed(() => ({ hoy: 'Hoy', '7d': 'Últimos 7 días', '30d': 'Últimos 30 días' })[this.periodo()]);
  protected readonly metricas = computed<MetricaCabecera[]>(() => {
    const all = this.v.clientes().filter((c) => !c.archivadoEn), arch = this.v.clientes().length - all.length;
    const act = all.filter((c) => !!c.ultimoPedidoEn && this.enPeriodo(c.ultimoPedidoEn));
    return [
      { id: 'todos', etiqueta: 'Clientes', valor: all.length, delta: arch ? pl(arch, 'archivado', 'archivados') : 'ninguno archivado' },
      { id: 'nuevos', etiqueta: 'Nuevos del mes', valor: all.filter(this.nuevoC).length, delta: 'últimos 30 días', trazo: '#2be0d5' },
      { id: 'activos', etiqueta: 'Con pedidos', valor: act.length, delta: this.periodoTexto().toLowerCase(), tono: 'exito' },
      { id: 'promo', etiqueta: 'Aceptan promociones', valor: all.filter((c) => c.aceptaPromociones).length, delta: 'por WhatsApp', trazo: '#25d366' },
    ];
  });
  protected readonly badge = computed(() => pl(this.v.clientes().filter((c) => !c.archivadoEn).length, 'cliente', 'clientes'));

  // ── Hoja ────────────────────────────────────────────────────────────
  protected readonly selId = signal<number | 'nuevo' | null>(null);
  protected readonly pestana = signal<Pestana>('resumen');
  protected readonly completa = signal(false);
  protected readonly menu = signal(false);
  protected readonly borrador = signal<BorradorCliente | null>(null);
  private readonly guardado = signal('');
  protected readonly error = signal('');
  protected readonly guardando = signal(false);

  protected readonly puedeEditar = computed(() => this.cat.puede('clientes.editar'));
  protected readonly esNuevo = computed(() => this.selId() === 'nuevo');
  protected readonly sel = computed(() => { const id = this.selId(); return typeof id === 'number' ? this.v.cliente(id) ?? null : null; });
  protected readonly abierta = computed(() => this.esNuevo() || !!this.sel());
  protected readonly sucio = computed(() => { const b = this.borrador(); return !!b && JSON.stringify(b) !== this.guardado(); });
  protected readonly cols = computed(() =>
    this.completa() && this.abierta() ? 'minmax(0,1fr)' : this.abierta() ? 'minmax(300px,.86fr) minmax(0,1.34fr)' : 'minmax(320px,1.3fr) minmax(240px,.7fr)',
  );
  protected readonly posicion = computed(() => ({ i: this.visibles().indexOf(this.sel()?.id ?? -1), n: this.visibles().length }));
  protected readonly st = computed(() => (this.sel() ? this.v.stats(this.sel()!.id) : null));
  protected readonly pestanas = computed<PestanaHojaV5[]>(() =>
    this.esNuevo()
      ? [{ k: 'resumen', label: 'Resumen' }]
      : [
          { k: 'resumen', label: 'Resumen' },
          { k: 'pedidos', label: 'Pedidos', n: String(this.st()?.n ?? 0) },
          { k: 'notas', label: 'Notas', n: this.sel()?.notas ? '•' : null },
        ],
  );
  protected readonly cab = computed(() => {
    const c = this.sel(), d = this.borrador(), nombre = d ? d.nombre : c?.nombre ?? '', arch = !!c?.archivadoEn, t = tonoCliente(c?.id ?? 0);
    return {
      nombre: nombre || 'Cliente sin nombre',
      nombreC: nombre ? '#111827' : '#b5b5b5',
      ini: nombre ? iniCliente(nombre) : '?',
      fondo: arch ? '#f1f1f1' : c ? t[0] : '#f4f4f4',
      tinta: arch ? '#9ca3af' : c ? t[1] : '#9ca3af',
      sub: c ? `${tel(c.telefono) || 'Sin celular'} · cliente desde ${fecha(c.creadoEn)}` : 'Sin guardar',
    };
  });

  constructor() {
    this.cat.asegurar();
    this.v.asegurar();
    const qp = this.ruta.snapshot.queryParamMap;
    if (qp.get('cliente')) this.selId.set(+qp.get('cliente')!);
    if (qp.get('nuevo')) this.nuevo();
    if (qp.get('completa')) this.completa.set(true);
    // Si el cliente del enlace no existe (o es de otra empresa), se cierra la hoja.
    this.v.alListo(async () => {
      const id = this.selId();
      if (typeof id === 'number' && !this.v.cliente(id) && !(await this.v.cargarCliente(id))) {
        this.selId.set(null);
        this.alertas.mostrar({ estado: 'warning', titulo: 'No encontramos ese cliente', texto: 'Puede que lo hayan borrado.' });
      }
    });
    // Todos sus pedidos (la lista de Pedidos solo trae los más recientes): Pedidos y Notas los usan.
    effect(() => { const id = this.selId(); if (typeof id === 'number') this.v.cargarPedidosDe(id); });
    effect(() => {
      this.alertas.fijarCambios(
        this.sucio()
          ? { titulo: 'Cambios sin guardar', texto: this.esNuevo() ? 'Cliente nuevo sin crear' : 'Editaste los datos del cliente', guardar: () => void this.guardar(), descartar: () => this.descartar() }
          : null,
      );
    });
  }

  private bloqueado(): boolean {
    if (this.sucio() || this.libreta()?.sucio()) { this.alertas.sacudir(); return true; }
    return false;
  }
  protected abrir(id: number): void {
    if (this.selId() === id || this.bloqueado()) return;
    this.borrador.set(null);
    this.menu.set(false);
    this.error.set('');
    this.selId.set(id);
    void this.router.navigate([], { queryParams: { cliente: id, nuevo: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }
  protected cerrar(): void {
    if (this.bloqueado()) return;
    this.selId.set(null);
    this.borrador.set(null);
    this.completa.set(false);
    this.menu.set(false);
    void this.router.navigate([], { queryParams: { cliente: null, nuevo: null, completa: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }
  protected paso(d: 1 | -1): void {
    const ids = this.visibles(), { i } = this.posicion();
    if (!ids.length) return;
    this.abrir(i < 0 ? ids[d > 0 ? 0 : ids.length - 1] : ids[Math.min(ids.length - 1, Math.max(0, i + d))]);
  }
  protected alternarCompleta(): void {
    this.completa.update((x) => !x);
    void this.router.navigate([], { queryParams: { completa: this.completa() ? 1 : null }, queryParamsHandling: 'merge', replaceUrl: true });
  }
  protected elegirMetrica(id: string): void {
    this.archivados.set(false);
    this.metrica.update((m) => (id === 'todos' || m === id ? null : (id as Metrica)));
  }
  protected cambiarPeriodo(): void {
    this.periodo.update((p) => (p === 'hoy' ? '7d' : p === '7d' ? '30d' : 'hoy'));
  }
  protected alternarGrupo(k: string): void {
    this.colapsados.update((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  }
  protected limpiar(): void {
    this.q.set('');
    this.metrica.set(null);
    this.archivados.set(false);
  }
  protected elegirPestana(k: string): void {
    if (this.sucio()) { this.alertas.sacudir(); return; }
    this.pestana.set(k as Pestana);
  }

  protected nuevo(): void {
    if (this.bloqueado() || this.cat.niega('clientes.editar')) return;
    const d = this.v.borradorCliente();
    this.selId.set('nuevo');
    this.borrador.set(d);
    this.guardado.set(JSON.stringify(d));
    this.error.set('');
    this.pestana.set('resumen');
  }
  protected editar(): void {
    const c = this.sel();
    if (!c || this.cat.niega('clientes.editar')) return;
    this.menu.set(false);
    const d = this.v.borradorCliente(c);
    this.borrador.set(d);
    this.guardado.set(JSON.stringify(d));
    this.error.set('');
    this.pestana.set('resumen');
  }
  protected cambiarBorrador(d: BorradorCliente): void {
    this.borrador.set(d);
    this.error.set('');
  }
  protected async guardar(): Promise<void> {
    const d = this.borrador();
    if (!d || this.guardando()) return;
    this.guardando.set(true);
    const r = await this.v.guardarCliente(d, this.esNuevo() ? null : (this.selId() as number));
    this.guardando.set(false);
    if ('error' in r) { this.error.set(r.error); return; }
    this.borrador.set(null);
    this.selId.set(r.id);
    void this.router.navigate([], { queryParams: { cliente: r.id, nuevo: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }
  protected descartar(): void {
    const n = this.esNuevo();
    this.borrador.set(null);
    this.error.set('');
    if (n) {
      this.selId.set(null);
      void this.router.navigate([], { queryParams: { nuevo: null }, queryParamsHandling: 'merge', replaceUrl: true });
    }
  }
  protected archivar(): void {
    const c = this.sel();
    if (!c) return;
    this.menu.set(false);
    this.v.archivar(c.id);
  }

  protected abrirPedido(id: number): void {
    if (!this.bloqueado()) void this.router.navigate(['/orders'], { queryParams: { pedido: id } });
  }
  private archivadoAviso(c: Cliente | null): boolean {
    if (!c?.archivadoEn) return false;
    this.alertas.mostrar({ estado: 'warning', titulo: 'Cliente archivado', texto: `Desarchiva a ${c.nombre.split(' ')[0]} para crearle pedidos` });
    return true;
  }
  protected nuevoPedido(): void {
    const c = this.sel();
    if (!c || this.archivadoAviso(c) || this.bloqueado()) return;
    void this.router.navigate(['/orders'], { queryParams: { nuevo: 1, cliente: c.id } });
  }
  protected repetir(p: Pedido): void {
    if (this.archivadoAviso(this.sel()) || this.bloqueado()) return;
    void this.router.navigate(['/orders'], { queryParams: { nuevo: 1, repetir: p.id } });
  }
  protected verTodos(): void {
    const c = this.sel();
    if (c && !this.bloqueado()) void this.router.navigate(['/orders'], { queryParams: { cliente: c.id } });
  }
  /** Con el contacto vinculado abre la bandeja de Goods; si no, WhatsApp con el número. */
  protected whatsapp(): void {
    const c = this.sel();
    if (!c) return;
    if (c.whatsappContactoId) void this.router.navigate(['/whatsapp']);
    else if (c.telefono) window.open(`https://wa.me/${c.telefono}`, '_blank', 'noopener');
  }

  @HostListener('document:keydown', ['$event'])
  protected teclas(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key === 's' && this.borrador()) { e.preventDefault(); void this.guardar(); return; }
    const t = e.target as HTMLElement;
    if (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); this.nuevo(); }
    else if ((e.key === 'ArrowDown' || e.key === 'j') && !this.borrador()) { e.preventDefault(); this.paso(1); }
    else if ((e.key === 'ArrowUp' || e.key === 'k') && !this.borrador()) { e.preventDefault(); this.paso(-1); }
    else if (e.key === 'Escape') { if (this.menu()) this.menu.set(false); else if (this.abierta()) this.cerrar(); }
  }
}
