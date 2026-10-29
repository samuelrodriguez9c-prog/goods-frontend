import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import { AvisoInvitacion } from '../../usuarios.util';

/** Aviso de invitación pendiente o vencida en la ficha, con la barra de lo que le queda al enlace. */
@Component({
  selector: 'app-aviso-invitacion',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'flex animate-[st-fade-in-up_.25s_both] flex-wrap items-center gap-x-4 gap-y-3 rounded-[14px] py-3 pl-3.5 pr-3',
    '[style.background]': 'aviso().bg',
  },
  template: `
    @let iv = aviso();
    <span
      class="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-white"
      [style.color]="iv.color"
      ><app-ic [nombre]="iv.icono" [size]="16"
    /></span>
    <span class="flex min-w-[200px] flex-1 flex-col gap-0.5">
      <span class="text-[13px] font-semibold" [style.color]="iv.color">{{ iv.t }}</span>
      <span class="text-pretty text-xs leading-[17px] text-[#4b5563]">{{ iv.d }}</span>
      <span class="mt-1.5 h-1 max-w-[260px] overflow-hidden rounded-full bg-black/[.07]"
        ><span
          class="block h-full rounded-full transition-[width] duration-[600ms] ease-[cubic-bezier(.2,.8,.2,1)]"
          [style.width]="iv.w"
          [style.background]="iv.fill"
        ></span
      ></span>
    </span>
    <button
      type="button"
      (click)="reenviar.emit()"
      class="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#303030] px-3 py-[7px] text-[12.5px] font-medium text-white shadow-[inset_0_-1px_0_#000] hover:opacity-90"
    >
      <app-ic nombre="send" [size]="14" />{{ iv.btn }}
    </button>
  `,
})
export class AvisoInvitacionComponent {
  readonly aviso = input.required<AvisoInvitacion>();
  readonly reenviar = output<void>();
}
