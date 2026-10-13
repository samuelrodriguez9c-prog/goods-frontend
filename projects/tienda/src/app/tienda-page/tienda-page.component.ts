import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import {
  IconBrandWhatsapp,
  IconMinus,
  IconPlus,
  IconSearch,
  IconShoppingBag,
  IconTrash,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { environment } from '../../environments/environment';
import { TiendaService } from '../core/tienda.service';
import { ProductoPublico, TiendaPublica, formatearMonto } from '../core/tienda.model';

type Estado = 'cargando' | 'lista' | 'no-disponible' | 'error';
/** `null` = todo; `0` = productos sin categoría ("Otros"). */
type Filtro = number | null;

interface LineaCarrito {
  producto: ProductoPublico;
  cantidad: number;
}

const MAX_POR_PRODUCTO = 999;

/**
 * La tienda pública de una Empresa (Fase 0 de PROPUESTA_WHATSAPP.md): su
 * catálogo, un carrito y "Enviar pedido por WhatsApp", que abre el chat
 * con el negocio con el pedido ya escrito.
 *
 * El carrito vive en el navegador (por tienda) y el mensaje lo arma el
 * backend con los precios y el stock de ese momento; la vista previa de
 * acá es la misma plantilla para que el visitante vea qué va a mandar.
 */
@Component({
  selector: 'app-tienda-page',
  imports: [FormsModule, TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tienda-page.component.html',
})
export class TiendaPageComponent {
  private readonly tiendaService = inject(TiendaService);
  private readonly title = inject(Title);
  private readonly destroyRef = inject(DestroyRef);

  readonly slug = input.required<string>();

  protected readonly i = {
    wa: IconBrandWhatsapp,
    mas: IconPlus,
    menos: IconMinus,
    buscar: IconSearch,
    bolsa: IconShoppingBag,
    quitar: IconTrash,
    cerrar: IconX,
  };
  protected readonly goodsUrl = environment.goodsUrl;

  protected readonly estado = signal<Estado>('cargando');
  protected readonly tienda = signal<TiendaPublica | null>(null);
  protected readonly filtro = signal<Filtro>(null);
  protected readonly busqueda = signal('');
  protected readonly carrito = signal<Map<number, number>>(new Map());
  protected readonly abierto = signal(false);
  protected readonly detalle = signal<ProductoPublico | null>(null);
  protected readonly nombre = signal('');
  protected readonly nota = signal('');
  /** Casilla "quiero recibir novedades": queda escrita en el mensaje (así el negocio tiene el consentimiento). */
  protected readonly aceptaPromociones = signal(false);
  protected readonly enviando = signal(false);
  protected readonly errorPedido = signal<string | null>(null);
  /** Ya lo mandamos a WhatsApp: ofrecer vaciar el pedido al volver. */
  protected readonly enviado = signal(false);

  private readonly hoja = viewChild<ElementRef<HTMLElement>>('hoja');

  protected readonly productos = computed(() => this.tienda()?.productos ?? []);
  protected readonly porId = computed(() => new Map(this.productos().map((p) => [p.id, p])));
  protected readonly hayOtros = computed(
    () => (this.tienda()?.categorias.length ?? 0) > 0 && this.productos().some((p) => p.categoriaId === null),
  );
  protected readonly conBuscador = computed(() => this.productos().length > 8);

  protected readonly visibles = computed(() => {
    const f = this.filtro();
    const q = normalizar(this.busqueda().trim());
    return this.productos().filter(
      (p) =>
        (f === null || (f === 0 ? p.categoriaId === null : p.categoriaId === f)) &&
        (!q || normalizar(`${p.nombre} ${p.descripcion ?? ''}`).includes(q)),
    );
  });

  protected readonly lineas = computed<LineaCarrito[]>(() => {
    const porId = this.porId();
    return [...this.carrito()]
      .map(([id, cantidad]) => ({ producto: porId.get(id)!, cantidad }))
      .filter((l) => l.producto);
  });
  protected readonly unidades = computed(() => this.lineas().reduce((s, l) => s + l.cantidad, 0));
  protected readonly total = computed(() => this.lineas().reduce((s, l) => s + l.producto.precio * l.cantidad, 0));

  /** Misma plantilla que `TiendaService.armarPedido` del backend. */
  protected readonly vistaPrevia = computed(() => {
    const t = this.tienda();
    if (!t) return [];
    const partes: { texto: string; negrita?: boolean }[] = [
      { texto: `Hola ${t.nombre}, quiero hacer este pedido:` },
      { texto: '' },
      ...this.lineas().map((l) => ({
        texto: `• ${l.cantidad} × ${l.producto.nombre} — ${this.monto(l.producto.precio * l.cantidad)}`,
      })),
      { texto: '' },
      { texto: `Total: ${this.monto(this.total())}`, negrita: true },
    ];
    const nombre = this.nombre().trim();
    const nota = this.nota().trim();
    if (nombre || nota) partes.push({ texto: '' });
    if (nombre) partes.push({ texto: `Mi nombre: ${nombre}` });
    if (nota) partes.push({ texto: `Nota: ${nota}` });
    if (this.aceptaPromociones()) partes.push({ texto: '' }, { texto: textoAltaPromociones(t.nombre) });
    return partes;
  });

  constructor() {
    effect(() => this.cargar(this.slug()));

    // El carrito y el nombre se recuerdan por tienda en este navegador.
    effect(() => {
      const t = this.tienda();
      if (!t) return;
      guardar(`goods.tienda.${t.slug}.carrito`, JSON.stringify([...this.carrito()]));
    });
    effect(() => guardar('goods.tienda.nombre', this.nombre()));

    // Escape cierra lo que esté abierto; el scroll de fondo se bloquea.
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (this.detalle()) this.detalle.set(null);
      else if (this.abierto()) this.abierto.set(false);
    };
    document.addEventListener('keydown', alTeclear);
    this.destroyRef.onDestroy(() => document.removeEventListener('keydown', alTeclear));
    effect(() => {
      document.body.style.overflow = this.abierto() || this.detalle() ? 'hidden' : '';
    });
    effect(() => {
      if (this.abierto()) queueMicrotask(() => this.hoja()?.nativeElement.focus());
    });
  }

  protected monto(n: number): string {
    return formatearMonto(n, this.tienda()?.moneda ?? 'COP');
  }

  protected cantidad(id: number): number {
    return this.carrito().get(id) ?? 0;
  }

  protected cambiar(p: ProductoPublico, delta: number): void {
    if (p.agotado && delta > 0) return;
    const nuevo = new Map(this.carrito());
    const n = Math.min(MAX_POR_PRODUCTO, (nuevo.get(p.id) ?? 0) + delta);
    if (n <= 0) nuevo.delete(p.id);
    else nuevo.set(p.id, n);
    this.carrito.set(nuevo);
    this.errorPedido.set(null);
    this.enviado.set(false);
  }

  protected quitar(p: ProductoPublico): void {
    this.cambiar(p, -this.cantidad(p.id));
  }

  protected vaciar(): void {
    this.carrito.set(new Map());
    this.nota.set('');
    this.enviado.set(false);
    this.abierto.set(false);
  }

  protected enlaceChat(): string {
    return `https://wa.me/${this.tienda()?.whatsapp ?? ''}`;
  }

  protected inicial(nombre: string): string {
    return nombre.trim().charAt(0).toUpperCase() || '·';
  }

  protected enviar(): void {
    const t = this.tienda();
    if (!t || !this.lineas().length || this.enviando()) return;
    this.enviando.set(true);
    this.errorPedido.set(null);
    this.tiendaService
      .armarPedido(t.slug, {
        items: this.lineas().map((l) => ({ productoId: l.producto.id, cantidad: l.cantidad })),
        nombre: this.nombre().trim() || undefined,
        nota: this.nota().trim() || undefined,
        aceptaPromociones: this.aceptaPromociones() || undefined,
      })
      .subscribe({
        next: (pedido) => {
          this.enviando.set(false);
          this.enviado.set(true);
          window.location.href = pedido.url;
        },
        error: (e: HttpErrorResponse) => {
          this.enviando.set(false);
          if (e.status === 409) {
            // Cambió el stock o el catálogo: se actualiza y se muestra qué pasó.
            this.errorPedido.set(e.error?.message ?? 'Algo de tu pedido cambió. Revísalo y vuelve a enviarlo.');
            this.cargar(t.slug, true);
          } else if (e.status === 404) {
            this.estado.set('no-disponible');
          } else {
            this.errorPedido.set('No pudimos preparar el mensaje. Revisa tu conexión y vuelve a intentarlo.');
          }
        },
      });
  }

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
        } else {
          // Lo que se agotó o ya no está sale del carrito; lo que no alcanza se ajusta en el servidor.
          const vigentes = new Map(t.productos.filter((p) => !p.agotado).map((p) => [p.id, p]));
          this.carrito.set(new Map([...this.carrito()].filter(([id]) => vigentes.has(id))));
        }
      },
      error: (e: HttpErrorResponse) => {
        this.estado.set(e.status === 404 ? 'no-disponible' : 'error');
        this.title.setTitle(e.status === 404 ? 'Tienda no disponible' : 'Tienda');
      },
    });
  }

  protected reintentar(): void {
    this.cargar(this.slug());
  }
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function guardar(clave: string, valor: string): void {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    /* modo privado o almacenamiento bloqueado: el carrito vive solo en memoria */
  }
}

function leerCarrito(t: TiendaPublica): Map<number, number> {
  const disponibles = new Set(t.productos.filter((p) => !p.agotado).map((p) => p.id));
  try {
    const guardado = JSON.parse(leer(`goods.tienda.${t.slug}.carrito`) ?? '[]') as [number, number][];
    return new Map(
      guardado.filter(
        ([id, n]) => disponibles.has(id) && Number.isInteger(n) && n > 0 && n <= MAX_POR_PRODUCTO,
      ),
    );
  } catch {
    return new Map();
  }
}

/** La misma frase que `textoAltaPromociones` del backend (el webhook de WhatsApp la reconoce). */
function textoAltaPromociones(negocio: string): string {
  return `✅ Acepto recibir novedades y promociones de ${negocio} por WhatsApp.`;
}
