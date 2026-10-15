import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { Title } from '@angular/platform-browser';
import {
  IconAlertCircle,
  IconArrowDown,
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
  IconArrowUpRight,
  IconBrandFacebook,
  IconBrandInstagram,
  IconBrandTiktok,
  IconBrandWhatsapp,
  IconBuildingStore,
  IconCheck,
  IconChecks,
  IconCircleCheckFilled,
  IconMapPin,
  IconMinus,
  IconPlus,
  IconSearch,
  IconSearchOff,
  IconShoppingBag,
  IconStarFilled,
  IconTrash,
  IconTruckDelivery,
  IconUser,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { environment } from '../../environments/environment';
import { BurbujaDirective, RevelarDirective, volarAlPedido } from '../core/movimiento';
import { TiendaService } from '../core/tienda.service';
import { Entrega, ProductoPublico, TiendaNoDisponible, TiendaPublica, formatearMonto } from '../core/tienda.model';
import { NoDisponibleComponent } from '../no-disponible/no-disponible.component';

type Estado = 'cargando' | 'lista' | 'no-disponible' | 'error';
/** 0 Tu pedido · 1 Entrega · 2 Tus datos · 3 Mensaje · 4 ¿Ya lo enviaste? · 5 Enviado. */
type Paso = 0 | 1 | 2 | 3 | 4 | 5;

interface Seccion {
  id: number;
  nombre: string;
  productos: ProductoPublico[];
}

const MAX_POR_PRODUCTO = 999;
/** Tono de fondo de la tarjeta, tono fuerte de la burbuja y forma — por índice del producto en el catálogo. */
export const TONOS = ['#cfe9da', '#c2e2d0', '#dcefe4', '#b8dcc8', '#d4ebde', '#c6e6d5', '#e0f2e8'];
export const TONOS_FUERTES = ['#b2dac4', '#a3d1b9', '#c1e2cf', '#98caae', '#b5d9c6', '#a8d4bd', '#c4e5d3'];
const PASOS_TITULO = ['Tu pedido', '¿Cómo lo recibes?', '¿A nombre de quién?', 'Así le llegará', 'Confirmar envío', ''];
const NOTAS_RAPIDAS = ['Entregar en la tarde', 'Es un regalo', 'Llamar antes de llegar'];
const TAM_SUGERIDO = [78, 64, 84, 70, 74, 66];
const DESFASE_SUGERIDO = [0, 14, 2, 18, 6, 12];

/**
 * Tienda pública v2 (handoff-tienda-en-linea): hero verde con burbujas,
 * nav flotante, destacado, catálogo por categorías en tarjetas-arco,
 * detalle en modal (hoja inferior en móvil) y la isla «Tu pedido» que se
 * abre en un flujo de 4 pasos hasta WhatsApp.
 *
 * Mismas reglas que la v1: el carrito vive en el navegador por tienda y el
 * mensaje lo arma el backend (`armarPedido`) con precios y stock del momento.
 */
@Component({
  selector: 'app-tienda-page',
  imports: [FormsModule, NgTemplateOutlet, TablerIconComponent, BurbujaDirective, RevelarDirective, NoDisponibleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tienda-page.component.html',
})
export class TiendaPageComponent {
  private readonly tiendaService = inject(TiendaService);
  private readonly title = inject(Title);
  private readonly destroyRef = inject(DestroyRef);
  private readonly zone = inject(NgZone);

  readonly slug = input.required<string>();

  protected readonly i = {
    wa: IconBrandWhatsapp, ig: IconBrandInstagram, fb: IconBrandFacebook, tt: IconBrandTiktok,
    mas: IconPlus, menos: IconMinus, quitar: IconTrash, cerrar: IconX, buscar: IconSearch, sinResultados: IconSearchOff,
    bolsa: IconShoppingBag, tienda: IconBuildingStore, camion: IconTruckDelivery, usuario: IconUser, check: IconCheck, checks: IconChecks,
    checkLleno: IconCircleCheckFilled, alerta: IconAlertCircle, pin: IconMapPin, estrella: IconStarFilled,
    abajo: IconArrowDown, arriba: IconArrowUp, izq: IconArrowLeft, der: IconArrowRight, diagonal: IconArrowUpRight,
  };
  protected readonly goodsUrl = environment.goodsUrl;
  protected readonly anio = new Date().getFullYear();
  protected readonly Math = Math;
  protected readonly notasRapidas = NOTAS_RAPIDAS;

  // ── Datos ─────────────────────────────────────────────────────────────
  protected readonly estado = signal<Estado>('cargando');
  protected readonly tienda = signal<TiendaPublica | null>(null);
  protected readonly noDisponible = signal<TiendaNoDisponible>({ motivo: 'no-existe' });

  // ── UI ────────────────────────────────────────────────────────────────
  protected readonly movil = signal(false);
  protected readonly enTope = signal(true);
  protected readonly trasHero = signal(false);
  protected readonly seccionActiva = signal<number | null>(null);
  protected readonly busqueda = signal('');
  protected readonly buscando = signal(false);
  protected readonly detalle = signal<ProductoPublico | null>(null);
  protected readonly detQty = signal(1);
  protected readonly destQty = signal(1);

  // ── Pedido ────────────────────────────────────────────────────────────
  protected readonly carrito = signal<Map<number, number>>(new Map());
  protected readonly abierto = signal(false);
  protected readonly paso = signal<Paso>(0);
  protected readonly entrega = signal<Entrega>('recoger');
  protected readonly entregaElegida = signal(false);
  protected readonly direccion = signal('');
  protected readonly nombre = signal('');
  protected readonly telefono = signal('');
  protected readonly nota = signal('');
  protected readonly aceptaPromociones = signal(false);
  protected readonly faltaDir = signal(false);
  protected readonly faltaNombre = signal(false);
  protected readonly faltaTelefono = signal(false);
  protected readonly enviando = signal(false);
  protected readonly errorPedido = signal<string | null>(null);
  private urlPedido: string | null = null;

  // ── Refs ──────────────────────────────────────────────────────────────
  private readonly heroRef = viewChild<ElementRef<HTMLElement>>('hero');
  private readonly catalogoRef = viewChild<ElementRef<HTMLElement>>('catalogo');
  private readonly islaRef = viewChild<ElementRef<HTMLElement>>('islaEl');
  private readonly anilloRef = viewChild<ElementRef<SVGCircleElement>>('anillo');
  private readonly busquedaRef = viewChild<ElementRef<HTMLInputElement>>('inputBusqueda');
  private readonly nombreRef = viewChild<ElementRef<HTMLInputElement>>('inputNombre');
  private readonly dirRef = viewChild<ElementRef<HTMLInputElement>>('inputDir');
  private readonly seccionRefs = viewChildren<ElementRef<HTMLElement>>('seccion');
  private readonly navRefs = viewChildren<ElementRef<HTMLElement>>('navBtn');
  protected readonly indicador = signal({ w: 0, x: 0, o: 0 });

  // ── Derivados ─────────────────────────────────────────────────────────
  protected readonly productos = computed(() => this.tienda()?.productos ?? []);
  private readonly indice = computed(() => new Map(this.productos().map((p, k) => [p.id, k])));
  private readonly porId = computed(() => new Map(this.productos().map((p) => [p.id, p])));

  protected readonly categorias = computed(() => {
    const t = this.tienda();
    if (!t) return [];
    const cats = [...t.categorias];
    if (this.productos().some((p) => p.categoriaId === null)) cats.push({ id: 0, nombre: cats.length ? 'Otros' : 'Productos' });
    return cats.filter((c) => this.productos().some((p) => (c.id === 0 ? p.categoriaId === null : p.categoriaId === c.id)));
  });

  private readonly q = computed(() => normalizar(this.busqueda().trim()));
  protected readonly hayQ = computed(() => !!this.q());
  protected readonly filtrados = computed(() => {
    const q = this.q();
    const cat = new Map(this.categorias().map((c) => [c.id, c.nombre]));
    return this.productos().filter((p) => !q || normalizar(`${p.nombre} ${p.descripcion ?? ''} ${cat.get(p.categoriaId ?? 0) ?? ''}`).includes(q));
  });
  protected readonly secciones = computed<Seccion[]>(() =>
    this.categorias()
      .map((c) => ({ id: c.id, nombre: c.nombre, productos: this.filtrados().filter((p) => (c.id === 0 ? p.categoriaId === null : p.categoriaId === c.id)) }))
      .filter((s) => s.productos.length),
  );
  protected readonly sinResultados = computed(() => this.hayQ() && this.filtrados().length === 0);

  /** Primer producto `destacado` disponible. Sin destacado, la sección no se muestra. */
  protected readonly destacado = computed(() => (this.hayQ() ? null : (this.productos().find((p) => p.destacado && !p.agotado) ?? null)));

  protected readonly lineas = computed(() => {
    const porId = this.porId();
    return [...this.carrito()].map(([id, cantidad]) => ({ producto: porId.get(id)!, cantidad })).filter((l) => l.producto);
  });
  protected readonly unidades = computed(() => this.lineas().reduce((s, l) => s + l.cantidad, 0));
  protected readonly total = computed(() => this.lineas().reduce((s, l) => s + l.producto.precio * l.cantidad, 0));
  protected readonly ahorro = computed(() =>
    this.lineas().reduce((s, l) => s + (l.producto.precioAntes ? (l.producto.precioAntes - l.producto.precio) * l.cantidad : 0), 0),
  );
  protected readonly sugeridos = computed(() =>
    this.productos()
      .filter((p) => !p.agotado && !this.carrito().has(p.id))
      .slice(0, 6)
      .map((p, k) => ({ p, tam: TAM_SUGERIDO[k], desfase: DESFASE_SUGERIDO[k], forma: (k + 1) % 4, tono: k % 2 ? '#ffffff' : this.tonoFuerte(p) })),
  );

  protected readonly nombreValido = computed(() => this.nombre().trim().length > 0);
  protected readonly telefonoValido = computed(() => /^[0-9]{7,15}$/.test(this.telefono().replace(/\D/g, '')));
  protected readonly esDomicilio = computed(() => this.entrega() === 'domicilio');

  /** Misma plantilla que `TiendaService.armarPedido` del backend (+ línea de entrega, TODO backend). */
  protected readonly mensaje = computed(() => {
    const t = this.tienda();
    if (!t) return [];
    const m: { texto: string; negrita?: boolean }[] = [
      { texto: `Hola ${t.nombre}, quiero hacer este pedido:` }, { texto: '' },
      ...this.lineas().map((l) => ({ texto: `• ${l.cantidad} × ${l.producto.nombre} — ${this.monto(l.producto.precio * l.cantidad)}` })),
      { texto: '' }, { texto: `Total: ${this.monto(this.total())}`, negrita: true }, { texto: '' },
      { texto: `Mi nombre: ${this.nombre().trim() || '…'}` },
      { texto: this.esDomicilio() ? `Entrega a domicilio: ${this.direccion().trim()}` : 'Recojo en la tienda' },
    ];
    if (this.nota().trim()) m.push({ texto: `Nota: ${this.nota().trim()}` });
    if (this.aceptaPromociones()) m.push({ texto: '' }, { texto: `✅ Acepto recibir novedades y promociones de ${t.nombre} por WhatsApp.` });
    return m;
  });

  protected readonly tituloPaso = computed(() => PASOS_TITULO[this.paso()]);
  protected readonly subPaso = computed(() => {
    const u = cuenta(this.unidades()), tot = this.monto(this.total()), a = this.ahorro();
    return [
      a > 0 ? `${u} · ${tot} · ahorras ${this.monto(a)}` : `${u} · ${tot}`,
      'Recógelo en la tienda o te lo enviamos',
      'Solo se usa para tu pedido',
      'Revisa el mensaje antes de enviarlo',
      'Último paso',
      '',
    ][this.paso()];
  });
  protected readonly pasoNum = computed(() => String(Math.min(this.paso(), 3) + 1).padStart(2, '0'));
  protected readonly riel = computed(() => {
    const p = this.paso(), dom = this.esDomicilio();
    return [
      { icono: this.i.bolsa, texto: cuenta(this.unidades()) },
      { icono: dom ? this.i.camion : this.i.tienda, texto: this.entregaElegida() || p > 1 ? (dom ? 'Domicilio' : 'Recoger') : 'Entrega' },
      { icono: this.i.usuario, texto: 'Tus datos' },
      { icono: this.i.wa, texto: 'Mensaje' },
    ].map((r, k) => ({ ...r, k, actual: k === p, hecho: k < p }));
  });

  /** La isla: barra flotante cerrada ↔ hoja abierta. En móvil cerrada se corre 44 px a la izquierda para no tapar «Volver arriba». */
  protected readonly isla = computed(() => {
    const ab = this.abierto(), mv = this.movil();
    const visible = ab || (this.unidades() > 0 && this.trasHero());
    const dx = mv && !ab ? 'calc(-50% - 44px)' : '-50%';
    const mostrar = visible && !this.detalle();
    return {
      w: ab ? (mv ? '100vw' : 'min(580px, calc(100vw - 24px))') : mv ? 'min(300px, calc(100vw - 112px))' : '300px',
      h: ab ? (mv ? '92vh' : 'min(760px, calc(100vh - 100px))') : '62px',
      r: ab ? (mv ? '28px 28px 0 0' : '36px') : '999px',
      b: ab && mv ? '0px' : '20px',
      t: mostrar ? `translateX(${dx})` : `translate(${dx}, 160%)`,
      o: mostrar ? 1 : 0,
    };
  });
  protected readonly verSubir = computed(() => this.trasHero() && !this.abierto() && !this.detalle());

  /** Nav: transparente sobre el hero; al bajar, píldora blanca translúcida. */
  protected readonly nav = computed(() => {
    const top = this.enTope(), mv = this.movil();
    const n = top
      ? { max: '1400px', h: mv ? '64px' : '76px', px: mv ? '0 14px' : '0 28px', r: mv ? '28px 28px 0 0' : '36px 36px 0 0', bg: 'rgba(11,61,51,0)', fg: '#eafff5', sh: 'none', blur: 'none',
          track: 'rgba(255,255,255,.08)', ind: 'rgba(255,255,255,.16)', cartBg: '#25d366', cartFg: '#072a23', cartPill: '#072a23', cartPillFg: '#25d366', logoW: mv ? '96px' : '120px', logoH: mv ? '34px' : '40px' }
      : { max: '1180px', h: mv ? '58px' : '64px', px: mv ? '0 6px 0 14px' : '0 6px 0 18px', r: '999px', bg: 'rgba(255,255,255,.82)', fg: '#0b1f1a',
          sh: '0 16px 40px -20px rgba(7,42,35,.35), 0 0 0 1px rgba(11,61,51,.06)', blur: 'blur(16px) saturate(1.4)',
          track: '#eaf3ee', ind: '#0b3d33', cartBg: '#0b3d33', cartFg: '#eafff5', cartPill: '#25d366', cartPillFg: '#072a23', logoW: mv ? '96px' : '104px', logoH: '34px' };
    const buscandoMv = mv && (this.buscando() || !!this.busqueda());
    return { ...n, logoW: buscandoMv ? '0px' : n.logoW, logoO: buscandoMv ? 0 : 1, cartPad: mv ? '0 6px 0 14px' : '0 6px 0 18px' };
  });
  protected readonly anchoBusqueda = computed(() => (this.buscando() || this.busqueda() ? (this.movil() ? '140px' : '190px') : '0px'));

  constructor() {
    effect(() => this.cargar(this.slug()));
    effect(() => {
      const t = this.tienda();
      if (t) guardar(`goods.tienda.${t.slug}.carrito`, JSON.stringify([...this.carrito()]));
    });
    effect(() => guardar('goods.tienda.nombre', this.nombre()));
    effect(() => guardar('goods.tienda.telefono', this.telefono()));
    effect(() => { document.body.style.overflow = this.abierto() || this.detalle() ? 'hidden' : ''; });
    effect(() => { this.seccionActiva(); this.navRefs(); queueMicrotask(() => this.moverIndicador()); });

    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (this.detalle()) this.detalle.set(null);
      else if (this.abierto()) this.cerrarPedido();
    };
    document.addEventListener('keydown', alTeclear);

    const mq = matchMedia('(max-width: 759px)');
    const alCambiarAncho = () => this.movil.set(mq.matches);
    alCambiarAncho();
    mq.addEventListener('change', alCambiarAncho);

    afterNextRender(() => {
      const alScroll = () => this.pintarScroll();
      this.zone.runOutsideAngular(() => addEventListener('scroll', alScroll, { passive: true }));
      this.pintarScroll();
      this.destroyRef.onDestroy(() => removeEventListener('scroll', alScroll));
    });
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('keydown', alTeclear);
      mq.removeEventListener('change', alCambiarAncho);
      document.body.style.overflow = '';
    });
  }

  // ── Presentación ──────────────────────────────────────────────────────
  protected monto(n: number): string { return formatearMonto(n, this.tienda()?.moneda ?? 'COP'); }
  protected cantidad(id: number): number { return this.carrito().get(id) ?? 0; }
  protected inicial(nombre: string): string { return nombre.trim().charAt(0).toUpperCase() || '·'; }
  protected tono(p: ProductoPublico): string { return TONOS[(this.indice().get(p.id) ?? 0) % TONOS.length]; }
  protected tonoFuerte(p: ProductoPublico): string { return TONOS_FUERTES[(this.indice().get(p.id) ?? 0) % TONOS_FUERTES.length]; }
  protected forma(p: ProductoPublico): string { return `forma-${(this.indice().get(p.id) ?? 0) % 4}`; }
  protected porcentaje(p: ProductoPublico): number { return p.precioAntes ? Math.round((1 - p.precio / p.precioAntes) * 100) : 0; }
  /** Burbuja de la tarjeta: −20 % / Últimas unidades. Agotado va como pastilla sobre la imagen. */
  protected etiqueta(p: ProductoPublico): { texto: string; bg: string; fg: string } | null {
    if (p.agotado) return null;
    if (p.precioAntes) return { texto: `−${this.porcentaje(p)}%`, bg: '#0b3d33', fg: '#eafff5' };
    if (p.ultimasUnidades) return { texto: 'Últimas\nunidades', bg: '#2be0d5', fg: '#072a23' };
    return null;
  }
  protected enlaceWa(texto: string): string {
    return `https://wa.me/${this.tienda()?.whatsapp ?? ''}?text=${encodeURIComponent(texto)}`;
  }
  protected waProducto(p: ProductoPublico): string {
    const n = this.tienda()?.nombre ?? '';
    return this.enlaceWa(p.agotado ? `Hola ${n}, ¿me avisan cuando vuelva a llegar ${p.nombre}?` : `Hola ${n}, quiero preguntar por: ${p.nombre}`);
  }
  protected waGeneral(): string { return this.enlaceWa(`Hola ${this.tienda()?.nombre ?? ''}, tengo una pregunta`); }
  protected waBusqueda(): string { return this.enlaceWa(`Hola ${this.tienda()?.nombre ?? ''}, ¿tienen ${this.busqueda().trim()}?`); }
  protected resumenLineas(): string {
    const u = this.unidades(), n = this.lineas().length;
    return `${u} ${u === 1 ? 'unidad' : 'unidades'} · ${n} ${n === 1 ? 'referencia' : 'referencias'}`;
  }
  protected inicialNombre(): string { return (this.nombre().trim().charAt(0) || '?').toUpperCase(); }
  protected categoriaDe(p: ProductoPublico): string {
    return this.categorias().find((c) => c.id === (p.categoriaId ?? 0))?.nombre ?? '';
  }

  // ── Navegación ────────────────────────────────────────────────────────
  protected subir(): void { scrollTo({ top: 0, behavior: 'smooth' }); }
  protected irCatalogo(): void { this.irA(this.catalogoRef()?.nativeElement, 40); }
  protected irSeccion(k: number): void { this.irA(this.seccionRefs()[k]?.nativeElement, 100); }
  private irA(el: HTMLElement | undefined, off: number): void {
    if (el) scrollTo({ top: el.getBoundingClientRect().top + scrollY - off, behavior: 'smooth' });
  }

  protected abrirBusqueda(): void {
    this.buscando.set(true);
    setTimeout(() => this.busquedaRef()?.nativeElement.focus(), 50);
  }
  protected cerrarBusqueda(): void { if (!this.busqueda()) this.buscando.set(false); }
  protected alBuscar(v: string): void {
    const habia = !!this.busqueda().trim();
    this.busqueda.set(v);
    if (!habia && v.trim()) requestAnimationFrame(() => this.irCatalogo());
  }
  protected limpiarBusqueda(e: Event): void { e.preventDefault(); this.busqueda.set(''); }
  protected sugerir(k: number): void {
    this.busqueda.set(''); this.buscando.set(false);
    setTimeout(() => this.irSeccion(k), 60);
  }

  // ── Carrito ───────────────────────────────────────────────────────────
  protected cambiar(p: ProductoPublico, delta: number): void {
    if (p.agotado && delta > 0) return;
    const nuevo = new Map(this.carrito());
    const n = Math.min(MAX_POR_PRODUCTO, (nuevo.get(p.id) ?? 0) + delta);
    if (n <= 0) nuevo.delete(p.id); else nuevo.set(p.id, n);
    this.carrito.set(nuevo);
    this.errorPedido.set(null);
  }
  protected agregar(p: ProductoPublico, e?: MouseEvent, n = 1): void {
    e?.stopPropagation();
    if (p.agotado) return;
    volarAlPedido(e, this.islaRef()?.nativeElement, this.movil());
    this.cambiar(p, n);
  }
  /** Burbuja de «Agrega también»: crece, desaparece (380 ms) y recién ahí se suma. */
  protected agregarSugerido(p: ProductoPublico, burbuja: HTMLElement): void {
    const a = burbuja.animate(
      [{ scale: '1', opacity: 1 }, { scale: '1.22', opacity: 1, offset: 0.4 }, { scale: '0.2', opacity: 0 }],
      { duration: 380, easing: 'cubic-bezier(.4,0,.2,1)' },
    );
    a.onfinish = () => this.cambiar(p, 1);
  }

  // ── Detalle ───────────────────────────────────────────────────────────
  protected abrirDetalle(p: ProductoPublico): void { this.detalle.set(p); this.detQty.set(1); }
  protected agregarDetalle(): void {
    const p = this.detalle();
    if (p) { this.cambiar(p, this.detQty()); this.detalle.set(null); }
  }

  // ── Pedido ────────────────────────────────────────────────────────────
  protected abrirPedido(): void {
    if (this.paso() === 5) this.paso.set(0);
    this.abierto.set(true);
  }
  protected cerrarPedido(): void {
    this.abierto.set(false);
    if (this.paso() === 5) this.paso.set(0);
  }
  protected volver(): void { this.paso.update((p) => Math.max(0, p - 1) as Paso); }
  protected irPaso(k: number): void { if (k < this.paso()) this.paso.set(k as Paso); }

  protected elegirEntrega(e: Entrega): void {
    this.entrega.set(e); this.entregaElegida.set(true); this.faltaDir.set(false);
    if (e === 'domicilio') this.enfocarDir();
  }
  private enfocarDir(): void {
    setTimeout(() => {
      const el = this.dirRef()?.nativeElement;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.closest<HTMLElement>('[data-scroll]')?.scrollTo({ top: 99999, behavior: 'smooth' });
    }, 80);
  }

  protected continuar(): void {
    const p = this.paso();
    if (p === 0) return this.paso.set(1);
    if (p === 1) {
      if (this.esDomicilio() && !this.direccion().trim()) { this.faltaDir.set(true); this.enfocarDir(); return; }
      this.entregaElegida.set(true);
      this.paso.set(2);
      setTimeout(() => this.nombreRef()?.nativeElement.focus({ preventScroll: true }), 650);
      return;
    }
    if (p === 2) {
      this.faltaNombre.set(!this.nombreValido());
      this.faltaTelefono.set(!this.telefonoValido());
      if (this.nombreValido() && this.telefonoValido()) this.paso.set(3);
    }
  }
  protected agregarNota(t: string): void {
    this.nota.update((n) => (n.trim() ? `${n.trim()}, ${t.toLowerCase()}` : t));
  }

  /**
   * Paso 3 → backend arma el mensaje → abre WhatsApp en otra pestaña → paso 4.
   * La pestaña se abre antes de la petición para que el navegador no la bloquee.
   */
  protected enviar(): void {
    const t = this.tienda();
    if (!t || !this.lineas().length || this.enviando()) return;
    const ventana = window.open('', '_blank');
    this.enviando.set(true);
    this.errorPedido.set(null);
    this.tiendaService
      .armarPedido(t.slug, {
        items: this.lineas().map((l) => ({ productoId: l.producto.id, cantidad: l.cantidad })),
        nombre: this.nombre().trim(),
        telefono: this.telefono().replace(/\D/g, ''),
        // El backend todavía no acepta `entrega` ni `direccion` (rechaza campos de más):
        // van dentro de la nota, como indica el handoff, hasta que los sume.
        nota: [this.esDomicilio() ? `Entrega a domicilio: ${this.direccion().trim()}` : 'Recojo en la tienda', this.nota().trim()]
          .filter(Boolean).join(' · ').slice(0, 300),
        aceptaPromociones: this.aceptaPromociones() || undefined,
      })
      .subscribe({
        next: (pedido) => {
          this.enviando.set(false);
          this.urlPedido = pedido.url;
          if (ventana) ventana.location.href = pedido.url;
          else window.location.href = pedido.url;
          setTimeout(() => this.paso.set(4), 300);
        },
        error: (e: HttpErrorResponse) => {
          ventana?.close();
          this.enviando.set(false);
          if (e.status === 409) {
            this.errorPedido.set(e.error?.message ?? 'Algo de tu pedido cambió. Revísalo y vuelve a enviarlo.');
            this.cargar(t.slug, true);
            this.paso.set(0);
          } else if (e.status === 404) {
            this.estado.set('no-disponible');
          } else if (e.status === 400 || e.status === 429) {
            const m = e.error?.message;
            this.errorPedido.set((Array.isArray(m) ? m[0] : m) ?? 'Revisa tu nombre y tu celular.');
            this.paso.set(2);
          } else {
            this.errorPedido.set('No pudimos preparar el mensaje. Revisa tu conexión y vuelve a intentarlo.');
          }
        },
      });
  }
  protected abrirOtraVez(): void { if (this.urlPedido) window.open(this.urlPedido, '_blank'); }
  protected confirmarEnvio(): void {
    this.carrito.set(new Map());
    this.nota.set('');
    this.paso.set(5);
  }
  protected seguirComprando(): void { this.abierto.set(false); this.paso.set(0); }

  // ── Scroll ────────────────────────────────────────────────────────────
  private pintarScroll(): void {
    const y = scrollY, vh = innerHeight;
    const hero = this.heroRef()?.nativeElement;
    if (hero) { hero.style.transform = `translate3d(0,${(y * 0.2).toFixed(1)}px,0)`; hero.style.opacity = String(Math.max(0, 1 - y / 700)); }
    const anillo = this.anilloRef()?.nativeElement;
    if (anillo) {
      const H = document.documentElement.scrollHeight - vh;
      anillo.style.strokeDashoffset = String(157.08 * (1 - (H > 0 ? Math.min(1, y / H) : 0)));
    }
    let activa: number | null = null;
    this.seccionRefs().forEach((r, k) => { if (r.nativeElement.getBoundingClientRect().top <= 180) activa = this.secciones()[k]?.id ?? null; });
    if (this.enTope() !== y < 40) this.enTope.set(y < 40);
    if (this.trasHero() !== y > vh * 0.55) this.trasHero.set(y > vh * 0.55);
    if (this.seccionActiva() !== activa) this.seccionActiva.set(activa);
  }
  private moverIndicador(): void {
    const k = this.secciones().findIndex((s) => s.id === this.seccionActiva());
    const btn = k >= 0 ? this.navRefs()[k]?.nativeElement : null;
    this.indicador.set(btn ? { w: btn.offsetWidth, x: btn.offsetLeft, o: 1 } : { ...this.indicador(), o: 0 });
  }

  // ── Carga ─────────────────────────────────────────────────────────────
  private cargar(slug: string, silencioso = false): void {
    if (!silencioso) this.estado.set('cargando');
    this.tiendaService.ver(slug).subscribe({
      next: (t) => {
        this.tienda.set(t);
        this.title.setTitle(t.nombre);
        this.estado.set('lista');
        if (!silencioso) {
          this.carrito.set(leerCarrito(t));
          this.nombre.set(leer('goods.tienda.nombre') ?? '');
          this.telefono.set(leer('goods.tienda.telefono') ?? '');
          if (!t.direccionTienda) this.entrega.set('domicilio');
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
  protected reintentar(): void { this.cargar(this.slug()); }
}

function cuenta(n: number): string { return `${n} ${n === 1 ? 'producto' : 'productos'}`; }
function normalizar(t: string): string { return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
function leer(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } }
function guardar(k: string, v: string): void { try { localStorage.setItem(k, v); } catch { /* modo privado */ } }
function leerCarrito(t: TiendaPublica): Map<number, number> {
  const disponibles = new Set(t.productos.filter((p) => !p.agotado).map((p) => p.id));
  try {
    const g = JSON.parse(leer(`goods.tienda.${t.slug}.carrito`) ?? '[]') as [number, number][];
    return new Map(g.filter(([id, n]) => disponibles.has(id) && Number.isInteger(n) && n > 0 && n <= MAX_POR_PRODUCTO));
  } catch {
    return new Map();
  }
}
