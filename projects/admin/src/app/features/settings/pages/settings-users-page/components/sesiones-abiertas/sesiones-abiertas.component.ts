import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';

export interface SesionVM {
  id: number;
  /** Tabler sin «ti-»: device-laptop, device-mobile, device-desktop. */
  icono: string;
  /** «Chrome en Windows». */
  disp: string;
  /** La IP: el backend no da la ciudad. */
  lugar: string;
  /** Minutos desde el último uso (0 = activa ahora). */
  min: number;
  /** «hace 2 h». */
  hace: string;
  /** La sesión desde la que estás tú: no se puede cerrar. */
  esEste?: boolean;
}

const TRES_DIAS = 3 * 24 * 60;

/**
 * «Sesiones abiertas» de la ficha de Usuarios.
 *
 * - Cabecera: kicker 10.5/600 mayúsculas #9ca3af + contador (pastilla #f1f1f1)
 *   + «N activa(s) ahora» con punto #29845a. A la derecha «Cerrar todas»
 *   («Cerrar las 2» si son dos): pastilla h-28 `inset 0 0 0 1px #f1d4d7`, 11.5/600 #b42318,
 *   ícono logout-2. Un clic, sin confirmar.
 * - Subtítulo 11.5/16 #6b7280: «Cierra las que no reconozcas.»
 * - Tarjeta por sesión: r12, `#fafafa` + `inset 0 0 0 1px #f1f1f1`, p `9px 8px 9px 9px`.
 *   Ícono 34 r10: verde `#e7f6ec/#1f6b43` + punto que late si está activa;
 *   ámbar `#fff6d1/#8a5a00` + alerta junto al lugar si lleva ≥ 3 días; gris en otro caso.
 *   «Este equipo» (`#e0f7f5/#00605b`) sin botón de cerrar.
 * - Cerrar (un clic): la tarjeta sale (`grid-rows 1fr→0fr`, `opacity 0`,
 *   `translateX(24px)`, 280 ms) y después se emite `cerrar`.
 * - «Este equipo» queda listo para cuando el backend marque la sesión actual
 *   (hoy no la marca: todas se pueden cerrar).
 */
