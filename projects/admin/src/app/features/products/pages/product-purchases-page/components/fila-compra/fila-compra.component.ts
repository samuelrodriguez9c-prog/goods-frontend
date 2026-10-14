import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { EstadoCompra } from '../../../../shared/modelos';
import { icono } from '../../../../shared/ui/iconos';
import { AVATAR_CANCELADA, BARRA_ESTADO } from '../../compras.modelo';

export interface FilaCompra {
  id: number;
  proveedor: string;
  iniciales: string;
  /** [fondo, tinta] del proveedor. */
  tono: [string, string];
  estado: EstadoCompra;
  /** Código · factura · líneas y unidades. */
  detalle: string;
  conFactura: boolean;
  total: string;
  /** "hace 3 d", "recibida hace 2 días", "cancelada". */
  edad: string;
  atrasada: boolean;
}

/**
 * Fila de la lista de Compras. Seleccionada o con el cursor encima se pega a la
 * hoja (sin margen derecho, esquinas redondeadas hacia afuera); una pendiente con
 * el cursor encima muestra "Recibir" en lugar de la edad.
 */
@Component({
  selector: 'app-fila-compra',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative block transition-[margin] duration-260 ease-[cubic-bezier(.2,.8,.2,1)]',
    '[class.mr-7]': '!resaltada()',
    '(mouseenter)': 'encima.set(true)',
    '(mouseleave)': 'encima.set(false)',
  },
  template: `
    @let f = fila();
    @let cancelada = f.estado === 'cancelada';
    <div (click)="abrir.emit()"
      class="relative grid cursor-pointer grid-cols-[4px_34px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-l-xl py-2 pl-2.5 select-none transition-[background-color,border-radius,padding] duration-260 ease-[cubic-bezier(.2,.8,.2,1)]"
      [class]="resaltada() ? 'rounded-r-none bg-white pr-[30px]' : 'rounded-r-xl bg-transparent pr-3.5'">
      <span class="h-7 w-[3px] rounded-full" [class]="barraEstado[f.estado]"></span>
      <span class="flex size-8.5 shrink-0 items-center justify-center rounded-[10px] font-[Archivo] text-[12.5px] font-semibold"
        [class]="cancelada ? avatarCancelada : ''" [style.background]="cancelada ? null : f.tono[0]" [style.color]="cancelada ? null : f.tono[1]">{{ f.iniciales }}</span>
      <span class="flex min-w-0 flex-col gap-0.5">
        <span class="flex min-w-0 items-center gap-1.5">
          <span class="truncate text-[13.5px] text-[#111827]" [class]="seleccionada() ? 'font-semibold' : 'font-medium'">{{ f.proveedor }}</span>
          @if (f.conFactura) {
            <tabler-icon [icon]="icono('paperclip')" [size]="13" [stroke]="2" title="Tiene factura adjunta" class="text-[#9ca3af]" />
          }
        </span>
        <span class="truncate text-[11.5px] text-[#8a8a8a] tabular-nums">{{ f.detalle }}</span>
      </span>
      <span class="flex h-9 min-w-24 flex-col items-end justify-center gap-[3px]">
        <span class="text-[12.5px] font-semibold whitespace-nowrap tabular-nums"
          [class]="cancelada ? 'text-[#9ca3af] line-through' : 'text-[#111827]'">{{ f.total }}</span>
        @if (botonRecibir()) {
          <button type="button" (click)="$event.stopPropagation(); recibir.emit()"
            class="flex h-5 animate-[fade-in_.15s] cursor-pointer items-center gap-1 rounded-full bg-[#303030] px-2 text-[11px] font-medium text-white">
            <tabler-icon [icon]="icono('package-import')" [size]="12" [stroke]="2" />Recibir
          </button>
        } @else {
          <span class="text-[11px] whitespace-nowrap" [class]="f.atrasada ? 'font-semibold text-[#b42318]' : 'font-medium text-[#8a8a8a]'">{{ f.edad }}</span>
        }
      </span>
    </div>
    @if (resaltada()) {
      <span class="pointer-events-none absolute -top-3 right-4 z-[4] size-3 animate-[fade-in_.2s] [background:radial-gradient(circle_at_0_0,_transparent_11.5px,_#fff_12px)]"></span>
      <span class="pointer-events-none absolute right-4 -bottom-3 z-[4] size-3 animate-[fade-in_.2s] [background:radial-gradient(circle_at_0_100%,_transparent_11.5px,_#fff_12px)]"></span>
    }
  `,
})
export class FilaCompraComponent {
  readonly fila = input.required<FilaCompra>();
  readonly seleccionada = input(false);
  /** Con permiso y sin cambios sin guardar en esta compra. */
  readonly puedeRecibir = input(false);
  readonly abrir = output<void>();
  readonly recibir = output<void>();

  protected readonly icono = icono;
  protected readonly barraEstado = BARRA_ESTADO;
  protected readonly avatarCancelada = AVATAR_CANCELADA;
  protected readonly encima = signal(false);
  protected readonly resaltada = computed(() => this.seleccionada() || this.encima());
  protected readonly botonRecibir = computed(() => this.encima() && this.puedeRecibir() && this.fila().estado === 'pendiente');
}
