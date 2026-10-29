import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { CatalogoStore } from '../../../../shared/catalogo.store';
import { cop, num, pl } from '../../../../shared/formato';
import { EstadoProducto, ProductoV5 } from '../../../../shared/modelos';
import { icono } from '../../../../shared/ui/iconos';
import { PopoverDirective } from '../../../../../../shared/ui/popover.directive';
import { CargarMasComponent, PaginaPorGrupo } from '../../../../../../shared/ui/cargar-mas/cargar-mas.component';
import { miniaturaProducto, nombreCategoria } from '../../categorias.util';
import { MenuActivo } from '../../menu-activo';
import { OrdenProductos, ProductosCategoria } from '../../productos-categoria';
import { DesplegableComponent } from '../desplegable/desplegable.component';
import { MiniaturaComponent } from '../miniatura/miniatura.component';

const ORDENES: { k: OrdenProductos; label: string; detalle: string }[] = [
  { k: 'nombre', label: 'Nombre', detalle: 'A → Z' },
  { k: 'precio', label: 'Precio', detalle: 'Mayor primero' },
  { k: 'stock', label: 'Stock', detalle: 'Menos unidades primero' },
];
/** Insignia y etiqueta de cada estado en la fila (igual que en la lista de Productos). */
const ESTF: Record<EstadoProducto, { t: string; bg: string; fg: string; icono: string }> = {
  activo: { t: 'Activo', bg: '#dcfce7', fg: '#0b5c3f', icono: 'check' },
  agotado: { t: 'Agotado', bg: '#ffe6e5', fg: '#b42318', icono: 'x' },
  descontinuado: { t: 'Descontinuado', bg: '#e3e3e3', fg: '#4b5563', icono: 'archive' },
};
/** Cuántos candidatos muestra "Agregar productos". */
const MAX_CANDIDATOS = 8;

/**
 * Pestaña Productos de la hoja: resumen, búsqueda y orden, "Agregar productos"
 * desde otras categorías y la lista (agrupada por subcategoría en una principal)
 * con selección para la barra de acciones.
 */
