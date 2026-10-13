import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { cop } from '../../../shared/formato';
import { AccionProveedor, inicialesDe } from '../../../shared/proveedores.util';
import { icono } from '../../../shared/ui/iconos';
import { FilaProveedor, tonoAvatar } from '../proveedores.modelo';
import { AccionProveedorComponent } from './accion-proveedor.component';

/** Tarjeta de la vista Tarjetas: gasto total, próxima entrega y próxima acción. */
@Component({
  selector: 'app-tarjeta-proveedor',
  standalone: true,
  imports: [TablerIconComponent, AccionProveedorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex cursor-pointer animate-[mov-in_360ms_cubic-bezier(.2,.8,.2,1)_both] flex-col gap-3 rounded-2xl bg-white p-3.5 transition-[box-shadow,transform] duration-250 ease-[cubic-bezier(.2,.8,.2,1)]',
    '[class]': 'clases()',
    '(click)': 'abrir.emit()',
    '(mouseenter)': 'encima.set(true)',
    '(mouseleave)': 'encima.set(false)',
  },
  template: `
    @let f = fila();
    @let p = f.proveedor;
    <div class="flex items-center gap-2.5">
      <span class="flex size-10 shrink-0 items-center justify-center rounded-xl font-[Archivo] text-[14px] font-semibold"
        [style.background]="tono()[0]" [style.color]="tono()[1]">{{ iniciales() }}</span>
      <span class="flex min-w-0 flex-col gap-[1px]">
        <span class="truncate text-[13.5px] font-semibold text-[#111827]">{{ p.nombre }}</span>
        <span class="flex items-center gap-[5px] text-[11.5px] text-[#8a8a8a]">
          <span class="size-1.5 shrink-0 rounded-full" [class]="p.activo ? 'bg-[#29845a]' : 'bg-[#9ca3af]'"></span>{{ f.detalle }}
        </span>
      </span>
    </div>
    <div class="flex items-end justify-between gap-2">
      <span class="flex flex-col gap-[1px]">
        <span class="text-[11px] text-[#9ca3af]">Gasto total</span>
        <span class="font-[Archivo] text-[17px] font-semibold tabular-nums" [class]="f.total ? 'text-[#303030]' : 'text-[#b5b5b5]'">{{ total() }}</span>
      </span>
      <span class="relative mb-[7px] block h-1 w-16 rounded-full bg-[#efefef]">
        <span class="absolute top-0 bottom-0 left-0 rounded-full" [class]="p.activo ? 'bg-[#303030]' : 'bg-[#b5b5b5]'" [style.width.%]="f.proporcion"></span>
      </span>
    </div>
    <div class="flex items-center justify-between gap-2 border-t border-t-[#f1f1f1] pt-2.5">
      <span class="flex min-w-0 items-center gap-[5px] truncate text-[11.5px] font-medium" [class]="f.proximaPronto ? 'text-[#00605b]' : 'text-[#6b7280]'">
        <tabler-icon [icon]="icono('calendar-event')" [size]="13" />{{ f.proxima }}
      </span>
      <app-accion-proveedor [accion]="f.accion" (ejecutar)="ejecutar.emit($event)" />
    </div>
  `,
})
export class TarjetaProveedorComponent {
  readonly fila = input.required<FilaProveedor>();
  readonly seleccionada = input(false);
  readonly abrir = output<void>();
  readonly ejecutar = output<AccionProveedor>();

  protected readonly icono = icono;
  protected readonly encima = signal(false);
  protected readonly iniciales = computed(() => inicialesDe(this.fila().proveedor.nombre));
  protected readonly tono = computed(() => tonoAvatar(this.fila().proveedor.id, this.fila().proveedor.activo));
  protected readonly total = computed(() => (this.fila().total ? cop(this.fila().total) : '—'));
  protected readonly clases = computed(() => {
    // Con el cursor encima (y sin seleccionar) sube 2 px.
    const estado = this.seleccionada()
      ? 'shadow-[0_0_0_1.5px_#303030,0_14px_30px_-18px_rgba(0,0,0,.35)] [transform:translateY(0)]'
      : this.encima()
        ? 'shadow-[0_0_0_1px_#e0e0e0,0_12px_26px_-18px_rgba(0,0,0,.28)] [transform:translateY(-2px)]'
        : 'shadow-[0_0_0_1px_#ebebeb] [transform:translateY(0)]';
    return estado + (this.fila().proveedor.activo ? '' : ' opacity-70');
  });
}
