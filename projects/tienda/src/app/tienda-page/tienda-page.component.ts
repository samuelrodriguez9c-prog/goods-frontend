import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, NgZone, afterNextRender, computed, effect, inject, input, untracked, viewChild } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { BurbujaDirective } from '../core/movimiento';
import { NoDisponibleComponent } from '../no-disponible/no-disponible.component';
import { CatalogoTiendaComponent } from './components/catalogo-tienda/catalogo-tienda.component';
import { DestacadoTiendaComponent } from './components/destacado-tienda/destacado-tienda.component';
import { DetalleProductoComponent } from './components/detalle-producto/detalle-producto.component';
import { HeroTiendaComponent } from './components/hero-tienda/hero-tienda.component';
import { IslaPedidoComponent } from './components/isla-pedido/isla-pedido.component';
import { NavTiendaComponent } from './components/nav-tienda/nav-tienda.component';
import { PieTiendaComponent } from './components/pie-tienda/pie-tienda.component';
import { ICONOS } from './iconos';
import { PedidoStore } from './pedido.store';
import { TiendaStore } from './tienda.store';

/**
 * Tienda pública: hero verde con burbujas,
 * nav flotante, destacado, catálogo por categorías en tarjetas-arco,
 * detalle en modal (hoja inferior en móvil) y la isla «Tu pedido» que se
 * abre en un flujo de 4 pasos hasta WhatsApp.
 *
 * La página orquesta: carga la tienda del `slug`, pinta los estados
 * (cargando · no disponible · error · lista), escucha el scroll (parallax
 * del hero, nav, sección activa, anillo de «Volver arriba»), el ancho
 * (móvil) y Esc. El estado vive en `TiendaStore` y `PedidoStore`; el
 * carrito queda en el navegador por tienda y el mensaje lo arma el backend
 * (`armarPedido`) con precios y stock del momento.
 */
@Component({
  selector: 'app-tienda-page',
  imports: [
    TablerIconComponent, BurbujaDirective, NoDisponibleComponent, NavTiendaComponent, HeroTiendaComponent,
    DestacadoTiendaComponent, CatalogoTiendaComponent, PieTiendaComponent, IslaPedidoComponent, DetalleProductoComponent,
  ],
  providers: [TiendaStore, PedidoStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tienda-page.component.html',
})
export class TiendaPageComponent {
  protected readonly st = inject(TiendaStore);
  private readonly pd = inject(PedidoStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly zone = inject(NgZone);

  readonly slug = input.required<string>();
  /** `/<tienda>/p/<producto>`: el slug (o el id) del producto que se abre al cargar. */
  readonly producto = input<string>();
  private readonly location = inject(Location);
  /** El producto del enlace ya se abrió (no reabrirlo al recargar en silencio). */
  private enlaceAbierto: string | null = null;

  protected readonly i = ICONOS;
  protected readonly verSubir = computed(() => this.st.trasHero() && !this.pd.abierto() && !this.st.detalle());
  private readonly anilloRef = viewChild<ElementRef<SVGCircleElement>>('anillo');

  constructor() {
    effect(() => this.st.cargar(this.slug()));
    // Enlace directo: con la tienda lista, abre el detalle de ese producto.
    effect(() => {
      const pedido = this.producto(), t = this.st.tienda();
      if (!pedido || !t || this.st.estado() !== 'lista' || this.enlaceAbierto === pedido) return;
      this.enlaceAbierto = pedido;
      const p = t.productos.find((x) => x.slug === pedido || String(x.id) === pedido);
      if (p) untracked(() => this.st.abrirDetalle(p));
    });
    // La dirección sigue al detalle: abierto se puede copiar y compartir; cerrado vuelve a la tienda.
    effect(() => {
      const d = this.st.detalle();
      if (this.st.estado() !== 'lista') return;
      this.location.replaceState(`/${this.slug()}` + (d ? `/p/${encodeURIComponent(d.slug ?? String(d.id))}` : ''));
    });
    effect(() => { document.body.style.overflow = this.pd.abierto() || this.st.detalle() ? 'hidden' : ''; });

    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (this.st.detalle()) this.st.detalle.set(null);
      else if (this.pd.abierto()) this.pd.cerrarPedido();
    };
    document.addEventListener('keydown', alTeclear);

    const mq = matchMedia('(max-width: 759px)');
    const alCambiarAncho = () => this.st.movil.set(mq.matches);
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

  private pintarScroll(): void {
    const y = scrollY, vh = innerHeight;
    const hero = this.st.refs.hero?.()?.nativeElement;
    if (hero) { hero.style.transform = `translate3d(0,${(y * 0.2).toFixed(1)}px,0)`; hero.style.opacity = String(Math.max(0, 1 - y / 700)); }
    const anillo = this.anilloRef()?.nativeElement;
    if (anillo) {
      const H = document.documentElement.scrollHeight - vh;
      anillo.style.strokeDashoffset = String(157.08 * (1 - (H > 0 ? Math.min(1, y / H) : 0)));
    }
    let activa: number | null = null;
    const secciones = this.st.secciones();
    (this.st.refs.secciones?.() ?? []).forEach((r, k) => { if (r.nativeElement.getBoundingClientRect().top <= 180) activa = secciones[k]?.id ?? null; });
    if (this.st.enTope() !== y < 40) this.st.enTope.set(y < 40);
    if (this.st.trasHero() !== y > vh * 0.55) this.st.trasHero.set(y > vh * 0.55);
    if (this.st.seccionActiva() !== activa) this.st.seccionActiva.set(activa);
  }
}
