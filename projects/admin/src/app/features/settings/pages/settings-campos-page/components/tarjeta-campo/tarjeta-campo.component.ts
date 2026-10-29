import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';

/** Tarjeta de las pestañas de la hoja: ícono, título, una línea de ayuda, un contador opcional y el contenido. */
@Component({
  selector: 'app-tarjeta-campo',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'flex flex-col gap-[18px] rounded-2xl border border-[#ebebeb] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,.03),0_12px_28px_-22px_rgba(0,0,0,.28)]',
  },
  template: `
    <div class="flex items-start gap-3">
      <span
        class="flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[#f4f4f4] text-[#303030]"
        ><app-ic [nombre]="icono()" [size]="17"
      /></span>
      <span class="flex min-w-0 flex-1 flex-col gap-0.5"
        ><span class="text-[15px] font-semibold tracking-[-0.005em] text-[#111827]">{{
          titulo()
        }}</span
        ><span class="text-xs leading-[17px] text-[#8a8a8a]">{{ descripcion() }}</span></span
      >
      @if (contador() !== null) {
        <span
          class="shrink-0 rounded-full bg-[#f1f1f1] px-[7px] text-[11px] font-semibold leading-[17px] text-[#6b7280] tabular-nums"
          >{{ contador() }}</span
        >
      }
    </div>
    <ng-content />
  `,
})
export class TarjetaCampoComponent {
  readonly icono = input.required<string>();
  readonly titulo = input.required<string>();
  readonly descripcion = input('');
  readonly contador = input<number | string | null>(null);
}
