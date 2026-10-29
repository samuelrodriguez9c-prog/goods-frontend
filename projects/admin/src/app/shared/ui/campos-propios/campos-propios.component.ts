import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { CampoPersonalizado, ValoresCampos, partirOpciones } from '../../../core/campos/campo-personalizado.model';

/** Hasta este número de opciones una lista se elige con chips; más, con un selector. */
const CHIPS_MAX = 6;

/**
 * Los campos propios de la Empresa dentro de un formulario (producto,
 * cliente, pedido, proveedor). No guarda nada: muestra `valores` y avisa
 * cada cambio; el formulario los manda como `atributos`.
 *
 * @remarks
 * - Una lista con `reglas.multiple` se elige siempre con chips y guarda las
 *   opciones separadas por comas (ver `atributosDe`).
 * - Muestra la ayuda, el texto de ejemplo, la unidad y el color de cada
 *   opción. Un campo «Solo administradores» (`editan: 'admin'`) queda de solo
 *   lectura para quien no tiene `campos.gestionar` (el backend lo rechazaría).
 */
@Component({
  selector: 'app-campos-propios',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-4 gap-y-[18px]' },
  template: `
    @for (c of campos(); track c.id) {
      @let v = valor(c.clave);
      @let e = mostrarErrores() ? errores()[c.clave] : '';
      @let bloqueado = soloLectura() || (c.editan === 'admin' && !esAdmin());
      @let r = c.reglas ?? {};
      <div class="flex min-w-0 flex-col gap-2" [class.col-span-full]="c.tipo === 'lista' && (c.opciones?.length ?? 0) > 3">
        <label [for]="'cp-' + c.clave" class="flex items-center gap-2 text-[13px] font-semibold text-[#303030]">
          <span class="truncate">{{ c.etiqueta }}</span>
          @if (c.obligatorio) {
            <span class="rounded-md bg-[#ffe6e5] px-[7px] py-px text-[11px] font-medium leading-[17px] text-[#c4320a]">Requerido</span>
          }
          @if (c.editan === 'admin' && !esAdmin()) {
            <span title="Solo lo cambian quienes administran los campos propios" class="rounded-md bg-[#f1f1f1] px-[7px] py-px text-[11px] font-medium leading-[17px] text-[#6b7280]">Solo administradores</span>
          }
        </label>
        @switch (c.tipo) {
          @case ('lista') {
            @if (r.multiple) {
              <div class="flex flex-wrap gap-1.5" role="group" [attr.aria-label]="c.etiqueta">
                @for (o of opcionesCon(c, v); track o) {
                  @let on = elegidas(v).includes(o);
                  <button
                    type="button"
                    [attr.aria-pressed]="on"
                    [disabled]="bloqueado"
                    (click)="cambio.emit({ clave: c.clave, valor: alternar(v, o) })"
                    class="flex items-center gap-1.5 rounded-full px-3 py-[5px] text-[12.5px] font-medium transition-colors"
                    [class]="on ? 'bg-[#303030] text-white' : 'bg-[#f4f4f4] text-[#303030] hover:bg-[#ebebeb]'"
                  >
                    @if (c.colores?.[o]; as hex) {
                      <span class="size-[7px] rounded-full" [style.background]="hex"></span>
                    }
                    {{ o }}
                  </button>
                }
              </div>
            } @else if ((c.opciones?.length ?? 0) <= chipsMax) {
              <div class="flex flex-wrap gap-1.5" role="radiogroup" [attr.aria-label]="c.etiqueta">
                @for (o of opcionesCon(c, v); track o) {
                  @let on = v === o;
                  <button
                    type="button"
                    role="radio"
                    [attr.aria-checked]="on"
                    [disabled]="bloqueado"
                    (click)="cambio.emit({ clave: c.clave, valor: on && !c.obligatorio ? '' : o })"
                    class="flex items-center gap-1.5 rounded-full px-3 py-[5px] text-[12.5px] font-medium transition-colors"
                    [class]="on ? 'bg-[#303030] text-white' : 'bg-[#f4f4f4] text-[#303030] hover:bg-[#ebebeb]'"
                  >
                    @if (c.colores?.[o]; as hex) {
                      <span class="size-[7px] rounded-full" [style.background]="hex"></span>
                    }
                    {{ o }}
                  </button>
                }
              </div>
            } @else {
              <select
                [id]="'cp-' + c.clave"
                [value]="v"
                [disabled]="bloqueado"
                (change)="cambio.emit({ clave: c.clave, valor: $any($event.target).value })"
                class="w-full rounded-[10px] border-0 bg-[#fafafa] px-3 py-[9px] text-[13px] outline-none shadow-[0_0_0_1px_#e5e5e5] focus:bg-white focus:shadow-[0_0_0_1px_#303030,0_0_0_4px_rgba(48,48,48,.08)]"
                [style.box-shadow]="e ? '0 0 0 1px #e51c00' : null"
              >
                <option value="">{{ c.obligatorio ? 'Elige una opción' : 'Sin dato' }}</option>
                @for (o of opcionesCon(c, v); track o) {
                  <option [value]="o" [selected]="v === o">{{ o }}</option>
                }
              </select>
            }
          }
          @case ('si_no') {
            <div class="flex gap-1.5" role="radiogroup" [attr.aria-label]="c.etiqueta">
              @for (o of siNo; track o[0]) {
                @let on = v === o[0];
                <button
                  type="button"
                  role="radio"
                  [attr.aria-checked]="on"
                  [disabled]="bloqueado"
                  (click)="cambio.emit({ clave: c.clave, valor: on && !c.obligatorio ? '' : o[0] })"
                  class="min-w-[52px] rounded-full px-3 py-[5px] text-[12.5px] font-medium transition-colors"
                  [class]="on ? 'bg-[#303030] text-white' : 'bg-[#f4f4f4] text-[#303030] hover:bg-[#ebebeb]'"
                >{{ o[1] }}</button>
              }
            </div>
          }
          @default {
            <div class="relative flex items-center">
              @if (c.tipo === 'numero' && r.unidad && r.unidadPos === 'antes') {
                <span class="pointer-events-none absolute left-3 text-[13px] text-[#8a8a8a]">{{ r.unidad }}</span>
              }
              <input
                [id]="'cp-' + c.clave"
                [type]="c.tipo === 'fecha' ? 'date' : 'text'"
                [attr.inputmode]="c.tipo === 'numero' ? 'decimal' : null"
                [attr.maxlength]="c.tipo === 'texto' ? (r.max ?? 500) : null"
                [attr.min]="c.tipo === 'fecha' && r.noPasadas ? hoy : null"
                [placeholder]="c.placeholder ?? ''"
                [value]="v"
                [disabled]="bloqueado"
                (input)="cambio.emit({ clave: c.clave, valor: $any($event.target).value })"
                class="w-full rounded-[10px] border-0 bg-[#fafafa] px-3 py-[9px] text-[13px] outline-none shadow-[0_0_0_1px_#e5e5e5] transition-[box-shadow,background-color] focus:bg-white focus:shadow-[0_0_0_1px_#303030,0_0_0_4px_rgba(48,48,48,.08)]"
                [class.tabular-nums]="c.tipo === 'numero'"
                [class.uppercase]="r.formato === 'mayusculas'"
                [style.padding-left.px]="c.tipo === 'numero' && r.unidad && r.unidadPos === 'antes' ? 14 + r.unidad.length * 8 : null"
                [style.padding-right.px]="c.tipo === 'numero' && r.unidad && r.unidadPos !== 'antes' ? 14 + r.unidad.length * 8 : null"
                [style.box-shadow]="e ? '0 0 0 1px #e51c00' : null"
              />
              @if (c.tipo === 'numero' && r.unidad && r.unidadPos !== 'antes') {
                <span class="pointer-events-none absolute right-3 text-[13px] text-[#8a8a8a]">{{ r.unidad }}</span>
              }
            </div>
          }
        }
        @if (c.ayuda || (c.tipo === 'lista' && r.multiple)) {
          <span class="text-xs text-[#8a8a8a]">{{ c.ayuda || 'Puedes elegir varias.' }}</span>
        }
        @if (e) {
          <span class="text-xs text-[#b42318] animate-[fade-in-up_.2s_ease-out]">{{ e }}</span>
        }
      </div>
    }
  `,
})
export class CamposPropiosComponent {
  /** Solo los activos, en orden. */
  readonly campos = input.required<CampoPersonalizado[]>();
  readonly valores = input.required<ValoresCampos>();
  readonly errores = input<Record<string, string>>({});
  /** Los errores se muestran después del primer intento de guardar. */
  readonly mostrarErrores = input(false);
  readonly soloLectura = input(false);
  readonly cambio = output<{ clave: string; valor: string }>();

