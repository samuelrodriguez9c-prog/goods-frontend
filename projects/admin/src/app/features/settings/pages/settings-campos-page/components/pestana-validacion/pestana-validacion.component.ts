import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
  output,
} from '@angular/core';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import {
  BorradorCampo,
  FORMATOS,
  ReglasBorrador,
  llevaDefecto,
  nombreEntidad,
} from '../../campos.util';
import { InterruptorComponent } from '../interruptor/interruptor.component';
import { CambioCampo } from '../pestana-general/pestana-general.component';
import { SegmentosComponent } from '../segmentos/segmentos.component';
import { TarjetaCampoComponent } from '../tarjeta-campo/tarjeta-campo.component';

const AYUDA: Record<BorradorCampo['tipo'], string> = {
  texto: 'Largo y formato del texto.',
  numero: 'Rango, decimales y unidad.',
  fecha: 'Fechas permitidas y avisos.',
  lista: 'Cuántas opciones se pueden elegir.',
  si_no: 'Nada que validar.',
};

/**
 * Pestaña «Validación»: «Qué se acepta» (reglas según el tipo) y «Al
 * llenarlo» (texto de ejemplo y valor por defecto). El backend valida lo
 * mismo al guardar un registro; «No repetir» y «Aviso antes de la fecha» los
 * hace solo él.
 */