@Component({
  selector: 'app-sesiones-abiertas',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-0.5 border-t border-[#f1f1f1] pt-3' },
  template: `
    <div class="flex items-center justify-between gap-2.5 pb-0.5">
      <span class="flex items-center gap-1.5">
        <span class="text-[10.5px] font-semibold tracking-[.06em] text-[#9ca3af] uppercase"
          >Sesiones abiertas</span
        >
        @if (sesiones().length) {
          <span
            class="rounded-full bg-[#f1f1f1] px-1.5 text-[10.5px] leading-4 font-semibold text-[#4b5563] tabular-nums"
            >{{ sesiones().length }}</span
          >
        }
        @if (activas()) {
          <span class="inline-flex items-center gap-1 text-[11px] font-medium text-[#1f6b43]"
            ><span class="size-1.5 rounded-full bg-[#29845a]"></span
            >{{ activas() === 1 ? '1 activa ahora' : activas() + ' activas ahora' }}</span
          >
        }
      </span>
      @if (sesiones().length > 1) {
        <button
          type="button"
          (click)="cerrarTodas.emit()"
          title="Cerrar todas las sesiones"
          class="flex h-7 shrink-0 cursor-pointer items-center gap-[5px] rounded-full px-2.5 pl-[9px] text-[11.5px] font-semibold whitespace-nowrap text-[#b42318] shadow-[inset_0_0_0_1px_#f1d4d7] transition-[box-shadow] duration-200 hover:shadow-[inset_0_0_0_1px_#f5c2c7]"
        >
          <app-ic nombre="logout-2" [size]="13" />{{
            sesiones().length === 2 ? 'Cerrar las 2' : 'Cerrar todas'
          }}
        </button>
      }
    </div>
    <span class="pb-1.5 text-[11.5px] leading-4 text-[#6b7280]">{{
      sesiones().length ? 'Cierra las que no reconozcas.' : vacio()
    }}</span>

    @for (x of sesiones(); track x.id) {
      @let sal = saliendo() === x.id;
      @let viejo = x.min >= tres;
      <div
        class="grid transition-[grid-template-rows,opacity,transform] duration-[280ms] ease-[cubic-bezier(.2,.8,.2,1)]"
        [style.grid-template-rows]="sal ? '0fr' : '1fr'"
        [style.opacity]="sal ? 0 : 1"
        [style.transform]="sal ? 'translateX(24px)' : 'none'"
      >
        <div class="min-h-0 overflow-hidden">
          <div
            class="my-[3px] grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl bg-[#fafafa] py-[9px] pr-2 pl-[9px] shadow-[inset_0_0_0_1px_#f1f1f1]"
          >
            <span
              class="relative flex size-[34px] items-center justify-center rounded-[10px]"
              [class]="
                x.min === 0
                  ? 'bg-[#e7f6ec] text-[#1f6b43]'
                  : viejo
                    ? 'bg-[#fff6d1] text-[#8a5a00]'
                    : 'bg-[#f1f1f1] text-[#4b5563]'
              "
            >
              <app-ic [nombre]="x.icono" [size]="16" />
              @if (x.min === 0) {
                <span class="absolute -right-[3px] -bottom-[3px] flex size-3"
                  ><span
                    class="absolute inset-0 animate-[gp-latido_2.4s_ease-in-out_infinite] rounded-full bg-[#29845a]"
                  ></span
                  ><span
                    class="relative size-3 rounded-full bg-[#29845a] shadow-[0_0_0_2px_#fff]"
                  ></span
                ></span>
              }
            </span>
            <span class="flex min-w-0 flex-col gap-0.5">
              <span class="flex min-w-0 items-center gap-1.5">
                <span class="truncate text-[12.5px] font-semibold text-[#111827]">{{
                  x.disp
                }}</span>
                @if (x.esEste) {
                  <span
                    class="shrink-0 rounded-[5px] bg-[#e0f7f5] px-1.5 text-[10.5px] leading-[17px] font-semibold text-[#00605b]"
                    >Este equipo</span
                  >
                }
              </span>
              <span
                class="flex min-w-0 items-center gap-1 overflow-hidden text-[11.5px] whitespace-nowrap"
                [class]="viejo ? 'text-[#8a5a00]' : 'text-[#6b7280]'"
              >
                <app-ic
                  [nombre]="viejo ? 'alert-triangle' : 'map-pin'"
                  [size]="12"
                  class="shrink-0"
                />
                <span class="truncate"
                  >{{ x.lugar ? x.lugar + ' · ' : ''
                  }}{{ x.min === 0 ? 'activa ahora' : x.hace }}</span
                >
              </span>
            </span>
            @if (!x.esEste) {
              <button
                type="button"
                (click)="salir(x.id)"
                title="Cerrar esta sesión"
                [attr.aria-label]="'Cerrar sesión en ' + x.disp"
                class="flex size-[30px] shrink-0 cursor-pointer items-center justify-center rounded-full text-[#9ca3af] transition-[background-color,color] duration-200 hover:bg-[#fde2e4] hover:text-[#b42318]"
              >
                <app-ic nombre="logout" [size]="14" />
              </button>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class SesionesAbiertasComponent {
  readonly sesiones = input<SesionVM[]>([]);
  /** Sin sesiones: «Todavía no ha entrado a Goods.», «No tiene sesiones abiertas.»… */
  readonly vacio = input('No tiene sesiones abiertas.');
  readonly cerrar = output<number>();
  readonly cerrarTodas = output<void>();
  protected readonly tres = TRES_DIAS;
  protected readonly saliendo = signal<number | null>(null);
  protected readonly activas = computed(() => this.sesiones().filter((x) => x.min === 0).length);
  protected salir(id: number): void {
    this.saliendo.set(id);
    setTimeout(() => {
      this.cerrar.emit(id);
      this.saliendo.set(null);
    }, 280);
  }
}
