import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { icono as tabler } from '../../../shared/ui/iconos';

/**
 * Tarjeta de sección de la hoja: ícono, título y detalle arriba; el contenido
 * debajo. Un botón con el atributo `accion` va a la derecha del título.
 * `holgada` = más aire (tarjetas del formulario).
 */
@Component({
  selector: 'app-seccion-hoja',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex flex-col rounded-2xl border border-[#ebebeb] bg-white shadow-[0_1px_2px_rgba(0,0,0,.03),0_12px_28px_-22px_rgba(0,0,0,.28)]',
    '[class]': "holgada() ? 'gap-4.5 p-5' : 'gap-3.5 p-4.5'",
  },
  template: `
    <div class="flex items-start gap-3">
      <span class="flex size-8.5 shrink-0 items-center justify-center rounded-[10px] bg-[#f4f4f4] text-[#303030]">
        <tabler-icon [icon]="tabler(icono())" [size]="17" />
      </span>
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="text-[15px] font-semibold tracking-[-0.005em] text-[#111827]">{{ titulo() }}</span>
        <span class="text-[12px] leading-[17px] text-[#8a8a8a]">{{ detalle() }}</span>
      </span>
      <ng-content select="[accion]" />
    </div>
    <ng-content />
  `,
})
export class SeccionHojaComponent {
  readonly icono = input.required<string>();
  readonly titulo = input.required<string>();
  readonly detalle = input('');
  readonly holgada = input(false, { transform: booleanAttribute });
  protected readonly tabler = tabler;
}
