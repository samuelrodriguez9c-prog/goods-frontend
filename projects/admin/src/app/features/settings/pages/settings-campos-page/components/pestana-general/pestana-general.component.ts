import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  booleanAttribute,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  ENTIDADES,
  TIPOS,
  TipoCampo,
} from '../../../../../../core/campos/campo-personalizado.model';
import { normalizar } from '../../../../../../shared/ui/persona';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import { PuntoRadioComponent } from '../../../../shared/ui/punto-radio/punto-radio.component';
import { BorradorCampo, COLORES, ICONO_TIPO, LugarCampo, nombreEntidad } from '../../campos.util';
import { InterruptorComponent } from '../interruptor/interruptor.component';
import { SegmentosComponent } from '../segmentos/segmentos.component';
import { TarjetaCampoComponent } from '../tarjeta-campo/tarjeta-campo.component';

/** Un cambio del borrador: campo y valor nuevo. */
export type CambioCampo = {
  [K in keyof BorradorCampo]: { k: K; v: BorradorCampo[K] };
}[keyof BorradorCampo];

/**
 * Pestaña «General» de la hoja del campo: Identidad (nombre, ayuda y
 * sección), Tipo de dato, Opciones (solo listas: color, nombre, uso y orden)
 * y Reglas (obligatorio, estado y orden en el formulario). No guarda: emite
 * cada `cambio` al borrador de la página. Sección y tipo solo se eligen al
 * crear.
 */
