import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';

/**
 * Fila con título, ayuda e interruptor de la hoja del campo («Obligatorio»,
 * «No repetir»…). Toda la fila es clicable, como en el diseño.
 */
@Component({
  selector: 'app-interruptor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <button
      type="button"
      role="switch"
      [attr.aria-checked]="on()"
      [disabled]="deshabilitado()"
      (click)="cambiar.emit(!on())"
      class="flex w-full cursor-pointer items-center gap-3 text-left disabled:cursor-default"
    >
      <span class="flex min-w-0 flex-col gap-0.5"
        ><span class="text-[13px] font-semibold text-[#303030]">{{ titulo() }}</span>
        @if (ayuda()) {
          <span class="text-xs text-[#6b7280]">{{ ayuda() }}</span>
        }
      </span>
      <span class="flex-1"></span>
      <span
        class="relative h-5 w-[34px] shrink-0 rounded-full transition-colors duration-150"
        [style.background]="on() ? '#303030' : '#d4d4d4'"
        ><span
          class="absolute top-0.5 size-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.2)] transition-[left] duration-200"
          [style.left.px]="on() ? 16 : 2"
        ></span
      ></span>
    </button>
  `,
})
export class InterruptorComponent {
  readonly titulo = input('');
  readonly ayuda = input('');
  readonly on = input(false);
  readonly deshabilitado = input(false, { transform: booleanAttribute });
  readonly cambiar = output<boolean>();
}
