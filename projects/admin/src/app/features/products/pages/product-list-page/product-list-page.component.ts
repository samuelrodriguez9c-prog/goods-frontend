import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { ProductoService } from '../../../../core/producto/producto.service';
import { InventarioService } from '../../../../core/inventario/inventario.service';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IconAdjustmentsHorizontal, IconAlertOctagon, IconAlertTriangle, IconArchive, IconArrowUp, IconCheck,
  IconChevronDown, IconChevronUp, IconCircleCheck, IconCircleDot, IconCircleX, IconCloudOff, IconCurrencyDollar,
  IconFileSpreadsheet, IconFolder, IconFolderOff, IconFolderQuestion, IconFolders, IconLayoutGrid, IconList,
  IconPencil, IconPlus, IconSearch, IconStack2, IconStar, IconStarFilled, IconStarHalfFilled, IconTag, IconTrash, IconX,
  TablerIconComponent,
  type TablerIcon,
} from '@tabler/icons-angular';
import { CambiosEnVivoService } from '../../../../core/realtime/cambios-en-vivo.service';
import { ESTADOS_PRODUCTO, EstadoProducto, ProductoCatalogo } from '../../../../core/producto/models/producto.model';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { AtajosService, verTecla } from '../../../../core/ui/atajos.service';
import { PistaService } from '../../../../core/ui/pista.service';
import { AutofocoDirective } from '../../../../shared/ui/autofoco.directive';
import { EstadoIconoComponent } from '../../../../shared/ui/estado-icono/estado-icono.component';
import { AtajosDialogoComponent } from '../../components/atajos-dialogo/atajos-dialogo.component';
import { ProductoFichaComponent } from '../../components/producto-ficha/producto-ficha.component';
import { Agrupar, PMAX, ProductosStore, cop, num } from '../../productos.store';

type SeccionFiltro = 'agrupar' | 'estado' | 'categorias' | 'precio';

/**
 * Productos v4 (handoff-productos §2). Lista + ficha lado a lado, filtros en
 * popover, selección masiva con barra oscura, edición en línea de precio y
 * stock, atajos de teclado y "Cambios sin guardar" en la pila de alertas.
 *
 * Toda la lógica de datos vive en `ProductosStore`; acá solo hay UI.
 */
/** Ventana en la que un `datos:cambio` se toma como eco de una escritura propia. */
const ECO_PROPIO_MS = 2500;

@Component({
  selector: 'app-product-list-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TablerIconComponent, EstadoIconoComponent, AutofocoDirective, ProductoFichaComponent, AtajosDialogoComponent],
  providers: [ProductosStore],
  templateUrl: './product-list-page.component.html',
})
export class ProductListPageComponent {
  protected readonly s = inject(ProductosStore);
  protected readonly atajos = inject(AtajosService);
  private readonly alertas = inject(AlertaService);
  private readonly pista = inject(PistaService);
  private readonly router = inject(Router);

  protected readonly ic = {
    tag: IconTag, plus: IconPlus, search: IconSearch, x: IconX, filtros: IconAdjustmentsHorizontal,
    grilla: IconLayoutGrid, lista: IconList, check: IconCheck, abajo: IconChevronDown, arriba: IconChevronUp,
    flecha: IconArrowUp, nube: IconCloudOff, estrella: IconStarFilled, lapiz: IconPencil, dot: IconCircleDot,
    carpeta: IconFolder, carpetas: IconFolders, sinCarpeta: IconFolderOff, estrellaVacia: IconStar,
    estrellaMedia: IconStarHalfFilled, csv: IconFileSpreadsheet, basura: IconTrash, capas: IconStack2,
    precio: IconCurrencyDollar,
  };
  /** Íconos de grupo por nombre (los define el store). */
  protected readonly icGrupo: Record<string, TablerIcon> = {
    'circle-check': IconCircleCheck, 'alert-octagon': IconAlertOctagon, archive: IconArchive, 'circle-x': IconCircleX,
    'alert-triangle': IconAlertTriangle, folder: IconFolder, 'folder-question': IconFolderQuestion,
  };
  protected readonly EST = ESTADOS_PRODUCTO;
  protected readonly estados = Object.keys(ESTADOS_PRODUCTO) as EstadoProducto[];
  protected readonly PMAX = PMAX;
  protected readonly cop = cop;
  protected readonly num = num;

