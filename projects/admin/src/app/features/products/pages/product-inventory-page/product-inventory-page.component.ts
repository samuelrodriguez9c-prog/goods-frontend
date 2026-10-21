import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TablerIconComponent } from '@tabler/icons-angular';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { CatalogoStore } from '../../shared/catalogo.store';
import { cop, hace, num, pl } from '../../shared/formato';
import { Movimiento, ProductoV5 } from '../../shared/modelos';
import { EstadoPaginaComponent } from '../../shared/ui/estado-pagina/estado-pagina.component';
import { FranjaMetricasComponent, MetricaFranja } from '../../../../shared/ui/franja-metricas/franja-metricas.component';
import { icono } from '../../shared/ui/iconos';
import { ModuloCabeceraComponent } from '../../shared/ui/modulo-cabecera/modulo-cabecera.component';
import { PestanaHojaV5, PestanasHojaComponent } from '../../shared/ui/pestanas-hoja/pestanas-hoja.component';
import { PopoverDirective } from '../../../../shared/ui/popover.directive';
import { FilaInventario, FilaInventarioComponent } from './components/fila-inventario/fila-inventario.component';
import { GrupoInventario, GrupoInventarioComponent } from './components/grupo-inventario/grupo-inventario.component';
import { MiniaturaProductoComponent } from './components/miniatura-producto/miniatura-producto.component';
import { ModalReponerComponent } from './components/modal-reponer/modal-reponer.component';
import { PestanaComprasComponent } from './components/pestana-compras/pestana-compras.component';
import { PestanaMovimientosComponent } from './components/pestana-movimientos/pestana-movimientos.component';
import { PestanaResumenComponent } from './components/pestana-resumen/pestana-resumen.component';
import {
  Agrupacion, Ajuste, FiltroMovimientos, Metrica, NIVELES, Nivel, PestanaInventario, RangoMovimientos,
  TIPOS_MOVIMIENTO, ajusteVacio, categoriaRaiz, deltaAjuste, escalaStock, miniaturaDe, motivoDe, nivelDe, planReponer, soloDigitos, tipoDe,
  ultimaCompra,
} from './inventario.modelo';

const AGRUPACIONES: { k: Agrupacion; titulo: string; detalle: string; icono: string }[] = [
  { k: 'estado', titulo: 'Estado del stock', detalle: 'Sin stock, bajo el mínimo y al día', icono: 'stack-2' },
  { k: 'categoria', titulo: 'Categoría', detalle: 'Por categoría principal', icono: 'category' },
  { k: 'proveedor', titulo: 'Proveedor', detalle: 'A quién le compraste la última vez', icono: 'truck' },
];
/** Texto del chip de la métrica que filtra la lista. */
const FILTRO_METRICA: Record<Metrica, string> = {
  disp: 'Con unidades', res: 'Con reservas', bajo: 'Bajo el mínimo', sin: 'Sin stock', valor: 'Con costo cargado',
};
/** Subtítulo de los grupos por estado. */
const NOTA_NIVEL: Record<Nivel, string | null> = { sin: 'No se pueden vender', bajo: 'Avisamos en la campanita', ok: null };
const CHIP_NIVEL: Record<Nivel, string> = {
  sin: 'bg-[#ffe6e5] text-[#b42318]', bajo: 'bg-[#fff6d1] text-[#8a5a00]', ok: 'bg-[#e6f6ec] text-[#087b5d]',
};
const CIFRA_NIVEL: Record<Nivel, string> = { sin: 'text-[#b42318]', bajo: 'text-[#8a5a00]', ok: 'text-[#111827]' };
const MEDIDOR_NIVEL: Record<Nivel, string> = { sin: 'bg-[#d82c0d]', bajo: 'bg-[#ffb904]', ok: 'bg-[#303030]' };
const NOTA_MEDIDOR_NIVEL: Record<Nivel, string> = { sin: 'text-[#b42318]', bajo: 'text-[#8a5a00]', ok: 'text-[#9ca3af]' };

/**
 * Inventario: cabecera, franja de métricas, lista agrupada con
 * ajuste rápido ±1 y la hoja del producto (Resumen · Movimientos · Compras).
 * Los ajustes y el mínimo quedan como borrador hasta guardar ("Cambios sin guardar").
 */
