import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ItemActividad } from '../../../../../../core/actividad/actividad-equipo.service';
import { haceCuanto } from '../../../../../../shared/ui/persona';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import {
  ORIGEN_UI,
  areaUi,
  autorDe,
  cuandoDe,
  filasCambio,
  registroUi,
  tipoUi,
} from '../../actividad.util';

/** Lo que la ficha muestra de la persona: sus acciones en el período y en qué áreas. */
export interface ResumenPersona {
  nombre: string;
  acciones: number;
  ultimaEn: string | null;
  areas: { t: string; icono: string; n: number; w: number }[];
}

/**
 * Detalle de una acción: qué se hizo, quién, cuándo y desde dónde; «Qué
 * cambió» (antes → después por dato, con lo quitado tachado y la diferencia
 * en números), el registro con sus otras acciones y la persona con sus
 * acciones por área.
 */
@Component({
  selector: 'app-ficha-actividad',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    @let x = item();
    @let au = area();
    @let tp = tipo();
    <div class="mx-auto w-full max-w-[860px] shrink-0 px-6">
      <div class="mt-2.5 flex items-start gap-3">
        <span
          class="flex size-11 shrink-0 items-center justify-center rounded-[13px] font-display text-[15px] font-semibold"
          [style.background]="autor().tono[0]"
          [style.color]="autor().tono[1]"
          >{{ autor().ini }}</span
        >
        <span class="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span
            class="font-display text-lg leading-[23px] font-semibold tracking-[-0.01em] text-pretty text-[#111827]"
            >{{ x.texto }}</span
          >
          <span class="text-xs text-[#8a8a8a]">{{ autor().nombre }} · {{ cuando() }}</span>
        </span>
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-1.5">
        <span
          class="flex h-[30px] items-center gap-[7px] rounded-full bg-[#f4f4f4] px-[11px] text-[12.5px] font-medium text-[#111827]"
          ><span class="size-[7px] rounded-full" [style.background]="tp.color"></span
          >{{ tp.t }}</span
        >
        <span
          class="flex h-[30px] items-center gap-1.5 rounded-full bg-[#f4f4f4] px-[11px] text-[12.5px] font-medium text-[#374151]"
          ><app-ic [nombre]="au.icono" [size]="14" class="text-[#6b7280]" />{{ au.t }}</span
        >
        @if (origen(); as o) {
          <span
            title="Desde dónde se hizo"
            class="flex h-[30px] items-center gap-1.5 rounded-full bg-[#f4f4f4] px-[11px] text-[12.5px] font-medium text-[#374151]"
            ><app-ic [nombre]="o.icono" [size]="14" class="text-[#6b7280]" />{{ o.t }}</span
          >
        }
        <span class="flex-1"></span>
        @if (x.enlace) {
          <button
            type="button"
            (click)="abrirRegistro.emit()"
            class="flex h-[30px] items-center gap-1.5 rounded-full bg-[#303030] px-3 text-[12.5px] font-medium text-white hover:bg-[#1a1a1a]"
          >
            {{ reg().cta }}<app-ic nombre="arrow-up-right" [size]="14" />
          </button>
        }
      </div>
      <div class="-mx-6 mt-4 h-px bg-[#f1f1f1]"></div>
    </div>
    <div class="min-h-0 flex-1 bg-white">
      <div class="mx-auto flex w-full max-w-[860px] flex-col gap-3 px-6 pt-4 pb-[120px]">
        <!-- Qué cambió -->
        <div [class]="tarjeta + ' animate-[st-fade-in-up_.2s_ease-out] !gap-3.5 !p-5'">
          <div class="flex items-start gap-3">
            <span
              class="flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[#f4f4f4] text-[#303030]"
              ><app-ic nombre="arrows-diff" [size]="17"
            /></span>
            <span class="flex min-w-0 flex-1 flex-col gap-0.5"
              ><span class="text-[15px] font-semibold tracking-[-0.005em] text-[#111827]">{{
                textos().titulo
              }}</span
              ><span class="text-xs leading-[17px] text-[#8a8a8a]">{{ textos().ayuda }}</span></span
            >
          </div>
          @if (!filas().length) {
            <p class="m-0 text-[13px] text-[#8a8a8a]">
              {{
                x.registro
                  ? 'No hay detalle de los datos de esta acción: se registró antes de que la actividad guardara los cambios.'
                  : 'Esta acción no cambió datos de un registro.'
              }}
            </p>
          }
          <div class="flex flex-col">
            @for (f of filas(); track $index) {
              <div class="flex min-w-0 flex-col gap-1 border-t border-[#f4f4f4] py-3">
                <span class="text-xs text-[#8a8a8a]">{{ f.campo }}</span>
                <span class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                  @if (f.antes.length) {
                    <span class="flex min-w-0 flex-wrap gap-x-2 gap-y-0.5">
                      @for (t of f.antes; track $index) {
                        <span
                          class="max-w-full truncate text-[13.5px] leading-5"
                          [style.color]="t.color"
                          [style.font-weight]="t.peso"
                          [class.line-through]="t.tachado"
                          >{{ t.t }}</span
                        >
                      }
                    </span>
                  }
                  @if (f.flecha) {
                    <app-ic
                      nombre="arrow-narrow-right"
                      [size]="15"
                      class="self-center text-[#c4c4c4]"
                    />
                  }
                  @if (f.despues.length) {
                    <span class="flex min-w-0 flex-wrap gap-x-2 gap-y-0.5">
                      @for (t of f.despues; track $index) {
                        <span
                          class="max-w-full truncate text-[13.5px] leading-5"
                          [style.color]="t.color"
                          [style.font-weight]="t.peso"
                          [class.line-through]="t.tachado"
                          >{{ t.t }}</span
                        >
                      }
                    </span>
                  }
                  @if (f.delta) {
                    <span
                      class="text-xs font-medium whitespace-nowrap tabular-nums"
                      [style.color]="f.deltaColor"
                      >{{ f.delta }}</span
                    >
                  }
                </span>
              </div>
            }
          </div>
        </div>

        <div
          class="grid animate-[st-fade-in-up_.24s_ease-out] grid-cols-[repeat(auto-fit,minmax(max(260px,calc((100%-12px)/2)),1fr))] gap-3"
        >
          <!-- El registro -->
          @if (x.registro; as r) {
            <div [class]="tarjeta">
              <div class="flex items-start gap-3">
                <span
                  class="flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[#f4f4f4] text-[#303030]"
                  ><app-ic [nombre]="reg().icono" [size]="17"
                /></span>
                <span class="flex min-w-0 flex-1 flex-col gap-0.5"
                  ><span
                    class="truncate text-[15px] font-semibold tracking-[-0.005em] text-[#111827]"
                    >{{ r.nombre || reg().t }}</span
                  ><span class="truncate text-xs leading-[17px] text-[#8a8a8a]"
                    >{{ reg().t }} · {{ r.ref }}</span
                  ></span
                >
                @if (x.enlace) {
                  <button
                    type="button"
                    (click)="abrirRegistro.emit()"
                    [title]="reg().cta"
                    class="flex shrink-0 rounded-lg p-1.5 text-[#6b7280] hover:bg-[#f1f1f1] hover:text-[#111827]"
                  >
                    <app-ic nombre="arrow-up-right" [size]="16" />
                  </button>
                }
              </div>
              <div class="flex flex-col">
                @for (y of delRegistro(); track y.id) {
                  @let act = y.id === x.id;
                  <button
                    type="button"
                    (click)="elegir.emit(y.id)"
                    class="relative grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2.5 border-t border-[#f4f4f4] px-1.5 py-[9px] text-left transition-colors duration-150 hover:bg-[#fafafa]"
                    [style.background]="act ? '#f7f7f7' : null"
                  >
                    <span
                      class="flex size-6 items-center justify-center rounded-full text-[9.5px] font-semibold"
                      [style.background]="autorDe(y).tono[0]"
                      [style.color]="autorDe(y).tono[1]"
                      >{{ autorDe(y).ini }}</span
                    >
                    <span
                      class="min-w-0 truncate text-[12.5px] leading-[17px] text-[#374151]"
                      [style.font-weight]="act ? 600 : 400"
                      >{{ y.texto }}</span
                    >
                    <span class="text-[11.5px] whitespace-nowrap text-[#9ca3af]">{{
                      hace(y.fecha)
                    }}</span>
                  </button>
                }
              </div>
            </div>
          }

          <!-- La persona -->
          @if (persona(); as p) {
            <div [class]="tarjeta">
              <div class="flex items-start gap-3">
                <span
                  class="flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[#f4f4f4] text-[#303030]"
                  ><app-ic nombre="user" [size]="17"
                /></span>
                <span class="flex min-w-0 flex-1 flex-col gap-0.5"
                  ><span
                    class="truncate text-[15px] font-semibold tracking-[-0.005em] text-[#111827]"
                    >{{ p.nombre }}</span
                  ><span class="truncate text-xs leading-[17px] text-[#8a8a8a]">{{
                    p.ultimaEn ? 'Última acción ' + hace(p.ultimaEn).toLowerCase() : 'Sin acciones'
                  }}</span></span
                >
                <button
                  type="button"
                  (click)="soloPersona.emit()"
                  title="Ver solo sus acciones"
                  class="flex shrink-0 rounded-lg p-1.5 text-[#6b7280] hover:bg-[#f1f1f1] hover:text-[#111827]"
                >
                  <app-ic nombre="filter" [size]="16" />
                </button>
              </div>
              <div class="flex items-baseline gap-2 border-t border-[#f4f4f4] pt-3">
                <span
                  class="font-display text-[26px] leading-[30px] font-semibold tracking-[-0.02em] tabular-nums text-[#111827]"
                  >{{ p.acciones.toLocaleString('es-CO') }}</span
                >
                <span class="text-[12.5px] text-[#6b7280]"
                  >{{ p.acciones === 1 ? 'acción' : 'acciones' }} {{ periodo() }}</span
                >
              </div>
              <div class="flex flex-col gap-[9px]">
                @for (d of p.areas; track d.t) {
                  <div
                    class="grid grid-cols-[minmax(0,96px)_minmax(0,1fr)_auto] items-center gap-2.5"
                  >
                    <span class="flex min-w-0 items-center gap-1.5 text-[12.5px] text-[#374151]"
                      ><app-ic
                        [nombre]="d.icono"
                        [size]="13"
                        class="shrink-0 text-[#8a8a8a]"
                      /><span class="truncate">{{ d.t }}</span></span
                    >
                    <span class="relative block h-1 overflow-hidden rounded-full bg-[#f1f1f1]"
                      ><span
                        class="absolute inset-y-0 left-0 rounded-full bg-[#303030] transition-[width] duration-500"
                        [style.width.%]="d.w"
                      ></span
                    ></span>
                    <span class="text-xs tabular-nums text-[#6b7280]">{{ d.n }}</span>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class FichaActividadComponent {
  readonly item = input.required<ItemActividad>();
  /** Las acciones cargadas sobre el mismo registro, de la más vieja a la más nueva. */
  readonly delRegistro = input<ItemActividad[]>([]);
  readonly persona = input<ResumenPersona | null>(null);
  /** «en 7 días». */
  readonly periodo = input('');
  readonly abrirRegistro = output<void>();
  readonly elegir = output<number>();
  readonly soloPersona = output<void>();

  protected readonly tarjeta =
    'flex min-w-0 flex-col gap-3 rounded-2xl border border-[#ebebeb] bg-white px-[18px] pt-[18px] pb-3.5 shadow-[0_1px_2px_rgba(0,0,0,.03),0_12px_28px_-22px_rgba(0,0,0,.28)]';
  protected readonly autorDe = autorDe;
  protected readonly hace = haceCuanto;
  protected readonly autor = computed(() => autorDe(this.item()));
  protected readonly area = computed(() => areaUi(this.item()));
  protected readonly tipo = computed(() => tipoUi(this.item()));
  protected readonly origen = computed(() => ORIGEN_UI[this.item().origen] ?? null);
  protected readonly reg = computed(() => registroUi(this.item().registro?.tipo));
  protected readonly cuando = computed(() => cuandoDe(this.item()));
  protected readonly filas = computed(() => filasCambio(this.item()));
  protected readonly textos = computed(() => {
    const t = this.item().tipo;
    return t === 'crear'
      ? { titulo: 'Con qué se creó', ayuda: 'Los datos con los que quedó el registro.' }
      : t === 'eliminar'
        ? { titulo: 'Qué se eliminó', ayuda: 'Cómo estaba antes de borrarlo.' }
        : { titulo: 'Qué cambió', ayuda: 'De cómo estaba a cómo quedó.' };
  });
}