  // ── UI local ──
  protected readonly filtrosAbierto = signal(false);
  protected readonly seccion = signal<SeccionFiltro>('estado');
  protected readonly qFoco = signal(false);
  protected readonly hover = signal<number | null>(null);
  protected readonly menuMasivo = signal<'estado' | 'categoria' | null>(null);
  protected readonly atajosAbierto = this.atajos.guia;
  protected readonly cambiosEnVivo = signal(0);
  private gEn = 0;

  protected readonly agrupaciones: { k: Agrupar; t: string; d: string; icon: TablerIcon }[] = [
    { k: 'estado', t: 'Por estado', d: 'Activos, agotados y descontinuados', icon: IconCircleDot },
    { k: 'categoria', t: 'Por categoría', d: 'Principales y sus subcategorías', icon: IconFolders },
    { k: 'stock', t: 'Por stock', d: 'Sin stock, bajo el mínimo y al día', icon: IconStack2 },
  ];
  protected readonly secciones = computed(() => {
    const st = this.s;
    const ag = this.agrupaciones.find((a) => a.k === st.agrupar())!.t;
    return [
      { k: 'agrupar' as const, t: 'Agrupar', sub: ag, icon: IconStack2, act: st.agrupar() !== 'estado' },
      { k: 'estado' as const, t: 'Estado', sub: st.fEstados().length ? st.fEstados().map((e) => ESTADOS_PRODUCTO[e].t).join(', ') : 'Todos', icon: IconCircleDot, act: st.fEstados().length > 0 },
      { k: 'categorias' as const, t: 'Categorías', sub: st.fCats().length ? st.fCats().length + ' elegidas' : 'Todas', icon: IconFolders, act: st.fCats().length > 0 },
      { k: 'precio' as const, t: 'Precio', sub: st.hayFiltroPrecio() ? cop(st.pMin()) + ' – ' + (st.pMax() < PMAX ? cop(st.pMax()) : 'más') : 'Cualquiera', icon: IconCurrencyDollar, act: st.hayFiltroPrecio() },
    ];
  });
  protected readonly indiceSeccion = computed(() => this.secciones().findIndex((x) => x.k === this.seccion()));

  /** Cuántos hay de cada estado / categoría (para los conteos del popover). */
  protected cuentaEstado(e: EstadoProducto): number {
    return this.s.productos().filter((p) => p.estado === e).length;
  }
  protected cuentaCategoria(id: number): number {
    return this.s.productos().filter((p) => id === 0 ? p.categoriaId == null : p.categoriaId === id || this.s.categoria(p.categoriaId)?.categoriaPadreId === id).length;
  }

  protected readonly rangos = [
    { t: 'Cualquier precio', d: 'Sin límite', min: 0, max: PMAX },
    { t: 'Hasta $5.000', d: 'Panes sueltos, bebidas', min: 0, max: 5000 },
    { t: '$5.000 – $20.000', d: 'La mayoría del catálogo', min: 5000, max: 20000 },
    { t: 'Más de $20.000', d: 'Tortas, insumos', min: 20000, max: PMAX },
  ];
  /** Histograma de precios: 24 barras sobre 0 – PMAX. */
  protected readonly barras = computed(() => {
    const n = 24, paso = PMAX / n, cuenta = new Array(n).fill(0);
    this.s.productos().forEach((p) => cuenta[Math.min(n - 1, Math.floor(p.precio / paso))]++);
    const max = Math.max(1, ...cuenta);
    return cuenta.map((c, i) => ({
      alto: (c ? Math.max(8, (c / max) * 100) : 4) + '%',
      dentro: i * paso >= this.s.pMin() && (this.s.pMax() >= PMAX || (i + 1) * paso <= this.s.pMax()),
      tip: c + ' entre ' + cop(i * paso) + ' y ' + cop((i + 1) * paso),
    }));
  });
  protected readonly enRango = computed(() => {
    const n = this.s.productos().filter((p) => p.precio >= this.s.pMin() && (this.s.pMax() >= PMAX || p.precio <= this.s.pMax())).length;
    return n + (n === 1 ? ' producto' : ' productos');
  });

