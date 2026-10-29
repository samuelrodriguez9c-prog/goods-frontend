import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PopoverDirective } from '../../../../../shared/ui/popover.directive';
import { IcComponent } from '../../../../products/shared/ui/ic/ic.component';

export interface Atajo {
  t: string;
  k: string;
}

/** Botón de teclado de la cabecera con la lista de atajos de la página. */
@Component({
  selector: 'app-atajos-teclado',
  standalone: true,
  imports: [IcComponent, PopoverDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative' },
  template: `
    <button
      type="button"
      (click)="$event.stopPropagation(); alternar.emit()"
      title="Atajos de teclado"
      class="flex size-[34px] items-center justify-center rounded-lg text-[#4b5563] hover:bg-[#e6e6e6]"
    >
      <app-ic nombre="keyboard" [size]="17" />
    </button>
    <div
      [appPopover]="abierto()"
      (click)="$event.stopPropagation()"
      class="absolute right-0 top-10 z-50 w-[250px] rounded-[14px] bg-white p-2 shadow-[0_0_0_1px_rgba(0,0,0,.06),0_18px_40px_-16px_rgba(0,0,0,.35)] [transition:opacity_.18s_ease,_transform_.26s_cubic-bezier(.2,.8,.2,1)]"
    >
      <p
        class="m-0 px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[.06em] text-[#9ca3af]"
      >
        Atajos
      </p>
      @for (a of atajos(); track a.t) {
        <div class="flex items-center gap-2 px-2 py-[5px] text-[12.5px] text-[#374151]">
          <span class="flex-1">{{ a.t }}</span>
          <kbd
            class="min-w-[22px] rounded-md bg-[#f1f1f1] px-1.5 py-0.5 text-center font-sans text-[11.5px] font-semibold text-[#4b5563]"
            >{{ a.k }}</kbd
          >
        </div>
      }
    </div>
  `,
})
export class AtajosTecladoComponent {
  readonly atajos = input.required<Atajo[]>();
  readonly abierto = input(false);
  readonly alternar = output<void>();
}
