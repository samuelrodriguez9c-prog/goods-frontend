import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { AccionFilaComponent } from '../../../../../../shared/ui/accion-fila/accion-fila.component';
import { AccionFila } from '../../../../shared/filas';
import { EstadoCompra } from '../../../../shared/modelos';
import { IcComponent } from '../../../../shared/ui/ic/ic.component';

export interface FilaCompra {
  id: number;
  proveedor: string;
  iniciales: string;
  /** [fondo, tinta] del proveedor. */
  tono: [string, string];
  estado: EstadoCompra;
  /** «C-0014». */
  codigo: string;
  lineas: number;
  /** N° de factura (o «adjunta» si solo hay archivo); `null` sin factura. */
  factura: string | null;
  /** Código · factura · líneas y unidades (para la búsqueda y las tarjetas). */
  detalle: string;
  conFactura: boolean;
  total: string;
  /** "hace 3 d", "recibida hace 2 días", "cancelada". */
  edad: string;
  atrasada: boolean;
}

/** Insignia de cada estado. */
const INS: Record<EstadoCompra, { t: string; icono: string; bg: string; fg: string }> = {
  pendiente: { t: 'Pendiente', icono: 'clock', bg: '#e0f2fe', fg: '#075985' },
  recibida: { t: 'Recibida', icono: 'check', bg: '#dcfce7', fg: '#0b5c3f' },
  cancelada: { t: 'Cancelada', icono: 'x', bg: '#e3e3e3', fg: '#4b5563' },
};

/**
 * Fila de la lista de Compras (`38px minmax(0,1fr) auto`, arriba): ícono con la
 * insignia del estado · proveedor · «C-0014 · ☰ 4 líneas» · la factura (o «Sin
 * factura» en ámbar; «No sumó stock» si se canceló) · a la derecha el total y
 * la fecha. Una pendiente con el cursor encima muestra el botón circular
 * «Recibir → +4 líneas». Seleccionada o con el cursor encima se pega a la hoja;
 * `despegada`: pasó bajo la cabecera del grupo (sigue blanca).
 */