@Component({
  selector: 'app-pestana-general',
  standalone: true,
  imports: [
    IcComponent,
    PuntoRadioComponent,
    TarjetaCampoComponent,
    InterruptorComponent,
    SegmentosComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'grid animate-[st-fade-in-up_.2s_ease-out] grid-cols-[repeat(auto-fit,minmax(max(270px,calc((100%-12px)/2)),1fr))] gap-3',
  },
  template: `
    @let d = borrador();
    <!-- Identidad -->
    <app-tarjeta-campo icono="id" titulo="Identidad" descripcion="Cómo se llama y dónde aparece.">
      <label class="flex flex-col gap-2">
        <span class="flex items-center text-[13px] font-semibold text-[#303030]"
          >Nombre <span class="ml-[3px] text-[#d82c0d]">*</span><span class="flex-1"></span
          ><span class="text-[11.5px] font-medium tabular-nums text-[#9ca3af]"
            >{{ d.etiqueta.length }}/40</span
          ></span
        >
        <input
          #campoNombre
          [value]="d.etiqueta"
          (input)="cambio.emit({ k: 'etiqueta', v: $any($event.target).value })"
          [disabled]="soloLectura()"
          maxlength="40"
          placeholder="Ej. Talla"
          class="w-full rounded-[10px] border-0 bg-[#fafafa] px-3 py-[9px] text-[13px] text-[#111827] outline-none focus:bg-white focus:!shadow-[0_0_0_1px_#303030,0_0_0_4px_rgba(48,48,48,.08)]"
          [style.box-shadow]="
            errorNombre() && d.etiqueta ? '0 0 0 1px #d82c0d' : '0 0 0 1px #e5e5e5'
          "
        />
        @if (errorNombre() && d.etiqueta) {
          <span class="text-xs text-[#b42318]">{{ errorNombre() }}</span>
        }
        <span class="flex flex-wrap items-center gap-1.5 text-xs text-[#8a8a8a]"
          >Clave<code
            class="rounded-md bg-[#f4f4f4] px-[7px] py-px font-mono text-[11.5px] text-[#374151]"
            >{{ clave() }}</code
          >para importar y para la API.</span
        >
      </label>
      <label class="flex flex-col gap-2">
        <span class="text-[13px] font-semibold text-[#303030]"
          >Texto de ayuda <span class="font-medium text-[#9ca3af]">· opcional</span></span
        >
        <input
          [value]="d.ayuda"
          (input)="cambio.emit({ k: 'ayuda', v: $any($event.target).value })"
          [disabled]="soloLectura()"
          maxlength="120"
          placeholder="Ej. Según la tabla de medidas de la marca"
          class="w-full rounded-[10px] border-0 bg-[#fafafa] px-3 py-[9px] text-[13px] text-[#111827] shadow-[0_0_0_1px_#e5e5e5] outline-none focus:bg-white focus:shadow-[0_0_0_1px_#303030,0_0_0_4px_rgba(48,48,48,.08)]"
        />
      </label>
      <div class="flex flex-col gap-2">
        <span class="text-[13px] font-semibold text-[#303030]">Dónde se usa</span>
        <app-segmentos
          class="grid-cols-4"
          [items]="entidades"
          [valor]="d.entidad"
          [deshabilitado]="!esNuevo() || soloLectura()"
          (elegir)="cambio.emit({ k: 'entidad', v: $any($event) })"
        />
        @if (!esNuevo()) {
          <span class="text-xs text-[#9ca3af]">No se puede cambiar después de crearlo.</span>
        }
      </div>
    </app-tarjeta-campo>

    <!-- Tipo de dato -->
    <app-tarjeta-campo
      icono="category"
      titulo="Tipo de dato"
      [descripcion]="
        esNuevo()
          ? 'Elige qué se guarda. No se puede cambiar después.'
          : 'No se puede cambiar: los datos guardados dependen de él.'
      "
    >
      <div role="radiogroup" class="-mt-1 flex flex-col gap-1">
        @for (tp of tipos; track tp.k) {
          @let on = d.tipo === tp.k;
          <button
            type="button"
            role="radio"
            [attr.aria-checked]="on"
            (click)="elegirTipo(tp.k)"
            [disabled]="(!esNuevo() && !on) || soloLectura()"
            class="grid grid-cols-[18px_30px_minmax(0,1fr)] items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors duration-200 enabled:hover:bg-[#f7f7f7] disabled:cursor-default"
            [style.background]="on ? '#f4f4f4' : null"
            [style.opacity]="!esNuevo() && !on ? 0.35 : 1"
          >
            <app-punto-radio [on]="on" [tamano]="18" />
            <span
              class="flex size-[30px] items-center justify-center rounded-[9px] bg-[#f1f1f1] text-[#4b5563]"
              ><app-ic [nombre]="iconoTipo[tp.k]"
            /></span>
            <span class="flex min-w-0 flex-col gap-px"
              ><span class="text-[13px] font-semibold text-[#111827]">{{ tp.t }}</span
              ><span class="truncate text-xs text-[#8a8a8a]">{{ tp.d }}</span></span
            >
          </button>
        }
      </div>
    </app-tarjeta-campo>

    <!-- Opciones (solo lista) -->
    @if (d.tipo === 'lista') {
      <app-tarjeta-campo
        class="col-span-full !gap-3.5"
        icono="list"
        titulo="Opciones"
        descripcion="Toca el punto para cambiar el color y el nombre para editarlo. Quitar una opción no borra el dato de los registros que ya la tienen."
        [contador]="d.opciones.length"
      >
        <div class="flex flex-col gap-0.5">
          @for (o of d.opciones; track $index; let i = $index, f = $first, l = $last) {
            <div
              class="grid grid-cols-[22px_minmax(0,1fr)_auto_auto_auto_auto] items-center gap-1.5 rounded-[10px] py-0.5 pl-2 pr-1.5 hover:bg-[#fafafa]"
            >
              <button
                type="button"
                (click)="cambiarColor(o)"
                [disabled]="soloLectura()"
                title="Cambiar color"
                class="flex size-[22px] items-center justify-center rounded-full enabled:hover:bg-[#f1f1f1]"
              >
                <span class="size-3 rounded-full" [style.background]="d.colores[o]"></span>
              </button>
              <input
                [value]="o"
                (change)="renombrar(i, $any($event.target).value)"
                [disabled]="soloLectura()"
                maxlength="60"
                class="min-w-0 rounded-[7px] border-0 bg-transparent px-1.5 py-[7px] text-[13px] font-medium text-[#111827] outline-none focus:bg-white focus:shadow-[0_0_0_1px_#303030]"
              />
              <span
                title="Registros con esta opción"
                class="px-1.5 text-[11.5px] tabular-nums text-[#9ca3af]"
                >{{ usoDe(o) }}</span
              >
              <button
                type="button"
                (click)="mover(i, -1)"
                [disabled]="f || soloLectura()"
                title="Subir"
                class="flex rounded-[7px] p-[5px] text-[#6b7280] hover:bg-[#f1f1f1] hover:text-[#111827] disabled:opacity-30"
              >
                <app-ic nombre="arrow-up" [size]="14" />
              </button>
              <button
                type="button"
                (click)="mover(i, 1)"
                [disabled]="l || soloLectura()"
                title="Bajar"
                class="flex rounded-[7px] p-[5px] text-[#6b7280] hover:bg-[#f1f1f1] hover:text-[#111827] disabled:opacity-30"
              >
                <app-ic nombre="arrow-down" [size]="14" />
              </button>
              <button
                type="button"
                (click)="quitar(i)"
                [disabled]="soloLectura()"
                title="Quitar"
                class="flex rounded-[7px] p-[5px] text-[#6b7280] hover:bg-[#fff1f0] hover:text-[#b42318]"
              >
                <app-ic nombre="x" [size]="14" />
              </button>
            </div>
          }
        </div>
        <label
          class="flex items-center gap-2 rounded-[10px] bg-[#fafafa] px-3 shadow-[0_0_0_1px_#e5e5e5] focus-within:bg-white focus-within:shadow-[0_0_0_1px_#303030,0_0_0_4px_rgba(48,48,48,.08)]"
        >
          <app-ic nombre="plus" [size]="14" class="text-[#8a8a8a]" />
          <input
            [value]="nuevaOpcion()"
            (input)="escribirOpcion($any($event.target).value)"
            (keydown)="teclaOpcion($event)"
            [disabled]="soloLectura()"
            maxlength="60"
            [placeholder]="d.opciones.length ? 'Otra opción' : 'Ej. S, M, L'"
            class="min-w-0 flex-1 border-0 bg-transparent py-[9px] text-[13px] outline-none"
          />
          <span class="hidden text-[11.5px] text-[#9ca3af] sm:inline"
            >Enter para agregar · pega varias separadas por coma</span
          >
        </label>
        @if (avisoOpcion() || errorOpciones()) {
          <span class="-mt-1.5 text-xs text-[#b42318]">{{ avisoOpcion() || errorOpciones() }}</span>
        }
      </app-tarjeta-campo>
    }

    <!-- Reglas -->
    <app-tarjeta-campo
      class="col-span-full"
      icono="adjustments-horizontal"
      titulo="Reglas"
      descripcion="Si es obligatorio, si está activo y en qué orden sale."
    >
      <div class="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-x-6 gap-y-[18px]">
        <app-interruptor
          class="self-center"
          titulo="Obligatorio"
          ayuda="No se puede guardar el registro sin este dato."
          [on]="d.obligatorio"
          [deshabilitado]="soloLectura()"
          (cambiar)="cambio.emit({ k: 'obligatorio', v: $event })"
        />
        <div class="flex flex-col gap-2">
          <span class="text-[13px] font-semibold text-[#303030]">Estado</span>
          <div class="relative grid grid-cols-2 rounded-[10px] bg-[#f1f1f1] p-[3px]">
            <span
              class="absolute inset-y-[3px] left-[3px] w-[calc((100%-6px)/2)] rounded-lg bg-white shadow-[0_1px_2px_rgba(0,0,0,.08),0_0_0_1px_rgba(0,0,0,.04)] transition-[translate] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]"
              [style.translate]="d.activo ? '0' : '100%'"
            ></span>
            @for (e of estados; track e.on) {
              <button
                type="button"
                (click)="cambio.emit({ k: 'activo', v: e.on })"
                [disabled]="soloLectura()"
                class="relative flex h-8 items-center justify-center gap-[7px] text-[13px] disabled:cursor-default"
                [style.font-weight]="d.activo === e.on ? 600 : 500"
                [style.color]="d.activo === e.on ? '#111827' : '#6b7280'"
              >
                <span class="size-[7px] rounded-full" [style.background]="e.punto"></span>{{ e.t }}
              </button>
            }
          </div>
          <span class="text-[12.5px] leading-[18px] text-[#6b7280]">{{
            d.activo
              ? 'Se ve en los formularios, los filtros y la exportación.'
              : 'Deja de verse. Los datos que ya tenía quedan guardados.'
          }}</span>
        </div>
      </div>
      @if (lugar(); as lg) {
        <div class="flex flex-wrap items-center gap-2.5 border-t border-[#f4f4f4] pt-3.5">
          <app-ic nombre="arrows-sort" [size]="15" class="text-[#9ca3af]" />
          <span class="flex min-w-0 flex-1 flex-col gap-px"
            ><span class="text-[13px] font-semibold text-[#303030]">Orden en el formulario</span
            ><span class="text-xs tabular-nums text-[#6b7280]"
              >Sale de {{ lg.i }} entre {{ lg.n }} campos de {{ entMin() }}.</span
            ></span
          >
          <button
            type="button"
            (click)="ordenar.emit(-1)"
            [disabled]="lg.primero || soloLectura()"
            class="flex items-center gap-1.5 rounded-lg bg-[#f1f1f1] px-[11px] py-1.5 text-[12.5px] font-medium text-[#303030] hover:bg-[#e6e6e6] disabled:opacity-35"
          >
            <app-ic nombre="arrow-up" [size]="14" />Subir
          </button>
          <button
            type="button"
            (click)="ordenar.emit(1)"
            [disabled]="lg.ultimo || soloLectura()"
            class="flex items-center gap-1.5 rounded-lg bg-[#f1f1f1] px-[11px] py-1.5 text-[12.5px] font-medium text-[#303030] hover:bg-[#e6e6e6] disabled:opacity-35"
          >
            <app-ic nombre="arrow-down" [size]="14" />Bajar
          </button>
        </div>
      }
    </app-tarjeta-campo>
  `,
})
export class PestanaGeneralComponent {
  readonly borrador = input.required<BorradorCampo>();
  readonly esNuevo = input(false);
  readonly clave = input('');
  readonly errorNombre = input('');
  readonly errorOpciones = input('');
  readonly lugar = input<LugarCampo | null>(null);
  /** Registros por opción (`GET …/uso`); vacío mientras carga o en un campo nuevo. */
  readonly usoOpciones = input<Record<string, number>>({});
  readonly soloLectura = input(false, { transform: booleanAttribute });
  readonly cambio = output<CambioCampo>();
  /** Mueve el campo guardado un lugar arriba (-1) o abajo (1) en su sección. */
  readonly ordenar = output<number>();

