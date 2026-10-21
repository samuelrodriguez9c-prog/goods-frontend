import { ChangeDetectionStrategy, Component, computed, inject, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogoStore } from '../../../products/shared/catalogo.store';
import { cop, norm, num } from '../../../products/shared/formato';
import { IcComponent } from '../../../products/shared/ui/ic/ic.component';
import { BorradorPedido } from '../../shared/ventas.modelos';
import { VentasStore } from '../../shared/ventas.store';

/**
 * Productos del pedido en el formulario: buscador en grilla (nombre o SKU,
 * con el stock disponible) y las líneas con −/+ que avisan cuando la
 * cantidad pasa lo que hay. Al editar un pedido, lo que ya tenía apartado
 * cuenta como disponible.
 */
@Component({
  selector: 'app-buscador-productos',
  standalone: true,
  imports: [IcComponent, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3.5' },
  template: `
    @let d = borrador();
    <div class="relative flex flex-col gap-2">
      <label class="flex items-center gap-2 rounded-[10px] bg-[#fafafa] px-3 shadow-[0_0_0_1px_#e5e5e5] has-[input:focus]:bg-white has-[input:focus]:shadow-[0_0_0_1px_#d4d4d4]">
        <app-ic nombre="search" [size]="15" class="text-gray-400" />
        <input class="min-w-0 flex-1 border-0 bg-transparent py-[9px] text-[13px] outline-none" placeholder="Busca un producto por nombre o SKU" [ngModel]="q()" (ngModelChange)="q.set($event)" />
      </label>
      <div class="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-1.5">
        @for (x of resultados(); track x.p.id) {
          <button type="button" (click)="agregar(x.p.id)"
            class="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl bg-white px-2.5 py-2 text-left shadow-[0_0_0_1px_#efefef] transition-[box-shadow,transform] duration-200 hover:-translate-y-px hover:shadow-[0_0_0_1px_#d4d4d4,0_8px_18px_-12px_rgba(0,0,0,.3)]">
            <span class="flex min-w-0 flex-col gap-px">
              <span class="truncate text-[12.5px] font-semibold text-gray-900">{{ x.p.nombre }}</span>
              <span class="text-[11px]" [style.color]="x.stockC">{{ cop(x.p.precio) }} · {{ x.stock }}</span>
            </span>
            @if (x.ya) {
              <span class="rounded-full bg-[#303030] px-[7px] text-[11px] leading-[18px] font-semibold text-white">{{ x.ya }}</span>
            } @else {
              <app-ic nombre="plus" [size]="15" class="text-gray-500" />
            }
          </button>
        } @empty {
          <p class="m-0 text-[12.5px] text-gray-400">Ningún producto activo coincide.</p>
        }
      </div>
    </div>
    @for (it of d.items; track it.productoId; let i = $index) {
      @let hay = disp(it.productoId);
      @let over = it.cantidad > hay;
      <div class="grid animate-[mov-in_300ms_cubic-bezier(.2,.8,.2,1)_both] grid-cols-[minmax(0,1fr)_auto_auto_28px] items-center gap-2.5 rounded-xl bg-white py-2 pr-2 pl-2.5 shadow-[0_0_0_1px_#efefef]">
        <span class="flex min-w-0 flex-col gap-px">
          <span class="truncate text-[13px] font-semibold text-gray-900">{{ nombre(it.productoId) }}</span>
          @if (over) {
            <span class="text-[11.5px] text-[#b42318]">Pides {{ it.cantidad }}, quedan {{ num(hay) }} · el sistema lo rechaza</span>
          } @else {
            <span class="text-[11.5px] text-[#8a8a8a]">{{ cop(it.precioUnitario) }} c/u · Hay {{ num(hay) }}</span>
          }
        </span>
        <span class="flex items-center gap-0.5 rounded-[9px] bg-[#f1f1f1] p-0.5" [style.box-shadow]="'0 0 0 1px ' + (over ? '#d82c0d' : '#e3e3e3')">
          <button type="button" class="flex size-[26px] cursor-pointer items-center justify-center rounded-[7px] hover:bg-white" (click)="cantidad(i, it.cantidad - 1)"><app-ic nombre="minus" [size]="13" /></button>
          <input class="h-[26px] w-10 rounded-[7px] border-0 bg-white text-center text-[13px] font-semibold tabular-nums outline-none" inputmode="numeric"
            [ngModel]="it.cantidad" (ngModelChange)="cantidad(i, +$event || 1)" />
          <button type="button" class="flex size-[26px] cursor-pointer items-center justify-center rounded-[7px] hover:bg-white" (click)="cantidad(i, it.cantidad + 1)"><app-ic nombre="plus" [size]="13" /></button>
        </span>
        <span class="w-[78px] text-right text-[13px] font-semibold tabular-nums">{{ cop(it.cantidad * it.precioUnitario) }}</span>
        <button type="button" class="gp-btn-icono size-7 hover:text-[#b42318]" title="Quitar" (click)="cantidad(i, 0)"><app-ic nombre="x" [size]="14" /></button>
      </div>
    } @empty {
      <div class="flex flex-col items-center gap-1.5 rounded-[14px] border border-dashed p-[22px] text-center" [style.border-color]="intento() ? '#ffb3a8' : '#efefef'">
        <app-ic nombre="cart" [size]="20" class="text-gray-400" />
        <span class="text-[13px] text-gray-500">Agrega productos desde el buscador.</span>
        @if (intento()) {
          <span class="text-xs text-[#b42318]">Agrega al menos un producto</span>
        }
      </div>
    }
  `,
})
export class BuscadorProductosComponent {
  private readonly cat = inject(CatalogoStore);
  private readonly v = inject(VentasStore);
  readonly borrador = model.required<BorradorPedido>();
  readonly intento = input(false);
  /** Lo que el pedido ya tiene apartado (al editar), por producto: cuenta como disponible. */
  readonly apartado = input<Record<number, number>>({});
  protected readonly q = signal('');
  protected readonly cop = cop;
  protected readonly num = num;

  protected readonly disp = (pid: number) => this.v.disponible(pid) + (this.apartado()[pid] ?? 0);
  protected readonly nombre = (pid: number) => this.cat.producto(pid)?.nombre ?? 'Producto';

  protected readonly resultados = computed(() => {
    const d = this.borrador(), qq = norm(this.q());
    return this.cat
      .productos()
      .filter((p) => p.estado !== 'descontinuado' && (!qq || norm(p.nombre + ' ' + (p.sku ?? '')).includes(qq)))
      .slice(0, 6)
      .map((p) => {
        const st = this.cat.stockDe(p.id), hay = this.disp(p.id), ya = d.items.find((it) => it.productoId === p.id);
        return {
          p,
          stock: hay > 0 ? num(hay) + ' disp.' : 'Sin stock',
          stockC: hay <= 0 ? '#b42318' : hay < st.minimo ? '#b45309' : '#087b5d',
          ya: ya ? '×' + ya.cantidad : '',
        };
      });
  });

  protected agregar(pid: number): void {
    const pr = this.cat.producto(pid);
    if (!pr) return;
    this.borrador.update((d) => {
      const ex = d.items.findIndex((it) => it.productoId === pid);
      return {
        ...d,
        items: ex >= 0 ? d.items.map((it, i) => (i === ex ? { ...it, cantidad: it.cantidad + 1 } : it)) : [...d.items, { productoId: pid, cantidad: 1, precioUnitario: pr.precio }],
      };
    });
    this.q.set('');
  }

  protected cantidad(i: number, n: number): void {
    this.borrador.update((d) => ({
      ...d,
      items: n < 1 ? d.items.filter((_, j) => j !== i) : d.items.map((it, j) => (j === i ? { ...it, cantidad: n } : it)),
    }));
  }
}
