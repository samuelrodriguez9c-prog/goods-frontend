import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { AccionFilaComponent } from '../../../../../../shared/ui/accion-fila/accion-fila.component';
import { AccionFila } from '../../../../shared/filas';
import { cop } from '../../../../shared/formato';
import { AccionProveedor, inicialesDe } from '../../../../shared/proveedores.util';
import { IcComponent } from '../../../../shared/ui/ic/ic.component';
import { FilaProveedor } from '../../proveedores.modelo';

const DIA = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

/**
 * Fila de la vista Lista (`38px minmax(0,1fr) auto`, arriba): iniciales con la
 * insignia activo / inactivo · nombre · «NIT …» y 📅 los días de entrega · la
 * próxima acción como etiqueta · a la derecha lo comprado y la última compra.
 * Con el cursor encima, la derecha se cambia por el botón circular de la
 * próxima acción (Recibir → C-0014, Reponer, Comprar, Reactivar); «Al día»
 * no lleva botón. Seleccionada o con el cursor encima se pega a la hoja;
 * `despegada`: pasó bajo la cabecera del grupo (sigue blanca).
 */
@Component({
  selector: 'app-fila-proveedor',
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
    @let p = f.proveedor;
    @let r = resaltada();
    <div (click)="abrir.emit()"
      class="relative grid cursor-pointer grid-cols-[38px_minmax(0,1fr)_auto] items-start gap-3 py-2.5 pl-2.5 select-none transition-[background-color,border-radius,padding] duration-260 ease-[cubic-bezier(.2,.8,.2,1)]"
      [class]="r ? 'rounded-l-xl rounded-r-none bg-white pr-[30px]' : 'rounded-xl pr-3.5 ' + (seleccionada() ? 'bg-white' : 'bg-transparent')">
      <span class="relative flex size-[38px] items-center justify-center rounded-[11px] font-[Archivo] text-[14px] font-semibold text-[#6b7280] transition-[background-color] duration-260"
        [class]="r ? 'bg-[#f4f4f4]' : 'bg-[#e6e6e6]'">
        {{ iniciales() }}
        <span [title]="p.activo ? 'Activo' : 'Inactivo'" class="absolute -right-[3px] -bottom-[3px] flex size-[18px] items-center justify-center rounded-full transition-[box-shadow] duration-260"
          [style.background]="p.activo ? '#dcfce7' : '#e3e3e3'" [style.color]="p.activo ? '#0b5c3f' : '#4b5563'"
          [style.box-shadow]="'0 0 0 2px ' + (r ? '#fff' : '#f1f1f1')">
          <app-ic [nombre]="p.activo ? 'truck' : 'player-pause'" [size]="10" />
        </span>
      </span>
      <span class="flex min-w-0 flex-col gap-[5px]">
        <span class="min-w-0 truncate text-[13px] leading-[18px] text-[#111827]" [class]="seleccionada() ? 'font-semibold' : 'font-medium'">{{ p.nombre }}</span>
        <span class="-mt-[3px] flex min-w-0 items-center gap-2 overflow-hidden text-xs leading-4 text-[#6b7280]">
          <span class="shrink-0 whitespace-nowrap">{{ p.nit ? 'NIT ' + p.nit : 'Sin NIT' }}</span>
          @if (dias()) {
            <span class="inline-flex min-w-0 items-center gap-1 whitespace-nowrap"><app-ic nombre="calendar" [size]="12" class="shrink-0 text-[#9ca3af]" /><span class="truncate">{{ dias() }}</span></span>
          }
        </span>
        <span class="flex min-w-0 flex-wrap items-center gap-1">
          <span class="inline-flex h-5 shrink-0 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium whitespace-nowrap text-[#4b5563] transition-[background-color] duration-260"
            [class]="r ? 'bg-[#f4f4f4]' : 'bg-[#e8e8e8]'">
            <app-ic [nombre]="f.accion.icono" [size]="11" />{{ f.accion.texto }}
          </span>
        </span>
      </span>
      @if (encima() && boton(); as b) {
        <app-accion-fila [accion]="b" (accionar)="accionar()" />
      } @else {
        <span class="flex flex-col items-end gap-1.5 pt-px">
          <span class="text-[13px] font-semibold whitespace-nowrap tabular-nums" [style.color]="f.total ? '#111827' : '#9ca3af'">{{ total() }}</span>
          <span class="text-[11.5px] font-medium whitespace-nowrap text-[#9ca3af]">{{ f.ultima }}</span>
        </span>
      }
    </div>
    @if (r) {
      <span class="pointer-events-none absolute -top-3 right-4 z-[4] size-3 animate-[fade-in_.2s] [background:radial-gradient(circle_at_0_0,_transparent_11.5px,_#fff_12px)]"></span>
      <span class="pointer-events-none absolute right-4 -bottom-3 z-[4] size-3 animate-[fade-in_.2s] [background:radial-gradient(circle_at_0_100%,_transparent_11.5px,_#fff_12px)]"></span>
    }
  `,
})
export class FilaProveedorComponent {
  readonly fila = input.required<FilaProveedor>();
  readonly seleccionada = input(false);
  /** La seleccionada pasó bajo la cabecera del grupo o salió por abajo. */
  readonly despegada = input(false);
  readonly abrir = output<void>();
  readonly ejecutar = output<AccionProveedor>();

  protected readonly encima = signal(false);
  protected readonly resaltada = computed(() => (this.seleccionada() && !this.despegada()) || this.encima());
  protected readonly iniciales = computed(() => inicialesDe(this.fila().proveedor.nombre));
  protected readonly total = computed(() => (this.fila().total ? cop(this.fila().total) : '$0'));
  protected readonly dias = computed(() => this.fila().proveedor.diasEntrega.map((d) => DIA[d]).join(' · '));
  /** El círculo de la próxima acción (sin botón si está al día). */
  protected readonly boton = computed<AccionFila | null>(() => {
    const a = this.fila().accion;
    const n = this.fila().proveedor.nombre;
    switch (a.k) {
      case 'recibir':
        return { verbo: 'Recibir', nota: a.texto.replace(/^Recibir /, ''), icono: 'package-import', titulo: `${a.texto} y sumar el stock`, peso: 'fuerte' };
      case 'reponer':
        return { verbo: 'Reponer', nota: a.texto.replace(/^Reponer /, '') + ' bajos', icono: 'truck-delivery', titulo: `Comprarle a ${n} lo que está bajo el mínimo`, peso: 'fuerte' };
      case 'frio':
        return { verbo: 'Comprar', nota: a.texto.replace(/^Sin compras (hace )?/, '').replace(/^aún$/, 'nunca') + ' sin pedir', icono: 'shopping-cart-plus', titulo: `${a.texto}: armar una compra`, peso: 'suave' };
      default:
        return this.fila().proveedor.activo
          ? null
          : { verbo: 'Reactivar', nota: 'para comprar', icono: 'refresh', titulo: `Abrir ${n} para reactivarlo`, peso: 'suave' };
    }
  });

  protected accionar(): void {
    const a = this.fila().accion;
    if (a.activa) this.ejecutar.emit(a);
    else this.abrir.emit();
  }
}
