import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, forkJoin, of, throwError } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ValoresCampos, atributosDe, erroresCampos, firmaValores, textoValor, valoresDe } from '../../core/campos/campo-personalizado.model';
import { CampoPersonalizadoService } from '../../core/campos/campo-personalizado.service';
import { Categoria, CategoriaService } from '../../core/categoria/categoria.service';
import { Inventario, InventarioService } from '../../core/inventario/inventario.service';
import {
  ESTADOS_PRODUCTO,
  EstadoProducto,
  ProductoCatalogo,
  ProductoPayload,
} from '../../core/producto/models/producto.model';
import { ProductoService } from '../../core/producto/producto.service';
import { AlertaService } from '../../core/ui/alerta.service';
import { PistaService } from '../../core/ui/pista.service';

export type Agrupar = 'estado' | 'stock' | 'categoria';
export type Metrica = 'activos' | 'bajo' | 'agotados' | 'valor' | 'margen';
export type EstadoStock = 'sin' | 'bajo' | 'ok';
export type Pestana = 'general' | 'multimedia' | 'precio' | 'inventario' | 'envio' | 'tienda';

export const PMAX = 200_000;
const PAGINA_GRUPO = 15;

/** Tonos por categoría raíz, en orden de aparición [fondo, tinta]. */
const TONOS: [string, string][] = [
  ['#fbefd9', '#8a5a00'],
  ['#fde7ee', '#9d174d'],
  ['#e3f1fb', '#0369a1'],
  ['#eeece6', '#57534e'],
  ['#e6f6ec', '#087b5d'],
];

/** Lo que se edita en la ficha. Todo string para poder comparar con el guardado. */
export interface Borrador {
  nombre: string;
  sku: string;
  descripcion: string;
  marca: string;
  categoriaId: string;
  estado: EstadoProducto;
  destacado: boolean;
  precio: string;
  precioComparacion: string;
  costo: string;
  stockMinimo: string;
  pesoGramos: string;
  altoCm: string;
  anchoCm: string;
  largoCm: string;
  slug: string;
  slugManual: boolean;
  /** Campos propios de la Empresa, como texto (ver `ValoresCampos`). */
  atributos: ValoresCampos;
}

const ETIQUETAS: Partial<Record<keyof Borrador, string>> = {
  nombre: 'Nombre', sku: 'SKU', descripcion: 'Descripción', marca: 'Marca', categoriaId: 'Categoría',
  estado: 'Estado', destacado: 'Destacado', precio: 'Precio', precioComparacion: 'Precio de comparación',
  costo: 'Costo', stockMinimo: 'Stock mínimo', pesoGramos: 'Peso', altoCm: 'Medidas', anchoCm: 'Medidas',
  largoCm: 'Medidas', slug: 'URL',
};
/** Pestaña donde vive cada campo con validación: al guardar con error se salta ahí. */
const PESTANA_DE: Partial<Record<keyof Borrador, Pestana>> = { nombre: 'general', sku: 'general', precio: 'precio', slug: 'tienda' };

export const cop = (n: number) => (n < 0 ? '−' : '') + '$' + Math.round(Math.abs(n)).toLocaleString('es-CO');
export const num = (n: number) => Math.round(n).toLocaleString('es-CO');
export const pct = (n: number) => Math.round(n * 100) + ' %';
export const slugDe = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
const sv = (v: unknown) => (v == null ? '' : String(v));
/** Para saber si hay cambios: los campos propios vacíos no cuentan. */
const firma = (b: Borrador) => JSON.stringify({ ...b, atributos: firmaValores(b.atributos) });
const nn = (v: string) => (v.trim() === '' ? null : Number(v));
const digitos = (v: string) => String(v).replace(/[^\d]/g, '');

/**
 * Estado de la pantalla de Productos. Se provee en `ProductListPageComponent`
 * (no es root): vive mientras la página está abierta.
 *
 * @remarks
 * El catálogo entero vive en el cliente y se filtra, agrupa y cuenta acá.
 * Cada escritura va al backend con la pila de alertas (cargando → resultado
 * en la misma alerta) y con Deshacer cuando aplica.
 */
@Injectable()
export class ProductosStore {
  private readonly api = inject(ProductoService);
  private readonly inventarioApi = inject(InventarioService);
  private readonly categoriasApi = inject(CategoriaService);
  private readonly auth = inject(AuthService);
  private readonly alertas = inject(AlertaService);
  private readonly pista = inject(PistaService);
  private readonly camposApi = inject(CampoPersonalizadoService);

  /** Campos propios activos de productos, en orden. */
  readonly campos = computed(() => this.camposApi.activos('producto'));
  /** Los que se pueden usar como filtro: listas y sí/no. */
  readonly camposFiltrables = computed(() => this.campos().filter((c) => c.tipo === 'lista' || c.tipo === 'si_no'));
  /** Valores elegidos por campo propio (`'true'`/`'false'` en los sí/no). */
  readonly fAtributos = signal<Record<string, string[]>>({});

