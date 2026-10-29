import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import {
  ENTIDADES,
  EntidadCampo,
  TOPE_CAMPOS,
} from '../../../../../../core/campos/campo-personalizado.model';
import { normalizar } from '../../../../../../shared/ui/persona';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import { MarcoModalComponent } from '../../../../shared/ui/marco-modal/marco-modal.component';
import {
  ICONO_ENTIDAD,
  ICONO_TIPO,
  PLANTILLAS,
  PlantillaCampo,
  nombreEntidad,
  nombreTipo,
} from '../../campos.util';
import { SegmentosComponent } from '../segmentos/segmentos.component';

export interface EleccionNuevoCampo {
  entidad: EntidadCampo;
  /** `null` = en blanco. */
  plantilla: PlantillaCampo | null;
}

/**
 * Modal «Nuevo campo»: la sección arriba y, debajo, «En blanco» y las
 * plantillas de esa sección (las que ya existen se ven pero no se eligen).
 * El pie dice cuántos cupos quedan; sin cupo, el campo se creará inactivo.
 */
@Component({
  selector: 'app-modal-nuevo-campo',
  standalone: true,
  imports: [IcComponent, MarcoModalComponent, SegmentosComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-marco-modal etiqueta="Nuevo campo" [ancho]="720" (cerrar)="cerrar.emit()">
      <div class="flex flex-col gap-3.5 px-[22px] pt-5 pb-4">
        <div class="flex items-start gap-3">
          <span class="flex min-w-0 flex-1 flex-col gap-[3px]"
            ><span class="font-display text-[19px] font-semibold tracking-[-0.01em] text-[#111827]"
              >Nuevo campo</span
            ><span class="text-[12.5px] text-[#6b7280]"
              >Empieza con una plantilla y ajústala, o crea uno en blanco.</span
            ></span
          >
          <button
            type="button"
            (click)="cerrar.emit()"
            title="Cerrar (Esc)"
            class="flex rounded-lg p-[5px] text-[#6b7280] hover:bg-[#f1f1f1] hover:text-[#111827]"
          >
            <app-ic nombre="x" [size]="16" />
          </button>
        </div>
        <app-segmentos
          class="grid-cols-4"
          [alto]="32"
          [items]="secciones"
          [valor]="entidad()"
          (elegir)="entidad.set($any($event))"
        />
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto px-[22px] pb-[18px]">
        <div class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
          <button
            type="button"
            (click)="usar(null)"
            class="flex flex-col gap-2.5 rounded-[14px] border border-dashed border-[#d4d4d4] p-3.5 text-left hover:border-[#a3a3a3] hover:bg-[#fafafa]"
          >
            <span
              class="flex size-8 items-center justify-center rounded-[10px] bg-[#303030] text-white"
              ><app-ic nombre="plus" [size]="16"
            /></span>
            <span class="flex flex-col gap-0.5"
              ><span class="text-[13px] font-semibold text-[#111827]">En blanco</span
              ><span class="text-xs text-[#8a8a8a]">Tú decides nombre y tipo.</span></span
            >
          </button>
          @for (p of plantillas(); track p.etiqueta) {
            <button
              type="button"
              (click)="usar(p)"
              [disabled]="p.existe"
              class="flex flex-col gap-2.5 rounded-[14px] bg-[#f7f7f7] p-3.5 text-left transition-[background-color,box-shadow] duration-150 enabled:hover:bg-white enabled:hover:shadow-[0_0_0_1px_#e0e0e0,0_10px_24px_-16px_rgba(0,0,0,.3)] disabled:cursor-default disabled:opacity-45"
            >
              <span class="flex items-center gap-2"
                ><span
                  class="flex size-8 items-center justify-center rounded-[10px] bg-white text-[#303030] shadow-[0_0_0_1px_#ebebeb]"
                  ><app-ic [nombre]="iconoTipo[p.tipo]" [size]="16" /></span
                ><span class="flex-1"></span>
                @if (p.existe) {
                  <span
                    class="rounded-md bg-[#e9e9e9] px-1.5 text-[10.5px] font-semibold leading-[17px] text-[#6b7280]"
                    >Ya existe</span
                  >
                }
              </span>
              <span class="flex min-w-0 flex-col gap-0.5"
                ><span class="text-[13px] font-semibold text-[#111827]">{{ p.etiqueta }}</span
                ><span class="truncate text-xs text-[#8a8a8a]">{{ p.sub }}</span></span
              >
            </button>
          }
        </div>
      </div>
      <div
        class="flex items-center gap-2 border-t border-[#f1f1f1] px-[22px] py-3 text-xs text-[#6b7280]"
      >
        <app-ic
          [nombre]="lleno() ? 'alert-triangle' : 'info-circle'"
          [size]="14"
          [style.color]="lleno() ? '#d97706' : '#9ca3af'"
        /><span class="flex-1">{{ nota() }}</span
        ><span class="text-[#9ca3af]">Esc para cerrar</span>
      </div>
    </app-marco-modal>
  `,
})
export class ModalNuevoCampoComponent {
  readonly entidadInicial = input<EntidadCampo>('producto');
  /** Activos por sección, para el cupo. */
  readonly activos = input.required<Record<EntidadCampo, number>>();
  /** Nombres que ya existen por sección (las plantillas con ese nombre no se eligen). */
  readonly existentes = input.required<Record<EntidadCampo, string[]>>();
  readonly elegir = output<EleccionNuevoCampo>();
  readonly cerrar = output<void>();

  protected readonly iconoTipo = ICONO_TIPO;
  protected readonly secciones = ENTIDADES.map((e) => ({
    k: e.k,
    t: e.t,
    icono: ICONO_ENTIDAD[e.k],
  }));
  protected readonly entidad = linkedSignal(() => this.entidadInicial());
  protected readonly lleno = computed(() => this.activos()[this.entidad()] >= TOPE_CAMPOS);
  protected readonly plantillas = computed(() => {
    const ya = new Set(this.existentes()[this.entidad()].map((x) => normalizar(x)));
    return PLANTILLAS[this.entidad()].map((p) => ({
      ...p,
      sub: `${nombreTipo(p.tipo)} · ${p.nota}`,
      existe: ya.has(normalizar(p.etiqueta)),
    }));
  });
  protected readonly nota = computed(() => {
    const e = nombreEntidad(this.entidad());
    const n = this.activos()[this.entidad()];
    return this.lleno()
      ? `${e} ya tiene ${TOPE_CAMPOS} activos: el campo se creará inactivo.`
      : `${e}: ${n} de ${TOPE_CAMPOS} activos · te quedan ${TOPE_CAMPOS - n}.`;
  });

  protected usar(p: PlantillaCampo | null): void {
    this.elegir.emit({ entidad: this.entidad(), plantilla: p });
  }
}
