import { ChangeDetectionStrategy, Component, computed, inject, input, model, output, signal } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { CatalogoStore } from '../../../shared/catalogo.store';
import { codigoCompra, cop, fecha, hace, num, pl } from '../../../shared/formato';
import { statProveedor } from '../../../shared/proveedores.util';
import { icono } from '../../../shared/ui/iconos';
import { ESTADO_COMPRA, FiltroCompras } from '../proveedores.modelo';

const FILTROS: { k: FiltroCompras; label: string }[] = [
  { k: 'todas', label: 'Todas' }, { k: 'pendiente', label: 'Pendientes' }, { k: 'recibida', label: 'Recibidas' }, { k: 'cancelada', label: 'Canceladas' },
];

/** Pestaña Compras: resumen, filtro por estado y las compras al proveedor (clic = ir a la compra). */
@Component({
  selector: 'app-pestana-compras',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex animate-[fade-in-up_.22s_ease-out] flex-col gap-3.5' },
  template: `
    @let r = resumen();
    <div class="grid grid-cols-[repeat(3,minmax(0,1fr))] overflow-hidden rounded-xl shadow-[0_0_0_1px_#ececec]">
      @for (x of r.cifras; track x.label) {
        <div class="-mr-[1px] border-r border-r-[#ececec] px-3.5 py-[11px]">
          <div class="text-[11.5px] text-[#6b7280]">{{ x.label }}</div>
          <div class="truncate font-[Archivo] text-[18px] font-semibold text-[#111827] tabular-nums">{{ x.valor }}</div>
        </div>
      }
    </div>

    <div class="relative grid grid-cols-[repeat(4,minmax(0,1fr))] rounded-xl bg-[#efefef] p-[3px]">
      <span class="absolute top-[3px] bottom-[3px] left-[3px] w-[calc((100%_-_6px)_/_4)] rounded-[9px] bg-white shadow-[0_1px_2px_rgba(0,0,0,.08),0_0_0_1px_rgba(0,0,0,.04)] transition-[transform] duration-340 ease-[cubic-bezier(.2,.8,.2,1)]"
        [style.transform]="'translateX(' + r.indice * 100 + '%)'"></span>
      @for (o of r.filtros; track o.k) {
        <button type="button" (click)="filtrar(o.k)"
          class="relative flex h-7.5 cursor-pointer items-center justify-center gap-1.5 text-[12.5px] whitespace-nowrap transition-[color] duration-200 ease-[ease]"
          [class]="o.k === filtro() ? 'font-semibold text-[#111827]' : 'font-medium text-[#6b7280]'">
          {{ o.label }}<span class="text-[10.5px] font-semibold text-[#9ca3af] tabular-nums">{{ o.n }}</span>
        </button>
      }
    </div>

    @if (r.lista.length) {
      <div class="flex flex-col gap-1.5">
        <!-- La clave incluye la vuelta: al cambiar el filtro se vuelven a montar y se repite la entrada. -->
        @for (c of r.lista; track c.id + '-' + vuelta()) {
          <button type="button" (click)="verCompra.emit(c.id)"
            class="relative grid animate-[mov-in_380ms_cubic-bezier(.2,.8,.2,1)_both] cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-[14px] bg-white px-3.5 py-3 text-left shadow-[0_0_0_1px_#efefef] [transition:box-shadow_.25s,_transform_.25s_cubic-bezier(.2,.8,.2,1)] hover:shadow-[0_0_0_1px_#e0e0e0,_0_10px_24px_-16px_rgba(0,_0,_0,_.3)]!"
            [class.opacity-55]="c.estado === 'cancelada'" [style.animation-delay.ms]="c.retraso">
            <span class="flex min-w-0 items-center gap-2">
              <span class="text-[13px] font-semibold text-[#111827] tabular-nums">{{ c.codigo }}</span>
              <span class="rounded-full px-[7px] text-[11px] leading-[18px] font-medium whitespace-nowrap" [class]="estadoCompra[c.estado].clases">{{ estadoCompra[c.estado].texto }}</span>
              <span class="truncate text-[12px] text-[#6b7280]">{{ c.factura }}</span>
            </span>
            <span class="text-right text-[13.5px] font-semibold text-[#111827] tabular-nums">{{ c.total }}</span>
            <span class="text-[11.5px] text-[#8a8a8a]">{{ c.fecha }} · {{ c.lineas }}</span>
            <span class="relative block h-1 w-18 justify-self-end rounded-full bg-[#efefef]">
              <span class="absolute top-0 bottom-0 left-0 rounded-full bg-[#303030]" [style.width.%]="c.proporcion"></span>
            </span>
          </button>
        }
      </div>
    } @else {
      <div class="flex animate-[fade-in-up_.25s_ease-out] flex-col items-center gap-2.5 rounded-2xl border border-dashed border-[#e0e0e0] p-7 text-center text-[13px] text-[#6b7280]">
        <span class="flex size-9 items-center justify-center rounded-full bg-[#f1f1f1] text-[#8a8a8a]">
          <tabler-icon [icon]="icono('file-invoice')" [size]="17" />
        </span>
        {{ r.hayCompras ? 'No hay compras en este estado.' : 'Todavía no le has comprado a este proveedor.' }}
      </div>
    }
  `,
})
export class PestanaComprasComponent {
  private readonly catalogo = inject(CatalogoStore);
  readonly proveedorId = input.required<number>();
  /** Se conserva en la página al cambiar de pestaña o de proveedor. */
  readonly filtro = model<FiltroCompras>('todas');
  readonly verCompra = output<number>();

  protected readonly icono = icono;
  protected readonly estadoCompra = ESTADO_COMPRA;
  /** Cambia con cada filtro para repetir la animación de entrada. */
  protected readonly vuelta = signal(0);

  protected readonly resumen = computed(() => {
    const stat = statProveedor(this.catalogo, this.proveedorId()), filtro = this.filtro(), hoy = this.catalogo.hoy();
    const promedio = stat.recibidas.length ? stat.total / stat.recibidas.length : 0;
    const mayor = Math.max(1, ...stat.compras.map((c) => this.catalogo.totalCompra(c)));
    return {
      cifras: [
        { label: 'Total recibido', valor: cop(stat.total) },
        { label: 'Compras recibidas', valor: String(stat.recibidas.length) },
        { label: 'Ticket promedio', valor: promedio ? cop(promedio) : '—' },
      ],
      filtros: FILTROS.map((f) => ({ ...f, n: f.k === 'todas' ? stat.compras.length : stat.compras.filter((c) => c.estado === f.k).length })),
      indice: Math.max(0, FILTROS.findIndex((f) => f.k === filtro)),
      hayCompras: stat.compras.length > 0,
      lista: [...stat.compras]
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .filter((c) => filtro === 'todas' || c.estado === filtro)
        .map((c, i) => {
          const total = this.catalogo.totalCompra(c);
          return {
            id: c.id, estado: c.estado, codigo: codigoCompra(c.id), factura: c.numeroFactura || 'Sin N° de factura',
            fecha: fecha(c.fecha) + ' · ' + hace(c.fecha, hoy),
            lineas: pl(c.items.length, 'línea', 'líneas') + ' · ' + num(c.items.reduce((t, it) => t + it.cantidad, 0)) + ' u',
            total: cop(total), proporcion: Math.max(4, (total / mayor) * 100), retraso: Math.min(i, 10) * 35,
          };
        }),
    };
  });

  protected filtrar(k: FiltroCompras): void {
    if (this.filtro() === k) return;
    this.filtro.set(k);
    this.vuelta.update((n) => n + 1);
  }
}
