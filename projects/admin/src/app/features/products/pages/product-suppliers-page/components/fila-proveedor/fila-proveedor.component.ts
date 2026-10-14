import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { cop } from '../../../../shared/formato';
import { AccionProveedor, inicialesDe } from '../../../../shared/proveedores.util';
import { FilaProveedor, tonoAvatar } from '../../proveedores.modelo';
import { AccionProveedorComponent } from '../accion-proveedor/accion-proveedor.component';

/**
 * Fila de la vista Lista. Seleccionada o con el cursor encima se pega a la hoja
 * (sin margen derecho, esquinas redondeadas hacia afuera).
 */
@Component({
  selector: 'app-fila-proveedor',
  standalone: true,
  imports: [AccionProveedorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative block transition-[margin] duration-260 ease-[cubic-bezier(.2,.8,.2,1)]',
    '[class.mr-7]': '!resaltada()',
    '(mouseenter)': 'encima.set(true)',
    '(mouseleave)': 'encima.set(false)',
  },
  template: `
    @let f = fila();
    @let p = f.proveedor;
    <div (click)="abrir.emit()"
      class="relative grid cursor-pointer grid-cols-[4px_36px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-l-xl py-2 pl-2.5 select-none transition-[background-color,border-radius,padding] duration-260 ease-[cubic-bezier(.2,.8,.2,1)]"
      [class]="resaltada() ? 'rounded-r-none bg-white pr-[30px]' : 'rounded-r-xl bg-transparent pr-3.5'">
      <span class="h-7.5 w-[3px] rounded-full" [class]="p.activo ? 'bg-[#29845a]' : 'bg-[#9ca3af]'"></span>
      <span class="flex size-9 shrink-0 items-center justify-center rounded-[11px] font-[Archivo] text-[13px] font-semibold"
        [style.background]="tono()[0]" [style.color]="tono()[1]">{{ iniciales() }}</span>
      <span class="flex min-w-0 flex-col gap-0.5">
        <span class="flex min-w-0 items-center gap-1.5">
          <span class="truncate text-[13.5px] text-[#111827]" [class]="seleccionada() ? 'font-semibold' : 'font-medium'">{{ p.nombre }}</span>
          @if (!p.activo) {
            <span class="shrink-0 rounded-md bg-[#e3e3e3] px-1.5 text-[10.5px] leading-[17px] font-medium text-[#4b5563]">Inactivo</span>
          }
        </span>
        <span class="truncate text-[11.5px] text-[#8a8a8a]">{{ f.detalle }}</span>
      </span>
      <span class="flex flex-col items-end gap-[5px]">
        <app-accion-proveedor [accion]="f.accion" (ejecutar)="ejecutar.emit($event)" />
        <span class="text-[11px] font-medium whitespace-nowrap tabular-nums" [class]="f.total ? 'text-[#303030]' : 'text-[#b5b5b5]'">{{ total() }}</span>
      </span>
    </div>
    @if (resaltada()) {
      <span class="pointer-events-none absolute -top-3 right-4 z-[4] size-3 animate-[fade-in_.2s] [background:radial-gradient(circle_at_0_0,_transparent_11.5px,_#fff_12px)]"></span>
      <span class="pointer-events-none absolute right-4 -bottom-3 z-[4] size-3 animate-[fade-in_.2s] [background:radial-gradient(circle_at_0_100%,_transparent_11.5px,_#fff_12px)]"></span>
    }
  `,
})
export class FilaProveedorComponent {
  readonly fila = input.required<FilaProveedor>();
  readonly seleccionada = input(false);
  readonly abrir = output<void>();
  readonly ejecutar = output<AccionProveedor>();

  protected readonly encima = signal(false);
  protected readonly resaltada = computed(() => this.seleccionada() || this.encima());
  protected readonly iniciales = computed(() => inicialesDe(this.fila().proveedor.nombre));
  protected readonly tono = computed(() => tonoAvatar(this.fila().proveedor.id, this.fila().proveedor.activo));
  protected readonly total = computed(() => (this.fila().total ? cop(this.fila().total) : '—'));
}