@Component({
  selector: 'app-fila-compra',
  standalone: true,
  imports: [IcComponent, AccionFilaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative block transition-[margin] duration-260 ease-[cubic-bezier(.2,.8,.2,1)]',
    '[class.mr-7]': '!resaltada()',
    '[attr.data-sel]': "seleccionada() ? '1' : null",
    '(mouseenter)': 'encima.set(true)',
    '(mouseleave)': 'encima.set(false)',
  },
  template: `
    @let f = fila();
    @let r = resaltada();
    @let e = insignia();
    @let cancelada = f.estado === 'cancelada';
    <div (click)="abrir.emit()"
      class="relative grid cursor-pointer grid-cols-[38px_minmax(0,1fr)_auto] items-start gap-3 py-2.5 pl-2.5 select-none transition-[background-color,border-radius,padding] duration-260 ease-[cubic-bezier(.2,.8,.2,1)]"
      [class]="r ? 'rounded-l-xl rounded-r-none bg-white pr-[30px]' : 'rounded-xl pr-3.5 ' + (seleccionada() ? 'bg-white' : 'bg-transparent')">
      <span class="relative flex size-[38px] items-center justify-center rounded-[11px] text-[#6b7280] transition-[background-color] duration-260"
        [class]="r ? 'bg-[#f4f4f4]' : 'bg-[#e6e6e6]'">
        <app-ic nombre="file-invoice" [size]="17" />
        <span [title]="e.t" class="absolute -right-[3px] -bottom-[3px] flex size-[18px] items-center justify-center rounded-full transition-[box-shadow] duration-260"
          [style.background]="e.bg" [style.color]="e.fg" [style.box-shadow]="'0 0 0 2px ' + (r ? '#fff' : '#f1f1f1')">
          <app-ic [nombre]="e.icono" [size]="10" />
        </span>
      </span>
      <span class="flex min-w-0 flex-col gap-[5px]">
        <span class="min-w-0 truncate text-[13px] leading-[18px] text-[#111827]" [class]="seleccionada() ? 'font-semibold' : 'font-medium'">{{ f.proveedor }}</span>
        <span class="-mt-[3px] flex min-w-0 items-center gap-2 overflow-hidden text-xs leading-4 text-[#6b7280]">
          <span class="shrink-0 whitespace-nowrap">{{ f.codigo }}</span>
          <span class="inline-flex min-w-0 items-center gap-1 whitespace-nowrap"><app-ic nombre="list" [size]="12" class="shrink-0 text-[#9ca3af]" /><span class="truncate">{{ lineas() }}</span></span>
        </span>
        <span class="flex min-w-0 flex-wrap items-center gap-1">
          @if (cancelada) {
            <span class="inline-flex h-5 shrink-0 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium whitespace-nowrap text-[#4b5563]" [class]="r ? 'bg-[#f4f4f4]' : 'bg-[#e8e8e8]'">
              <app-ic nombre="circle-x" [size]="11" />No sumó stock
            </span>
          } @else if (f.factura) {
            <span class="inline-flex h-5 shrink-0 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium whitespace-nowrap text-[#4b5563]" [class]="r ? 'bg-[#f4f4f4]' : 'bg-[#e8e8e8]'">
              <app-ic nombre="paperclip" [size]="11" />Factura {{ f.factura }}
            </span>
          } @else {
            <span class="inline-flex h-5 shrink-0 items-center gap-1 rounded-md bg-[#fff6d1] px-1.5 text-[11px] font-medium whitespace-nowrap text-[#8a5a00]">
              <app-ic nombre="alert-triangle" [size]="11" />Sin factura
            </span>
          }
        </span>
      </span>
      @if (boton(); as b) {
        <app-accion-fila [accion]="b" (accionar)="recibir.emit()" />
      } @else {
        <span class="flex flex-col items-end gap-1.5 pt-px">
          <span class="text-[13px] font-semibold whitespace-nowrap tabular-nums" [class]="cancelada ? 'text-[#9ca3af]' : 'text-[#111827]'">{{ f.total }}</span>
          <span class="text-[11.5px] whitespace-nowrap" [class]="f.atrasada ? 'font-semibold text-[#b42318]' : 'font-medium text-[#9ca3af]'">{{ f.edad }}</span>
        </span>
      }
    </div>
    @if (r) {
      <span class="pointer-events-none absolute -top-3 right-4 z-[4] size-3 animate-[fade-in_.2s] [background:radial-gradient(circle_at_0_0,_transparent_11.5px,_#fff_12px)]"></span>
      <span class="pointer-events-none absolute right-4 -bottom-3 z-[4] size-3 animate-[fade-in_.2s] [background:radial-gradient(circle_at_0_100%,_transparent_11.5px,_#fff_12px)]"></span>
    }
  `,
})
export class FilaCompraComponent {
  readonly fila = input.required<FilaCompra>();
  readonly seleccionada = input(false);
  /** La seleccionada pasó bajo la cabecera del grupo o salió por abajo. */
  readonly despegada = input(false);
  /** Con permiso y sin cambios sin guardar en esta compra. */
  readonly puedeRecibir = input(false);
  readonly abrir = output<void>();
  readonly recibir = output<void>();

  protected readonly encima = signal(false);
  protected readonly resaltada = computed(() => (this.seleccionada() && !this.despegada()) || this.encima());
  protected readonly insignia = computed(() => INS[this.fila().estado]);
  protected readonly lineas = computed(() => {
    const n = this.fila().lineas;
    return `${n} ${n === 1 ? 'línea' : 'líneas'}`;
  });
  protected readonly boton = computed<AccionFila | null>(() => {
    const f = this.fila();
    if (!this.encima() || !this.puedeRecibir() || f.estado !== 'pendiente') return null;
    return { verbo: 'Recibir', nota: '+' + this.lineas(), icono: 'package-import', titulo: `Recibir ${f.codigo} y sumar el stock`, peso: 'fuerte' };
  });
}
