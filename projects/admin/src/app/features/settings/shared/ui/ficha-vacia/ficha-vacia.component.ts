import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IcComponent } from '../../../../products/shared/ui/ic/ic.component';

/** Estado de la ficha sin selección: ícono, título, texto corto, resumen, acción y atajos. */
@Component({
  selector: 'app-ficha-vacia',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'flex h-full flex-col items-center justify-center gap-2 p-10 text-center animate-[st-fade-in_.3s_both]',
  },
  template: `
    <span
      class="flex size-11 items-center justify-center rounded-[14px] bg-[#f4f4f4] text-[#6b7280]"
      ><app-ic [nombre]="icono()" [size]="22"
    /></span>
    <span class="text-sm font-semibold text-[#111827]">{{ titulo() }}</span>
    @if (texto()) {
      <span class="max-w-[280px] text-pretty text-[12.5px] leading-[18px] text-[#6b7280]">{{
        texto()
      }}</span>
    }
    @if (resumen()) {
      <span class="text-xs tabular-nums text-[#9ca3af]">{{ resumen() }}</span>
    }
    @if (accion()) {
      <button
        type="button"
        (click)="accionar.emit()"
        class="mt-1 flex items-center gap-1.5 rounded-full bg-[#f1f1f1] px-3 py-1.5 text-[13px] font-medium text-[#303030] hover:bg-[#e6e6e6]"
      >
        <app-ic [nombre]="accionIcono()" [size]="14" />{{ accion() }}
      </button>
    }
    @if (atajos()) {
      <span class="text-xs text-[#9ca3af]">{{ atajos() }}</span>
    }
  `,
})
export class FichaVaciaComponent {
  readonly icono = input('pointer');
  readonly titulo = input.required<string>();
  readonly texto = input('');
  readonly resumen = input('');
  readonly accion = input('');
  readonly accionIcono = input('plus');
  readonly atajos = input('↑ ↓ para moverte · N para crear · Esc para cerrar');
  readonly accionar = output<void>();
}
