import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import { PERIODOS, Periodo } from '../../actividad.util';

export interface MetricaActividad {
  k: 'total' | 'personas' | 'area' | 'eliminar';
  t: string;
  icono: string;
  v: string;
  sub: string;
  /** Verde o rojo para la comparación con el período anterior y las eliminaciones. */
  subColor?: string;
  /** El `title` de la tarjeta: qué hace tocarla. */
  titulo?: string;
  on: boolean;
}

/**
 * Período (Hoy · 7 · 30 · 90 días) con la comparación, arriba de la lista.
 * Las cuatro métricas van debajo en `app-tarjetas-plegables` (las pone la
 * página con `app-tarjeta-actividad`): tocar una filtra o agrupa la lista.
 */
@Component({
  selector: 'app-metricas-actividad',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mb-2 flex flex-col gap-2 pr-7' },
  template: `
    <div class="flex flex-wrap items-center gap-2.5">
      <div
        role="radiogroup"
        aria-label="Período"
        class="grid grid-cols-[repeat(4,auto)] gap-0.5 rounded-[11px] bg-[#e3e3e3] p-[3px]"
      >
        @for (p of periodos; track p.k) {
          @let on = periodo() === p.k;
          <button
            type="button"
            role="radio"
            [attr.aria-checked]="on"
            (click)="periodo.set(p.k)"
            class="h-7 whitespace-nowrap rounded-lg px-3 text-[12.5px] transition-[background-color,box-shadow] duration-200"
            [style.background]="on ? '#fff' : 'transparent'"
            [style.font-weight]="on ? 600 : 500"
            [style.color]="on ? '#111827' : '#4b5563'"
            [style.box-shadow]="on ? '0 1px 2px rgba(0,0,0,.08)' : 'none'"
          >
            {{ p.t }}
          </button>
        }
      </div>
      <span class="text-xs text-[#8a8a8a]">{{ comparacion() }}</span>
    </div>
  `,
})
export class MetricasActividadComponent {
  readonly periodo = model.required<Periodo>();
  /** «Los 7 días anteriores hubo 42 acciones». */
  readonly comparacion = input('');
  protected readonly periodos = PERIODOS;
}

/** Una métrica de Actividad (va dentro de `app-tarjetas-plegables`). */
@Component({
  selector: 'app-tarjeta-actividad',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-w-0 flex-1' },
  template: `
    @let m = metrica();
    <button
      type="button"
      (click)="elegir.emit(m.k)"
      [title]="m.titulo ?? ''"
      class="flex min-w-0 flex-1 flex-col gap-[3px] rounded-xl px-3 py-2.5 text-left transition-[background-color,box-shadow] duration-200 hover:!bg-white"
      [style.background]="m.on ? '#fff' : '#e8e8e8'"
      [style.box-shadow]="m.on ? '0 0 0 1.5px #303030' : 'none'"
    >
      <span class="flex items-center gap-1.5 text-[11.5px] font-medium text-[#6b7280]"
        ><app-ic [nombre]="m.icono" [size]="13" /><span class="truncate">{{ m.t }}</span></span
      >
      <span
        class="truncate font-display text-[19px] font-semibold leading-6 tracking-[-0.01em] tabular-nums text-[#111827]"
        >{{ m.v }}</span
      >
      <span class="truncate text-[11.5px]" [style.color]="m.subColor ?? '#8a8a8a'">{{
        m.sub
      }}</span>
    </button>
  `,
})
export class TarjetaActividadComponent {
  readonly metrica = input.required<MetricaActividad>();
  readonly elegir = output<MetricaActividad['k']>();
}
