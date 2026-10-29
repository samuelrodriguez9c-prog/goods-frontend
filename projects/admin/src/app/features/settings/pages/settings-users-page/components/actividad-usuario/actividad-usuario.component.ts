import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  AreaActividad,
  ItemActividad,
} from '../../../../../../core/actividad/actividad-equipo.service';
import { haceCuanto } from '../../../../../../shared/ui/persona';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import { areaUi } from '../../../settings-actividad-page/actividad.util';

const DIA_MS = 864e5;
/** Color del ícono de cada acción según el área; el resto va en gris. */
const TONO_AREA: Partial<Record<AreaActividad, [string, string]>> = {
  pedidos: ['#e0f7f5', '#00605b'],
  whatsapp: ['#e7f6ec', '#1f6b43'],
  inventario: ['#fff1d6', '#8a5a00'],
};

/**
 * «Actividad reciente» de una persona: barras de los últimos 7 días y sus
 * últimas 6 acciones del mes, agrupadas en Hoy, Ayer, Esta semana y Antes.
 */
@Component({
  selector: 'app-actividad-usuario',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-2.5' },
  template: `
    <div class="flex flex-wrap items-end justify-between gap-x-4 gap-y-2.5">
      <span class="flex flex-col gap-0.5">
        <span class="font-display text-[15px] font-semibold text-[#111827]"
          >Actividad reciente</span
        >
        <span class="text-xs text-[#6b7280]">{{ sub() }}</span>
      </span>
      <div class="flex flex-col items-end gap-1">
        <div class="flex h-7 items-end gap-[3px]">
          @for (d of semana(); track $index) {
            <span
              [title]="d.titulo"
              class="w-[9px] rounded-[3px] transition-[height,background-color] duration-500 ease-[cubic-bezier(.3,1.3,.5,1)] hover:!bg-[#111827]"
              [style.height.px]="d.h"
              [style.background]="d.bg"
            ></span>
          }
        </div>
        <span class="text-[10.5px] text-[#9ca3af]">Últimos 7 días</span>
      </div>
    </div>
    <div class="flex flex-col">
      @for (g of grupos(); track g.t) {
        <div class="flex flex-col">
          <span
            class="pt-2 pb-1 pl-[38px] text-[10.5px] font-semibold tracking-[.06em] text-[#9ca3af] uppercase"
            >{{ g.t }}</span
          >
          @for (a of g.items; track a.id; let k = $index, l = $last) {
            <div
              class="relative grid min-h-[46px] animate-[st-fade-in-up_.28s_cubic-bezier(.2,.8,.2,1)_both] grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[10px] pr-2 transition-colors duration-200 hover:bg-[#f8f8f8]"
              [style.animation-delay.ms]="a.delay"
            >
              <span
                class="absolute left-[13px] w-0.5 rounded-sm bg-[#efefef]"
                [style.top]="k === 0 ? '50%' : '0'"
                [style.bottom]="l ? '50%' : '0'"
              ></span>
              <span
                class="relative z-[1] flex size-7 items-center justify-center rounded-full shadow-[0_0_0_3px_#fff]"
                [style.background]="a.bg"
                [style.color]="a.color"
                ><app-ic [nombre]="a.icono" [size]="13"
              /></span>
              <span class="flex min-w-0 flex-col gap-[3px]">
                <span class="text-pretty text-[13px] leading-[18px] text-[#4b5563]">{{
                  a.texto
                }}</span>
                <span class="flex items-center gap-[5px] text-[11px] text-[#9ca3af]"
                  ><app-ic [nombre]="a.icono" [size]="11" />{{ a.area }}</span
                >
              </span>
              <span class="whitespace-nowrap text-[11.5px] tabular-nums text-[#9ca3af]">{{
                a.cuando
              }}</span>
            </div>
          }
        </div>
      } @empty {
        <div class="flex items-center gap-2.5 py-2.5">
          <span
            class="flex size-7 items-center justify-center rounded-full bg-[#f4f4f4] text-[#9ca3af]"
            ><app-ic nombre="history" [size]="13"
          /></span>
          <span class="text-[12.5px] text-[#6b7280]">{{
            invitada()
              ? 'Verás aquí lo que haga cuando acepte la invitación.'
              : 'No ha hecho cambios en el último mes.'
          }}</span>
        </div>
      }
    </div>
    @if (items().length) {
      <button
        type="button"
        (click)="verTodo.emit()"
        class="ml-[38px] self-start text-xs font-medium text-[#4b5563] underline decoration-[#c9c9c9] underline-offset-2 hover:text-[#111827] hover:decoration-[#111827]"
      >
        Ver todo en Actividad del equipo
      </button>
    }
  `,
})
export class ActividadUsuarioComponent {
  /** Acciones del último mes, de la más nueva a la más vieja. */
  readonly items = input.required<ItemActividad[]>();
  /** Todavía no aceptó la invitación (cambia el texto vacío). */
  readonly invitada = input(false);
  readonly verTodo = output<void>();

  protected readonly sub = computed(() => {
    const n = this.items().length;
    return n
      ? `${n} ${n === 1 ? 'acción' : 'acciones'} en el último mes`
      : 'Sin acciones registradas';
  });

  /** Una barra por día; hoy en negro. */
  protected readonly semana = computed(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return [6, 5, 4, 3, 2, 1, 0].map((dd) => {
      const desde = hoy.getTime() - dd * DIA_MS;
      const n = this.items().filter((a) => {
        const x = new Date(a.fecha).getTime();
        return x >= desde && x < desde + DIA_MS;
      }).length;
      const dia = dd === 0 ? 'Hoy' : dd === 1 ? 'Ayer' : `Hace ${dd} días`;
      return {
        h: n ? Math.min(28, 8 + n * 7) : 4,
        bg: n ? (dd === 0 ? '#303030' : '#bdbdbd') : '#ececec',
        titulo: `${dia} · ${n === 1 ? '1 acción' : n + ' acciones'}`,
      };
    });
  });

  protected readonly grupos = computed(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const grupos: {
      t: string;
      items: {
        id: number;
        texto: string;
        area: string;
        icono: string;
        bg: string;
        color: string;
        cuando: string;
        delay: number;
      }[];
    }[] = [];
    this.items()
      .slice(0, 6)
      .forEach((a, i) => {
        const dias = Math.floor((hoy.getTime() - new Date(a.fecha).setHours(0, 0, 0, 0)) / DIA_MS);
        const t = dias <= 0 ? 'Hoy' : dias === 1 ? 'Ayer' : dias < 7 ? 'Esta semana' : 'Antes';
        let g = grupos[grupos.length - 1];
        if (!g || g.t !== t) grupos.push((g = { t, items: [] }));
        const ar = areaUi(a);
        const [bg, color] = TONO_AREA[a.area] ?? ['#f1f1f1', '#4b5563'];
        g.items.push({
          id: a.id,
          texto: a.texto,
          area: ar.t,
          icono: ar.icono,
          bg,
          color,
          cuando: haceCuanto(a.fecha),
          delay: i * 40,
        });
      });
    return grupos;
  });
}
