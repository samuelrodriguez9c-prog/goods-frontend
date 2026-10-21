import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, input, model, output, viewChild } from '@angular/core';
import {
  IconArrowUpRight, IconBrandWhatsapp, IconChecks, IconChevronLeft, IconCircleDashed, IconDeviceMobile, IconEye, IconLink,
  IconLock, IconMapPin, IconMessageCircle, IconSearch, IconShoppingBag, IconWorld, TablerIconComponent,
} from '@tabler/icons-angular';

export type SeccionTienda = 'direccion' | 'whatsapp' | 'marca' | 'local' | 'redes' | 'catalogo';
export type TabVista = 'tienda' | 'chat' | 'estado';
export interface ProductoVista { id: number; nombre: string; precio: string; agotado: boolean; imagen: string | null }

const TONOS = ['#cfe9da', '#c2e2d0', '#dcefe4', '#b8dcc8'];
const TONOS_FUERTES = ['#b2dac4', '#a3d1b9', '#c1e2cf', '#98caae'];

/**
 * Celular de la vista previa. La pestaña «Tienda» es una miniatura de la
 * tienda pública: tarjeta verde con burbujas, nombre en
 * Archivo mayúsculas, chips, tarjetas-arco y la barra «Tu pedido».
 * La sección `marcado` se resalta (anillo #303030) y se desplaza a la vista;
 * clic en una zona emite `ir` para llevar a su tarjeta. Pausada, la pantalla
 * queda fija arriba bajo la cortina «Volvemos pronto»: la cortina mide un
 * alto de pantalla, así que desplazarla dejaría ver la tienda debajo.
 */
@Component({
  selector: 'app-tienda-vista-previa',
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tienda-vista-previa.component.html',
})
export class TiendaVistaPreviaComponent {
  readonly nombre = input.required<string>();
  readonly slug = input.required<string>();
  readonly prefijo = input('tienda.goods.co/');
  readonly frase = input('');
  /** Ciudad junto a «Recibiendo pedidos», como en la tienda pública. */
  readonly ciudad = input('');
  readonly logoUrl = input<string | null>(null);
  readonly waListo = input(false);
  readonly productos = input<ProductoVista[]>([]);
  /** Nombres de las categorías con productos visibles (chips bajo el buscador). */
  readonly categorias = input<string[]>([]);
  readonly pausada = input(false);
  readonly marcado = input<SeccionTienda | null>(null);
  readonly tab = model<TabVista>('tienda');
  readonly ir = output<SeccionTienda>();

  protected readonly i = {
    pin: IconMapPin, mundo: IconWorld, candado: IconLock, buscar: IconSearch, bolsa: IconShoppingBag, wa: IconBrandWhatsapp, diagonal: IconArrowUpRight,
    ojo: IconEye, atras: IconChevronLeft, checks: IconChecks, link: IconLink,
  };
  protected readonly tabs: { v: TabVista; label: string; icono: typeof IconDeviceMobile }[] = [
    { v: 'tienda', label: 'Tienda', icono: IconDeviceMobile },
    { v: 'chat', label: 'Al compartir por chat', icono: IconMessageCircle },
    { v: 'estado', label: 'En tu estado de WhatsApp', icono: IconCircleDashed },
  ];
  protected readonly iTab = computed(() => this.tabs.findIndex((t) => t.v === this.tab()));
  protected readonly inicial = computed(() => this.nombre().trim().charAt(0).toUpperCase() || '·');
  protected readonly slugVista = computed(() => this.slug() || '…');
  protected readonly fraseVista = computed(() => this.frase().trim() || 'Agrega una frase para presentarte');
  protected readonly fraseChat = computed(() => this.frase().trim() || 'Mira nuestro catálogo y haz tu pedido.');
  protected readonly pie = computed(() =>
    this.tab() === 'tienda' ? (this.pausada() ? 'Así la ven tus clientes mientras está pausada' : 'Pasa el mouse por una tarjeta para ubicarla aquí') : this.tab() === 'chat' ? 'Así se ve tu enlace en un chat' : 'Un estado listo para anunciar tu tienda');

  private readonly pantalla = viewChild<ElementRef<HTMLElement>>('pantalla');
  private readonly zDireccion = viewChild<ElementRef<HTMLElement>>('zDireccion');
  private readonly zMarca = viewChild<ElementRef<HTMLElement>>('zMarca');
  private readonly zLocal = viewChild<ElementRef<HTMLElement>>('zLocal');
  private readonly zWhatsapp = viewChild<ElementRef<HTMLElement>>('zWhatsapp');
  private readonly zCatalogo = viewChild<ElementRef<HTMLElement>>('zCatalogo');

  constructor() {
    effect(() => {
      const m = this.marcado(), box = this.pantalla()?.nativeElement;
      if (this.pausada()) { box?.scrollTo({ top: 0 }); return; }
      if (!m || this.tab() !== 'tienda') return;
      const el = this.zona(m);
      if (box && el) box.scrollTo({ top: Math.max(0, el.offsetTop - 40), behavior: 'smooth' });
    });
  }

  private zona(k: SeccionTienda): HTMLElement | undefined {
    // Las redes van en el pie de la tienda, que la vista previa no muestra.
    if (k === 'redes') return undefined;
    return { direccion: this.zDireccion, marca: this.zMarca, local: this.zLocal, whatsapp: this.zWhatsapp, catalogo: this.zCatalogo }[k]()?.nativeElement;
  }

  protected anillo(k: SeccionTienda): string {
    return this.marcado() === k ? '0 0 0 2px #303030, 0 0 0 6px rgba(48,48,48,.12)' : '0 0 0 0 transparent';
  }
  protected tono(k: number): string { return TONOS[k % 4]; }
  protected tonoFuerte(k: number): string { return TONOS_FUERTES[k % 4]; }
}
