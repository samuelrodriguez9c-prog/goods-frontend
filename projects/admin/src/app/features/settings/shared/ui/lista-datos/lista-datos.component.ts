import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IcComponent } from '../../../../products/shared/ui/ic/ic.component';

export interface DatoLateral {
  t: string;
  i: string;
  v: string;
}

/** Bloque del lateral de la ficha: kicker y filas etiqueta · ícono · valor. */
@Component({
  selector: 'app-lista-datos',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-0.5 border-t border-[#f1f1f1] pt-3' },
  template: `
    <span class="pb-1 text-[10.5px] font-semibold uppercase tracking-[.06em] text-[#9ca3af]">{{
      titulo()
    }}</span>
    @for (d of datos(); track d.t) {
      <div
        class="grid min-h-[30px] items-center gap-2.5"
        [style.grid-template-columns]="anchoEtiqueta() + 'px minmax(0,1fr)'"
      >
        <span class="text-[12.5px] text-[#6b7280]">{{ d.t }}</span>
        <span class="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-[#111827]"
          ><app-ic [nombre]="d.i" [size]="14" class="shrink-0 text-[#9ca3af]" /><span
            class="truncate"
            >{{ d.v }}</span
          ></span
        >
      </div>
    }
    <ng-content />
  `,
})
export class ListaDatosComponent {
  readonly titulo = input.required<string>();
  readonly datos = input.required<DatoLateral[]>();
  readonly anchoEtiqueta = input(96);
}