@Component({
  selector: 'app-pestana-productos',
  standalone: true,
  imports: [TablerIconComponent, PopoverDirective, DesplegableComponent, MiniaturaComponent, CargarMasComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3 pt-4' },
  templateUrl: './pestana-productos.component.html',
})
export class PestanaProductosComponent {
  private readonly s = inject(CatalogoStore);
  protected readonly menu = inject(MenuActivo);
  protected readonly estado = inject(ProductosCategoria);

  /** null = categoría nueva (todavía sin productos). */
  readonly categoriaId = input.required<number | null>();
  readonly esPrincipal = input(false);
  readonly verProducto = output<number>();

  private readonly buscadorAgregar = viewChild<ElementRef<HTMLInputElement>>('buscadorAgregar');
  /** Fila con el mouse encima: muestra la casilla y el botón Quitar. */
  protected readonly encimaDe = signal<number | null>(null);

  protected readonly icono = icono;
  protected readonly f = { cop, num, pl };
  protected readonly ordenes = ORDENES;
  protected readonly ESTF = ESTF;
  /** «Cargar 15 más · quedan N» por grupo (subcategoría). */
  protected readonly pagina = new PaginaPorGrupo();
  protected readonly inicial = (p: ProductoV5) => (p.nombre.trim()[0] || '?').toUpperCase();
  protected readonly miniatura = (p: ProductoV5) => miniaturaProducto(this.s, p);
  protected readonly nombreCategoria = (id: number | null) => nombreCategoria(this.s, id);
  protected readonly stock = (p: ProductoV5) => this.s.stockDe(p.id);
  protected readonly puedeEditar = computed(() => this.s.puede('productos.editar'));

  constructor() {
    // Otra categoría o búsqueda/orden distintos: vuelve a los primeros 15.
    effect(() => {
      this.categoriaId();
      this.estado.busqueda();
      this.estado.orden();
      this.pagina.reiniciar();
    });
  }

  private nivelStock(id: number): 'ok' | 'bajo' | 'sin' {
    const i = this.s.stockDe(id);
    return i.disponible <= 0 ? 'sin' : i.disponible < i.minimo ? 'bajo' : 'ok';
  }
  protected stockAlDia = (p: ProductoV5) => this.nivelStock(p.id) === 'ok';
  /** Ancho de la barra de stock: el doble del mínimo es "lleno". */
  protected barraStock(p: ProductoV5): number {
    const i = this.s.stockDe(p.id);
    return Math.max(0, Math.min(100, (i.disponible / Math.max(i.minimo * 2, i.disponible, 1)) * 100));
  }

  private readonly subcategorias = computed(() => {
    const id = this.categoriaId();
    return id == null ? [] : this.s.categorias().filter((k) => k.categoriaPadreId === id);
  });
  /** Ids de la categoría y sus subcategorías. */
  private readonly ids = computed(() => {
    const id = this.categoriaId();
    return id == null ? [] : [id, ...this.subcategorias().map((k) => k.id)];
  });
  /** Todos los productos de la categoría (y de sus subcategorías). */
  protected readonly todos = computed(() => {
    const ids = this.ids();
    return this.s.productos().filter((x) => x.categoriaId != null && ids.includes(x.categoriaId));
  });

  protected readonly resumen = computed(() => {
    const todos = this.todos();
    const activos = todos.filter((x) => x.estado === 'activo').length;
    const bajo = todos.filter((x) => x.estado !== 'descontinuado' && this.nivelStock(x.id) !== 'ok').length;
    const valor = todos.reduce((a, x) => a + (x.costo != null ? Math.max(0, this.s.stockDe(x.id).disponible) * x.costo : 0), 0);
    const sinCosto = todos.filter((x) => x.costo == null).length;
    return [
      { label: 'Activos', valor: String(activos), detalle: 'de ' + todos.length, alerta: false },
      { label: 'Stock bajo', valor: String(bajo), detalle: bajo ? 'bajo el mínimo o sin stock' : 'todo al día', alerta: bajo > 0 },
      { label: 'Valor a costo', valor: cop(valor), detalle: sinCosto ? pl(sinCosto, 'sin costo', 'sin costo') : 'disponible × costo', alerta: false },
    ];
  });

  protected readonly etiquetaOrden = computed(() => ORDENES.find((o) => o.k === this.estado.orden())!.label);

  /** Grupos visibles: en una principal con hijas, "directamente" + uno por subcategoría. */
  protected readonly grupos = computed(() => {
    const id = this.categoriaId();
    if (id == null) return [];
    const q = this.estado.busqueda().trim().toLowerCase();
    const plegados = this.estado.plegados();
    const comparar = {
      nombre: (a: ProductoV5, b: ProductoV5) => a.nombre.localeCompare(b.nombre, 'es'),
      precio: (a: ProductoV5, b: ProductoV5) => b.precio - a.precio,
      stock: (a: ProductoV5, b: ProductoV5) => this.s.stockDe(a.id).disponible - this.s.stockDe(b.id).disponible,
    }[this.estado.orden()];
    const coincide = (x: ProductoV5) => !q || x.nombre.toLowerCase().includes(q) || (x.sku || '').toLowerCase().includes(q);
    const hijas = this.subcategorias();
    const base: { id: number; titulo: string | null; icono: string }[] =
      this.esPrincipal() && hijas.length
        ? [
            { id, titulo: 'En «' + this.nombreCategoria(id) + '» directamente', icono: 'folder' },
            ...hijas.map((k) => ({ id: k.id, titulo: k.nombre, icono: 'corner-down-right' })),
          ]
        : [{ id, titulo: null, icono: '' }];
    return base
      .map((g) => {
        const productos = this.todos()
          .filter((x) => x.categoriaId === g.id && coincide(x))
          .sort(comparar);
        const bajo = productos.filter((x) => this.nivelStock(x.id) !== 'ok').length;
        return { ...g, productos, bajo, abierto: !plegados.has(g.id) };
      })
      .filter((g) => g.productos.length > 0);
  });
  /** Ids visibles (para "seleccionar todo"). */
  private readonly visibles = computed(() => this.grupos().flatMap((g) => g.productos.map((x) => x.id)));
  protected readonly cuantosVisibles = computed(() => this.visibles().length);
  protected readonly todosMarcados = computed(() => {
    const vis = this.visibles(), sel = this.estado.seleccion();
    return vis.length > 0 && vis.every((v) => sel.has(v));
  });
  protected readonly haySeleccion = computed(() => this.estado.seleccion().size > 0);

  /** Productos de otras categorías (primero los sin categoría) para "Agregar productos". */
  private readonly candidatos = computed(() => {
    const ids = this.ids(), q = this.estado.busquedaAgregar().trim().toLowerCase();
    return this.s
      .productos()
      .filter((x) => !(x.categoriaId != null && ids.includes(x.categoriaId)) && (!q || x.nombre.toLowerCase().includes(q) || (x.sku || '').toLowerCase().includes(q)))
      .sort((a, b) => (a.categoriaId == null ? -1 : 0) - (b.categoriaId == null ? -1 : 0) || a.nombre.localeCompare(b.nombre, 'es'));
  });
  protected readonly candidatosVisibles = computed(() => this.candidatos().slice(0, MAX_CANDIDATOS));
  protected readonly candidatosOcultos = computed(() => Math.max(0, this.candidatos().length - MAX_CANDIDATOS));

  protected alternarAgregar(): void {
    if (this.s.niega('productos.editar')) return;
    this.estado.agregando.update((v) => !v);
    this.estado.busquedaAgregar.set('');
    if (this.estado.agregando()) setTimeout(() => this.buscadorAgregar()?.nativeElement.focus(), 60);
  }
  protected agregar(p: ProductoV5): void {
    const id = this.categoriaId()!;
    this.estado.mover([p.id], id, 'agregado a «' + this.nombreCategoria(id) + '»');
  }
  protected quitar(p: ProductoV5): void {
    this.estado.mover([p.id], null, 'sin categoría');
  }
  protected seleccionarTodo(): void {
    this.estado.seleccion.set(this.todosMarcados() ? new Set() : new Set(this.visibles()));
  }
  protected elegirOrden(k: OrdenProductos): void {
    this.estado.orden.set(k);
    this.menu.cerrar();
  }
  protected salir(id: number): void {
    if (this.encimaDe() === id) this.encimaDe.set(null);
  }
}