  /** Columnas: lista + ficha. Ficha expandida = solo ficha. Grilla sin ficha = solo grilla. */
  protected readonly columnas = computed(() => {
    const abierta = this.s.abierto() != null, grilla = this.s.vista() === 'grilla';
    if (this.vacio() || (abierta && this.s.completa())) return 'minmax(0,1fr)';
    if (grilla) return abierta ? 'minmax(0,1.15fr) minmax(0,1fr)' : 'minmax(0,1fr)';
    return abierta ? 'minmax(300px,0.86fr) minmax(0,1.34fr)' : 'minmax(320px,1.3fr) minmax(240px,0.7fr)';
  });
  protected readonly vacio = computed(() => this.s.carga() === 'error' || (this.s.carga() === 'listo' && !this.s.productos().length));
  protected readonly verLista = computed(() => !this.vacio() && !(this.s.abierto() != null && this.s.completa()));
  protected readonly verFicha = computed(() => !this.vacio() && (this.s.vista() === 'lista' || this.s.abierto() != null));
  protected readonly nSel = computed(() => this.s.seleccion().size);
  protected readonly destacados = computed(() => {
    const ids = [...this.s.seleccion()], nd = ids.filter((i) => this.s.producto(i)?.destacado).length, n = ids.length;
    return { todos: n > 0 && nd === n, algunos: nd > 0 && nd < n, nd };
  });

  constructor() {
    const productosApi = inject(ProductoService);
    const inventarioApi = inject(InventarioService);
    this.s.cargar();
    // ?producto=ID (desde Categorías, Inventario o Compras) abre su ficha al terminar de cargar.
    const pedido = Number(inject(ActivatedRoute).snapshot.queryParamMap.get('producto'));
    if (pedido) {
      const abrirPedido = effect(() => {
        if (this.s.carga() !== 'listo') return;
        abrirPedido.destroy();
        untracked(() => this.s.producto(pedido) && this.s.abrir(pedido));
      });
    }

    inject(CambiosEnVivoService)
      .huboCambio(['producto', 'inventario'])
      // El eco de nuestras propias escrituras no es un "cambio nuevo".
      .pipe(filter(() => Date.now() - Math.max(productosApi.ultimaEscritura, inventarioApi.ultimaEscritura) > ECO_PROPIO_MS), takeUntilDestroyed())
      .subscribe(() => this.cambiosEnVivo.update((n) => n + 1));

    // "Cambios sin guardar" vive en la pila mientras el borrador difiera.
    effect(() => {
      if (this.s.sucio()) {
        this.alertas.fijarCambios({
          titulo: this.s.abierto() === 'nuevo' ? 'Producto sin guardar' : 'Cambios sin guardar',
          texto: this.s.textoCambios(),
          guardar: () => this.s.guardar(),
          descartar: () => this.s.descartar(),
        });
      } else this.alertas.soltarCambios();
    });
    // La pila sube por encima de la barra de selección (44 px + 10 de aire).
    effect(() => this.alertas.desplazamiento.set(this.nSel() ? 54 : 0));

    inject(DestroyRef).onDestroy(() => {
      this.alertas.soltarCambios();
      this.alertas.desplazamiento.set(0);
    });
  }

  /** Para el guard de la ruta (ver LEEME §2.4). */
  puedeSalir(): boolean {
    return this.s.libre();
  }

  protected actualizarEnVivo(): void {
    this.cambiosEnVivo.set(0);
    this.s.cargar(true);
  }

  protected reintentar(): void {
    this.s.cargar();
  }

  protected alternarFiltros(e?: Event): void {
    e?.stopPropagation();
    this.filtrosAbierto.update((v) => !v);
    this.menuMasivo.set(null);
  }

  protected rango(r: { min: number; max: number }): void {
    this.s.pMin.set(r.min);
    this.s.pMax.set(r.max);
  }
  protected rangoActivo(r: { min: number; max: number }): boolean {
    return this.s.pMin() === r.min && this.s.pMax() === r.max;
  }
  protected ponerMin(v: string): void {
    this.s.pMin.set(Math.min(+v, this.s.pMax() - 5000));
  }
  protected ponerMax(v: string): void {
    this.s.pMax.set(Math.max(+v, this.s.pMin() + 5000));
  }

  protected alternarMenu(m: 'estado' | 'categoria', e: Event): void {
    e.stopPropagation();
    // el menú se abre hacia arriba, donde está la pila: la despejamos
    if (this.menuMasivo() !== m) this.alertas.cerrarTodas();
    this.menuMasivo.update((x) => (x === m ? null : m));
  }