@Component({
  selector: 'app-product-inventory-page',
  standalone: true,
  imports: [
    TablerIconComponent, ModuloCabeceraComponent, FranjaMetricasComponent, EstadoPaginaComponent, PestanasHojaComponent, PopoverDirective,
    GrupoInventarioComponent, FilaInventarioComponent, MiniaturaProductoComponent, PestanaResumenComponent, PestanaMovimientosComponent,
    PestanaComprasComponent, ModalReponerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-inventory-page.component.html',
  host: {
    class: 'flex h-full min-h-0 flex-col text-[13px] leading-[normal] text-[#111827] [&_tabler-icon]:inline-flex [&_tabler-icon]:shrink-0 [&_tabler-icon>svg]:block [&_tabler-icon>svg]:size-full [&_input::placeholder]:text-[#757575] [&_input::placeholder]:opacity-100',
    '(document:click)': 'agruparAbierto.set(false)',
    '(document:keydown)': 'atajos($event)',
  },
})
export class ProductInventoryPageComponent {
  protected readonly catalogo = inject(CatalogoStore);
  private readonly router = inject(Router);
  private readonly alertas = inject(AlertaService);

  protected readonly icono = icono;
  protected readonly num = num;
  protected readonly pl = pl;
  protected readonly agrupaciones = AGRUPACIONES;
  protected readonly filtroMetrica = FILTRO_METRICA;
  protected readonly chipNivel = CHIP_NIVEL;
  protected readonly cifraNivel = CIFRA_NIVEL;
  protected readonly medidorNivel = MEDIDOR_NIVEL;
  protected readonly notaMedidorNivel = NOTA_MEDIDOR_NIVEL;
  protected readonly niveles = NIVELES;

  private readonly franja = viewChild(FranjaMetricasComponent);
  private readonly buscador = viewChild<ElementRef<HTMLInputElement>>('buscador');

  // Estado de la pantalla
  protected readonly periodo = signal('hoy');
  protected readonly busqueda = signal('');
  protected readonly metrica = signal<Metrica | null>(null);
  protected readonly agrupacion = signal<Agrupacion>('estado');
  protected readonly agruparAbierto = signal(false);
  /** Grupos plegados, por clave. */
  protected readonly plegados = signal<Record<string, boolean>>({});
  protected readonly seleccionado = signal<number | null>(null);
  protected readonly pestana = signal<PestanaInventario>('resumen');
  /** La hoja ocupa toda la pantalla (sin cabecera ni lista). */
  protected readonly expandida = signal(false);
  /** Producto recién ajustado (destello en su fila). */
  protected readonly destello = signal<number | null>(null);
  protected readonly modalReponer = signal(false);
  // Borradores (alimentan "Cambios sin guardar").
  protected readonly ajuste = signal<Ajuste | null>(null);
  protected readonly minimo = signal<{ productoId: number; valor: string } | null>(null);
  /** Escribiendo: la alerta de cambios espera un momento. */
  private readonly escribiendo = signal(false);
  // Movimientos (se conservan al cambiar de pestaña o de producto).
  protected readonly filtroMovimientos = signal<FiltroMovimientos>('todos');
  protected readonly rangoMovimientos = signal<RangoMovimientos>('30');
  protected readonly movimientoAbierto = signal<number | null>(null);

  private tEscribiendo: ReturnType<typeof setTimeout> | undefined;
  private tDestello: ReturnType<typeof setTimeout> | undefined;

  // Datos
  private readonly stock = (id: number) => this.catalogo.stockDe(id);
  private readonly nivel = (id: number) => nivelDe(this.stock(id));
  private readonly nombreCategoria = (id: number | null) => this.catalogo.categoria(id)?.nombre ?? 'Sin categoría';
  private readonly nombreProveedor = (id: number) => this.catalogo.proveedor(id)?.nombre ?? '—';

  protected readonly editable = computed(() => this.catalogo.puede('inventario.editar'));
  protected readonly puedeComprar = computed(() => this.catalogo.puede('compras.crear'));
  protected readonly productos = computed(() => this.catalogo.productos().filter((p) => p.estado !== 'descontinuado'));
  protected readonly plan = computed(() => planReponer(this.catalogo));

  protected readonly carga = computed<'cargando' | 'error' | 'vacio' | 'lista'>(() => {
    const c = this.catalogo;
    if (c.cargando() && !c.cargado()) return 'cargando';
    if (c.error() && !c.cargado()) return 'error';
    return c.cargado() && this.productos().length === 0 ? 'vacio' : 'lista';
  });
  /** Error o vacío: solo la tarjeta de estado, sin lista ni hoja. */
  protected readonly soloEstado = computed(() => this.carga() === 'error' || this.carga() === 'vacio');

  // Cabecera y métricas
  private readonly totales = computed(() => {
    const ps = this.productos(), stock = ps.map((p) => this.stock(p.id));
    return {
      unidades: stock.reduce((a, s) => a + Math.max(0, s.disponible), 0),
      reservadas: stock.reduce((a, s) => a + s.reservado, 0),
      bajo: stock.filter((s) => nivelDe(s) === 'bajo').length,
      sin: stock.filter((s) => nivelDe(s) === 'sin').length,
      valor: ps.reduce((a, p, i) => a + (p.costo != null ? Math.max(0, stock[i].disponible) * p.costo : 0), 0),
    };
  });
  protected readonly lectura = computed(() => {
    const t = this.totales(), enCamino = this.plan().enCamino.length;
    return (
      `${t.bajo} productos bajo el mínimo y ${t.sin} sin stock. Tienes ${num(t.unidades)} unidades disponibles y ${num(t.reservadas)} reservadas por pedidos sin confirmar.` +
      (enCamino ? ` ${enCamino} ya vienen en compras pendientes.` : '')
    );
  });
  protected readonly porReponer = computed(() => this.plan().grupos.reduce((a, g) => a + g.lineas.length, 0));
  protected readonly metricas = computed<MetricaFranja[]>(() => {
    const t = this.totales(), m = this.metrica();
    const metrica = (k: Metrica, label: string, value: string, delta: string, tinta = '#303030') => ({ k, label, value, delta, tinta, activa: m === k });
    return [
      metrica('disp', 'Unidades disponibles', num(t.unidades), 'en ' + pl(this.productos().length, 'producto', 'productos')),
      metrica('res', 'Reservadas', num(t.reservadas), 'pedidos sin confirmar', t.reservadas ? '#0369a1' : undefined),
      metrica('bajo', 'Bajo el mínimo', String(t.bajo), t.bajo ? 'por reponer' : 'ninguno', t.bajo ? '#8a5a00' : undefined),
      metrica('sin', 'Sin stock', String(t.sin), t.sin ? 'no se pueden vender' : 'ninguno', t.sin ? '#b42318' : undefined),
      metrica('valor', 'Valor a costo', cop(t.valor), 'disponible × costo'),
    ];
  });

  // Lista
  private coincide(p: ProductoV5): boolean {
    const m = this.metrica(), q = this.busqueda().trim().toLowerCase(), s = this.stock(p.id);
    if (q && !(p.nombre.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q))) return false;
    if (m === 'res') return s.reservado > 0;
    if (m === 'valor') return p.costo != null && s.disponible > 0;
    if (m === 'bajo' || m === 'sin') return nivelDe(s) === m;
    return true;
  }

  protected readonly grupos = computed<GrupoInventario[]>(() => {
    const por = this.agrupacion(), plegados = this.plegados();
    const lista = this.productos().filter((p) => this.coincide(p)).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const unidades = (ps: ProductoV5[]) => num(ps.reduce((a, p) => a + Math.max(0, this.stock(p.id).disponible), 0)) + ' unidades';
    const fila = (p: ProductoV5): FilaInventario => {
      const s = this.stock(p.id);
      const ultima = por === 'categoria' ? ultimaCompra(this.catalogo, p.id) : null;
      const donde = por === 'categoria' ? (ultima ? this.nombreProveedor(ultima.proveedorId) : 'Sin proveedor') : this.nombreCategoria(p.categoriaId);
      const detalle = (p.sku || 'Sin SKU') + ' · ' + donde + (s.reservado ? ' · ' + s.reservado + ' reservadas' : '');
      return { id: p.id, nombre: p.nombre, detalle, miniatura: miniaturaDe(p, this.catalogo), stock: s, nivel: nivelDe(s) };
    };
    const grupo = (clave: string, titulo: string, icono: string, [fondo, tinta]: string[], ps: ProductoV5[], detalle?: string | null): GrupoInventario => ({
      clave, titulo, icono, fondo, tinta, detalle: detalle || unidades(ps), filas: ps.map(fila), abierto: !plegados[clave],
    });

    if (por === 'categoria') {
      const raices = this.catalogo.categorias().filter((c) => !c.categoriaPadreId).sort((a, b) => a.id - b.id);
      const grupos = raices.map((r) => {
        const [fondo, tinta, icono] = this.catalogo.tono(r.id);
        const ps = lista.filter((p) => p.categoriaId != null && categoriaRaiz(this.catalogo, p.categoriaId)?.id === r.id);
        const bajos = ps.filter((p) => this.nivel(p.id) !== 'ok').length;
        return grupo('c-' + r.id, r.nombre, icono, [fondo, tinta], ps, unidades(ps) + (bajos ? ' · ' + bajos + ' bajo el mínimo' : ''));
      });
      grupos.push(grupo('c-none', 'Sin categoría', 'folder-off', ['#f1f1f1', '#6b7280'], lista.filter((p) => p.categoriaId == null)));
      return grupos.filter((g) => g.filas.length);
    }
    if (por === 'proveedor') {
      // 0 = nunca comprado; va al final.
      const porProveedor = new Map<number, ProductoV5[]>();
      for (const p of lista) {
        const k = ultimaCompra(this.catalogo, p.id)?.proveedorId ?? 0;
        porProveedor.set(k, [...(porProveedor.get(k) ?? []), p]);
      }
      return [...porProveedor.keys()]
        .sort((a, b) => Number(a === 0) - Number(b === 0) || this.nombreProveedor(a).localeCompare(this.nombreProveedor(b), 'es'))
        .map((k) => {
          const ps = porProveedor.get(k)!;
          return k
            ? grupo('p-' + k, this.nombreProveedor(k), 'truck', ['#f1f1f1', '#4b5563'], ps, unidades(ps) + ' · último proveedor')
            : grupo('p-0', 'Sin compras registradas', 'help-circle', ['#f6f6f6', '#4b5563'], ps, unidades(ps) + ' · no sabemos a quién reponerle');
        });
    }
    return (['sin', 'bajo', 'ok'] as const)
      .map((n) => {
        const ps = lista.filter((p) => this.nivel(p.id) === n), nota = NOTA_NIVEL[n];
        return grupo('s-' + n, NIVELES[n].titulo, NIVELES[n].icono, [NIVELES[n].fondo, NIVELES[n].tinta], ps, nota ? unidades(ps) + ' · ' + nota : null);
      })
      .filter((g) => g.filas.length);
  });
  /** Ids en el orden de la lista (solo grupos abiertos): para ↑ ↓. */
  private readonly idsVisibles = computed(() => this.grupos().flatMap((g) => (g.abierto ? g.filas.map((f) => f.id) : [])));
  protected readonly cuentaVisibles = computed(() => pl(this.grupos().reduce((a, g) => a + g.filas.length, 0), 'producto', 'productos'));

  // Hoja del producto
  protected readonly hoja = computed(() => {
    const id = this.seleccionado(), producto = id != null ? this.catalogo.producto(id) : undefined;
    if (!producto || this.soloEstado()) return null;
    const stock = this.stock(producto.id), escala = escalaStock(stock), ids = this.idsVisibles(), posicion = ids.indexOf(producto.id);
    const compras = this.catalogo.compras().filter((c) => c.items.some((it) => it.productoId === producto.id)).sort((a, b) => b.fecha.localeCompare(a.fecha));
    const enCamino = compras.filter((c) => c.estado === 'pendiente');
    const nivel = nivelDe(stock);
    return {
      producto, stock, nivel, compras, enCamino,
      movimientos: this.catalogo.movimientos().filter((m) => m.productoId === producto.id).sort((a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime()),
      miniatura: miniaturaDe(producto, this.catalogo),
      categoria: this.nombreCategoria(producto.categoriaId),
      actualizado: 'Actualizado ' + hace(stock.actualizadoEn, this.catalogo.hoy()),
      navegacion: posicion >= 0 && ids.length > 1 ? { posicion, total: ids.length } : null,
      relleno: Math.min(100, (stock.disponible / escala) * 100),
      posicionMinimo: (stock.minimo / escala) * 100,
      notaMedidor: !stock.minimo
        ? 'Define un mínimo para recibir avisos'
        : nivel === 'ok' ? `Cubre el mínimo con ${stock.disponible - stock.minimo} de margen` : `Faltan ${stock.minimo - stock.disponible} para el mínimo`,
      faltaReponer: nivel !== 'ok' && enCamino.length === 0,
    };
  });
  protected readonly completa = computed(() => !!this.hoja() && this.expandida());
  protected readonly pestanas = computed<PestanaHojaV5[]>(() => {
    const h = this.hoja();
    return [
      { k: 'resumen', label: 'Resumen' },
      { k: 'movimientos', label: 'Movimientos', n: String(h?.movimientos.length ?? 0) },
      { k: 'compras', label: 'Compras', n: String(h?.compras.length ?? 0) },
    ];
  });
  /** Borrador de ajuste del producto abierto (o uno vacío). */
  protected readonly ajusteActual = computed(() => {
    const id = this.seleccionado()!, a = this.ajuste();
    return a && a.productoId === id ? a : ajusteVacio(id);
  });
  protected readonly minimoActual = computed(() => {
    const id = this.seleccionado()!, m = this.minimo();
    return m && m.productoId === id ? m.valor : String(this.stock(id).minimo);
  });

  /** Lo que falta guardar del producto abierto. */
  private readonly cambios = computed(() => {
    const id = this.seleccionado();
    if (id == null || !this.catalogo.producto(id)) return null;
    const stock = this.stock(id), a = this.ajuste(), m = this.minimo();
    const ajuste = a && a.productoId === id && deltaAjuste(a) !== 0 ? a : null;
    const despues = stock.disponible + (ajuste ? deltaAjuste(ajuste) : 0);
    const minimo = m && m.productoId === id ? +soloDigitos(m.valor) || 0 : stock.minimo;
    if (!ajuste && minimo === stock.minimo) return null;
    return { id, stock, ajuste, despues, minimo, cambiaMinimo: minimo !== stock.minimo, invalido: !!ajuste && despues < 0 };
  });

  constructor() {
    this.catalogo.asegurar();
    const id = Number(inject(ActivatedRoute).snapshot.queryParamMap.get('producto'));
    if (id) this.seleccionado.set(id);
    // Los movimientos se piden al abrir cada producto.
    effect(() => {
      const id = this.seleccionado();
      if (id != null) untracked(() => this.catalogo.cargarMovimientos(id));
    });
    // Un popover a la vez: al abrir el del período se cierra el de agrupar.
    effect(() => {
      if (this.franja()?.abierto()) untracked(() => this.agruparAbierto.set(false));
    });
    // Alerta fija "Cambios sin guardar" de la pila.
    effect(() => {
      const c = this.cambios(), escribiendo = this.escribiendo();
      untracked(() => {
        if (!c || escribiendo) return this.alertas.soltarCambios();
        const partes: string[] = [];
        if (c.ajuste) {
          const d = deltaAjuste(c.ajuste);
          partes.push(`${d > 0 ? 'Entrada de +' : 'Salida de −'}${Math.abs(d)} (${motivoDe(c.ajuste)}): ${c.stock.disponible} → ${c.despues}`);
        }
        if (c.cambiaMinimo) partes.push(`Stock mínimo ${c.stock.minimo} → ${c.minimo}`);
        this.alertas.fijarCambios({
          estado: c.invalido ? 'error' : 'warning',
          titulo: c.invalido ? 'Ajuste no válido' : 'Cambios sin guardar',
          texto:
            partes.join(' · ') +
            (c.invalido ? `. No puedes sacar más de lo que hay (${c.stock.disponible}).` : '. Guarda para aplicarlo o descarta. Atajo: Ctrl + S.'),
          guardar: () => this.guardar(),
          descartar: () => {
            this.ajuste.set(null);
            this.minimo.set(null);
          },
        });
      });
    });
    inject(DestroyRef).onDestroy(() => {
      this.alertas.soltarCambios();
      clearTimeout(this.tEscribiendo);
      clearTimeout(this.tDestello);
    });
  }

  // Selección y navegación
  protected abrir(id: number): void {
    if (id !== this.seleccionado() && this.cambios()) return this.alertas.sacudir();
    this.seleccionado.set(id);
    this.ajuste.set(null);
    this.minimo.set(null);
    this.router.navigate([], { queryParams: { producto: id }, replaceUrl: true });
  }
  protected cerrar(): void {
    if (this.cambios()) return this.alertas.sacudir();
    this.expandida.set(false);
    this.seleccionado.set(null);
    this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }
  protected mover(d: number): void {
    const ids = this.idsVisibles();
    if (!ids.length) return;
    const i = ids.indexOf(this.seleccionado() ?? -1);
    const siguiente = i < 0 ? ids[d > 0 ? 0 : ids.length - 1] : ids[Math.min(ids.length - 1, Math.max(0, i + d))];
    if (siguiente != null && siguiente !== this.seleccionado()) this.abrir(siguiente);
  }
  protected verFicha(id: number): void {
    this.router.navigate(['/products'], { queryParams: { producto: id } });
  }
  protected verCompra(id: number): void {
    this.router.navigate(['/products/compras'], { queryParams: { compra: id } });
  }
  protected verReferencia(m: Movimiento): void {
    if (m.referenciaTipo === 'compra') this.verCompra(m.referenciaId!);
    else if (m.referenciaId != null) this.router.navigate(['/orders', m.referenciaId]);
  }
  protected irProductos(): void {
    this.router.navigate(['/products']);
  }

  // Filtros y grupos
  protected alternarMetrica(k: string): void {
    this.metrica.update((m) => (m === k ? null : (k as Metrica)));
    this.plegados.set({});
  }
  protected limpiarFiltros(): void {
    this.metrica.set(null);
    this.busqueda.set('');
  }
  protected alternarAgrupar(e: Event): void {
    e.stopPropagation();
    this.agruparAbierto.update((v) => !v);
    this.franja()?.abierto.set(false);
  }
  protected agrupar(k: Agrupacion): void {
    this.agrupacion.set(k);
    this.agruparAbierto.set(false);
    this.plegados.set({});
  }
  protected plegarTodos(plegar: boolean): void {
    this.plegados.set(plegar ? Object.fromEntries(this.grupos().map((g) => [g.clave, true])) : {});
    this.agruparAbierto.set(false);
  }
  protected alternarGrupo(clave: string): void {
    this.plegados.update((p) => ({ ...p, [clave]: !p[clave] }));
  }

  // Ajustes
  /** ±1 desde la fila: se guarda al instante. */
  protected sumar(id: number, d: number): void {
    if (this.catalogo.niega('inventario.editar')) return;
    if (this.stock(id).disponible + d < 0) {
      this.alertas.mostrar({ estado: 'error', titulo: 'No se puede restar · el stock quedaría en negativo' });
      return;
    }
    this.catalogo.ajustarStock(id, d, 'Conteo físico');
    this.destellar(id);
  }
  protected cambiarAjuste(cambio: Partial<Ajuste>): void {
    const id = this.seleccionado();
    if (id == null) return;
    this.marcarEscritura();
    this.ajuste.update((a) => ({ ...(a && a.productoId === id ? a : ajusteVacio(id)), ...cambio }));
  }
  protected cambiarMinimo(valor: string): void {
    const id = this.seleccionado();
    if (id == null) return;
    this.marcarEscritura();
    this.minimo.set({ productoId: id, valor });
  }
  protected guardar(): void {
    const c = this.cambios();
    if (!c || this.catalogo.niega('inventario.editar')) return;
    if (c.invalido) {
      this.alertas.mostrar({ estado: 'error', titulo: 'No se puede guardar · el stock quedaría en negativo' });
      return;
    }
    if (c.cambiaMinimo) {
      this.minimo.set(null);
      this.catalogo.fijarMinimo(c.id, c.minimo);
    }
    if (c.ajuste) {
      this.catalogo.ajustarStock(c.id, deltaAjuste(c.ajuste), motivoDe(c.ajuste));
      this.ajuste.set(null);
      this.destellar(c.id);
    }
  }
  protected revertir(m: Movimiento): void {
    if (this.catalogo.niega('inventario.editar')) return;
    if (this.stock(m.productoId).disponible - m.cantidad < 0) {
      this.alertas.mostrar({ estado: 'error', titulo: 'No se puede revertir · el stock quedaría en negativo' });
      return;
    }
    const tipo = TIPOS_MOVIMIENTO[tipoDe(m.tipo)].titulo.toLowerCase();
    this.catalogo.ajustarStock(m.productoId, -m.cantidad, 'Reversión de ' + tipo);
    this.destellar(m.productoId);
    this.movimientoAbierto.set(null);
  }
  private marcarEscritura(): void {
    clearTimeout(this.tEscribiendo);
    this.escribiendo.set(true);
    this.tEscribiendo = setTimeout(() => this.escribiendo.set(false), 1100);
  }
  private destellar(id: number): void {
    this.destello.set(id);
    clearTimeout(this.tDestello);
    this.tDestello = setTimeout(() => this.destello.set(null), 900);
  }

  // Exportar y reponer
  protected exportar(): void {
    const celda = (v: unknown) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const estado = { sin: 'sin stock', bajo: 'bajo', ok: 'ok' };
    const filas = this.productos().map((p) => {
      const s = this.stock(p.id);
      return [p.sku, p.nombre, this.nombreCategoria(p.categoriaId), s.disponible, s.reservado, s.disponible - s.reservado, s.minimo, estado[nivelDe(s)], p.costo].map(celda).join(',');
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿sku,nombre,categoria,disponible,reservado,vendible,minimo,estado,costo\n' + filas.join('\n')], { type: 'text/csv' }));
    a.download = 'inventario.csv';
    a.click();
    this.alertas.mostrar({ estado: 'success', titulo: filas.length + ' productos exportados a CSV' });
  }
  protected abrirReponer(): void {
    if (this.catalogo.niega('compras.crear')) return;
    this.modalReponer.set(true);
  }
  protected async reponer(): Promise<void> {
    const plan = this.plan();
    this.modalReponer.set(false);
    for (const g of plan.grupos)
      await this.catalogo.crearCompra(
        g.proveedorId,
        g.lineas.map((l) => ({ productoId: l.producto.id, cantidad: l.cantidad, precioUnitario: l.precio })),
        'Creada desde Inventario › Reponer',
        {},
        { accion: () => ({ label: 'Ver compras', ejecutar: () => this.router.navigate(['/products/compras']) }) },
      );
  }

  // Atajos
  protected atajos(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && this.cambios()) {
      e.preventDefault();
      this.guardar();
      return;
    }
    if (this.modalReponer()) {
      if (e.key === 'Escape') this.modalReponer.set(false);
      return;
    }
    // Esc con un popover abierto solo lo cierra (el del período se cierra solo).
    if (e.key === 'Escape' && (this.agruparAbierto() || this.franja()?.abierto())) {
      this.agruparAbierto.set(false);
      return;
    }
    const tag = (document.activeElement as HTMLElement | null)?.tagName || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === '/') {
      const campo = this.buscador()?.nativeElement;
      if (campo) {
        e.preventDefault();
        campo.focus();
      }
      return;
    }
    if (e.key === 'Escape' && this.seleccionado() != null) return this.cerrar();
    const d = e.key === 'ArrowDown' || e.key === 'j' ? 1 : e.key === 'ArrowUp' || e.key === 'k' ? -1 : 0;
    if (d) {
      e.preventDefault();
      this.mover(d);
    }
  }
}