  private readonly auth = inject(AuthService);

  protected readonly chipsMax = CHIPS_MAX;
  /** Puede cambiar los campos «Solo administradores». */
  protected readonly esAdmin = computed(() => this.auth.currentUser()?.permisos.includes('campos.gestionar') ?? false);
  protected readonly hoy = new Date().toLocaleDateString('en-CA');
  protected readonly siNo = [['true', 'Sí'], ['false', 'No']] as const;

  protected valor(clave: string): string {
    return (this.valores() as Partial<ValoresCampos>)[clave] ?? '';
  }

  /** Si el valor guardado ya no está en la lista (se quitó la opción), igual se muestra. */
  protected opcionesCon(c: CampoPersonalizado, v: string): string[] {
    const xs = c.opciones ?? [];
    const guardadas = c.reglas?.multiple ? partirOpciones(v) : v ? [v] : [];
    return [...xs, ...guardadas.filter((x) => !xs.includes(x))];
  }

  protected elegidas(v: string): string[] {
    return partirOpciones(v);
  }

  /** Suma o quita una opción de una lista de varias. */
  protected alternar(v: string, o: string): string {
    const xs = partirOpciones(v);
    return (xs.includes(o) ? xs.filter((x) => x !== o) : [...xs, o]).join(', ');
  }
}