  // ── fila ──
  protected unida(id: number): boolean {
    return this.s.abierto() === id || this.hover() === id;
  }
  protected miniatura(p: ProductoCatalogo): { url: string | null; letra: string } {
    return { url: p.imagenes[0]?.url ?? null, letra: ((p.nombre || '?').trim()[0] || '?').toUpperCase() };
  }
  protected barraStock(p: ProductoCatalogo): { w: string; c: string } {
    const i = this.s.stock(p.id), ok = this.s.estadoStock(p.id) === 'ok';
    const w = i.min ? Math.min(100, Math.max(i.disp > 0 ? 6 : 0, (i.disp / (i.min * 2)) * 100)) : i.disp > 0 ? 100 : 0;
    return { w: w + '%', c: ok ? '#303030' : '#d82c0d' };
  }
  protected teclaCelda(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.s.confirmarCelda();
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      this.s.celda.set(null);
    }
  }
  protected limpiarSeleccion(): void {
    this.s.seleccion.set(new Set());
  }
  protected seleccionados(): number[] {
    return [...this.s.seleccion()];
  }

  @HostListener('document:click')
  protected cerrarMenus(): void {
    this.filtrosAbierto.set(false);
    this.menuMasivo.set(null);
  }

  // ── atajos (handoff-productos §4) ──
  @HostListener('window:keydown', ['$event'])
  protected tecla(e: KeyboardEvent): void {
    if (this.atajos.capturando()) return; // lo maneja el diálogo
    const s = this.s, k = this.atajos.teclas(), ch = (e.key || '').toLowerCase();
    const escribiendo = /INPUT|TEXTAREA|SELECT/.test((document.activeElement as HTMLElement | null)?.tagName ?? '');
    const ctrl = e.ctrlKey || e.metaKey;

    if (ctrl && ch === 's') {
      e.preventDefault();
      if (s.sucio()) s.guardar();
      else this.pista.hecho('No hay cambios por guardar');
      return;
    }
    if (ctrl && (e.code === 'Period' || e.key === '.' || e.key === ':')) {
      e.preventDefault();
      this.atajosAbierto.update((v) => !v);
      return;
    }
    if (e.key === 'Escape') {
      if (this.atajosAbierto()) return this.atajosAbierto.set(false);
      if (this.filtrosAbierto() || this.menuMasivo()) return this.cerrarMenus();
      if (s.celda()) return;
      if (this.nSel()) return s.seleccion.set(new Set());
      return;
    }
    if (escribiendo || this.atajosAbierto()) return;
    if (ctrl && ch === 'a') {
      e.preventDefault();
      s.marcarTodos();
      return;
    }
    if (ctrl || e.altKey) return;
    if (e.key === '?') return this.atajosAbierto.set(true);

    const ahora = Date.now();
    if (this.gEn && ahora - this.gEn < 1200) {
      this.gEn = 0;
      const destino: Record<string, [string, string]> = {
        [k.goP]: ['/products', 'Productos'], [k.goC]: ['/products/categorias', 'Categorías'], [k.goI]: ['/products/inventario', 'Inventario'],
        [k.goR]: ['/products/proveedores', 'Proveedores'], [k.goM]: ['/products/compras', 'Compras'],
      };
      const d = destino[ch];
      if (d && d[0] !== '/products') {
        e.preventDefault();
        this.irA(d[0], d[1]);
      }
      return;
    }
    if (ch === 'g') {
      this.gEn = ahora;
      return;
    }
    if (e.key === 'Home' || e.key === 'End') {
      const el = document.querySelector<HTMLElement>('[data-atajo="lista"]');
      if (el) {
        e.preventDefault();
        el.scrollTo({ top: e.key === 'Home' ? 0 : el.scrollHeight, behavior: 'smooth' });
      }
      return;
    }
    if (ch === k.buscar) {
      e.preventDefault();
      document.querySelector<HTMLInputElement>('[data-atajo="buscar"]')?.focus();
      return;
    }
    if (ch === k.nuevo) return void (e.preventDefault(), s.nuevo());
    if (ch === k.filtros) return this.alternarFiltros();
    if (ch === k.vista) {
      s.vista.update((v) => (v === 'lista' ? 'grilla' : 'lista'));
      this.pista.atajo(verTecla(k.vista), s.vista() === 'lista' ? 'Vista de lista' : 'Vista de grilla');
      return;
    }
    const abierto = s.abierto();
    if (ch === k.expandir && abierto != null) return s.completa.update((v) => !v);
    if (ch === k.marcar && typeof abierto === 'number') return s.marcar(abierto);
    const d = ch === k.sig || e.key === 'ArrowDown' ? 1 : ch === k.ant || e.key === 'ArrowUp' ? -1 : 0;
    if (d && abierto !== 'nuevo') {
      e.preventDefault();
      s.paso(d);
    }
  }

  /** Navegar con G luego … — respeta los cambios sin guardar (el guard sacude). */
  private irA(ruta: string, nombre: string): void {
    this.router.navigateByUrl(ruta).then((ok) => ok && this.pista.navegar(nombre));
  }
}
