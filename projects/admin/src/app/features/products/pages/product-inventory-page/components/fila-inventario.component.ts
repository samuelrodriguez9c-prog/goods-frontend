import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { num } from '../../../shared/formato';
import { Stock } from '../../../shared/modelos';
import { icono } from '../../../shared/ui/iconos';
import { Miniatura, Nivel, escalaStock } from '../inventario.modelo';
import { MiniaturaProductoComponent } from './miniatura-producto.component';

export interface FilaInventario {
  id: number;
  nombre: string;
  /** SKU · proveedor o categoría · reservadas. */
  detalle: string;
  miniatura: Miniatura;
  stock: Stock;
  nivel: Nivel;
}

const BARRA_NIVEL: Record<Nivel, string> = { sin: 'bg-[#d82c0d]', bajo: 'bg-[#ffb904]', ok: 'bg-[#29845a]' };
const RELLENO_NIVEL: Record<Nivel, string> = { sin: 'bg-[#d82c0d]', bajo: 'bg-[#ffb904]', ok: 'bg-[#303030]' };
const CIFRA_NIVEL: Record<Nivel, string> = { sin: 'text-[#b42318]', bajo: 'text-[#8a5a00]', ok: 'text-[#303030]' };

/**
 * Fila de la lista de Inventario. Seleccionada o con el cursor encima se pega a
 * la hoja (sin margen derecho, esquinas redondeadas hacia afuera); con permiso,
 * el cursor muestra los botones −1 / +1.
 */
@Component({
  selector: 'app-fila-inventario',
  standalone: true,
  imports: [TablerIconComponent, MiniaturaProductoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative block transition-[margin] duration-260 ease-[cubic-bezier(.2,.8,.2,1)]',
    '[class.mr-7]': '!resaltada()',
    '(mouseenter)': 'encima.set(true)',
    '(mouseleave)': 'encima.set(false)',
  },
  template: `
    @let f = fila();
    <div (click)="abrir.emit()"
      class="relative grid cursor-pointer grid-cols-[4px_34px_minmax(0,1fr)_96px] items-center gap-2.5 rounded-l-xl py-2 pl-2.5 select-none transition-[background-color,border-radius,padding] duration-260 ease-[cubic-bezier(.2,.8,.2,1)]"
      [class]="(resaltada() ? 'rounded-r-none pr-[30px] ' : 'rounded-r-xl pr-3.5 ') + (destello() ? 'bg-[#e6fbf9]' : resaltada() ? 'bg-white' : 'bg-transparent')">
      <span class="h-7 w-[3px] rounded-full" [class]="barraNivel[f.nivel]"></span>
      <app-miniatura-producto [miniatura]="f.miniatura" tamano="fila" />
      <span class="flex min-w-0 flex-col gap-0.5">
        <span class="truncate text-[13.5px] text-[#111827]" [class]="seleccionada() ? 'font-semibold' : 'font-medium'">{{ f.nombre }}</span>
        <span class="truncate text-[11.5px] text-[#8a8a8a]">{{ f.detalle }}</span>
      </span>
      <span class="flex h-8.5 w-24 flex-col items-end justify-center gap-[5px]">
        @if (botones()) {
          <span class="flex animate-[fade-in_.15s] items-center gap-1">
            <button type="button" (click)="$event.stopPropagation(); ajustar.emit(-1)" title="Restar 1"
              class="flex size-7 cursor-pointer items-center justify-center rounded-full bg-[#f1f1f1] text-[#303030] hover:bg-[#e3e3e3]!"
              [class.opacity-35]="f.stock.disponible <= 0">
              <tabler-icon [icon]="icono('minus')" [size]="14" [stroke]="2" />
            </button>
            <span class="min-w-7 text-center text-[12.5px] font-semibold tabular-nums" [class]="cifraNivel[f.nivel]">{{ unidades() }}</span>
            <button type="button" (click)="$event.stopPropagation(); ajustar.emit(1)" title="Sumar 1"
              class="flex size-7 cursor-pointer items-center justify-center rounded-full bg-[#303030] text-white hover:bg-[#1a1a1a]!">
              <tabler-icon [icon]="icono('plus')" [size]="14" [stroke]="2" />
            </button>
          </span>
        } @else {
          <span class="flex items-baseline gap-[5px] whitespace-nowrap">
            <span class="text-[10.5px] text-[#9ca3af] tabular-nums">mín. {{ f.stock.minimo }}</span>
            <span class="text-[12.5px] font-semibold tabular-nums" [class]="cifraNivel[f.nivel]">{{ unidades() }}</span>
          </span>
          <span class="relative block h-1 w-18 rounded-full transition-[background-color] duration-260 ease-[ease]"
            [class]="resaltada() ? 'bg-[#efefef]' : 'bg-[#e2e2e2]'">
            <span class="absolute top-0 bottom-0 left-0 rounded-full transition-[width] duration-600 ease-[cubic-bezier(.2,.8,.2,1)]"
              [class]="rellenoNivel[f.nivel]" [style.width.%]="relleno()"></span>
            @if (f.stock.minimo > 0) {
              <span class="absolute -top-0.5 -bottom-0.5 w-[1.5px] rounded-xs bg-[#8a8a8a]" [style.left.%]="posicionMinimo()"></span>
            }
          </span>
        }
      </span>
    </div>
    @if (resaltada()) {
      <span class="pointer-events-none absolute -top-3 right-4 z-[4] size-3 animate-[fade-in_.2s] [background:radial-gradient(circle_at_0_0,_transparent_11.5px,_#fff_12px)]"></span>
      <span class="pointer-events-none absolute right-4 -bottom-3 z-[4] size-3 animate-[fade-in_.2s] [background:radial-gradient(circle_at_0_100%,_transparent_11.5px,_#fff_12px)]"></span>
    }
  `,
})
export class FilaInventarioComponent {
  readonly fila = input.required<FilaInventario>();
  readonly seleccionada = input(false);
  /** Tiene el permiso inventario.editar (muestra −1 / +1). */
  readonly editable = input(false);
  /** Recién ajustada: fondo turquesa un instante. */
  readonly destello = input(false);
  readonly abrir = output<void>();
  readonly ajustar = output<number>();

  protected readonly icono = icono;
  protected readonly barraNivel = BARRA_NIVEL;
  protected readonly rellenoNivel = RELLENO_NIVEL;
  protected readonly cifraNivel = CIFRA_NIVEL;
  protected readonly encima = signal(false);
  protected readonly resaltada = computed(() => this.seleccionada() || this.encima());
  protected readonly botones = computed(() => this.encima() && this.editable());
  protected readonly unidades = computed(() => num(this.fila().stock.disponible) + ' u');
  protected readonly relleno = computed(() => {
    const s = this.fila().stock;
    return Math.max(s.disponible > 0 ? 4 : 0, Math.min(100, (s.disponible / escalaStock(s)) * 100));
  });
  protected readonly posicionMinimo = computed(() => (this.fila().stock.minimo / escalaStock(this.fila().stock)) * 100);
}
