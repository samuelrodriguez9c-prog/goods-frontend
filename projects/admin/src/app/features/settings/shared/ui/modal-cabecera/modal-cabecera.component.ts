import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IcComponent } from '../../../../products/shared/ui/ic/ic.component';

/**
 * Cabecera de los modales de Settings: ícono 40 × 40, título con chip mono,
 * texto de apoyo, `Esc` y cerrar; abajo un separador. El cuerpo y el pie los
 * pone cada modal.
 */
@Component({
  selector: 'app-modal-cabecera',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="flex items-start gap-3 px-[18px] pb-4 pt-[18px]">
      <span
        class="flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-[250ms]"
        [style.background]="iconoBg()"
        [style.color]="iconoColor()"
        ><app-ic [nombre]="icono()" [size]="20"
      /></span>
      <span class="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span class="flex min-w-0 items-center gap-2">
          <span
            class="whitespace-nowrap font-display text-lg font-semibold leading-[22px] tracking-[-0.01em] text-[#111827]"
            >{{ titulo() }}</span
          >
          @if (referencia()) {
            <span
              class="inline-flex h-5 min-w-0 items-center truncate rounded-md bg-[#f4f4f4] px-[7px] font-mono text-[11px] text-[#6b7280]"
              >{{ referencia() }}</span
            >
          }
        </span>
        <span class="text-pretty text-[12.5px] leading-[18px] text-[#6b7280]">{{ sub() }}</span>
      </span>
      <div class="flex shrink-0 items-center gap-1.5">
        <kbd
          class="flex h-5 items-center rounded-[5px] bg-[#f4f4f4] px-1.5 font-sans text-[11px] text-[#6b7280]"
          >Esc</kbd
        >
        <button
          type="button"
          (click)="cerrar.emit()"
          title="Cerrar · Esc"
          class="flex rounded-lg p-1.5 text-[#6b7280] hover:bg-[#f4f4f4] hover:text-[#111827]"
        >
          <app-ic nombre="x" [size]="17" />
        </button>
      </div>
    </div>
    <div class="mx-[18px] h-px bg-[#f1f1f1]"></div>
  `,
})
export class ModalCabeceraComponent {
  readonly icono = input.required<string>();
  readonly iconoBg = input('#f1f1f1');
  readonly iconoColor = input('#4b5563');
  readonly titulo = input.required<string>();
  readonly referencia = input('');
  readonly sub = input('');
  readonly cerrar = output<void>();
}
