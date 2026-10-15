import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';

/**
 * Un paso del editor de la tienda: tarjeta blanca con el número (gris,
 * oscuro si es el que se está editando, turquesa con ✓ si ya está listo),
 * título y explicación. Se resalta cuando se toca su parte en la vitrina.
 */
@Component({
  selector: 'app-paso-tienda',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'block scroll-mt-4 rounded-2xl bg-white p-5 transition-[box-shadow] duration-300',
    '[style.box-shadow]': "resaltado() ? '0 0 0 2px #2be0d5, 0 18px 40px -24px rgba(0,0,0,.25)' : '0 1px 2px rgba(0,0,0,.04), 0 18px 40px -28px rgba(0,0,0,.25)'",
    '(focusin)': 'enfocar.emit()',
  },
  template: `
    <div class="flex items-start gap-3.5">
      <span class="flex size-8 shrink-0 items-center justify-center rounded-full font-[Archivo] text-[13px] font-semibold transition-[background-color,color] duration-300"
        [class]="listo() ? 'bg-[#2be0d5] text-[#003331]' : resaltado() ? 'bg-[#303030] text-white' : 'bg-[#f1f1f1] text-[#6b7280]'">
        @if (listo()) {
          <app-ic nombre="check" [size]="15" [stroke]="2.4" />
        } @else {
          {{ n() }}
        }
      </span>
      <div class="flex min-w-0 flex-1 flex-col gap-0.5 pt-[3px]">
        <div class="flex items-center gap-2">
          <h2 class="m-0 text-[15px] font-semibold tracking-[-.005em] text-[#111827]">{{ titulo() }}</h2>
          @if (opcional()) {
            <span class="rounded-full bg-[#f1f1f1] px-2 text-[10.5px] leading-[18px] font-medium text-[#6b7280]">Opcional</span>
          }
        </div>
        <p class="m-0 text-[12.5px] leading-[18px] text-[#8a8a8a]">{{ detalle() }}</p>
      </div>
    </div>
    <div class="mt-4 pl-[46px]">
      <ng-content />
    </div>
  `,
})
export class PasoTiendaComponent {
  readonly n = input.required<number>();
  readonly titulo = input.required<string>();
  readonly detalle = input('');
  readonly listo = input(false);
  readonly opcional = input(false);
  readonly resaltado = input(false);
  readonly enfocar = output<void>();
}
