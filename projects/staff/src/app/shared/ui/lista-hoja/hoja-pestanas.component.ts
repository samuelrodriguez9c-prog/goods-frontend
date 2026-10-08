import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { PestanaHoja } from './lista-hoja.model';

/** Pestañas de 118×42 con indicador de 2px que se desliza (320ms). */
@Component({
  selector: 'app-hoja-pestanas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative -mx-6 flex border-b border-[#ebebeb] px-4' },
  template: `
    @for (t of pestanas(); track t.clave) {
      <button
        type="button"
        (click)="elegir.emit(t.clave)"
        class="flex h-[42px] w-[118px] items-center justify-center gap-[7px] whitespace-nowrap border-0 bg-transparent text-[13px] transition-colors duration-200 hover:text-gray-900"
        [class]="t.clave === activa() ? 'font-semibold text-gray-900' : 'font-medium text-gray-500'"
      >
        {{ t.texto }}
        @if (t.cuenta !== null && t.cuenta !== undefined && t.cuenta !== '') {
          <span
            class="rounded-full px-[7px] py-px text-[11px] font-semibold tabular-nums"
            [class]="t.alerta ? 'bg-[#fde2dd] text-[#b42318]' : 'bg-[#ececec] text-gray-600'"
          >{{ t.cuenta }}</span>
        }
      </button>
    }
    <span
      class="absolute -bottom-px h-0.5 w-[118px] rounded-sm bg-[#303030] transition-[left] duration-[320ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]"
      [style.left.px]="16 + indice() * 118"
    ></span>
  `,
})
export class HojaPestanasComponent {
  readonly pestanas = input.required<PestanaHoja[]>();
  readonly activa = input.required<string>();
  readonly elegir = output<string>();
  protected readonly indice = computed(() => Math.max(0, this.pestanas().findIndex((t) => t.clave === this.activa())));
}
