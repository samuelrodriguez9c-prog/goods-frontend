import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  CambioHistorialCampo,
  UsoCampo,
} from '../../../../../../core/campos/campo-personalizado.model';
import { haceCuanto, iniciales, tonoPersona } from '../../../../../../shared/ui/persona';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import { BorradorCampo, nombreEntidad } from '../../campos.util';

/**
 * Pestaña «Actividad»: cuántos registros tienen el dato, la distribución
 * (por opción en listas y sí/no; con y sin dato en el resto) y el historial
 * de cambios del campo (`GET …/uso` y `GET …/historial`).
 */
@Component({
  selector: 'app-pestana-actividad',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'grid animate-[st-fade-in-up_.2s_ease-out] grid-cols-[repeat(auto-fit,minmax(max(270px,calc((100%-12px)/2)),1fr))] gap-3',
  },
  template: `
    @if (borrador().id === null) {
      <div
        class="col-span-full flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[#e0e0e0] px-5 py-10 text-center"
      >
        <span
          class="flex size-10 items-center justify-center rounded-full bg-[#f4f4f4] text-[#8a8a8a]"
          ><app-ic nombre="chart-bar" [size]="18"
        /></span>
        <p class="m-0 text-[13px] text-[#6b7280]">Aún no hay actividad: el campo es nuevo.</p>
      </div>
    } @else {
      <div [class]="tarjeta">
        <span class="text-xs font-semibold tracking-[.06em] text-[#9ca3af] uppercase">Uso</span>
        @if (uso(); as u) {
          <div class="flex items-baseline gap-2">
            <span
              class="font-display text-[32px] leading-9 font-semibold tracking-[-0.02em] tabular-nums text-[#111827]"
              >{{ pct() }} %</span
            >
            <span class="text-[12.5px] text-[#6b7280]">con dato</span>
          </div>
          <span class="relative block h-1.5 overflow-hidden rounded-full bg-[#f1f1f1]"
            ><span
              class="absolute inset-y-0 left-0 rounded-full bg-[#303030] transition-[width] duration-500"
              [style.width.%]="pct()"
            ></span
          ></span>
          <span class="text-[12.5px] leading-[18px] tabular-nums text-[#6b7280]"
            >{{ fmt(u.conDato) }} de {{ fmt(u.total) }} {{ entMin() }} tienen este dato.</span
          >
        } @else {
          <span class="text-[12.5px] text-[#9ca3af]">{{
            falloUso() ? 'No se pudo cargar.' : 'Cargando…'
          }}</span>
        }
      </div>
      <div [class]="tarjeta + ' !gap-3'">
        <span class="text-xs font-semibold tracking-[.06em] text-[#9ca3af] uppercase">{{
          borrador().tipo === 'lista' ? 'Opciones más usadas' : 'Cobertura'
        }}</span>
        @for (x of distribucion(); track x.t) {
          <div class="grid grid-cols-[minmax(0,90px)_minmax(0,1fr)_auto] items-center gap-2.5">
            <span class="flex min-w-0 items-center gap-1.5 text-[12.5px] font-medium text-[#374151]"
              ><span class="size-[7px] shrink-0 rounded-full" [style.background]="x.color"></span
              ><span class="truncate">{{ x.t }}</span></span
            >
            <span class="relative block h-1.5 overflow-hidden rounded-full bg-[#f4f4f4]"
              ><span
                class="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
                [style.width.%]="x.w"
                [style.background]="x.color"
              ></span
            ></span>
            <span class="text-xs tabular-nums text-[#6b7280]">{{ fmt(x.n) }}</span>
          </div>
        } @empty {
          <span class="text-[12.5px] text-[#9ca3af]">{{ uso() ? 'Sin datos todavía.' : '…' }}</span>
        }
      </div>
      <div [class]="tarjeta + ' col-span-full !gap-1'">
        <span class="pb-2 text-xs font-semibold tracking-[.06em] text-[#9ca3af] uppercase"
          >Historial</span
        >
        @for (x of filas(); track $index) {
          <div class="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2.5 py-1.5">
            <span
              class="flex size-7 items-center justify-center rounded-full text-[10.5px] font-semibold"
              [style.background]="x.tono[0]"
              [style.color]="x.tono[1]"
              >{{ x.ini }}</span
            >
            <span class="min-w-0 text-[13px] leading-[18px] text-[#374151]"
              ><span class="font-semibold text-[#111827]">{{ x.quien }}</span> · {{ x.texto }}</span
            >
            <span class="whitespace-nowrap text-xs text-[#9ca3af]">{{ x.cuando }}</span>
          </div>
        } @empty {
          <span class="text-[12.5px] text-[#9ca3af]">{{
            historial() === null ? 'Cargando…' : 'Sin cambios registrados.'
          }}</span>
        }
      </div>
    }
  `,
})
export class PestanaActividadComponent {
  readonly borrador = input.required<BorradorCampo>();
  /** `null` mientras carga. */
  readonly uso = input<UsoCampo | null>(null);
  readonly falloUso = input(false);
  readonly historial = input<CambioHistorialCampo[] | null>(null);

  protected readonly tarjeta =
    'flex flex-col gap-3.5 rounded-2xl border border-[#ebebeb] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,.03),0_12px_28px_-22px_rgba(0,0,0,.28)]';
  protected readonly entMin = computed(() => nombreEntidad(this.borrador().entidad).toLowerCase());
  protected readonly pct = computed(() => {
    const u = this.uso();
    return u && u.total ? Math.round((u.conDato / u.total) * 100) : 0;
  });
  protected readonly distribucion = computed(() => {
    const u = this.uso();
    if (!u) return [];
    const b = this.borrador();
    if (u.porOpcion && b.tipo !== 'si_no') {
      const max = Math.max(1, ...u.porOpcion.map((x) => x.n));
      return [...u.porOpcion]
        .sort((x, y) => y.n - x.n)
        .map((x) => ({
          t: String(x.valor),
          n: x.n,
          color: b.colores[String(x.valor)] ?? '#6b7280',
          w: Math.round((x.n / max) * 100),
        }));
    }
    if (u.porOpcion && b.tipo === 'si_no') {
      const max = Math.max(1, ...u.porOpcion.map((x) => x.n));
      return u.porOpcion.map((x) => ({
        t: x.valor ? 'Sí' : 'No',
        n: x.n,
        color: x.valor ? '#303030' : '#d4d4d4',
        w: Math.round((x.n / max) * 100),
      }));
    }
    const total = Math.max(1, u.total);
    return [
      { t: 'Con dato', n: u.conDato, color: '#303030', w: Math.round((u.conDato / total) * 100) },
      {
        t: 'Sin dato',
        n: u.total - u.conDato,
        color: '#d4d4d4',
        w: Math.round(((u.total - u.conDato) / total) * 100),
      },
    ];
  });
  protected readonly filas = computed(() =>
    (this.historial() ?? []).map((x) => {
      const quien = x.usuario?.nombre ?? 'Alguien del equipo';
      return {
        quien,
        ini: iniciales(quien),
        tono: tonoPersona(x.usuario?.id ?? quien),
        texto: x.texto,
        cuando: haceCuanto(x.creadoEn),
      };
    }),
  );

  protected fmt(n: number): string {
    return n.toLocaleString('es-CO');
  }
}
