import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Etiqueta de un campo: nombre, «Requerido» / «Opcional» y una línea de ayuda. */
@Component({
  selector: 'app-tienda-etiqueta',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <span class="flex flex-col gap-0.5">
      <span class="flex items-center gap-2 text-[13px] font-semibold text-[#303030]">{{ t() }}
        @if (req()) { <span class="rounded-md bg-[#ffe6e5] px-[7px] py-px text-[11px] font-medium leading-[17px] text-[#c4320a]">Requerido</span> }
        @if (opc()) { <span class="rounded-md bg-[#f1f1f1] px-[7px] py-px text-[11px] font-medium leading-[17px] text-[#6b7280]">Opcional</span> }
      </span>
      <span class="text-xs leading-4 text-[#8a8a8a]">{{ sub() }}</span>
    </span>
  `,
})
export class TiendaEtiquetaComponent {
  readonly t = input.required<string>();
  readonly sub = input('');
  readonly req = input(false);
  readonly opc = input(false);
}
