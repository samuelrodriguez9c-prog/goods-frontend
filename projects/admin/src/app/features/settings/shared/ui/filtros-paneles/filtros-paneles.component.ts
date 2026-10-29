import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { PopoverDirective } from '../../../../../shared/ui/popover.directive';
import { IcComponent } from '../../../../products/shared/ui/ic/ic.component';
import { PuntoRadioComponent } from '../punto-radio/punto-radio.component';

export interface SeccionFiltro {
  k: string;
  t: string;
  icono: string;
  /** Lo elegido en la sección («Todos», «Aprobada»…). */
  sub?: string;
  activo: boolean;
}

export interface OpcionFiltro {
  k: string | number;
  t: string;
  n: number;
  on: boolean;
  /** Ícono en caja (con `bg`/`fg`) o, si trae `tono`, avatar con `ini`. */
  icono?: string;
  bg?: string;
  fg?: string;
  ini?: string;
  tono?: [string, string] | null;
}

/**
 * Filtros de dos paneles (Solicitudes, Actividad): a la izquierda las
 * secciones con un indicador que se desliza; a la derecha las opciones de la
 * sección elegida, con «Limpiar todo» y «Listo».
 */
@Component({
  selector: 'app-filtros-paneles',
  standalone: true,
  imports: [IcComponent, PuntoRadioComponent],
  hostDirectives: [{ directive: PopoverDirective, inputs: ['appPopover: abierto'] }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'absolute left-0 top-11 z-40 grid w-[460px] max-w-[calc(100vw-300px)] origin-top-left grid-cols-[156px_minmax(0,1fr)] overflow-hidden rounded-[14px] bg-white shadow-[0_0_0_1px_rgba(0,0,0,.06),0_24px_48px_-20px_rgba(0,0,0,.35)] [transition:opacity_.18s_ease,_transform_.26s_cubic-bezier(.2,.8,.2,1)]',
    '(click)': '$event.stopPropagation()',
  },
  template: `
    <div class="flex flex-col border-r border-[#efefef] bg-[#f7f7f7] px-1.5 py-2">
      <div class="px-2 pb-2 pt-1 font-display text-sm font-semibold text-[#111827]">Filtros</div>
      <div class="relative">
        <span
          class="absolute inset-x-0 top-0 h-11 rounded-[9px] bg-white shadow-[0_1px_2px_rgba(0,0,0,.06),0_0_0_1px_rgba(0,0,0,.04)] transition-transform duration-[350ms] ease-[cubic-bezier(.3,1.3,.5,1)]"
          [style.transform]="'translateY(' + indice() * 46 + 'px)'"
        ></span>
        @for (x of secciones(); track x.k) {
          @let on = seccion() === x.k;
          <button
            type="button"
            (click)="seccionChange.emit(x.k)"
            class="relative z-[1] mb-0.5 flex h-11 w-full items-center gap-2 px-2 text-left"
          >
            <span
              class="flex size-[22px] shrink-0 items-center justify-center rounded-full"
              [style.background]="on ? '#303030' : '#e6e6e6'"
              [style.color]="on ? '#fff' : '#4b5563'"
              ><app-ic [nombre]="x.icono" [size]="13"
            /></span>
            <span class="flex min-w-0 flex-1 flex-col gap-px">
              <span
                class="text-[12.5px] font-semibold"
                [style.color]="on ? '#111827' : '#4b5563'"
                >{{ x.t }}</span
              >
              @if (x.sub) {
                <span class="truncate text-[11px] text-[#8a8a8a]">{{ x.sub }}</span>
              }
            </span>
            @if (x.activo) {
              <span
                class="size-[7px] shrink-0 animate-[st-pop_.38s_cubic-bezier(.2,.8,.2,1)] rounded-full bg-[#2be0d5] shadow-[0_0_0_3px_rgba(43,224,213,.2)]"
              ></span>
            }
          </button>
        }
      </div>
      <button
        type="button"
        (click)="limpiar.emit()"
        class="mt-auto self-start px-2 pb-0.5 pt-2 text-xs font-medium text-[#6b7280] hover:text-[#111827]"
      >
        Limpiar todo
      </button>
    </div>
    <div class="flex max-h-[min(360px,55vh)] min-h-[260px] flex-col">
      <div class="sin-barra min-h-0 flex-1 overflow-y-auto px-3 pb-1.5 pt-3">
        @for (sec of [seccion()]; track sec) {
          <div class="flex animate-[st-ficha_.3s_cubic-bezier(.2,.8,.2,1)_both] flex-col gap-2">
            <div class="px-1 font-display text-sm font-semibold text-[#111827]">
              {{ tituloSeccion() }}
            </div>
            <div class="flex flex-col gap-0.5">
              @for (o of opciones(); track o.k) {
                <button
                  type="button"
                  (click)="elegir.emit(o.k)"
                  class="grid grid-cols-[16px_22px_minmax(0,1fr)_auto] items-center gap-2 rounded-[9px] px-2 py-[5px] text-left hover:bg-[#f7f7f7]"
                  [style.background]="o.on ? '#f4f4f4' : null"
                >
                  <app-punto-radio [on]="o.on" />
                  @if (o.tono) {
                    <span
                      class="flex size-[22px] items-center justify-center rounded-full text-[9.5px] font-semibold"
                      [style.background]="o.tono[0]"
                      [style.color]="o.tono[1]"
                      >{{ o.ini }}</span
                    >
                  } @else {
                    <span
                      class="flex size-[22px] items-center justify-center rounded-[7px]"
                      [style.background]="o.bg ?? '#f1f1f1'"
                      [style.color]="o.fg ?? '#4b5563'"
                      ><app-ic [nombre]="o.icono ?? 'point'" [size]="12"
                    /></span>
                  }
                  <span class="truncate text-[12.5px] font-medium text-[#111827]">{{ o.t }}</span>
                  <span class="text-[11.5px] font-semibold tabular-nums text-[#9ca3af]">{{
                    o.n
                  }}</span>
                </button>
              }
            </div>
          </div>
        }
      </div>
      <div class="flex items-center justify-between gap-2.5 border-t border-[#f1f1f1] px-3 py-2">
        <span class="min-w-0 truncate text-xs font-semibold tabular-nums text-[#111827]">{{
          resumen()
        }}</span>
        <button
          type="button"
          (click)="listo.emit()"
          class="shrink-0 rounded-lg bg-[#303030] px-[11px] py-[5px] text-[12.5px] font-medium text-white shadow-[inset_0_-1px_0_#000] hover:opacity-90"
        >
          Listo
        </button>
      </div>
    </div>
  `,
})
export class FiltrosPanelesComponent {
  readonly secciones = input.required<SeccionFiltro[]>();
  readonly seccion = input.required<string>();
  readonly opciones = input.required<OpcionFiltro[]>();
  /** Pie del panel («12 solicitudes»). */
  readonly resumen = input('');
  readonly seccionChange = output<string>();
  readonly elegir = output<string | number>();
  readonly limpiar = output<void>();
  readonly listo = output<void>();

  protected readonly indice = computed(() =>
    Math.max(
      0,
      this.secciones().findIndex((s) => s.k === this.seccion()),
    ),
  );
  protected readonly tituloSeccion = computed(
    () => this.secciones().find((s) => s.k === this.seccion())?.t ?? '',
  );
}
