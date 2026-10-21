import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IcComponent } from '../ic/ic.component';

/**
 * Tarjeta blanca de formulario con ícono, título y ayuda (Cliente, Entrega,
 * Pago y notas; Contacto, Dirección). Los campos van como contenido; una
 * acción opcional a la derecha del título con `[accion]`.
 */
@Component({
  selector: 'app-tarjeta-icono',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'flex min-w-0 flex-col gap-3.5 rounded-2xl border border-[#ebebeb] bg-white p-[18px] shadow-[0_1px_2px_rgba(0,0,0,.03),0_12px_28px_-22px_rgba(0,0,0,.28)]',
  },
  template: `
    <div class="flex items-start gap-3">
      <span class="flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[#f4f4f4] text-[#303030]"><app-ic [nombre]="icono()" [size]="17" /></span>
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="text-[15px] font-semibold tracking-[-.005em] text-gray-900">{{ titulo() }}</span>
        @if (sub()) {
          <span class="text-[12px] leading-[17px] text-[#8a8a8a]">{{ sub() }}</span>
        }
      </span>
      <ng-content select="[accion]" />
    </div>
    <ng-content />
  `,
})
export class TarjetaIconoComponent {
  readonly icono = input.required<string>();
  readonly titulo = input.required<string>();
  readonly sub = input('');
}