@Component({
  selector: 'app-pestana-validacion',
  standalone: true,
  imports: [IcComponent, TarjetaCampoComponent, InterruptorComponent, SegmentosComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex animate-[st-fade-in-up_.2s_ease-out] flex-col gap-3' },
  template: `
    @let d = borrador();
    @let r = d.reglas;
    <app-tarjeta-campo icono="shield-check" titulo="Qué se acepta" [descripcion]="ayuda()">
      @if (d.tipo === 'texto' || d.tipo === 'numero') {
        <div class="grid grid-cols-2 gap-3">
          @for (x of limites(); track x.k) {
            <label class="flex flex-col gap-2"
              ><span class="text-[13px] font-semibold text-[#303030]">{{ x.t }}</span
              ><input
                [value]="r[x.k]"
                (input)="numero(x.k, $any($event.target))"
                [disabled]="soloLectura()"
                inputmode="decimal"
                placeholder="Sin límite"
                class="w-full rounded-[10px] border-0 bg-[#fafafa] px-3 py-[9px] text-[13px] tabular-nums text-[#111827] shadow-[0_0_0_1px_#e5e5e5] outline-none focus:bg-white focus:shadow-[0_0_0_1px_#303030,0_0_0_4px_rgba(48,48,48,.08)]"
            /></label>
          }
        </div>
        @if (errorRango()) {
          <span class="-mt-2.5 text-xs text-[#b42318]">{{ errorRango() }}</span>
        }
      }

      @if (d.tipo === 'texto') {
        <div class="flex flex-col gap-2">
          <span class="text-[13px] font-semibold text-[#303030]">Formato</span>
          <app-segmentos
            class="grid-cols-4"
            [items]="formatos"
            [valor]="r.formato"
            [deshabilitado]="soloLectura()"
            (elegir)="regla('formato', $any($event))"
          />
          <span class="text-xs text-[#8a8a8a]">{{ ayudaFormato() }}</span>
        </div>
      }
      @if (d.tipo === 'texto' || d.tipo === 'numero') {
        <app-interruptor
          class="border-t border-[#f4f4f4] pt-4"
          titulo="No repetir"
          [ayuda]="'Dos ' + entMin() + ' no pueden tener el mismo valor. Útil para NIT o códigos.'"
          [on]="r.unico"
          [deshabilitado]="soloLectura()"
          (cambiar)="regla('unico', $event)"
        />
      }

      @if (d.tipo === 'numero') {
        <div class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-x-6 gap-y-4">
          <div class="flex flex-col gap-2">
            <span class="text-[13px] font-semibold text-[#303030]">Decimales</span>
            <div
              class="flex w-fit items-center rounded-[10px] bg-[#fafafa] shadow-[0_0_0_1px_#e5e5e5]"
            >
              <button
                type="button"
                (click)="regla('decimales', max0(r.decimales - 1))"
                [disabled]="soloLectura() || r.decimales <= 0"
                class="flex h-9 w-[34px] items-center justify-center rounded-l-[10px] text-[#4b5563] hover:bg-[#f1f1f1] disabled:opacity-40"
              >
                <app-ic nombre="minus" [size]="14" />
              </button>
              <span
                class="min-w-9 text-center text-[13px] font-semibold tabular-nums text-[#111827]"
                >{{ r.decimales }}</span
              >
              <button
                type="button"
                (click)="regla('decimales', r.decimales + 1)"
                [disabled]="soloLectura() || r.decimales >= 4"
                class="flex h-9 w-[34px] items-center justify-center rounded-r-[10px] text-[#4b5563] hover:bg-[#f1f1f1] disabled:opacity-40"
              >
                <app-ic nombre="plus" [size]="14" />
              </button>
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <span class="text-[13px] font-semibold text-[#303030]">Unidad</span>
            <div class="flex gap-1.5">
              <input
                [value]="r.unidad"
                (input)="regla('unidad', $any($event.target).value)"
                [disabled]="soloLectura()"
                maxlength="8"
                placeholder="kg, $, días"
                class="min-w-0 flex-1 rounded-[10px] border-0 bg-[#fafafa] px-3 py-[9px] text-[13px] text-[#111827] shadow-[0_0_0_1px_#e5e5e5] outline-none focus:bg-white focus:shadow-[0_0_0_1px_#303030,0_0_0_4px_rgba(48,48,48,.08)]"
              />
              <app-segmentos
                class="grid-cols-2"
                [alto]="30"
                [items]="posiciones"
                [valor]="r.unidadPos"
                [deshabilitado]="soloLectura()"
                (elegir)="regla('unidadPos', $any($event))"
              />
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2.5 rounded-xl bg-[#f7f7f7] px-3.5 py-2.5">
          <span class="text-xs text-[#6b7280]">Se verá así</span>
          <span class="font-display text-base font-semibold tabular-nums text-[#111827]">{{
            ejemplo()
          }}</span>
        </div>
      }

      @if (d.tipo === 'fecha') {
        <app-interruptor
          titulo="No permitir fechas pasadas"
          ayuda="Para vencimientos o entregas programadas."
          [on]="r.noPasadas"
          [deshabilitado]="soloLectura()"
          (cambiar)="regla('noPasadas', $event)"
        />
        <div class="flex flex-wrap items-center gap-3 border-t border-[#f4f4f4] pt-4">
          <span class="flex min-w-0 flex-1 flex-col gap-0.5"
            ><span class="text-[13px] font-semibold text-[#303030]">Aviso antes de la fecha</span
            ><span class="text-xs text-[#6b7280]">{{
              r.aviso
                ? 'Te avisamos en el panel ' + r.aviso + ' días antes de cada fecha.'
                : 'No avisamos antes de la fecha.'
            }}</span></span
          >
          <div class="flex items-center rounded-[10px] bg-[#fafafa] shadow-[0_0_0_1px_#e5e5e5]">
            <button
              type="button"
              (click)="regla('aviso', max0(r.aviso - 5))"
              [disabled]="soloLectura() || !r.aviso"
              class="flex h-9 w-[34px] items-center justify-center rounded-l-[10px] text-[#4b5563] hover:bg-[#f1f1f1] disabled:opacity-40"
            >
              <app-ic nombre="minus" [size]="14" />
            </button>
            <span
              class="min-w-16 text-center text-[13px] font-semibold tabular-nums text-[#111827]"
              >{{ r.aviso ? r.aviso + ' días' : 'Sin aviso' }}</span
            >
            <button
              type="button"
              (click)="regla('aviso', Math.min(90, r.aviso + 5))"
              [disabled]="soloLectura() || r.aviso >= 90"
              class="flex h-9 w-[34px] items-center justify-center rounded-r-[10px] text-[#4b5563] hover:bg-[#f1f1f1] disabled:opacity-40"
            >
              <app-ic nombre="plus" [size]="14" />
            </button>
          </div>
        </div>
      }

      @if (d.tipo === 'lista') {
        <app-interruptor
          titulo="Permitir varias"
          ayuda="Por ejemplo, un producto disponible en varios colores."
          [on]="r.multiple"
          [deshabilitado]="soloLectura()"
          (cambiar)="regla('multiple', $event)"
        />
      }
      @if (d.tipo === 'si_no') {
        <p class="m-0 text-[12.5px] leading-[18px] text-[#6b7280]">
          Un sí / no siempre es válido. Si es obligatorio, hay que elegir una de las dos.
        </p>
      }
    </app-tarjeta-campo>

    <app-tarjeta-campo
      icono="pencil"
      titulo="Al llenarlo"
      descripcion="Lo que ve tu equipo antes de escribir."
    >
      @if (d.tipo === 'texto' || d.tipo === 'numero') {
        <div class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
          <label class="flex flex-col gap-2"
            ><span class="text-[13px] font-semibold text-[#303030]">Texto de ejemplo</span
            ><input
              [value]="d.placeholder"
              (input)="cambio.emit({ k: 'placeholder', v: $any($event.target).value })"
              [disabled]="soloLectura()"
              maxlength="40"
              placeholder="Ej. ABC-123"
              class="w-full rounded-[10px] border-0 bg-[#fafafa] px-3 py-[9px] text-[13px] text-[#111827] shadow-[0_0_0_1px_#e5e5e5] outline-none focus:bg-white focus:shadow-[0_0_0_1px_#303030,0_0_0_4px_rgba(48,48,48,.08)]"
          /></label>
          <label class="flex flex-col gap-2"
            ><span class="text-[13px] font-semibold text-[#303030]">Valor por defecto</span
            ><input
              [value]="conDefecto() ? d.defecto : ''"
              (input)="cambio.emit({ k: 'defecto', v: $any($event.target).value })"
              [disabled]="soloLectura() || !conDefecto()"
              [attr.inputmode]="d.tipo === 'numero' ? 'decimal' : null"
              maxlength="40"
              [placeholder]="conDefecto() ? 'Vacío' : 'No aplica con «No repetir»'"
              class="w-full rounded-[10px] border-0 bg-[#fafafa] px-3 py-[9px] text-[13px] text-[#111827] shadow-[0_0_0_1px_#e5e5e5] outline-none focus:bg-white focus:shadow-[0_0_0_1px_#303030,0_0_0_4px_rgba(48,48,48,.08)] disabled:opacity-60"
          /></label>
        </div>
        @if (errorDefecto()) {
          <span class="-mt-2.5 text-xs text-[#b42318]">{{ errorDefecto() }}</span>
        }
      }
      @if (d.tipo === 'lista') {
        <div class="flex flex-col gap-2">
          <span class="text-[13px] font-semibold text-[#303030]">Opción por defecto</span>
          <div class="flex flex-wrap gap-1.5">
            @for (o of d.opciones; track o) {
              @let on = d.defecto === o;
              <button
                type="button"
                (click)="cambio.emit({ k: 'defecto', v: on ? '' : o })"
                [disabled]="soloLectura()"
                class="flex h-[30px] items-center gap-1.5 rounded-full px-[11px] text-[12.5px] font-medium transition-colors duration-150"
                [style.background]="on ? '#303030' : '#fff'"
                [style.color]="on ? '#fff' : '#374151'"
                [style.box-shadow]="on ? 'none' : '0 0 0 1px #e5e5e5'"
              >
                <span class="size-[7px] rounded-full" [style.background]="d.colores[o]"></span
                >{{ o }}
              </button>
            } @empty {
              <span class="text-xs text-[#9ca3af]">Agrega opciones en General.</span>
            }
          </div>
          <span class="text-xs text-[#8a8a8a]">Toca de nuevo para dejarlo sin valor.</span>
        </div>
      }
      @if (d.tipo === 'si_no') {
        <div class="flex flex-col gap-2">
          <span class="text-[13px] font-semibold text-[#303030]">Valor por defecto</span>
          <app-segmentos
            class="max-w-[340px] grid-cols-3"
            [alto]="30"
            [items]="siNo"
            [valor]="d.defecto"
            [deshabilitado]="soloLectura()"
            (elegir)="cambio.emit({ k: 'defecto', v: $event })"
          />
        </div>
      }
      @if (d.tipo === 'fecha') {
        <p class="m-0 text-[12.5px] leading-[18px] text-[#6b7280]">
          Las fechas se llenan con el calendario; no llevan texto de ejemplo ni valor por defecto.
        </p>
      }
    </app-tarjeta-campo>
  `,
})
export class PestanaValidacionComponent {
  readonly borrador = input.required<BorradorCampo>();
  readonly errorRango = input('');
  readonly errorDefecto = input('');
  readonly soloLectura = input(false, { transform: booleanAttribute });
  readonly cambio = output<CambioCampo>();

  protected readonly Math = Math;
  protected readonly formatos = FORMATOS.map((f) => ({ k: f.k, t: f.t }));
  protected readonly posiciones = [
    { k: 'antes', t: 'Antes' },
    { k: 'despues', t: 'Después' },
  ];
  protected readonly siNo = [
    { k: '', t: 'Sin valor' },
    { k: 'si', t: 'Sí' },
    { k: 'no', t: 'No' },
  ];
  protected readonly ayuda = computed(() => AYUDA[this.borrador().tipo]);
  protected readonly entMin = computed(() => nombreEntidad(this.borrador().entidad).toLowerCase());
  protected readonly ayudaFormato = computed(
    () => FORMATOS.find((f) => f.k === this.borrador().reglas.formato)?.d ?? '',
  );
  protected readonly conDefecto = computed(() => llevaDefecto(this.borrador()));
  protected readonly limites = computed(() => {
    const texto = this.borrador().tipo === 'texto';
    return [
      { k: 'min' as const, t: texto ? 'Largo mínimo' : 'Mínimo' },
      { k: 'max' as const, t: texto ? 'Largo máximo' : 'Máximo' },
    ];
  });
  /** «1.250,00 kg» con los decimales y la unidad elegidos. */
  protected readonly ejemplo = computed(() => {
    const r = this.borrador().reglas;
    const n = (1250).toLocaleString('es-CO', {
      minimumFractionDigits: r.decimales,
      maximumFractionDigits: r.decimales,
    });
    const u = r.unidad.trim();
    return u ? (r.unidadPos === 'antes' ? `${u} ${n}` : `${n} ${u}`) : n;
  });

  protected max0(n: number): number {
    return Math.max(0, n);
  }

  protected regla<K extends keyof ReglasBorrador>(k: K, v: ReglasBorrador[K]): void {
    this.cambio.emit({ k: 'reglas', v: { ...this.borrador().reglas, [k]: v } });
  }

  /** Mínimo y máximo: solo dígitos, signo y separador decimal (el largo de un texto, sin decimales). */
  protected numero(k: 'min' | 'max', el: HTMLInputElement): void {
    const texto = this.borrador().tipo === 'texto';
    const v = el.value.replace(texto ? /[^\d]/g : /[^\d.,-]/g, '').replace(',', '.');
    if (v !== el.value) el.value = v;
    this.regla(k, v);
  }
}
