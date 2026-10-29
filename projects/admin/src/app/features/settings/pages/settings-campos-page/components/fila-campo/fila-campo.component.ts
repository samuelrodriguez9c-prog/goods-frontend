import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CampoPersonalizado } from '../../../../../../core/campos/campo-personalizado.model';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import { ICONO_TIPO, nombreTipo, resumenCampo } from '../../campos.util';

/**
 * Contenido de la fila de un campo (va en `app-fila-lista`, columnas
 * `38px minmax(0,1fr) auto`, arriba):
 * - Miniatura de 38 px con el ícono del tipo y la insignia ✓ (activo) o pausa
 *   (inactivo). Con el cursor encima, o si ya hay campos marcados, el ícono se
 *   cambia por la casilla de selección múltiple.
 * - Nombre (600 si está abierto) con 🏪 si se ve en la tienda; debajo el tipo
 *   y el resumen de opciones, truncado; solo «Inactivo» y «Requerido» como etiquetas.
 * - Derecha: cuántos registros tienen dato (`conDato`, «—» mientras carga).
 */
@Component({
  selector: 'app-fila-campo',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    @let c = campo();
    <span
      class="relative flex size-[38px] items-center justify-center rounded-[11px] text-[#303030] transition-colors duration-[260ms]"
      [style.background]="resaltada() ? '#f4f4f4' : '#e6e6e6'"
    >
      @if (verCasilla()) {
        <span
          (click)="$event.stopPropagation(); marcar.emit()"
          title="Seleccionar"
          class="flex size-[18px] animate-[fade-in_.15s] items-center justify-center rounded-md text-white transition-[background-color,box-shadow] duration-150"
          [style.background]="marcado() ? '#303030' : '#fff'"
          [style.box-shadow]="marcado() ? 'none' : 'inset 0 0 0 1.5px #c9c9c9'"
        >
          @if (marcado()) {
            <app-ic nombre="check" [size]="12" />
          }
        </span>
      } @else {
        <app-ic [nombre]="icono()" [size]="17" [style.opacity]="c.activo ? 1 : 0.5" />
      }
      <span
        [title]="c.activo ? 'Activo' : 'Inactivo'"
        class="absolute -right-[3px] -bottom-[3px] flex size-[18px] items-center justify-center rounded-full transition-shadow duration-[260ms]"
        [style.background]="c.activo ? '#dcfce7' : '#e3e3e3'"
        [style.color]="c.activo ? '#0b5c3f' : '#4b5563'"
        [style.box-shadow]="'0 0 0 2px ' + (resaltada() ? '#fff' : '#f1f1f1')"
        ><app-ic [nombre]="c.activo ? 'check' : 'player-pause'" [size]="10"
      /></span>
    </span>
    <span class="flex min-w-0 flex-col gap-[5px]">
      <span class="flex min-w-0 items-center gap-1.5">
        <span
          class="min-w-0 truncate text-[13px] leading-[18px]"
          [style.font-weight]="seleccionada() ? 600 : 500"
          [style.color]="c.activo ? '#111827' : '#6b7280'"
          >{{ c.etiqueta }}</span
        >
        @if (c.activo && c.visibilidad?.tienda) {
          <app-ic
            nombre="building-store"
            [size]="13"
            title="Visible en la tienda"
            class="shrink-0 text-[#9ca3af]"
          />
        }
      </span>
      <span
        class="-mt-[3px] flex min-w-0 items-center gap-2 overflow-hidden text-xs leading-4 text-[#6b7280]"
      >
        <span class="inline-flex shrink-0 items-center gap-1 whitespace-nowrap"
          ><app-ic [nombre]="icono()" [size]="12" class="text-[#9ca3af]" />{{ tipo() }}</span
        >
        @if (resumen()) {
          <span class="min-w-0 flex-1 truncate">{{ resumen() }}</span>
        }
      </span>
      @if (!c.activo || c.obligatorio) {
        <span class="flex min-w-0 flex-wrap items-center gap-1">
          @if (!c.activo) {
            <span
              class="inline-flex h-5 shrink-0 items-center gap-[5px] whitespace-nowrap rounded-md bg-[#e3e3e3] px-[7px] text-[11px] font-medium text-[#4b5563]"
              ><app-ic nombre="eye-off" [size]="11" />Inactivo</span
            >
          }
          @if (c.obligatorio) {
            <span
              class="inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-md bg-[#ffe6e5] px-1.5 text-[11px] font-medium text-[#b42318]"
              ><app-ic nombre="asterisk" [size]="10" />Requerido</span
            >
          }
        </span>
      }
    </span>
    <span class="flex flex-col items-end gap-1.5 pt-px">
      <span
        class="whitespace-nowrap text-[13px] font-semibold tabular-nums"
        [style.color]="c.activo ? '#111827' : '#6b7280'"
        >{{ datos() }}</span
      >
      <span class="whitespace-nowrap text-[11.5px] font-medium text-[#9ca3af]">con dato</span>
    </span>
  `,
})
export class FilaCampoComponent {
  readonly campo = input.required<CampoPersonalizado>();
  readonly marcado = input(false);
  readonly seleccionada = input(false);
  readonly resaltada = input(false);
  /** Ya hay campos marcados: la casilla se ve en todas las filas. */
  readonly hayMarcados = input(false);
  /** Registros con dato (`GET /campos-personalizados/:id/uso`); `null` mientras carga. */
  readonly conDato = input<number | null>(null);
  readonly marcar = output<void>();

  protected readonly icono = computed(() => ICONO_TIPO[this.campo().tipo]);
  protected readonly tipo = computed(() => nombreTipo(this.campo().tipo));
  protected readonly resumen = computed(() => {
    const c = this.campo();
    // Sin reglas, `resumenCampo` repite la descripción del tipo: no aporta en la fila.
    return c.tipo === 'lista' ||
      Object.keys(c.reglas ?? {}).length ||
      typeof c.defecto === 'boolean'
      ? resumenCampo(c)
      : '';
  });
  protected readonly verCasilla = computed(() => this.hayMarcados() || this.resaltada());
  protected readonly datos = computed(() => {
    const n = this.conDato();
    return n == null ? '—' : n.toLocaleString('es-CO');
  });
}
