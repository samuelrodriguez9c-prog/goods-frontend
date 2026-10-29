import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ItemActividad } from '../../../../../../core/actividad/actividad-equipo.service';
import { haceCuanto } from '../../../../../../shared/ui/persona';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import { Agrupar, areaUi, autorDe, horaDe, registroUi, tipoUi } from '../../actividad.util';

/**
 * Contenido de la fila de una acción: avatar con el sello del tipo de acción,
 * quién (o el área, si se agrupa por persona) y el tipo, el texto y dos chips
 * (área o registro, y la referencia). Por día muestra la hora; si no, hace
 * cuánto.
 */
@Component({
  selector: 'app-fila-actividad',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    @let x = item();
    @let tp = tipo();
    @let porPersona = agrupar() === 'persona';
    <span
      class="relative flex size-[38px] shrink-0 items-center justify-center font-display text-[13px] font-semibold"
      [style.border-radius]="porPersona ? '11px' : '9999px'"
      [style.background]="porPersona ? '#e3e3e3' : autor().tono[0]"
      [style.color]="porPersona ? '#303030' : autor().tono[1]"
    >
      @if (porPersona) {
        <app-ic [nombre]="area().icono" [size]="17" />
      } @else {
        {{ autor().ini }}
      }
      <span
        [title]="tp.t"
        class="absolute -right-[3px] -bottom-[3px] flex size-[18px] items-center justify-center rounded-full transition-shadow duration-[260ms]"
        [style.background]="tp.bg"
        [style.color]="tp.fg"
        [style.box-shadow]="'0 0 0 2px ' + (resaltada() ? '#fff' : '#f1f1f1')"
        ><app-ic [nombre]="tp.icono" [size]="10"
      /></span>
    </span>
    <span class="flex min-w-0 flex-col gap-[3px]">
      <span class="flex min-w-0 items-baseline gap-1.5"
        ><span class="shrink-0 text-[13px] font-semibold text-[#111827]">{{
          porPersona ? area().t : autor().corto
        }}</span
        ><span class="min-w-0 truncate text-[11.5px] text-[#9ca3af]">{{ tp.t }}</span></span
      >
      <span
        class="line-clamp-2 text-[13px] leading-[18px] text-pretty text-[#374151]"
        [style.font-weight]="seleccionada() ? 500 : 400"
        >{{ x.texto }}</span
      >
      @if (chip(); as c) {
        <span class="mt-0.5 flex min-w-0 flex-wrap items-center gap-1">
          <span
            class="inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-[#4b5563] transition-colors duration-[260ms]"
            [style.background]="resaltada() ? '#f4f4f4' : '#e6e6e6'"
            ><app-ic [nombre]="c.icono" [size]="11" />{{ c.t }}</span
          >
          @if (x.registro?.ref; as ref) {
            <span
              class="inline-flex h-5 items-center rounded-md px-1.5 font-mono text-[10.5px] font-medium text-[#6b7280] transition-colors duration-[260ms]"
              [style.background]="resaltada() ? '#f4f4f4' : '#e6e6e6'"
              >{{ ref }}</span
            >
          }
        </span>
      }
    </span>
    <span class="whitespace-nowrap pt-px text-[11.5px] font-medium tabular-nums text-[#9ca3af]">{{
      agrupar() === 'dia' ? hora() : hace()
    }}</span>
  `,
})
export class FilaActividadComponent {
  readonly item = input.required<ItemActividad>();
  readonly agrupar = input<Agrupar>('dia');
  readonly seleccionada = input(false);
  readonly resaltada = input(false);

  protected readonly autor = computed(() => autorDe(this.item()));
  protected readonly area = computed(() => areaUi(this.item()));
  protected readonly tipo = computed(() => tipoUi(this.item()));
  protected readonly hora = computed(() => horaDe(this.item()));
  protected readonly hace = computed(() => haceCuanto(this.item().fecha));
  /** Por día, el área; por persona o área, el tipo de registro (el área ya está a la vista). */
  protected readonly chip = computed(() => {
    const x = this.item();
    if (this.agrupar() === 'dia') return this.area();
    return x.registro ? registroUi(x.registro.tipo) : this.area();
  });
}
