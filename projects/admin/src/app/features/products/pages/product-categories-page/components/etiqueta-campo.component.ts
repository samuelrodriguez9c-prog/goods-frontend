import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Título de un campo de la hoja, con su pastilla Requerido / Opcional y la ayuda debajo. */
@Component({
  selector: 'app-etiqueta-campo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-0.5' },
  template: `
    <span class="flex items-center gap-2 text-[13px] font-semibold text-[#303030]">
      {{ titulo() }}
      @if (marca() === 'requerido') {
        <span class="rounded-md bg-[#ffe6e5] px-[7px] py-[1px] text-[11px] leading-[17px] font-medium text-[#c4320a]">Requerido</span>
      } @else if (marca() === 'opcional') {
        <span class="rounded-md bg-[#f1f1f1] px-[7px] py-[1px] text-[11px] leading-[17px] font-medium text-[#6b7280]">Opcional</span>
      }
    </span>
    <span class="text-[12px] leading-[16px] text-[#8a8a8a]">{{ ayuda() }}</span>
  `,
})
export class EtiquetaCampoComponent {
  readonly titulo = input.required<string>();
  readonly marca = input<'requerido' | 'opcional' | null>(null);
  readonly ayuda = input('');
}
