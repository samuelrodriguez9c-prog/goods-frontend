import { ChangeDetectionStrategy, Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import { IconMessageCircle, IconMinus, IconPlus, IconReceipt, IconSearch, IconSend, TablerIconComponent } from '@tabler/icons-angular';
import { ProductoMostrador } from '../../../../../../core/whatsapp/whatsapp.model';
import { cop } from '../../../../shared/secciones';
import { stockTexto } from '../../bandeja.utils';

type Pestana = 'para' | 'todos' | 'disp';

/**
 * Mostrador: selector de productos que sale del compositor de la bandeja.
 *
 * Lista maestra a la izquierda (nombre + precio, punto turquesa si el cliente
 * preguntó, ×n si ya está en el pedido) y detalle a la derecha (total, stock,
 * cantidad, "Al pedido" / "Mostrar"). En pantallas angostas el detalle cae
 * debajo (`auto-fit, minmax(240px,1fr)`).
 *
 * Teclado (con el foco dentro del Mostrador; al abrir va al buscador): ↑/↓ (y ←/→ sin búsqueda) elige ·
 * Enter muestra en el chat · Shift+Enter agrega al pedido con la cantidad
 * elegida · Esc cierra.
 */
@Component({
  selector: 'app-mostrador-productos',
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mostrador-productos.component.html',
  host: {
    class: 'absolute inset-x-3 bottom-[calc(100%-2px)] z-20 block',
    '(click)': '$event.stopPropagation()',
    // El teclado funciona con el foco en cualquier parte del Mostrador (no solo en el buscador).
    '(keydown)': 'tecla($event)',
  },
})
export class MostradorProductosComponent {
  readonly productos = input.required<ProductoMostrador[]>();
  /** ids por los que el cliente preguntó (los marca la IA o el equipo). */
  readonly interes = input<number[]>([]);
  /** Pedido en curso: productoId → cantidad. */
  readonly borrador = input<Record<number, number>>({});
  /** Primer nombre del cliente ("Para María"). */
  readonly cliente = input<string>('');
  /** Alto máximo (px): el del área de mensajes, para no salirse del chat. */
  readonly maxAlto = input<number | null>(null);

  readonly mostrar = output<number>();
  readonly agregar = output<{ productoId: number; cantidad: number }>();
  readonly cerrar = output<void>();

  protected readonly i = { buscar: IconSearch, menos: IconMinus, mas: IconPlus, pedido: IconReceipt, enviar: IconSend, pregunto: IconMessageCircle };
  protected readonly cop = cop;

  protected readonly q = signal('');
  protected readonly pestana = signal<Pestana | null>(null);
  protected readonly idx = signal(0);
  protected readonly cant = signal(1);
  private readonly buscador = viewChild<ElementRef<HTMLInputElement>>('buscador');

  private readonly enPestana = (p: ProductoMostrador, t: Pestana) =>
    t === 'para' ? this.interes().includes(p.id) || !!this.borrador()[p.id] : t === 'disp' ? p.stock !== 0 : true;

  /** Abre en "Para {cliente}" si hay algo que mostrar ahí. */
  protected readonly tab = computed<Pestana>(() => this.pestana() ?? (this.productos().some((p) => this.enPestana(p, 'para')) ? 'para' : 'todos'));

  protected readonly pestanas = computed(() => {
    const ps = this.productos();
    const t: { k: Pestana; label: string; n: number }[] = [
      { k: 'para', label: this.cliente() ? `Para ${this.cliente()}` : 'Sugeridos', n: ps.filter((p) => this.enPestana(p, 'para')).length },
      { k: 'todos', label: 'Todos', n: ps.length },
      { k: 'disp', label: 'Con stock', n: ps.filter((p) => p.stock !== 0).length },
    ];
    return t.filter((x) => x.k !== 'para' || x.n > 0);
  });

  protected readonly lista = computed(() => {
    const q = norm(this.q());
    // Con búsqueda se ignora la pestaña: se busca en todo el catálogo.
    return this.productos().filter((p) => (q ? norm(`${p.nombre} ${p.sku ?? ''}`).includes(q) : this.enPestana(p, this.tab())));
  });

  protected readonly sel = computed<ProductoMostrador | null>(() => {
    const l = this.lista();
    return l[Math.min(this.idx(), Math.max(0, l.length - 1))] ?? null;
  });

  protected readonly detalle = computed(() => {
    const p = this.sel();
    if (!p) return null;
    const n = this.cant();
    const ya = this.borrador()[p.id] ?? 0;
    return {
      p,
      total: cop(p.precio * n),
      unidad: n > 1 ? `${n} × ${cop(p.precio)}` : 'por unidad',
      linea: stockTexto(p) + (ya ? ` · ${ya} ya en el pedido` : ''),
      punto: p.stock === 0 ? 'bg-[#d4d4d4]' : p.stock !== null && p.stock < 10 ? 'bg-[#f59e0b]' : 'bg-[#29845a]',
      tinta: p.stock === 0 ? 'text-[#b45309]' : 'text-[#6b7280]',
      pregunto: this.interes().includes(p.id),
    };
  });

  constructor() {
    requestAnimationFrame(() => this.buscador()?.nativeElement.focus());
  }

  protected elegir(k: number): void {
    if (k !== this.idx()) this.cant.set(1);
    this.idx.set(k);
  }

  protected cambiarPestana(t: Pestana): void {
    this.pestana.set(t);
    this.idx.set(0);
    this.cant.set(1);
    this.buscador()?.nativeElement.focus();
  }

  protected buscar(v: string): void {
    this.q.set(v);
    this.idx.set(0);
  }

  protected sumar(d: 1 | -1): void {
    const p = this.sel();
    const tope = p?.stock ? p.stock : 99;
    this.cant.update((n) => Math.min(tope, Math.max(1, n + d)));
  }

  protected alPedido(): void {
    const p = this.sel();
    if (!p) return;
    this.agregar.emit({ productoId: p.id, cantidad: this.cant() });
    this.cant.set(1);
  }

  protected mostrarSel(): void {
    const p = this.sel();
    if (p) this.mostrar.emit(p.id);
  }

  protected tecla(e: KeyboardEvent): void {
    const n = this.lista().length || 1;
    const lateral = (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !this.q();
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || lateral) {
      e.preventDefault();
      const adelante = e.key === 'ArrowDown' || e.key === 'ArrowRight';
      this.elegir((Math.min(this.idx(), n - 1) + (adelante ? 1 : -1) + n) % n);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) this.alPedido();
      else this.mostrarSel();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.cerrar.emit();
    }
  }
}

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
