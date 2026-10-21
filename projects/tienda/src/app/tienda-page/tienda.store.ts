import { HttpErrorResponse } from '@angular/common/http';
import { ElementRef, Injectable, Signal, computed, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { volarAlPedido } from '../core/movimiento';
import { TiendaService } from '../core/tienda.service';
import { ProductoPublico, TiendaNoDisponible, TiendaPublica, formatearMonto } from '../core/tienda.model';

export type Estado = 'cargando' | 'lista' | 'no-disponible' | 'error';

export interface Seccion {
  id: number;
  nombre: string;
  productos: ProductoPublico[];
}

type Ref<T extends Element = HTMLElement> = Signal<ElementRef<T> | undefined>;

export const MAX_POR_PRODUCTO = 999;
/** Tono de fondo de la tarjeta, tono fuerte de la burbuja y forma — por índice del producto en el catálogo. */
export const TONOS = ['#cfe9da', '#c2e2d0', '#dcefe4', '#b8dcc8', '#d4ebde', '#c6e6d5', '#e0f2e8'];
export const TONOS_FUERTES = ['#b2dac4', '#a3d1b9', '#c1e2cf', '#98caae', '#b5d9c6', '#a8d4bd', '#c4e5d3'];
const TAM_SUGERIDO = [78, 64, 84, 70, 74, 66];
const DESFASE_SUGERIDO = [0, 14, 2, 18, 6, 12];

/**
 * Estado de la tienda pública (lo comparten la página y sus componentes;
 * se provee en `TiendaPageComponent`): la tienda cargada, la búsqueda, el
 * catálogo por categorías, el carrito (en el navegador, por tienda), el
 * detalle abierto y lo que necesitan la nav y el hero. El flujo del pedido
 * vive en `PedidoStore`.
 *
 * `refs`: los componentes registran acá sus elementos (`viewChild`) para
 * que el scroll, el foco y la animación «volar al pedido» los encuentren.
 */
@Injectable()
export class TiendaStore {
  private readonly tiendaService = inject(TiendaService);
  private readonly title = inject(Title);
  private slug = '';
  private readonly alCargarPrimeraVez: ((t: TiendaPublica) => void)[] = [];

  readonly refs: {
    hero?: Ref; catalogo?: Ref; secciones?: Signal<readonly ElementRef<HTMLElement>[]>;
    isla?: Ref; busqueda?: Ref<HTMLInputElement>; nombre?: Ref<HTMLInputElement>; dir?: Ref<HTMLInputElement>;
  } = {};

  // ── Datos ─────────────────────────────────────────────────────────────
  readonly estado = signal<Estado>('cargando');
  readonly tienda = signal<TiendaPublica | null>(null);
  readonly noDisponible = signal<TiendaNoDisponible>({ motivo: 'no-existe' });

  // ── UI ────────────────────────────────────────────────────────────────
  readonly movil = signal(false);
  readonly enTope = signal(true);
  readonly trasHero = signal(false);
  readonly seccionActiva = signal<number | null>(null);
  readonly busqueda = signal('');
  readonly buscando = signal(false);
  readonly detalle = signal<ProductoPublico | null>(null);
  readonly detQty = signal(1);
  readonly destQty = signal(1);

  // ── Carrito ───────────────────────────────────────────────────────────
  readonly carrito = signal<Map<number, number>>(new Map());
  /** Error del último envío (se borra al tocar el carrito). */
  readonly errorPedido = signal<string | null>(null);

  // ── Derivados ─────────────────────────────────────────────────────────
  readonly productos = computed(() => this.tienda()?.productos ?? []);
  private readonly indice = computed(() => new Map(this.productos().map((p, k) => [p.id, k])));
  private readonly porId = computed(() => new Map(this.productos().map((p) => [p.id, p])));

  readonly categorias = computed(() => {
    const t = this.tienda();
    if (!t) return [];
    const cats = [...t.categorias];
    if (this.productos().some((p) => p.categoriaId === null)) cats.push({ id: 0, nombre: cats.length ? 'Otros' : 'Productos' });
    return cats.filter((c) => this.productos().some((p) => (c.id === 0 ? p.categoriaId === null : p.categoriaId === c.id)));
  });

  private readonly q = computed(() => normalizar(this.busqueda().trim()));
  readonly hayQ = computed(() => !!this.q());
  readonly filtrados = computed(() => {
    const q = this.q();
    const cat = new Map(this.categorias().map((c) => [c.id, c.nombre]));
    return this.productos().filter((p) => !q || normalizar(`${p.nombre} ${p.descripcion ?? ''} ${cat.get(p.categoriaId ?? 0) ?? ''}`).includes(q));
  });
  readonly secciones = computed<Seccion[]>(() =>
    this.categorias()
      .map((c) => ({ id: c.id, nombre: c.nombre, productos: this.filtrados().filter((p) => (c.id === 0 ? p.categoriaId === null : p.categoriaId === c.id)) }))
      .filter((s) => s.productos.length),
  );
  readonly sinResultados = computed(() => this.hayQ() && this.filtrados().length === 0);

  /** Primer producto `destacado` disponible. Sin destacado, la sección no se muestra. */
  readonly destacado = computed(() => (this.hayQ() ? null : (this.productos().find((p) => p.destacado && !p.agotado) ?? null)));

  readonly lineas = computed(() => {
    const porId = this.porId();
    return [...this.carrito()].map(([id, cantidad]) => ({ producto: porId.get(id)!, cantidad })).filter((l) => l.producto);
  });
  readonly unidades = computed(() => this.lineas().reduce((s, l) => s + l.cantidad, 0));
  readonly total = computed(() => this.lineas().reduce((s, l) => s + l.producto.precio * l.cantidad, 0));
  readonly ahorro = computed(() =>
    this.lineas().reduce((s, l) => s + (l.producto.precioAntes ? (l.producto.precioAntes - l.producto.precio) * l.cantidad : 0), 0),
  );
  readonly sugeridos = computed(() =>
    this.productos()
      .filter((p) => !p.agotado && !this.carrito().has(p.id))
      .slice(0, 6)
      .map((p, k) => ({ p, tam: TAM_SUGERIDO[k], desfase: DESFASE_SUGERIDO[k], forma: (k + 1) % 4, tono: k % 2 ? '#ffffff' : this.tonoFuerte(p) })),
  );

  /** Nav: transparente sobre el hero; al bajar, píldora blanca translúcida. */
  readonly nav = computed(() => {
    const top = this.enTope(), mv = this.movil();
    const n = top
      ? { max: '1400px', h: mv ? '64px' : '76px', px: mv ? '0 14px' : '0 28px', r: mv ? '28px 28px 0 0' : '36px 36px 0 0', bg: 'rgba(11,61,51,0)', fg: '#eafff5', sh: 'none', blur: 'none',
          track: 'rgba(255,255,255,.08)', ind: 'rgba(255,255,255,.16)', cartBg: '#25d366', cartFg: '#072a23', cartPill: '#072a23', cartPillFg: '#25d366', logoW: mv ? '96px' : '120px', logoH: mv ? '34px' : '40px' }
      : { max: '1180px', h: mv ? '58px' : '64px', px: mv ? '0 6px 0 14px' : '0 6px 0 18px', r: '999px', bg: 'rgba(255,255,255,.82)', fg: '#0b1f1a',
          sh: '0 16px 40px -20px rgba(7,42,35,.35), 0 0 0 1px rgba(11,61,51,.06)', blur: 'blur(16px) saturate(1.4)',
          track: '#eaf3ee', ind: '#0b3d33', cartBg: '#0b3d33', cartFg: '#eafff5', cartPill: '#25d366', cartPillFg: '#072a23', logoW: mv ? '96px' : '104px', logoH: '34px' };
    const buscandoMv = mv && (this.buscando() || !!this.busqueda());
    const chico = mv || !top;
    const monoS = chico ? '34px' : '40px';
    return { ...n, logoW: buscandoMv ? '0px' : n.logoW, logoO: buscandoMv ? 0 : 1, cartPad: mv ? '0 6px 0 14px' : '0 6px 0 18px',
      monoS, monoW: buscandoMv ? '0px' : monoS, monoF: chico ? '13px' : '15px' };
  });
  /**
   * Tamaño del nombre en el hero según su largo, para que un nombre largo no ocupe toda la pantalla.
   * De 15 a 30 letras (p. ej. «Estudio de Diseño Creativo», 3 líneas) también se limita por el alto
   * de la pantalla (15dvh): así los botones y los pasos del hero no se salen de la primera vista.
   */
  readonly titularHero = computed(() => {
    const n = (this.tienda()?.nombre ?? '').trim().length;
    if (n <= 14) return { fs: 'clamp(72px,12.5vw,212px)', mw: '9ch' };
    if (n <= 30) return { fs: 'clamp(56px,min(9vw,15dvh),152px)', mw: '11ch' };
    return { fs: 'clamp(48px,8.5vw,144px)', mw: '14ch' };
  });
  readonly anchoBusqueda = computed(() => (this.buscando() || this.busqueda() ? (this.movil() ? '140px' : '190px') : '0px'));

  constructor() {
    effect(() => {
      const t = this.tienda();
      if (t) guardar(`goods.tienda.${t.slug}.carrito`, JSON.stringify([...this.carrito()]));
    });
  }

  /** Registra lo que hay que hacer la primera vez que carga la tienda (el pedido lee nombre, celular y entrega). No se repite en las recargas silenciosas. */
  alCargar(fn: (t: TiendaPublica) => void): void { this.alCargarPrimeraVez.push(fn); }

  // ── Presentación ──────────────────────────────────────────────────────
  monto(n: number): string { return formatearMonto(n, this.tienda()?.moneda ?? 'COP'); }
  cantidad(id: number): number { return this.carrito().get(id) ?? 0; }
  inicial(nombre: string): string { return nombre.trim().charAt(0).toUpperCase() || '·'; }
  /** Monograma sin logo: inicial de las dos primeras palabras, sin artículos ni conectores. «Café La Loma» → «CL». */
  iniciales(nombre: string): string {
    const w = nombre.trim().split(/\s+/).filter((x) => !/^(de|del|la|las|el|los|y|e|&)$/i.test(x));
    return ((w[0]?.[0] ?? '·') + (w[1]?.[0] ?? '')).toUpperCase();
  }
  tono(p: ProductoPublico): string { return TONOS[(this.indice().get(p.id) ?? 0) % TONOS.length]; }
  tonoFuerte(p: ProductoPublico): string { return TONOS_FUERTES[(this.indice().get(p.id) ?? 0) % TONOS_FUERTES.length]; }
  forma(p: ProductoPublico): string { return `forma-${(this.indice().get(p.id) ?? 0) % 4}`; }
  porcentaje(p: ProductoPublico): number { return p.precioAntes ? Math.round((1 - p.precio / p.precioAntes) * 100) : 0; }
  /** Burbuja de la tarjeta: −20 % / Últimas unidades. Agotado va como pastilla sobre la imagen. */
  etiqueta(p: ProductoPublico): { texto: string; bg: string; fg: string } | null {
    if (p.agotado) return null;
    if (p.precioAntes) return { texto: `−${this.porcentaje(p)}%`, bg: '#0b3d33', fg: '#eafff5' };
    if (p.ultimasUnidades) return { texto: 'Últimas\nunidades', bg: '#2be0d5', fg: '#072a23' };
    return null;
  }
  enlaceWa(texto: string): string {
    return `https://wa.me/${this.tienda()?.whatsapp ?? ''}?text=${encodeURIComponent(texto)}`;
  }
  waProducto(p: ProductoPublico): string {
    const n = this.tienda()?.nombre ?? '';
    return this.enlaceWa(p.agotado ? `Hola ${n}, ¿me avisan cuando vuelva a llegar ${p.nombre}?` : `Hola ${n}, quiero preguntar por: ${p.nombre}`);
  }
  waGeneral(): string { return this.enlaceWa(`Hola ${this.tienda()?.nombre ?? ''}, tengo una pregunta`); }
  waBusqueda(): string { return this.enlaceWa(`Hola ${this.tienda()?.nombre ?? ''}, ¿tienen ${this.busqueda().trim()}?`); }
  categoriaDe(p: ProductoPublico): string {
    return this.categorias().find((c) => c.id === (p.categoriaId ?? 0))?.nombre ?? '';
  }

  // ── Navegación ────────────────────────────────────────────────────────
  subir(): void { scrollTo({ top: 0, behavior: 'smooth' }); }
  irCatalogo(): void { this.irA(this.refs.catalogo?.()?.nativeElement, 40); }
  irSeccion(k: number): void { this.irA(this.refs.secciones?.()[k]?.nativeElement, 100); }
  private irA(el: HTMLElement | undefined, off: number): void {
    if (el) scrollTo({ top: el.getBoundingClientRect().top + scrollY - off, behavior: 'smooth' });
  }

  abrirBusqueda(): void {
    this.buscando.set(true);
    setTimeout(() => this.refs.busqueda?.()?.nativeElement.focus(), 50);
  }
  cerrarBusqueda(): void { if (!this.busqueda()) this.buscando.set(false); }
  alBuscar(v: string): void {
    const habia = !!this.busqueda().trim();
    this.busqueda.set(v);
    if (!habia && v.trim()) requestAnimationFrame(() => this.irCatalogo());
  }
  limpiarBusqueda(e: Event): void { e.preventDefault(); this.busqueda.set(''); }
  sugerir(k: number): void {
    this.busqueda.set(''); this.buscando.set(false);
    setTimeout(() => this.irSeccion(k), 60);
  }

  // ── Carrito ───────────────────────────────────────────────────────────
  /** Suma o resta unidades (tope `MAX_POR_PRODUCTO`; en 0 sale del carrito). A un agotado no se le suma. Borra el error del último envío. */
  cambiar(p: ProductoPublico, delta: number): void {
    if (p.agotado && delta > 0) return;
    const nuevo = new Map(this.carrito());
    const n = Math.min(MAX_POR_PRODUCTO, (nuevo.get(p.id) ?? 0) + delta);
    if (n <= 0) nuevo.delete(p.id); else nuevo.set(p.id, n);
    this.carrito.set(nuevo);
    this.errorPedido.set(null);
  }
  agregar(p: ProductoPublico, e?: MouseEvent, n = 1): void {
    e?.stopPropagation();
    if (p.agotado) return;
    volarAlPedido(e, this.refs.isla?.()?.nativeElement, this.movil());
    this.cambiar(p, n);
  }
  /** Burbuja de «Agrega también»: crece, desaparece (380 ms) y recién ahí se suma. */
  agregarSugerido(p: ProductoPublico, burbuja: HTMLElement): void {
    const a = burbuja.animate(
      [{ scale: '1', opacity: 1 }, { scale: '1.22', opacity: 1, offset: 0.4 }, { scale: '0.2', opacity: 0 }],
      { duration: 380, easing: 'cubic-bezier(.4,0,.2,1)' },
    );
    a.onfinish = () => this.cambiar(p, 1);
  }

  // ── Detalle ───────────────────────────────────────────────────────────
  abrirDetalle(p: ProductoPublico): void { this.detalle.set(p); this.detQty.set(1); }
  agregarDetalle(): void {
    const p = this.detalle();
    if (p) { this.cambiar(p, this.detQty()); this.detalle.set(null); }
  }

  // ── Carga ─────────────────────────────────────────────────────────────
  /**
   * Trae la tienda y pasa a `lista`, `no-disponible` (404, con su motivo) o `error`.
   *
   * @param silencioso - Recarga sin pantalla de carga (tras un 409 al enviar): conserva el
   * carrito y le quita lo que se agotó. Sin él, lee el carrito guardado en el navegador.
   */
  cargar(slug: string, silencioso = false): void {
    this.slug = slug;
    if (!silencioso) this.estado.set('cargando');
    this.tiendaService.ver(slug).subscribe({
      next: (t) => {
        this.tienda.set(t);
        this.title.setTitle(t.nombre);
        this.estado.set('lista');
        if (!silencioso) {
          this.carrito.set(leerCarrito(t));
          this.alCargarPrimeraVez.forEach((fn) => fn(t));
        } else {
          const vigentes = new Set(t.productos.filter((p) => !p.agotado).map((p) => p.id));
          this.carrito.set(new Map([...this.carrito()].filter(([id]) => vigentes.has(id))));
        }
      },
      error: (e: HttpErrorResponse) => {
        if (e.status === 404) {
          this.noDisponible.set({ motivo: e.error?.motivo ?? 'no-existe', nombre: e.error?.nombre, whatsapp: e.error?.whatsapp ?? null });
          this.estado.set('no-disponible');
          this.title.setTitle(e.error?.nombre ?? 'Tienda no disponible');
        } else {
          this.estado.set('error');
          this.title.setTitle('Tienda');
        }
      },
    });
  }
  reintentar(): void { this.cargar(this.slug); }
}

export function normalizar(t: string): string { return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
export function leer(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } }
export function guardar(k: string, v: string): void {
  try {
    localStorage.setItem(k, v);
  } catch {
    // Sin almacenamiento (modo privado o lleno): el carrito sigue en memoria, solo no sobrevive a recargar.
  }
}
function leerCarrito(t: TiendaPublica): Map<number, number> {
  const disponibles = new Set(t.productos.filter((p) => !p.agotado).map((p) => p.id));
  try {
    const g = JSON.parse(leer(`goods.tienda.${t.slug}.carrito`) ?? '[]') as [number, number][];
    return new Map(g.filter(([id, n]) => disponibles.has(id) && Number.isInteger(n) && n > 0 && n <= MAX_POR_PRODUCTO));
  } catch {
    return new Map();
  }
}