  // datos
  readonly productos = signal<ProductoCatalogo[]>([]);
  readonly inventario = signal<Map<number, Inventario>>(new Map());
  readonly categorias = signal<Categoria[]>([]);
  readonly carga = signal<'cargando' | 'error' | 'listo'>('cargando');

  // lista
  readonly qVivo = signal('');
  readonly q = signal('');
  readonly metrica = signal<Metrica | null>(null);
  readonly fCats = signal<number[]>([]); // 0 = sin categoría
  readonly fEstados = signal<EstadoProducto[]>([]);
  readonly pMin = signal(0);
  readonly pMax = signal(PMAX);
  readonly agrupar = signal<Agrupar>('estado');
  readonly vista = signal<'lista' | 'grilla'>('lista');
  readonly plegados = signal<Set<string>>(new Set());
  readonly mostrados = signal<Record<string, number>>({});
  readonly seleccion = signal<Set<number>>(new Set());
  readonly destello = signal<Set<number>>(new Set());
  readonly celda = signal<{ id: number; campo: 'precio' | 'stock'; valor: string } | null>(null);

  // ficha
  readonly abierto = signal<number | 'nuevo' | null>(null);
  readonly borrador = signal<Borrador | null>(null);
  readonly guardado = signal<Borrador | null>(null);
  readonly pestana = signal<Pestana>('general');
  readonly completa = signal(false);
  readonly intento = signal(false);
  readonly guardando = signal(false);

  private qTimer: ReturnType<typeof setTimeout> | undefined;

  // permisos (mismos códigos que @RequirePermissions)
  puede(p: string): boolean {
    return !!this.auth.currentUser()?.permisos.includes(p);
  }

  /** Avisa y devuelve true si NO tiene el permiso. */
  niega(p: string): boolean {
    if (this.puede(p)) return false;
    this.alertas.mostrar({ estado: 'warning', titulo: 'Necesitas el permiso ' + p });
    return true;
  }

  // carga
  cargar(compararAlTerminar = false): void {
    if (!compararAlTerminar) this.carga.set('cargando');
    this.camposApi.asegurar('producto');
    const antes = this.productos();
    forkJoin({
      productos: this.api.catalogo(),
      // Sin `inventario.ver` el backend responde 403: queda vacío y el resto carga.
      // (No se mira `puede()`: al recargar la página el perfil puede no haber llegado.)
      inventario: this.inventarioApi
        .todo()
        .pipe(catchError((e) => (e instanceof HttpErrorResponse && e.status === 403 ? of([] as Inventario[]) : throwError(() => e)))),
      categorias: this.categoriasApi.listar(),
    }).subscribe({
      next: ({ productos, inventario, categorias }) => {
        if (compararAlTerminar) {
          const viejos = new Map(antes.map((p) => [p.id, JSON.stringify(p)]));
          this.destellar(productos.filter((p) => viejos.get(p.id) !== JSON.stringify(p)).map((p) => p.id));
        }
        this.productos.set(productos);
        this.inventario.set(new Map(inventario.map((i) => [i.productoId, i])));
        this.categorias.set(categorias);
        this.carga.set('listo');
        this.sincronizarBorrador();
      },
      error: () => this.carga.set('error'),
    });
  }

  // helpers de dominio
  stock(id: number): { disp: number; res: number; min: number } {
    const i = this.inventario().get(id);
    return { disp: i?.cantidadDisponible ?? 0, res: i?.cantidadReservada ?? 0, min: i?.stockMinimo ?? 0 };
  }
  estadoStock(id: number): EstadoStock {
    const i = this.stock(id);
    return i.disp <= 0 ? 'sin' : i.disp < i.min ? 'bajo' : 'ok';
  }
  margen(p: ProductoCatalogo): number | null {
    return p.costo != null && p.precio > 0 ? (p.precio - p.costo) / p.precio : null;
  }
  producto(id: number): ProductoCatalogo | undefined {
    return this.productos().find((p) => p.id === id);
  }
  categoria(id: number | null): Categoria | undefined {
    return id == null ? undefined : this.categorias().find((c) => c.id === id);
  }
  nombreCategoria(id: number | null): string {
    return this.categoria(id)?.nombre ?? 'Sin categoría';
  }
  raiz(id: number | null): Categoria | undefined {
    let c = this.categoria(id);
    while (c?.categoriaPadreId) c = this.categoria(c.categoriaPadreId);
    return c;
  }
  tono(id: number | null): [string, string] {
    const r = this.raiz(id);
    const raices = this.categorias().filter((c) => !c.categoriaPadreId).sort((a, b) => a.id - b.id);
    const i = r ? raices.findIndex((x) => x.id === r.id) : -1;
    return i < 0 ? ['#f1f1f1', '#6b7280'] : TONOS[i % TONOS.length];
  }

