import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TipoCampo } from '../../../../../../core/campos/campo-personalizado.model';
import { PopoverDirective } from '../../../../../../shared/ui/popover.directive';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import { PuntoRadioComponent } from '../../../../shared/ui/punto-radio/punto-radio.component';

export type EstadoCampos = 'todos' | 'activos' | 'inactivos' | 'requeridos';

export interface OpcionFiltroCampo<K> {
  k: K;
  t: string;
  d?: string;
  icono: string;
  n: number;
  on: boolean;
}

/** Botón del embudo y popover «Filtrar la lista» (estado y tipo de dato), con abrir o plegar todos los grupos. */
@Component({
  selector: 'app-filtros-campos',
  standalone: true,
  imports: [IcComponent, PopoverDirective, PuntoRadioComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative shrink-0' },
  template: `
    <button
      type="button"
      (click)="$event.stopPropagation(); alternar.emit()"
      title="Filtrar la lista"
      class="relative flex size-[34px] items-center justify-center rounded-full text-[#4b5563] hover:bg-[#e6e6e6]"
      [style.background]="abierto() || activo() ? '#e6e6e6' : null"
    >
      <app-ic nombre="filter" />
      @if (activo()) {
        <span
          class="absolute right-1 top-1 size-[7px] rounded-full bg-[#2be0d5] shadow-[0_0_0_2px_#f1f1f1]"
        ></span>
      }
    </button>
    <div
      [appPopover]="abierto()"
      (click)="$event.stopPropagation()"
      class="sin-barra absolute right-0 top-[42px] z-40 max-h-[min(560px,70vh)] w-[300px] origin-top-right overflow-y-auto rounded-2xl bg-white p-3.5 shadow-[0_0_0_1px_rgba(0,0,0,.06),0_24px_48px_-20px_rgba(0,0,0,.35)] [transition:opacity_.18s_ease,_transform_.26s_cubic-bezier(.2,.8,.2,1)]"
    >
      <div class="px-1 pb-2.5">
        <div class="font-display text-[15px] font-semibold text-[#111827]">Filtrar la lista</div>
        <div class="text-[12.5px] leading-[18px] text-[#6b7280]">
          Qué campos se muestran en los grupos.
        </div>
      </div>
      <p
        class="m-0 px-1 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[.06em] text-[#9ca3af]"
      >
        Estado
      </p>
      <div class="flex flex-col gap-1">
        @for (o of estados(); track o.k) {
          <button
            type="button"
            (click)="elegirEstado.emit(o.k)"
            class="grid grid-cols-[18px_30px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl px-3 py-[9px] text-left hover:bg-[#f7f7f7]"
            [style.background]="o.on ? '#f4f4f4' : null"
          >
            <app-punto-radio [on]="o.on" [tamano]="18" />
            <span
              class="flex size-[30px] items-center justify-center rounded-[9px] bg-[#f1f1f1] text-[#4b5563]"
              ><app-ic [nombre]="o.icono"
            /></span>
            <span class="flex min-w-0 flex-col gap-px"
              ><span class="text-[13px] font-semibold text-[#111827]">{{ o.t }}</span
              ><span class="text-xs text-[#8a8a8a]">{{ o.d }}</span></span
            >
            <span class="text-xs font-semibold tabular-nums text-[#6b7280]">{{ o.n }}</span>
          </button>
        }
      </div>
      <p
        class="m-0 mt-2 border-t border-[#f1f1f1] px-1 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-[.06em] text-[#9ca3af]"
      >
        Tipo de dato
      </p>
      <div class="flex flex-col gap-1">
        @for (o of tipos(); track o.k) {
          <button
            type="button"
            (click)="elegirTipo.emit(o.k)"
            class="grid grid-cols-[18px_30px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl px-3 py-[9px] text-left hover:bg-[#f7f7f7]"
            [style.background]="o.on ? '#f4f4f4' : null"
          >
            <app-punto-radio [on]="o.on" [tamano]="18" />
            <span
              class="flex size-[30px] items-center justify-center rounded-[9px] bg-[#f1f1f1] text-[#4b5563]"
              ><app-ic [nombre]="o.icono"
            /></span>
            <span class="text-[13px] font-semibold text-[#111827]">{{ o.t }}</span>
            <span class="text-xs font-semibold tabular-nums text-[#6b7280]">{{ o.n }}</span>
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
export class FiltrosCamposComponent {
  readonly abierto = input(false);
  /** Si hay algún filtro puesto (punto turquesa). */
  readonly activo = input(false);
  readonly estados = input.required<OpcionFiltroCampo<EstadoCampos>[]>();
  /** La primera es «Todos los tipos» (`k: null`). */
  readonly tipos = input.required<OpcionFiltroCampo<TipoCampo | null>[]>();
  readonly alternar = output<void>();
  readonly elegirEstado = output<EstadoCampos>();
  readonly elegirTipo = output<TipoCampo | null>();
  readonly abrirTodos = output<void>();
  readonly plegarTodos = output<void>();
}
