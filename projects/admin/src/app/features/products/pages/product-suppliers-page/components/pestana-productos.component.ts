import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { CatalogoStore } from '../../../shared/catalogo.store';
import { cop, hace, num, pl } from '../../../shared/formato';
import { nivelStock } from '../../../shared/modelos';
import { productosProveedor } from '../../../shared/proveedores.util';
import { icono } from '../../../shared/ui/iconos';
import { NIVEL_STOCK, miniaturaDe } from '../proveedores.modelo';
import { MiniaturaProductoComponent } from './miniatura-producto.component';

/**
 * Pestaña Productos: lo que se le ha comprado al proveedor, con su último costo,
 * la variación frente a la compra anterior y el estado del stock.
 */
@Component({
  selector: 'app-pestana-productos',
  standalone: true,
  imports: [TablerIconComponent, MiniaturaProductoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex animate-[fade-in-up_.22s_ease-out] flex-col gap-3' },
  template: `
    @let ps = productos();
    <div class="flex items-center justify-between gap-2.5 px-1">
      <span class="text-[12px] text-[#6b7280]">{{ pl(ps.length, 'producto', 'productos') }} que le has comprado</span>
      @if (porReponer()) {
        <button type="button" (click)="reponer.emit()" [title]="puedeComprar() ? '' : 'Necesitas el permiso compras.crear'"
          class="flex items-center gap-1.5 rounded-full bg-[#fff6d1] px-2.5 py-1 text-[12px] font-medium text-[#8a5a00] hover:[filter:brightness(.97)]"
          [class]="puedeComprar() ? 'cursor-pointer' : 'cursor-not-allowed'">
          <tabler-icon [icon]="icono('truck-delivery')" [size]="13" />{{ pl(porReponer(), 'necesita', 'necesitan') }} reposición · Reponer
        </button>
      }
    </div>
    @if (ps.length) {
      <div class="flex flex-col rounded-2xl border border-[#ebebeb] bg-white p-1.5 shadow-[0_1px_2px_rgba(0,0,0,.03),0_12px_28px_-22px_rgba(0,0,0,.28)]">
        @for (r of ps; track r.id) {
          <button type="button" (click)="verProducto.emit(r.id)"
            class="grid animate-[mov-in_380ms_cubic-bezier(.2,.8,.2,1)_both] cursor-pointer grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2.5 py-[9px] text-left transition-[background-color] duration-200 ease-[ease] hover:bg-[#f7f7f7]!"
            [style.animation-delay.ms]="r.retraso">
            <app-miniatura-producto [miniatura]="r.miniatura" />
            <span class="flex min-w-0 flex-col gap-0.5">
              <span class="flex min-w-0 items-center gap-[7px]">
                <span class="truncate text-[13px] font-semibold text-[#111827]">{{ r.nombre }}</span>
                <span class="shrink-0 rounded-full px-[7px] text-[10.5px] leading-[17px] font-medium" [class]="nivelStock[r.nivel].clases">{{ nivelStock[r.nivel].texto }}</span>
              </span>
              <span class="truncate text-[11.5px] text-[#8a8a8a]">{{ r.detalle }}</span>
            </span>
            <span class="flex flex-col items-end gap-0.5">
              <span class="flex items-center gap-1.5">
                @if (r.variacion; as v) {
                  <span title="Cambio frente a la compra anterior" class="rounded-full px-1.5 text-[10.5px] leading-[17px] font-semibold"
                    [class]="v.sube ? 'bg-[#fff1f0] text-[#b42318]' : 'bg-[#e6f6ec] text-[#087b5d]'">{{ v.texto }}</span>
                }
                <span class="text-[13px] font-semibold text-[#111827] tabular-nums">{{ r.precio }}</span>
              </span>
              <span class="text-[11px] text-[#9ca3af]">último costo · {{ r.fecha }}</span>
            </span>
          </button>
        }
      </div>
    } @else {
      <div class="rounded-2xl border border-dashed border-[#e0e0e0] p-7 text-center text-[13px] text-[#6b7280]">Cuando le compres algo, aquí verás qué productos te surte y a qué costo.</div>
    }
  `,
})
export class PestanaProductosComponent {
  private readonly catalogo = inject(CatalogoStore);
  readonly proveedorId = input.required<number>();
  readonly puedeComprar = input(false);
  readonly reponer = output<void>();
  readonly verProducto = output<number>();

  protected readonly icono = icono;
  protected readonly pl = pl;
  protected readonly nivelStock = NIVEL_STOCK;

  protected readonly productos = computed(() => {
    const hoy = this.catalogo.hoy();
    return productosProveedor(this.catalogo, this.proveedorId())
      .sort((a, b) => b.unidades - a.unidades)
      .map((x, i) => {
        const cambio = x.anterior != null && x.anterior !== x.actual ? (x.actual - x.anterior) / x.anterior : 0;
        return {
          id: x.p.id, nombre: x.p.nombre, miniatura: miniaturaDe(x.p, this.catalogo), nivel: nivelStock(this.catalogo.stockDe(x.p.id)),
          detalle: pl(x.veces, 'compra', 'compras') + ' · ' + num(x.unidades) + ' u en total',
          precio: cop(x.actual), fecha: hace(x.fecha, hoy),
          /** Variación del costo frente a la compra anterior (null = igual o sin anterior). */
          variacion: cambio ? { sube: cambio > 0, texto: (cambio > 0 ? '↑ ' : '↓ ') + Math.abs(Math.round(cambio * 100)) + ' %' } : null,
          retraso: Math.min(i, 10) * 35,
        };
      });
  });
  /** Productos bajo el mínimo o sin stock. */
  protected readonly porReponer = computed(() => this.productos().filter((r) => r.nivel !== 'ok').length);
}