  /** Principales por id y, debajo de cada una, sus hijas por nombre. */
  readonly arbol = computed(() => {
    const cs = this.categorias();
    return cs
      .filter((c) => !c.categoriaPadreId)
      .sort((a, b) => a.id - b.id)
      .flatMap((r) => [
        r,
        ...cs.filter((c) => c.categoriaPadreId === r.id).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
      ]);
  });

  readonly margenPromedio = computed(() => {
    const ms = this.productos()
      .filter((p) => p.estado !== 'descontinuado')
      .map((p) => this.margen(p))
      .filter((m): m is number => m != null);
    return ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : 0;
  });

  // filtros
  readonly hayFiltroPrecio = computed(() => this.pMin() > 0 || this.pMax() < PMAX);
  readonly nFiltros = computed(
    () => this.fCats().length + this.fEstados().length + (this.hayFiltroPrecio() ? 1 : 0) + Object.values(this.fAtributos()).reduce((n, xs) => n + xs.length, 0),
  );

  readonly filtrados = computed(() => {
    const q = this.q().trim().toLowerCase();
    const cats = this.fCats(), ests = this.fEstados(), min = this.pMin(), max = this.pMax();
    const m = this.metrica(), avg = this.margenPromedio();
    const fa = Object.entries(this.fAtributos()).filter(([, xs]) => xs.length);
    this.inventario(); // dependencia: el stock cambia los filtros de métrica
    return this.productos()
      .filter((p) => {
        if (q && !(p.nombre.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q))) return false;
        if (cats.length && !cats.some((c) => (c === 0 ? p.categoriaId == null : p.categoriaId === c || this.categoria(p.categoriaId)?.categoriaPadreId === c))) return false;
        if (ests.length && !ests.includes(p.estado)) return false;
        if (fa.some(([k, xs]) => !xs.includes(String(p.atributos?.[k] ?? '')))) return false;
        if (p.precio < min || (max < PMAX && p.precio > max)) return false;
        if (m === 'activos' && p.estado !== 'activo') return false;
        if (m === 'bajo' && this.estadoStock(p.id) !== 'bajo') return false;
        if (m === 'agotados' && p.estado !== 'agotado') return false;
        if (m === 'valor' && !(p.costo != null && this.stock(p.id).disp > 0)) return false;
        if (m === 'margen') {
          const g = this.margen(p);
          if (g == null || g >= avg) return false;
        }
        return true;
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  });

  readonly grupos = computed(() => {
    const lista = this.filtrados(), por = this.agrupar();
    const g = (key: string, titulo: string, icono: string, bg: string, fg: string, items: ProductoCatalogo[]) => ({ key, titulo, icono, bg, fg, items });
    let out: ReturnType<typeof g>[];
    if (por === 'estado') {
      out = [
        g('e-activo', 'Activos', 'circle-check', '#e6f6ec', '#087b5d', lista.filter((p) => p.estado === 'activo')),
        g('e-agotado', 'Agotados', 'alert-octagon', '#ffe6e5', '#d82c0d', lista.filter((p) => p.estado === 'agotado')),
        g('e-desc', 'Descontinuados', 'archive', '#f1f1f1', '#6b7280', lista.filter((p) => p.estado === 'descontinuado')),
      ];
    } else if (por === 'stock') {
      out = [
        g('s-sin', 'Sin stock', 'circle-x', '#ffe6e5', '#d82c0d', lista.filter((p) => this.estadoStock(p.id) === 'sin')),
        g('s-bajo', 'Bajo el mínimo', 'alert-triangle', '#fff6d1', '#8a5a00', lista.filter((p) => this.estadoStock(p.id) === 'bajo')),
        g('s-ok', 'Stock al día', 'circle-check', '#e6f6ec', '#087b5d', lista.filter((p) => this.estadoStock(p.id) === 'ok')),
      ];
    } else {
      out = this.arbol().map((c) => {
        const [bg, fg] = this.tono(c.id);
        const padre = c.categoriaPadreId ? this.nombreCategoria(c.categoriaPadreId) + ' › ' : '';
        return g('c-' + c.id, padre + c.nombre, 'folder', bg, fg, lista.filter((p) => p.categoriaId === c.id));
      });
      out.push(g('c-0', 'Sin categoría', 'folder-question', '#f1f1f1', '#6b7280', lista.filter((p) => p.categoriaId == null)));
    }
    return out
      .filter((x) => x.items.length)
      .map((x) => {
        const sin = x.items.filter((p) => this.estadoStock(p.id) === 'sin').length;
        const bajo = x.items.filter((p) => this.estadoStock(p.id) === 'bajo').length;
        const foto = x.items.filter((p) => !p.imagenes.length).length;
        const costo = x.items.filter((p) => p.costo == null).length;
        const partes = [sin && sin + ' sin stock', bajo && bajo + ' bajo el mínimo', foto && foto + ' sin foto', costo && costo + ' sin costo'].filter(Boolean);
        const lim = this.mostrados()[x.key] ?? PAGINA_GRUPO;
        return { ...x, sub: partes.slice(0, 3).join(' · '), abierto: !this.plegados().has(x.key), visibles: x.items.slice(0, lim), quedan: x.items.length - lim };
      });
  });

  readonly idsVisibles = computed(() => this.grupos().flatMap((g) => g.items.map((p) => p.id)));
  readonly todosMarcados = computed(() => {
    const ids = this.filtrados().map((p) => p.id), s = this.seleccion();
    return ids.length > 0 && ids.every((i) => s.has(i));
  });

  readonly chips = computed(() => {
    const out: { label: string; quitar: () => void }[] = [];
    if (this.q()) out.push({ label: 'Busca: “' + this.q() + '”', quitar: () => this.buscar('', true) });
    const m = this.metrica();
    if (m) out.push({ label: { activos: 'Solo activos', bajo: 'Bajo el mínimo', agotados: 'Agotados', valor: 'Con valor en inventario', margen: 'Margen bajo el promedio' }[m], quitar: () => this.metrica.set(null) });
    this.fCats().forEach((c) => out.push({ label: c === 0 ? 'Sin categoría' : this.nombreCategoria(c), quitar: () => this.alternarEn(this.fCats, c) }));
    this.fEstados().forEach((e) => out.push({ label: ESTADOS_PRODUCTO[e].t, quitar: () => this.alternarEn(this.fEstados, e) }));
    if (this.hayFiltroPrecio()) out.push({ label: cop(this.pMin()) + ' – ' + (this.pMax() < PMAX ? cop(this.pMax()) : 'más'), quitar: () => { this.pMin.set(0); this.pMax.set(PMAX); } });
    for (const c of this.camposFiltrables()) {
      for (const v of this.fAtributos()[c.clave] ?? []) out.push({ label: c.etiqueta + ': ' + textoValor(c, v), quitar: () => this.alternarAtributo(c.clave, v) });
    }
    return out;
  });

  readonly conteo = computed(() => {
    const n = this.filtrados().length, t = this.productos().length;
    return n === t ? n + ' productos' : n + ' de ' + t + ' productos';
  });

  // cabecera: lectura + métricas
  readonly resumen = computed(() => {
    const todos = this.productos(), act = todos.filter((p) => p.estado !== 'descontinuado');
    this.inventario();
    const bajo = act.filter((p) => this.estadoStock(p.id) === 'bajo').length;
    const agot = todos.filter((p) => p.estado === 'agotado').length;
    const activos = todos.filter((p) => p.estado === 'activo').length;
    const sinStockActivos = todos.filter((p) => p.estado === 'activo' && this.estadoStock(p.id) === 'sin').length;
    const valor = todos.reduce((a, p) => a + (p.costo != null ? Math.max(0, this.stock(p.id).disp) * p.costo : 0), 0);
    const unidades = todos.reduce((a, p) => a + Math.max(0, this.stock(p.id).disp), 0);
    const sinCosto = todos.filter((p) => p.costo == null).length;
    const avg = this.margenPromedio();
    return {
      lectura: `${bajo} productos bajo el mínimo, ${agot} agotados. El margen promedio es ${pct(avg)}.`,
      metricas: [
        { key: 'activos' as Metrica, label: 'Productos activos', valor: String(activos), sub: 'De ' + todos.length + ' en el catálogo', tinta: '#111827' },
        { key: 'bajo' as Metrica, label: 'Bajo el mínimo', valor: String(bajo), sub: sinStockActivos + ' activos sin stock', tinta: '#8a5a00' },
        { key: 'agotados' as Metrica, label: 'Agotados', valor: String(agot), sub: agot ? 'Marcados como agotados' : 'Ninguno', tinta: '#b42318' },
        { key: 'valor' as Metrica, label: 'Valor del inventario', valor: cop(valor), sub: num(unidades) + ' unidades a costo', tinta: '#111827' },
        { key: 'margen' as Metrica, label: 'Margen promedio', valor: pct(avg), sub: sinCosto + ' sin costo · clic: bajo el promedio', tinta: '#00605b' },
      ],
    };
  });

  // acciones de lista
  buscar(v: string, ya = false): void {
    this.qVivo.set(v);
    clearTimeout(this.qTimer);
    if (ya) this.q.set(v);
    else this.qTimer = setTimeout(() => this.q.set(v), 250);
  }
  alternarEn<T>(s: { update: (fn: (xs: T[]) => T[]) => void }, v: T): void {
    s.update((xs) => (xs.includes(v) ? xs.filter((x) => x !== v) : [...xs, v]));
  }
  /** Marca o desmarca un valor del filtro de un campo propio. */
  alternarAtributo(clave: string, valor: string): void {
    this.fAtributos.update((f) => {
      const xs = f[clave] ?? [];
      return { ...f, [clave]: xs.includes(valor) ? xs.filter((x) => x !== valor) : [...xs, valor] };
    });
  }
  limpiarFiltros(): void {
    this.fAtributos.set({});
    this.buscar('', true);
    this.fCats.set([]);
    this.fEstados.set([]);
    this.pMin.set(0);
    this.pMax.set(PMAX);
    this.metrica.set(null);
  }
  alternarGrupo(key: string): void {
    this.plegados.update((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }
  cargarMas(key: string): void {
    this.mostrados.update((m) => ({ ...m, [key]: (m[key] ?? PAGINA_GRUPO) + PAGINA_GRUPO }));
  }
  marcar(id: number): void {
    this.seleccion.update((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  marcarTodos(): void {
    const ids = this.filtrados().map((p) => p.id);
    this.seleccion.set(this.todosMarcados() ? new Set() : new Set(ids));
  }

  /** Doble clic en precio o stock. */
  editarCelda(id: number, campo: 'precio' | 'stock'): void {
    if (this.niega(campo === 'precio' ? 'productos.editar' : 'inventario.editar')) return;
    const v = campo === 'precio' ? this.producto(id)!.precio : this.stock(id).disp;
    this.celda.set({ id, campo, valor: String(v) });
  }
  confirmarCelda(): void {
    const c = this.celda();
    this.celda.set(null);
    if (!c || digitos(c.valor) === '') return;
    const n = Number(digitos(c.valor)), p = this.producto(c.id)!;
    if (c.campo === 'precio') {
      if (n === p.precio) return;
      this.parchear([c.id], { precio: n }, { titulo: 'Guardando precio', exito: 'Precio guardado', texto: p.nombre + ' · ' + cop(p.precio) + ' → ' + cop(n) });
    } else {
      const delta = n - this.stock(c.id).disp;
      if (!delta) return;
      const antes = this.stock(c.id).disp;
      this.alertas
        .seguir(this.inventarioApi.ajustar(c.id, delta, 'Conteo físico'), {
          titulo: 'Corrigiendo stock', texto: p.nombre,
          exito: { titulo: 'Stock corregido', texto: p.nombre + ' · ' + antes + ' → ' + n },
          error: { titulo: 'No se pudo corregir el stock', texto: 'El servidor rechazó el ajuste. Inténtalo de nuevo.' },
        })
        .subscribe((inv) => { this.ponerInventario(inv); this.destellar([c.id]); });
    }
  }

  /** PATCH a varios productos, optimista, con Deshacer. */
  parchear(ids: number[], cambio: ProductoPayload, txt: { titulo: string; exito: string; texto?: string }): void {
    const previos = new Map(ids.map((id) => [id, this.producto(id)!]));
    const aplicar = (fn: (p: ProductoCatalogo) => ProductoCatalogo) =>
      this.productos.update((xs) => xs.map((p) => (ids.includes(p.id) ? fn(p) : p)));
    aplicar((p) => ({ ...p, ...cambio }) as ProductoCatalogo);
    this.sincronizarBorrador();
    const id = this.alertas.mostrar({ titulo: txt.titulo, texto: txt.texto });
    forkJoin(ids.map((i) => this.api.actualizar(i, cambio))).subscribe({
      next: (nuevos) => {
        aplicar((p) => nuevos.find((n) => n.id === p.id) ?? p);
        this.alertas.resolver(id, {
          estado: 'success', titulo: txt.exito, texto: txt.texto,
          accion: { label: 'Deshacer', ejecutar: () => this.deshacer(previos) },
        });
      },
      error: () => {
        aplicar((p) => previos.get(p.id) ?? p);
        this.alertas.resolver(id, { estado: 'error', titulo: 'No se pudo guardar', texto: 'El servidor rechazó el cambio. No se modificó ningún producto.' });
      },
    });
  }

  private deshacer(previos: Map<number, ProductoCatalogo>): void {
    const ids = [...previos.keys()];
    this.productos.update((xs) => xs.map((p) => previos.get(p.id) ?? p));
    this.sincronizarBorrador();
    const payload = (p: ProductoCatalogo): ProductoPayload => ({ estado: p.estado, categoriaId: p.categoriaId, destacado: p.destacado, precio: p.precio });
    this.alertas
      .seguir(forkJoin(ids.map((i) => this.api.actualizar(i, payload(previos.get(i)!)))), {
        titulo: 'Deshaciendo',
        exito: { titulo: 'Cambios deshechos' },
        error: { titulo: 'No se pudo deshacer', texto: 'Recarga la lista para ver el estado real.' },
      })
      .subscribe();
  }

  masivoEstado(estado: EstadoProducto): void {
    if (this.niega('productos.editar')) return;
    const ids = [...this.seleccion()], n = ids.length, t = ESTADOS_PRODUCTO[estado].t.toLowerCase();
    this.seleccion.set(new Set());
    this.parchear(ids, { estado }, { titulo: 'Cambiando estado', exito: n === 1 ? '1 producto marcado como ' + t : n + ' productos marcados como ' + t + 's' });
  }
  masivoCategoria(categoriaId: number | null): void {
    if (this.niega('productos.editar')) return;
    const ids = [...this.seleccion()];
    this.seleccion.set(new Set());
    this.parchear(ids, { categoriaId }, { titulo: 'Moviendo productos', exito: ids.length + ' movidos a «' + this.nombreCategoria(categoriaId) + '»' });
  }
  masivoDestacado(): void {
    if (this.niega('productos.editar')) return;
    const ids = [...this.seleccion()], todos = ids.every((i) => this.producto(i)?.destacado), n = ids.length;
    this.parchear(ids, { destacado: !todos }, {
      titulo: todos ? 'Quitando de destacados' : 'Destacando',
      exito: todos ? (n === 1 ? 'Quitado de destacados' : n + ' quitados de destacados') : n === 1 ? 'Producto destacado' : n + ' productos destacados',
      texto: todos ? undefined : n === 1 ? 'Aparece primero en la tienda' : 'Aparecen primero en la tienda',
    });
  }

  pedirEliminar(ids: number[]): void {
    if (this.niega('productos.eliminar')) return;
    const uno = ids.length === 1;
    this.alertas.abrirOverlay({
      variante: 'tarjeta', estado: 'warning',
      titulo: uno ? 'Eliminar «' + this.producto(ids[0])?.nombre + '»' : 'Eliminar ' + ids.length + ' productos',
      dato: 'Esta acción no se puede deshacer.',
      primario: { label: 'Eliminar', ejecutar: () => { this.alertas.cerrarOverlay(); this.eliminar(ids); } },
      secundario: { label: 'Cancelar', ejecutar: () => this.alertas.cerrarOverlay() },
    });
  }

  /**
   * Si el backend rechaza (tiene ventas o compras), se ofrece descontinuar en
   * vez de borrar: conserva el historial y lo saca de la tienda.
   */
  private eliminar(ids: number[]): void {
    const id = this.alertas.mostrar({ titulo: ids.length === 1 ? 'Eliminando producto' : 'Eliminando ' + ids.length + ' productos' });
    forkJoin(ids.map((i) => this.api.eliminar(i))).subscribe({
      next: () => {
        this.productos.update((xs) => xs.filter((p) => !ids.includes(p.id)));
        this.seleccion.set(new Set());
        if (typeof this.abierto() === 'number' && ids.includes(this.abierto() as number)) this.cerrarFicha(true);
        this.alertas.resolver(id, { estado: 'success', titulo: ids.length === 1 ? 'Producto eliminado' : ids.length + ' productos eliminados' });
      },
      error: () => {
        this.cargar(true);
        this.alertas.resolver(id, {
          estado: 'error', titulo: 'No se pudo eliminar',
          texto: 'Tiene ventas o compras registradas. Márcalo como descontinuado: se oculta de la tienda y conserva su historial.',
          accion: { label: 'Marcar como descontinuado', ejecutar: () => this.parchear(ids, { estado: 'descontinuado' }, { titulo: 'Descontinuando', exito: 'Marcado como descontinuado' }) },
        });
      },
    });
  }

  exportarCSV(ids?: number[]): void {
    const filas = this.productos().filter((p) => !ids || ids.includes(p.id));
    const esc = (v: unknown) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const campos = this.campos();
    const csv = [['sku', 'nombre', 'categoria', 'precio', 'precioComparacion', 'costo', 'disponible', 'stockMinimo', 'estado'].concat(campos.map((c) => esc(c.etiqueta))).join(',')]
      .concat(filas.map((p) => {
        const i = this.stock(p.id);
        return [p.sku, p.nombre, this.nombreCategoria(p.categoriaId), p.precio, p.precioComparacion, p.costo, i.disp, i.min, p.estado, ...campos.map((c) => textoValor(c, p.atributos?.[c.clave]))].map(esc).join(',');
      }))
      .join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv' }));
    a.download = 'productos.csv';
    a.click();
    this.pista.hecho(filas.length + ' productos exportados a CSV');
  }

  // ficha
  readonly sucio = computed(() => {
    const b = this.borrador(), g = this.guardado();
    return !!b && !!g && firma(b) !== firma(g);
  });

  /** Texto de la alerta fija: qué cambió, en palabras. */
  readonly textoCambios = computed(() => {
    const b = this.borrador(), g = this.guardado();
    if (!b || !g) return '';
    if (this.abierto() === 'nuevo') return 'Todavía no se ha creado. Guárdalo para que aparezca en la lista y en la tienda.';
    const campos = [...new Set((Object.keys(b) as (keyof Borrador)[]).filter((k) => ETIQUETAS[k] && b[k] !== g[k]).map((k) => ETIQUETAS[k]!))];
    if (firmaValores(b.atributos) !== firmaValores(g.atributos)) campos.push('Campos propios');
    if (!campos.length) return 'Guarda para aplicar los cambios o descártalos. Atajo: Ctrl + S.';
    const lista = campos.length === 1 ? campos[0] : campos.slice(0, -1).join(', ') + ' y ' + campos.at(-1);
    return 'Cambiaste ' + lista + '. Guarda para aplicarlo o descarta para volver a como estaba. Atajo: Ctrl + S.';
  });

  readonly errores = computed(() => {
    const b = this.borrador(), e: Partial<Record<keyof Borrador, string>> = {};
    if (!b) return e;
    const id = typeof this.abierto() === 'number' ? (this.abierto() as number) : null, ps = this.productos();
    if (!b.nombre.trim()) e.nombre = 'Escribe el nombre del producto.';
    if (b.precio === '') e.precio = 'El precio es obligatorio.';
    else if (+b.precio < 0) e.precio = 'Debe ser 0 o más.';
    const sku = b.sku.trim().toLowerCase();
    if (sku && ps.some((p) => p.id !== id && (p.sku ?? '').toLowerCase() === sku)) e.sku = 'Ya existe otro producto con este SKU.';
    if (b.slug && ps.some((p) => p.id !== id && p.slug === b.slug)) e.slug = 'Esta URL ya la usa otro producto.';
    return e;
  });

  /** Errores de los campos propios, por clave. */
  readonly erroresAtributos = computed(() => {
    const b = this.borrador();
    return b ? erroresCampos(b.atributos, this.campos()) : {};
  });

  aBorrador(p: ProductoCatalogo): Borrador {
    const i = this.stock(p.id);
    return {
      nombre: p.nombre, sku: p.sku ?? '', descripcion: p.descripcion ?? '', marca: p.marca ?? '',
      categoriaId: sv(p.categoriaId), estado: p.estado, destacado: p.destacado,
      precio: sv(p.precio), precioComparacion: sv(p.precioComparacion), costo: sv(p.costo), stockMinimo: sv(i.min),
      pesoGramos: sv(p.pesoGramos), altoCm: sv(p.altoCm), anchoCm: sv(p.anchoCm), largoCm: sv(p.largoCm),
      slug: p.slug ?? '', slugManual: false, atributos: valoresDe(p.atributos, this.campos()),
    };
  }

  /** Devuelve false (y sacude la pila) si hay cambios sin guardar. */
  libre(): boolean {
    if (!this.sucio()) return true;
    this.alertas.sacudir();
    return false;
  }

  abrir(id: number, pestana?: Pestana): void {
    if (this.abierto() === id && !pestana) return;
    if (this.abierto() !== id && !this.libre()) return;
    const b = this.aBorrador(this.producto(id)!);
    if (this.abierto() === 'nuevo') this.pestana.set('general');
    if (pestana) this.pestana.set(pestana);
    this.abierto.set(id);
    this.borrador.set(b);
    this.guardado.set({ ...b });
    this.intento.set(false);
    this.celda.set(null);
  }

  nuevo(): void {
    if (this.niega('productos.crear') || !this.libre()) return;
    const b: Borrador = { nombre: '', sku: '', descripcion: '', marca: '', categoriaId: '', estado: 'activo', destacado: false, precio: '', precioComparacion: '', costo: '', stockMinimo: '0', pesoGramos: '', altoCm: '', anchoCm: '', largoCm: '', slug: '', slugManual: false, atributos: valoresDe({}, this.campos()) };
    this.abierto.set('nuevo');
    this.borrador.set(b);
    this.guardado.set({ ...b });
    this.pestana.set('general');
    this.intento.set(false);
    this.completa.set(false);
  }

  cerrarFicha(forzar = false): void {
    if (!forzar && !this.libre()) return;
    this.abierto.set(null);
    this.borrador.set(null);
    this.guardado.set(null);
    this.completa.set(false);
  }

  /** ↑ ↓ / J K dentro de la lista visible. */
  paso(d: 1 | -1): void {
    const ids = this.idsVisibles(), a = this.abierto();
    if (typeof a !== 'number') {
      if (a == null && ids.length) this.abrir(d > 0 ? ids[0] : ids[ids.length - 1]);
      return;
    }
    const i = ids.indexOf(a), n = ids[Math.min(ids.length - 1, Math.max(0, i + d))];
    if (n != null && n !== a) this.abrir(n);
  }

  editar<K extends keyof Borrador>(k: K, v: Borrador[K]): void {
    this.borrador.update((b) => {
      if (!b) return b;
      const d = { ...b, [k]: v };
      if (k === 'nombre' && !d.slugManual) d.slug = slugDe(v as string);
      if (k === 'slug') {
        const s = v as string;
        d.slugManual = true;
        d.slug = slugDe(s.replace(/\s/g, '-')) + (s.endsWith('-') ? '-' : '');
      }
      return d;
    });
  }

  editarAtributo(clave: string, valor: string): void {
    this.borrador.update((b) => (b ? { ...b, atributos: { ...b.atributos, [clave]: valor } } : b));
  }

  descartar(): void {
    if (this.abierto() === 'nuevo') return this.cerrarFicha(true);
    this.borrador.set({ ...this.guardado()! });
    this.intento.set(false);
  }

  guardar(): void {
    const b = this.borrador(), a = this.abierto();
    if (!b || this.guardando()) return;
    const esNuevo = a === 'nuevo';
    if (this.niega(esNuevo ? 'productos.crear' : 'productos.editar')) return;
    const errs = Object.keys(this.errores()) as (keyof Borrador)[];
    if (errs.length || Object.keys(this.erroresAtributos()).length) {
      this.intento.set(true);
      this.pestana.set(errs.length ? (PESTANA_DE[errs[0]] ?? 'general') : 'general');
      this.alertas.mostrar({ estado: 'warning', titulo: 'Revisa los campos marcados' });
      return;
    }
    const payload: ProductoPayload = {
      nombre: b.nombre.trim(), sku: b.sku.trim() || null, descripcion: b.descripcion, marca: b.marca.trim() || null,
      categoriaId: b.categoriaId === '' ? null : +b.categoriaId, estado: b.estado, destacado: b.destacado,
      precio: +b.precio, precioComparacion: nn(b.precioComparacion), costo: nn(b.costo),
      pesoGramos: nn(b.pesoGramos), altoCm: nn(b.altoCm), anchoCm: nn(b.anchoCm), largoCm: nn(b.largoCm), slug: b.slug || null,
      // Sin campos activos no se mandan: así no se exigen obligatorios que no se ven.
      ...(this.campos().length ? { atributos: atributosDe(b.atributos, this.campos()) } : {}),
    };
    // Los vacíos van como null: `@IsOptional` del DTO los deja pasar. Si alguna
    // validación del backend empieza a rechazar null, hay que omitir el campo.
    const min = +b.stockMinimo || 0;
    this.guardando.set(true);
    const id = this.alertas.mostrar({ titulo: esNuevo ? 'Creando producto' : 'Guardando cambios', texto: b.nombre.trim() });
    const req = esNuevo ? this.api.crear(payload) : this.api.actualizar(a as number, payload);
    req.subscribe({
      next: (p) => {
        const minReq: Observable<Inventario | null> = min !== this.stock(p.id).min && this.puede('inventario.editar') ? this.inventarioApi.stockMinimo(p.id, min) : of(null);
        minReq.subscribe((inv) => {
          if (inv) this.ponerInventario(inv);
          this.productos.update((xs) => (esNuevo ? [...xs, p] : xs.map((x) => (x.id === p.id ? p : x))));
          const nb = this.aBorrador(p);
          this.abierto.set(p.id);
          this.borrador.set(nb);
          this.guardado.set({ ...nb });
          this.intento.set(false);
          this.guardando.set(false);
          if (esNuevo) this.destellar([p.id]);
          this.alertas.resolver(id, esNuevo
            ? { estado: 'success', titulo: 'Producto creado', texto: 'Ahora puedes subir sus imágenes' }
            : { estado: 'success', titulo: 'Cambios guardados', texto: p.nombre });
        });
      },
      error: (e) => {
        this.guardando.set(false);
        const conflicto = e?.status === 409;
        this.alertas.resolver(id, {
          estado: 'error', titulo: 'No se pudo guardar',
          texto: conflicto ? 'El SKU o la URL ya los usa otro producto.' : 'El servidor rechazó el cambio. Tus datos siguen en la ficha.',
        });
      },
    });
  }

  ponerInventario(inv: Inventario): void {
    this.inventario.update((m) => new Map(m).set(inv.productoId, inv));
    // si el usuario no tocó la ficha, refleja el mínimo nuevo
    if (this.abierto() === inv.productoId && !this.sucio()) this.sincronizarBorrador();
  }

  /** Tras un cambio externo (masivo, en vivo): rehace el borrador si no hay edición. */
  private sincronizarBorrador(): void {
    const a = this.abierto();
    if (typeof a !== 'number' || this.sucio()) return;
    const p = this.producto(a);
    if (!p) return this.cerrarFicha(true);
    const b = this.aBorrador(p);
    this.borrador.set(b);
    this.guardado.set({ ...b });
  }

  destellar(ids: number[]): void {
    if (!ids.length) return;
    this.destello.set(new Set(ids));
    setTimeout(() => this.destello.set(new Set()), 1800);
  }
}
