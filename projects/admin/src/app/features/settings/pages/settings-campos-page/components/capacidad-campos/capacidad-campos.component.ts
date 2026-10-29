import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { EntidadCampo, TOPE_CAMPOS } from '../../../../../../core/campos/campo-personalizado.model';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';

export interface CapacidadEntidad {
  k: EntidadCampo;
  t: string;
  icono: string;
  activos: number;
  pct: string;
  /** Negro, ámbar cerca del tope, rojo al tope. */
  barra: string;
  on: boolean;
}

/**
 * Una tarjeta de capacidad: activos de la sección sobre el tope, con su
 * barra. Tocarla filtra la lista por esa sección. Va dentro de
 * `app-tarjetas-plegables` (`min` 150), con el alto parejo de Actividad.
 */
@Component({
  selector: 'app-tarjeta-capacidad',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-w-0 flex-1' },
  template: `
    @let c = capacidad();
    <button
      type="button"
      (click)="elegir.emit(c.k)"
      [title]="c.on ? 'Ver todas las secciones' : 'Ver solo ' + c.t"
      class="flex min-h-[78px] min-w-0 flex-1 flex-col justify-between gap-2.5 rounded-xl p-3 text-left transition-[background-color,box-shadow] duration-200 hover:bg-[#e9e9e9]"
      [style.background]="c.on ? '#fff' : '#e6e6e6'"
      [style.box-shadow]="c.on ? '0 0 0 1.5px #303030' : 'none'"
    >
      <span class="flex items-center gap-2">
        <span
          class="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#dcdcdc] text-[#303030]"
          ><app-ic [nombre]="c.icono" [size]="13"
        /></span>
        <span class="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#111827]">{{
          c.t
        }}</span>
        <span class="shrink-0 text-xs tabular-nums text-[#6b7280]"
          ><span class="font-semibold text-[#111827]">{{ c.activos }}</span> / {{ tope }}</span
        >
      </span>
      <span class="relative block h-1 overflow-hidden rounded-full bg-[#d9d9d9]"
        ><span
          class="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
          [style.width]="c.pct"
          [style.background]="c.barra"
        ></span
      ></span>
    </button>
  `,
})
export class TarjetaCapacidadComponent {
  readonly capacidad = input.required<CapacidadEntidad>();
  readonly elegir = output<EntidadCampo>();
  protected readonly tope = TOPE_CAMPOS;
}
