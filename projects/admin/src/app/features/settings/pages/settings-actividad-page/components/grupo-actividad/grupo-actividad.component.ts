import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import { GrupoActividad } from '../../actividad.util';

/** Grupo de la lista (un día, una persona o un área): cabecera fija al hacer scroll y cuerpo plegable con las filas proyectadas. */
@Component({
  selector: 'app-grupo-actividad',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    @let g = grupo();
    <button
      type="button"
      (click)="alternar.emit()"
      class="sticky top-0 z-[3] flex w-[calc(100%-28px)] items-center gap-2.5 bg-[#f1f1f1] pb-2 pl-1 pr-2 pt-3.5 text-left"
    >
      @if (g.tono) {
        <span
          class="flex size-[22px] shrink-0 items-center justify-center rounded-full text-[9.5px] font-semibold"
          [style.background]="g.tono[0]"
          [style.color]="g.tono[1]"
          >{{ g.ini }}</span
        >
      } @else {
        <span
          class="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-[#e3e3e3] text-[#303030]"
          ><app-ic [nombre]="g.icono" [size]="13"
        /></span>
      }
      <span class="flex min-w-0 flex-1 flex-col gap-px">
        <span class="flex items-center gap-[7px]">
          <span class="text-[13px] font-semibold text-[#111827]">{{ g.t }}</span>
          <span
            class="rounded-full bg-[#e3e3e3] px-[7px] text-[11px] font-semibold leading-[17px] tabular-nums text-[#4b5563]"
            >{{ g.filas.length }}</span
          >
        </span>
        <span class="truncate text-[11.5px] text-[#8a8a8a]">{{ g.sub }}</span>
      </span>
      <span class="flex size-6 shrink-0 items-center justify-center text-[#8a8a8a]"
        ><app-ic
          nombre="chevron-down"
          [size]="14"
          class="transition-transform duration-300"
          [style.transform]="abierto() ? 'none' : 'rotate(-90deg)'"
      /></span>
    </button>
    <div
      class="grid transition-[grid-template-rows] duration-[320ms] ease-[cubic-bezier(.2,.8,.2,1)]"
      [style.grid-template-rows]="abierto() ? '1fr' : '0fr'"
    >
      <div class="min-h-0" [style.overflow]="abierto() ? 'visible' : 'hidden'">
        <div class="flex flex-col gap-0.5 pb-1 pt-0.5"><ng-content /></div>
      </div>
    </div>
  `,
})
export class GrupoActividadComponent {
  readonly grupo = input.required<GrupoActividad>();
  readonly abierto = input(true);
  readonly alternar = output<void>();
}
