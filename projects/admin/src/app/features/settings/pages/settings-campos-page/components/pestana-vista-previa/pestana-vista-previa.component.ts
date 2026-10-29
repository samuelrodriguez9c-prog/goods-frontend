import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import {
  CampoPersonalizado,
  EntidadCampo,
  errorValor,
} from '../../../../../../core/campos/campo-personalizado.model';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import { COLORES, SINGULAR_ENTIDAD, nombreEntidad } from '../../campos.util';
import { SegmentosComponent } from '../segmentos/segmentos.component';

type Valor = string | string[];

/**
 * Pestaña «Vista previa»: el formulario de la sección como lo verá el
 * equipo (solo los campos activos, en su orden), con el campo abierto
 * marcado «Editando». Arranca con los valores por defecto; «Probar guardar»
 * marca lo que no pasaría con las mismas reglas que el backend (salvo «No
 * repetir»). En escritorio o en el ancho de un celular.
 */
@Component({
  selector: 'app-pestana-vista-previa',
  standalone: true,
  imports: [IcComponent, SegmentosComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex animate-[st-fade-in-up_.2s_ease-out] flex-col gap-3' },
  template: `
    <div class="flex flex-wrap items-center gap-2">
      <p class="m-0 min-w-[200px] flex-1 px-1 text-[12.5px] leading-[18px] text-[#6b7280]">
        Prueba el formulario de {{ entMin() }} como lo verá tu equipo. Solo salen los campos
        activos, en este orden.
      </p>
      <app-segmentos
        class="grid-cols-2"
        [items]="dispositivos"
        [valor]="movil() ? 'movil' : 'escritorio'"
        (elegir)="movil.set($event === 'movil')"
      />
    </div>
    <div class="flex justify-center rounded-[18px] bg-[#f4f4f4] p-4">
      <div
        class="flex w-full flex-col gap-[18px] rounded-2xl border border-[#ebebeb] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,.03),0_12px_28px_-22px_rgba(0,0,0,.28)] transition-[max-width] duration-[350ms] ease-[cubic-bezier(.2,.8,.2,1)]"
        [style.max-width]="movil() ? '360px' : '100%'"
      >
        <div class="flex items-start gap-3">
          <span
            class="flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[#f4f4f4] text-[#303030]"
            ><app-ic nombre="forms" [size]="17"
          /></span>
          <span class="flex min-w-0 flex-1 flex-col gap-0.5"
            ><span class="text-[15px] font-semibold tracking-[-0.005em] text-[#111827]"
              >Campos propios</span
            ><span class="text-xs leading-[17px] text-[#8a8a8a]"
              >Los datos que tu negocio guarda de cada {{ singular() }}.</span
            ></span
          >
        </div>
        <div
          class="grid gap-x-4 gap-y-[18px]"
          [style.grid-template-columns]="
            movil() ? 'minmax(0,1fr)' : 'repeat(auto-fill,minmax(220px,1fr))'
          "
        >
          @for (c of activos(); track c.id) {
            @let v = valor(c);
            @let err = mostrar(c);
            @let actual = c.id === campoId();
            <div
              class="-m-2 flex min-w-0 flex-col gap-[7px] rounded-xl p-2 transition-colors duration-200"
              [style.background]="actual ? '#f4fbfa' : 'transparent'"
            >
              <span class="flex items-center gap-1.5 text-[13px] font-semibold text-[#303030]"
                >{{ c.etiqueta }}
                @if (c.obligatorio) {
                  <span class="text-[#d82c0d]">*</span>
                }
                @if (actual) {
                  <span
                    class="rounded-md bg-[#d9f5f3] px-1.5 text-[10.5px] font-semibold leading-[17px] text-[#0f5e59]"
                    >Editando</span
                  >
                }
              </span>
              @switch (c.tipo) {
                @case ('lista') {
                  <div class="flex flex-wrap gap-1.5">
                    @for (o of c.opciones ?? []; track o; let i = $index) {
                      @let on = lista(v).includes(o);
                      <button
                        type="button"
                        (click)="elegir(c, o)"
                        class="flex h-[30px] items-center gap-1.5 rounded-full px-[11px] text-[12.5px] font-medium transition-colors duration-150"
                        [style.background]="on ? '#303030' : '#fff'"
                        [style.color]="on ? '#fff' : '#374151'"
                        [style.box-shadow]="
                          on ? 'none' : err ? '0 0 0 1px #f3b7ad' : '0 0 0 1px #e5e5e5'
                        "
                      >
                        <span
                          class="size-[7px] rounded-full"
                          [style.background]="c.colores?.[o] ?? colores[0]"
                        ></span
                        >{{ o }}
                      </button>
                    }
                  </div>
                }
                @case ('si_no') {
                  <span class="grid grid-cols-2 gap-0.5 rounded-[10px] bg-[#f1f1f1] p-[3px]">
                    @for (o of siNo; track o.k) {
                      @let on = v === o.k;
                      <button
                        type="button"
                        (click)="poner(c, on ? '' : o.k)"
                        class="h-[30px] rounded-lg text-[13px] transition-[background-color,box-shadow] duration-200"
                        [style.background]="on ? '#fff' : 'transparent'"
                        [style.font-weight]="on ? 600 : 500"
                        [style.color]="on ? '#111827' : '#6b7280'"
                        [style.box-shadow]="
                          on ? '0 1px 2px rgba(0,0,0,.08),0 0 0 1px rgba(0,0,0,.04)' : 'none'
                        "
                      >
                        {{ o.t }}
                      </button>
                    }
                  </span>
                }
                @default {
                  @let r = c.reglas ?? {};
                  <label
                    class="flex h-9 items-center gap-2 rounded-[10px] bg-white px-3 transition-shadow duration-150"
                    [style.box-shadow]="
                      err ? '0 0 0 1px #d82c0d,0 0 0 4px rgba(216,44,13,.08)' : '0 0 0 1px #e5e5e5'
                    "
                  >
                    @if (c.tipo === 'numero' && r.unidad && r.unidadPos === 'antes') {
                      <span class="text-[13px] text-[#8a8a8a]">{{ r.unidad }}</span>
                    }
                    <input
                      [type]="c.tipo === 'fecha' ? 'date' : 'text'"
                      [attr.inputmode]="c.tipo === 'numero' ? 'decimal' : null"
                      [value]="v"
                      (input)="poner(c, $any($event.target).value)"
                      [placeholder]="c.placeholder || (c.tipo === 'numero' ? '0' : 'Escribe aquí')"
                      class="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-[#111827] outline-none"
                    />
                    @if (c.tipo === 'numero' && r.unidad && r.unidadPos !== 'antes') {
                      <span class="text-[13px] text-[#8a8a8a]">{{ r.unidad }}</span>
                    }
                  </label>
                }
              }
              @if (err) {
                <span
                  class="flex animate-[st-fade-in-up_.16s_ease-out] items-center gap-[5px] text-xs text-[#c4320a]"
                  ><app-ic nombre="alert-circle" [size]="13" />{{ err }}</span
                >
              }
              @if (nota(c); as n) {
                <span class="text-xs text-[#8a8a8a]">{{ n }}</span>
              }
            </div>
          }
        </div>
        @if (!activos().length) {
          <p class="m-0 text-[12.5px] text-[#6b7280]">
            No hay campos activos en {{ entMin() }}: la tarjeta no aparece en el formulario.
          </p>
        } @else {
          <div class="flex flex-wrap items-center gap-2 border-t border-[#f4f4f4] pt-3.5">
            @if (probado()) {
              @let n = cuentaErrores();
              <span
                class="flex animate-[st-fade-in-up_.18s_ease-out] items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-medium"
                [style.background]="n ? '#fff1f0' : 'rgba(41,132,90,.08)'"
                [style.color]="n ? '#b42318' : '#1f6e49'"
                ><app-ic [nombre]="n ? 'alert-circle' : 'circle-check'" [size]="14" />{{
                  n
                    ? n + (n === 1 ? ' dato por corregir' : ' datos por corregir')
                    : 'Todo en orden: se guardaría'
                }}</span
              >
            }
            <span class="flex-1"></span>
            <button
              type="button"
              (click)="limpiar()"
              class="rounded-full px-3 py-1.5 text-[13px] font-medium text-[#4b5563] hover:bg-[#f1f1f1]"
            >
              Limpiar
            </button>
            <button
              type="button"
              (click)="probado.set(true)"
              class="flex items-center gap-1.5 rounded-full bg-[#303030] px-3.5 py-1.5 text-[13px] font-medium text-white hover:bg-[#1a1a1a]"
            >
              <app-ic nombre="player-play" [size]="14" />Probar guardar
            </button>
          </div>
        }
      </div>
    </div>
  `,
})
export class PestanaVistaPreviaComponent {
  /** Los campos de la sección con el borrador en su lugar (activos e inactivos). */
  readonly campos = input.required<CampoPersonalizado[]>();
  /** Id del campo abierto (`-1` si es nuevo): se marca «Editando». Al cambiar se reinicia la prueba. */
  readonly campoId = input<number>(-1);
  readonly entidad = input.required<EntidadCampo>();

  protected readonly colores = COLORES;
  protected readonly dispositivos = [
    { k: 'escritorio', t: 'Escritorio', icono: 'device-desktop' },
    { k: 'movil', t: 'Móvil', icono: 'device-mobile' },
  ];
  protected readonly siNo = [
    { k: 'si', t: 'Sí' },
    { k: 'no', t: 'No' },
  ];
  protected readonly movil = signal(false);
  protected readonly probado = signal(false);
  /** Lo que se escribió; lo que no está aquí arranca con el valor por defecto. */
  private readonly prueba = signal<Record<number, Valor>>({});

  protected readonly activos = computed(() => this.campos().filter((c) => c.activo));
  protected readonly entMin = computed(() => nombreEntidad(this.entidad()).toLowerCase());
  protected readonly singular = computed(() => SINGULAR_ENTIDAD[this.entidad()]);
  protected readonly cuentaErrores = computed(
    () => this.activos().filter((c) => this.error(c, this.valor(c))).length,
  );

  constructor() {
    effect(() => {
      void this.campoId();
      this.prueba.set({});
      this.probado.set(false);
    });
  }

  protected valor(c: CampoPersonalizado): Valor {
    const p = this.prueba()[c.id];
    if (p !== undefined) return p;
    const d = c.defecto;
    if (d == null) return c.tipo === 'lista' ? [] : '';
    if (c.tipo === 'lista') return Array.isArray(d) ? d : [String(d)];
    if (c.tipo === 'si_no') return d === true ? 'si' : 'no';
    return String(d);
  }

  protected lista(v: Valor): string[] {
    return Array.isArray(v) ? v : [];
  }

  protected poner(c: CampoPersonalizado, v: Valor): void {
    this.prueba.update((p) => ({ ...p, [c.id]: v }));
  }

  /** Una sola opción reemplaza; con «Permitir varias» se suman y quitan. */
  protected elegir(c: CampoPersonalizado, o: string): void {
    const xs = this.lista(this.valor(c));
    const on = xs.includes(o);
    this.poner(c, on ? xs.filter((x) => x !== o) : c.reglas?.multiple ? [...xs, o] : [o]);
  }

  /** El error se ve al probar o en cuanto se escribe algo. */
  protected mostrar(c: CampoPersonalizado): string {
    const v = this.valor(c);
    const vacio = Array.isArray(v) ? !v.length : !v.trim();
    return this.probado() || !vacio ? this.error(c, v) : '';
  }

  private error(c: CampoPersonalizado, v: Valor): string {
    if (Array.isArray(v)) return !v.length && c.obligatorio ? 'Este dato es obligatorio.' : '';
    return errorValor(c, v);
  }

  protected nota(c: CampoPersonalizado): string {
    return c.ayuda || (c.tipo === 'lista' && c.reglas?.multiple ? 'Puedes elegir varias.' : '');
  }

  protected limpiar(): void {
    this.prueba.set({});
    this.probado.set(false);
  }
}
