import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { CatalogoStore } from '../../../shared/catalogo.store';
import { codigoCompra, cop, fecha, hace, num } from '../../../shared/formato';
import { CEST, CompraV5, EstadoCompra } from '../../../shared/modelos';
import { icono } from '../../../shared/ui/iconos';

const INSIGNIA_ESTADO: Record<EstadoCompra, string> = {
  pendiente: 'bg-[#ffeb79] text-[#8a5a00]',
  recibida: 'bg-[#a4ffb6] text-[#0b5c3f]',
  cancelada: 'bg-[#e3e3e3] text-[#4b5563]',
};

/** Pestaña Compras de la hoja: resumen de lo recibido y las compras que traen el producto. */
@Component({
  selector: 'app-pestana-compras',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex animate-[fade-in-up_.22s_ease-out] flex-col gap-3.5' },
  template: `
    <div class="grid grid-cols-[repeat(3,minmax(0,1fr))] overflow-hidden rounded-xl shadow-[0_0_0_1px_#ececec]">
      @for (x of resumen(); track x.titulo) {
        <div class="-mr-[1px] border-r border-r-[#ececec] px-3.5 py-[11px]">
          <div class="text-[11.5px] text-[#6b7280]">{{ x.titulo }}</div>
          <div class="truncate font-[Archivo] text-[18px] font-semibold text-[#111827] tabular-nums">{{ x.valor }}</div>
        </div>
      }
    </div>
    @if (filas().length) {
      <div class="flex flex-col rounded-2xl border border-[#ebebeb] bg-white p-1.5 shadow-[0_1px_2px_rgba(0,0,0,.03),0_12px_28px_-22px_rgba(0,0,0,.28)]">
        @for (c of filas(); track c.id) {
          <button type="button" (click)="irCompra.emit(c.id)"
            class="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-xl px-3 py-[11px] text-left transition-[background-color] duration-200 ease-[ease] hover:bg-[#f7f7f7]!"
            [class.opacity-55]="c.estado === 'cancelada'">
            <span class="flex min-w-0 items-center gap-2">
              <span class="text-[13px] font-semibold text-[#111827] tabular-nums">{{ c.codigo }}</span>
              <span class="rounded-full px-[7px] text-[11px] leading-[18px] font-medium whitespace-nowrap" [class]="insignia[c.estado]">{{ c.etiqueta }}</span>
              <span class="truncate text-[12.5px] text-[#4b5563]">{{ c.proveedor }}</span>
            </span>
            <span class="text-right text-[13px] font-semibold text-[#111827] tabular-nums">{{ c.total }}</span>
            <span class="text-[11.5px] text-[#8a8a8a]">{{ c.fecha }}</span>
            <span class="text-right text-[11.5px] text-[#8a8a8a] tabular-nums">{{ c.cantidad }}</span>
          </button>
        }
      </div>
    } @else {
      <div class="rounded-2xl border border-dashed border-[#e0e0e0] p-7 text-center text-[13px] text-[#6b7280]">Este producto todavía no aparece en ninguna compra.</div>
    }
    @if (faltaReponer()) {
      <button type="button" (click)="reponer.emit()" [title]="permitido() ? '' : 'Necesitas el permiso compras.crear'"
        class="flex items-center gap-1.5 self-start rounded-lg bg-[#303030] px-3 py-[7px] text-[13px] font-medium text-white shadow-[inset_0_-1px_0_#000]"
        [class]="permitido() ? 'cursor-pointer' : 'cursor-not-allowed opacity-45'">
        <tabler-icon [icon]="icono('truck-delivery')" [size]="14" [stroke]="2" />Reponer lo que falta
      </button>
    }
  `,
})
export class PestanaComprasComponent {
  private readonly catalogo = inject(CatalogoStore);

  readonly productoId = input.required<number>();
  /** Compras que traen el producto, de la más nueva a la más vieja. */
  readonly compras = input.required<CompraV5[]>();
  /** Está bajo el mínimo y no hay compras pendientes: ofrece reponer. */
  readonly faltaReponer = input(false);
  /** Tiene el permiso compras.crear. */
  readonly permitido = input(false);
  readonly irCompra = output<number>();
  readonly reponer = output<void>();

  protected readonly icono = icono;
  protected readonly insignia = INSIGNIA_ESTADO;

  private readonly itemDe = (c: CompraV5) => c.items.find((it) => it.productoId === this.productoId())!;

  protected readonly resumen = computed(() => {
    const id = this.productoId(), recibidas = this.compras().filter((c) => c.estado === 'recibida');
    const ultima = recibidas[0], ultimoItem = ultima ? this.itemDe(ultima) : undefined, costo = this.catalogo.producto(id)?.costo;
    const total = recibidas.reduce((a, c) => a + c.items.filter((it) => it.productoId === id).reduce((b, it) => b + it.cantidad, 0), 0);
    return [
      { titulo: 'Última recibida', valor: ultima ? hace(ultima.fecha, this.catalogo.hoy()) : '—' },
      { titulo: 'Último costo', valor: ultimoItem ? cop(ultimoItem.precioUnitario) : costo != null ? cop(costo) : '—' },
      { titulo: 'Recibido en total', valor: num(total) + ' u' },
    ];
  });
  protected readonly filas = computed(() =>
    this.compras().map((c) => {
      const it = this.itemDe(c);
      return {
        id: c.id,
        estado: c.estado,
        etiqueta: CEST[c.estado].t,
        codigo: codigoCompra(c.id),
        proveedor: this.catalogo.proveedor(c.proveedorId)?.nombre ?? '—',
        fecha: fecha(c.fecha),
        cantidad: it.cantidad + ' u × ' + cop(it.precioUnitario),
        total: cop(it.cantidad * it.precioUnitario),
      };
    }),
  );
}