  protected readonly entidades = ENTIDADES.map((e) => ({ k: e.k, t: e.t }));
  protected readonly tipos = TIPOS;
  protected readonly iconoTipo = ICONO_TIPO;
  protected readonly estados = [
    { on: true, t: 'Activo', punto: '#29845a' },
    { on: false, t: 'Inactivo', punto: '#9ca3af' },
  ];
  protected readonly nuevaOpcion = signal('');
  protected readonly avisoOpcion = signal('');
  protected readonly entMin = computed(() => nombreEntidad(this.borrador().entidad).toLowerCase());
  private readonly campoNombre = viewChild.required<ElementRef<HTMLInputElement>>('campoNombre');

  enfocarNombre(): void {
    this.campoNombre().nativeElement.focus();
  }

  protected usoDe(o: string): string {
    const n = this.usoOpciones()[o];
    return n ? n.toLocaleString('es-CO') : '—';
  }

  protected elegirTipo(t: TipoCampo): void {
    if (t === this.borrador().tipo) return;
    this.cambio.emit({ k: 'tipo', v: t });
    this.cambio.emit({ k: 'defecto', v: '' });
  }

  protected escribirOpcion(v: string): void {
    this.avisoOpcion.set('');
    if (v.includes(',')) this.agregar(v);
    else this.nuevaOpcion.set(v);
  }

