import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { icono } from '../../../../shared/ui/iconos';

/**
 * Tarjeta de las pestañas de la hoja: ícono, título y descripción arriba
 * (con una acción opcional a la derecha, `<button accion>`) y el contenido debajo.
 */
@Component({
  selector: 'app-tarjeta-hoja',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex flex-col gap-4.5 rounded-2xl border border-[#ebebeb] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,.03),_0_12px_28px_-22px_rgba(0,0,0,.28)]',
  },
  template: `
    <div class="flex items-start gap-3">
      <span class="flex size-8.5 shrink-0 items-center justify-center rounded-[10px] bg-[#f4f4f4] text-[#303030]">
        <tabler-icon [icon]="iconoTabler()" [size]="17" [stroke]="2" />
      </span>
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="text-[15px] font-semibold tracking-[-0.005em] text-[#111827]">{{ titulo() }}</span>
        <span class="text-[12px] leading-[17px] text-[#8a8a8a]">{{ descripcion() }}</span>
      </span>
      <ng-content select="[accion]" />
    </div>
    <ng-content />
  `,
})
export class TarjetaHojaComponent {
  /** Nombre del ícono (webfont del prototipo). */
  readonly icono = input.required<string>();
  readonly titulo = input.required<string>();
  readonly descripcion = input('');

  protected readonly iconoTabler = computed(() => icono(this.icono()));
}
