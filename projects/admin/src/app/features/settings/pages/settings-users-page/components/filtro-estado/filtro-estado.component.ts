import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PopoverDirective } from '../../../../../../shared/ui/popover.directive';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import { PuntoRadioComponent } from '../../../../shared/ui/punto-radio/punto-radio.component';
import { ESTADO_USUARIO, EstadoUsuario } from '../../../../shared/usuarios';

export type FiltroEstado = 'todos' | EstadoUsuario;

export interface OpcionEstado {
  k: FiltroEstado;
  n: number;
}

/**
 * Botón del embudo junto al buscador y su popover «Estado». El estado abierto
 * lo lleva la página, que lo cierra con Esc o con un clic afuera.
 */
@Component({
  selector: 'app-filtro-estado',
  standalone: true,
  imports: [IcComponent, PopoverDirective, PuntoRadioComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative' },
  template: `
    <button
      type="button"
      (click)="$event.stopPropagation(); alternar.emit()"
      title="Filtrar por estado"
      class="relative flex size-[34px] shrink-0 items-center justify-center rounded-full text-[#4b5563] transition-colors duration-200 hover:bg-[#e6e6e6]"
      [style.background]="abierto() || valor() !== 'todos' ? '#e6e6e6' : null"
    >
      <app-ic nombre="filter" />
      @if (valor() !== 'todos') {
        <span
          class="absolute right-1 top-1 size-[7px] rounded-full bg-[#2be0d5] shadow-[0_0_0_2px_#f1f1f1]"
        ></span>
      }
    </button>
    <div
      [appPopover]="abierto()"
      (click)="$event.stopPropagation()"
      class="absolute right-0 top-11 z-40 flex w-[260px] origin-top-right flex-col gap-0.5 rounded-[14px] bg-white p-1.5 shadow-[0_0_0_1px_rgba(0,0,0,.06),0_24px_48px_-20px_rgba(0,0,0,.35)] [transition:opacity_.18s_ease,_transform_.26s_cubic-bezier(.2,.8,.2,1)]"
    >
      <div class="px-2 py-1.5 font-display text-sm font-semibold text-[#111827]">Estado</div>
      @for (o of opciones(); track o.k) {
        @let e = o.k === 'todos' ? null : estados[o.k];
        <button
          type="button"
          (click)="elegir.emit(o.k)"
          class="grid grid-cols-[16px_22px_minmax(0,1fr)_auto] items-center gap-2 rounded-[9px] px-2 py-[5px] text-left transition-colors duration-200 hover:bg-[#f7f7f7]"
          [style.background]="valor() === o.k ? '#f4f4f4' : null"
        >
          <app-punto-radio [on]="valor() === o.k" />
          <span
            class="flex size-[22px] items-center justify-center rounded-[7px]"
            [style.background]="e?.bg ?? '#f1f1f1'"
            [style.color]="e?.fg ?? '#4b5563'"
            ><app-ic [nombre]="e?.icono ?? 'users'" [size]="12"
          /></span>
          <span class="text-[12.5px] font-medium text-[#111827]">{{ e?.t ?? 'Todos' }}</span>
          <span class="text-[11.5px] font-semibold tabular-nums text-[#9ca3af]">{{ o.n }}</span>
        </button>
      }
    </div>
  `,
})
export class FiltroEstadoComponent {
  readonly valor = input.required<FiltroEstado>();
  readonly opciones = input.required<OpcionEstado[]>();
  readonly abierto = input(false);
  readonly alternar = output<void>();
  readonly elegir = output<FiltroEstado>();

  protected readonly estados = ESTADO_USUARIO;
}