  protected teclaOpcion(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.agregar(this.nuevaOpcion());
    } else if (e.key === 'Backspace' && !this.nuevaOpcion()) {
      const o = this.borrador().opciones;
      if (o.length) this.quitar(o.length - 1);
    }
  }

  /** Agrega una o varias («S, M, L»); las repetidas se avisan y no entran. */
  private agregar(texto: string): void {
    const d = this.borrador();
    const ops = [...d.opciones];
    const colores = { ...d.colores };
    for (const t of texto
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)) {
      if (ops.some((x) => normalizar(x) === normalizar(t))) {
        this.avisoOpcion.set(`«${t}» ya está en la lista.`);
        continue;
      }
      colores[t] = COLORES[ops.length % COLORES.length];
      ops.push(t);
    }
    this.nuevaOpcion.set('');
    if (ops.length === d.opciones.length) return;
    this.cambio.emit({ k: 'colores', v: colores });
    this.cambio.emit({ k: 'opciones', v: ops });
  }

  /** La opción pendiente del campo «Otra opción», si la hay (la página la suma al guardar). */
  pendiente(): string {
    return this.nuevaOpcion().trim();
  }

  limpiarPendiente(): void {
    this.nuevaOpcion.set('');
  }

  protected cambiarColor(o: string): void {
    const d = this.borrador();
    const i = COLORES.indexOf(d.colores[o]);
    this.cambio.emit({ k: 'colores', v: { ...d.colores, [o]: COLORES[(i + 1) % COLORES.length] } });
  }

  protected renombrar(i: number, valor: string): void {
    const d = this.borrador();
    const viejo = d.opciones[i];
    const t = valor.trim();
    if (!t || t === viejo) return;
    if (d.opciones.some((x, k) => k !== i && normalizar(x) === normalizar(t))) {
      this.avisoOpcion.set(`«${t}» ya está en la lista.`);
      return;
    }
    const colores = sin(d.colores, viejo);
    this.cambio.emit({ k: 'colores', v: { ...colores, [t]: d.colores[viejo] ?? COLORES[0] } });
    this.cambio.emit({ k: 'opciones', v: d.opciones.map((x, k) => (k === i ? t : x)) });
    if (d.defecto === viejo) this.cambio.emit({ k: 'defecto', v: t });
  }

  protected quitar(i: number): void {
    const d = this.borrador();
    const o = d.opciones[i];
    this.cambio.emit({ k: 'colores', v: sin(d.colores, o) });
    this.cambio.emit({ k: 'opciones', v: d.opciones.filter((_x, k) => k !== i) });
    if (d.defecto === o) this.cambio.emit({ k: 'defecto', v: '' });
  }

  protected mover(i: number, d: number): void {
    const o = [...this.borrador().opciones];
    const j = i + d;
    if (j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]];
    this.cambio.emit({ k: 'opciones', v: o });
  }
}

function sin(colores: Record<string, string>, opcion: string): Record<string, string> {
  return Object.fromEntries(Object.entries(colores).filter(([k]) => k !== opcion));
}
