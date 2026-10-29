import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PopoverDirective } from '../../../../../../shared/ui/popover.directive';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import { PuntoRadioComponent } from '../../../../shared/ui/punto-radio/punto-radio.component';
import { AGRUPAR, Agrupar } from '../../actividad.util';

/**
 * Botón y popover «Agrupar la lista» (por día, persona o área) con abrir o
 * plegar todos los grupos. El punto turquesa avisa que no es por día. El
 * estado abierto lo lleva la página.
 */
@Component({
  selector: 'app-agrupar-actividad',
  standalone: true,
  imports: [IcComponent, PopoverDirective, PuntoRadioComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative shrink-0' },
  template: `
    <button
      type="button"
      (click)="$event.stopPropagation(); alternar.emit()"
      title="Agrupar la lista"
      class="relative flex size-[34px] items-center justify-center rounded-full text-[#4b5563] transition-colors duration-200 hover:bg-[#e6e6e6]"
      [style.background]="abierto() || valor() !== 'dia' ? '#e3e3e3' : null"
    >
      <app-ic nombre="stack-2" />
      @if (valor() !== 'dia') {
        <span
          class="absolute top-1 right-1 size-[7px] rounded-full bg-[#2be0d5] shadow-[0_0_0_2px_#f1f1f1]"
        ></span>
      }
    </button>
    <div
      [appPopover]="abierto()"
      (click)="$event.stopPropagation()"
      class="absolute top-[42px] right-0 z-40 w-[300px] origin-top-right rounded-2xl bg-white p-3.5 shadow-[0_0_0_1px_rgba(0,0,0,.06),0_24px_48px_-20px_rgba(0,0,0,.35)] [transition:opacity_.18s_ease,_transform_.26s_cubic-bezier(.2,.8,.2,1)]"
    >
      <div class="px-1 pb-2.5">
        <div class="font-display text-[15px] font-semibold text-[#111827]">Agrupar la lista</div>
        <div class="text-[12.5px] leading-[18px] text-[#6b7280]">
          Cómo se ordenan las acciones en grupos plegables.
        </div>
      </div>
      <div class="flex flex-col gap-1">
        @for (o of opciones; track o.k) {
          @let on = valor() === o.k;
          <button
            type="button"
            (click)="elegir.emit(o.k)"
            class="grid grid-cols-[18px_30px_minmax(0,1fr)] items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors duration-200 hover:bg-[#f7f7f7]"
            [style.background]="on ? '#f4f4f4' : null"
          >
            <app-punto-radio [on]="on" [tamano]="18" />
            <span
              class="flex size-[30px] items-center justify-center rounded-[9px] bg-[#f1f1f1] text-[#4b5563]"
              ><app-ic [nombre]="o.i"
            /></span>
            <span class="flex flex-col gap-px"
              ><span class="text-[13px] font-semibold text-[#111827]">{{ o.t }}</span
              ><span class="text-xs text-[#8a8a8a]">{{ o.d }}</span></span
            >
          </button>
        }
      </div>
      <div class="mt-2.5 flex gap-1.5 border-t border-[#f1f1f1] pt-2.5">
        <button
          type="button"
          (click)="abrirTodos.emit()"
          class="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#f1f1f1] px-2.5 py-[7px] text-[12.5px] font-medium text-[#303030] hover:bg-[#e6e6e6]"
        >
          <app-ic nombre="chevrons-down" [size]="14" />Abrir todos
        </button>
        <button
          type="button"
          (click)="plegarTodos.emit()"
          class="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#f1f1f1] px-2.5 py-[7px] text-[12.5px] font-medium text-[#303030] hover:bg-[#e6e6e6]"
        >
          <app-ic nombre="chevrons-up" [size]="14" />Plegar todos
        </button>
      </div>
    </div>
  `,
})
export class AgruparActividadComponent {
  readonly valor = input.required<Agrupar>();
  readonly abierto = input(false);
  readonly alternar = output<void>();
  readonly elegir = output<Agrupar>();
  readonly abrirTodos = output<void>();
  readonly plegarTodos = output<void>();
  protected readonly opciones = AGRUPAR;
}
