import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import {
  BorradorCampo,
  ICONO_ENTIDAD,
  ICONO_TIPO,
  LugarCampo,
  nombreEntidad,
  nombreTipo,
} from '../../campos.util';

export type PestanaCampo = 'general' | 'validacion' | 'visibilidad' | 'vista' | 'actividad';

export const PESTANAS: { k: PestanaCampo; t: string }[] = [
  { k: 'general', t: 'General' },
  { k: 'validacion', t: 'Validación' },
  { k: 'visibilidad', t: 'Visibilidad' },
  { k: 'vista', t: 'Vista previa' },
  { k: 'actividad', t: 'Actividad' },
];

/**
 * Cabecera de la hoja del campo: ícono del tipo, nombre, dónde aparece,
 * pastillas (estado, tipo, sección, requerido y cuántos registros tienen el
 * dato) y las cinco pestañas con su contador.
 */
@Component({
  selector: 'app-cabecera-campo',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let d = borrador();
    <div class="mt-2.5 flex items-center gap-3">
      <span
        class="flex size-11 shrink-0 items-center justify-center rounded-[13px] bg-[#f4f4f4] text-[#303030]"
        ><app-ic [nombre]="iconoTipo()" [size]="20"
      /></span>
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          class="truncate font-display text-[19px] font-semibold leading-6 tracking-[-0.01em]"
          [style.color]="d.etiqueta ? '#111827' : '#b5b5b5'"
          >{{ d.etiqueta || 'Campo sin nombre' }}</span
        >
        <span class="text-xs text-[#8a8a8a]">{{ lectura() }}</span>
      </span>
    </div>
    <div class="mt-3 flex flex-wrap items-center gap-1.5">
      <span
        class="flex h-[30px] items-center gap-[7px] rounded-full bg-[#f4f4f4] px-[11px] text-[12.5px] font-medium text-[#111827]"
        ><span
          class="size-[7px] rounded-full"
          [style.background]="d.activo ? '#29845a' : '#c9c9c9'"
        ></span
        >{{ d.activo ? 'Activo' : 'Inactivo' }}</span
      >
      <span
        class="flex h-[30px] items-center gap-1.5 rounded-full bg-[#f4f4f4] px-[11px] text-[12.5px] font-medium text-[#374151]"
        ><app-ic [nombre]="iconoTipo()" [size]="14" class="text-[#6b7280]" />{{ tipo() }}</span
      >
      <span
        class="flex h-[30px] items-center gap-1.5 rounded-full bg-[#f4f4f4] px-[11px] text-[12.5px] font-medium text-[#374151]"
        ><app-ic [nombre]="iconoEntidad()" [size]="14" class="text-[#6b7280]" />{{
          entidad()
        }}</span
      >
      @if (d.obligatorio) {
        <span
          class="flex h-[30px] items-center rounded-full bg-[#ffe6e5] px-[11px] text-[12.5px] font-medium text-[#c4320a]"
          >Requerido</span
        >
      }
      @if (conDato() !== null) {
        <span
          title="Registros con este dato"
          class="flex h-[30px] items-center gap-1.5 rounded-full bg-[#f4f4f4] px-[11px] text-[12.5px] font-medium tabular-nums text-[#374151]"
          ><app-ic nombre="database" [size]="14" class="text-[#6b7280]" />{{ conDatoTexto() }}</span
        >
      }
    </div>
    <div class="sin-barra relative -mx-6 mt-3.5 flex gap-0.5 overflow-x-auto px-4">
      <span class="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[#ebebeb]"></span>
      @for (p of pestanas; track p.k; let i = $index) {
        @let on = pestana() === p.k;
        <button
          type="button"
          (click)="pestana.set(p.k)"
          [title]="p.t + ' (' + (i + 1) + ')'"
          class="relative flex h-[42px] flex-[1_0_auto] items-center justify-center gap-1.5 whitespace-nowrap px-2.5 text-[13px] transition-colors duration-200 hover:text-[#111827]"
          [style.font-weight]="on ? 600 : 500"
          [style.color]="on ? '#111827' : '#6b7280'"
        >
          {{ p.t }}
          @if (contadores()[p.k]; as n) {
            <span
              class="rounded-full bg-[#f1f1f1] px-1.5 text-[11px] font-semibold leading-[17px] text-[#6b7280]"
              >{{ n }}</span
            >
          }
          <span
            class="absolute inset-x-2 bottom-0 z-[1] h-0.5 rounded-sm bg-[#303030] transition-[opacity,transform] duration-300"
            [style.opacity]="on ? 1 : 0"
            [style.transform]="on ? 'scaleX(1)' : 'scaleX(.4)'"
          ></span>
        </button>
      }
    </div>
  `,
})
export class CabeceraCampoComponent {
  readonly borrador = input.required<BorradorCampo>();
  readonly lugar = input<LugarCampo | null>(null);
  /** Registros con este dato (`GET …/uso`); `null` en un campo nuevo o mientras carga. */
  readonly conDato = input<number | null>(null);
  /** El número junto a cada pestaña («3», «4/6»); vacío no se muestra. */
  readonly contadores = input<Partial<Record<PestanaCampo, string>>>({});
  readonly pestana = model<PestanaCampo>('general');

  protected readonly pestanas = PESTANAS;
  protected readonly iconoTipo = computed(() => ICONO_TIPO[this.borrador().tipo]);
  protected readonly iconoEntidad = computed(() => ICONO_ENTIDAD[this.borrador().entidad]);
  protected readonly tipo = computed(() => nombreTipo(this.borrador().tipo));
  protected readonly entidad = computed(() => nombreEntidad(this.borrador().entidad));
  /** «Aparece en el formulario de productos, en los filtros y en la exportación.» */
  protected readonly lectura = computed(() => {
    const d = this.borrador();
    if (d.id === null) return 'Completa los datos y guarda desde la barra de abajo.';
    const v = d.visibilidad;
    return `Aparece en el formulario de ${this.entidad().toLowerCase()}${v.filtros ? ', en los filtros' : ''}${v.exportacion ? ' y en la exportación' : ''}.`;
  });
  protected readonly conDatoTexto = computed(
    () => `${(this.conDato() ?? 0).toLocaleString('es-CO')} con dato`,
  );
}
