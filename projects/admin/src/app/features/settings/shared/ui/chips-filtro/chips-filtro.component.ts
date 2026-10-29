import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IcComponent } from '../../../../products/shared/ui/ic/ic.component';

export interface ChipActivo {
  t: string;
  quitar: () => void;
}

/** Filtros activos sobre la lista, en pastillas negras que se quitan con un clic. */
@Component({
  selector: 'app-chips-filtro',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-wrap gap-1.5 pb-1 pr-7' },
  template: `
    @for (c of chips(); track c.t) {
      <button
        type="button"
        (click)="c.quitar()"
        class="flex h-[26px] animate-[st-pop_.25s_both] items-center gap-[5px] rounded-full bg-[#303030] pl-2.5 pr-1.5 text-xs font-medium text-white hover:bg-[#1a1a1a]"
      >
        {{ c.t }}<app-ic nombre="x" [size]="12" class="text-[#a3a3a3]" />
      </button>
    }
  `,
})
export class ChipsFiltroComponent {
  readonly chips = input.required<ChipActivo[]>();
}
