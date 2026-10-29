import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import {
  ESTADO_SOLICITUD,
  Solicitud,
} from '../../../../../../core/solicitudes/models/solicitud.model';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import { FuenteProgreso, etapaDe, indicePaso, pasosDe } from '../../solicitudes.util';

/** Lo que pide la barra; las del tablero no traen respuesta, fecha de entrega ni conversación. */
export type SolicitudProgreso = FuenteProgreso &
  Pick<Partial<Solicitud>, 'fechaCompromiso' | 'respuesta'>;

/**
 * Progreso de la solicitud como en el handoff: estado con los 5 segmentos y
 * «Paso N de 5 · lleva X días aquí»; a la derecha qué esperar y quién la
 * lleva. Abajo los 5 pasos: el enfocado (el actual, o el que tiene el mouse)
 * se ensancha y muestra nombre y fecha; los demás, solo su ícono.
 *
 * @remarks La `respuesta` de Goods no está en el prototipo, pero el backend la
 * guarda al decidir (por qué no se aprobó, por ejemplo): va debajo.
 */
@Component({
  selector: 'app-progreso-solicitud',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3.5 pb-0.5 pt-1' },
  styles: `
    .rayas {
      background-image: repeating-linear-gradient(-45deg, #a6e9e4 0 6px, #d3f5f2 6px 12px);
      background-size: 17px 17px;
      animation: rayas 1.4s linear infinite;
    }
    @keyframes rayas {
      to {
        background-position: 17px 0;
      }
    }
  `,
  template: `
    @let x = solicitud();
    @let e = etapa();
    <div class="flex flex-wrap items-end justify-between gap-x-5 gap-y-2.5">
      <div class="flex min-w-0 flex-col gap-1">
        <span class="flex items-center gap-2.5">
          <span
            class="whitespace-nowrap font-display text-lg font-semibold leading-[22px] tracking-[-0.01em] text-[#111827]"
            >{{ estado().texto }}</span
          >
          <span class="flex items-center gap-[3px]">
            @for (m of e.mini; track $index) {
              <span
                class="h-1.5 rounded-full transition-[width,background-color] duration-[400ms] ease-[cubic-bezier(.3,1.4,.5,1)]"
                [style.width]="m.w"
                [style.background]="m.bg"
              ></span>
            }
          </span>
        </span>
        <span class="whitespace-nowrap text-xs text-[#6b7280]">{{ e.paso }}</span>
      </div>
      <div class="flex min-w-0 flex-col items-end gap-1 text-right">
        <span
          class="flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold text-[#111827]"
          ><app-ic [nombre]="e.etaIcono" [size]="15" class="text-[#6b7280]" />{{ e.eta }}</span
        >
        @if (e.responsable; as r) {
          <span class="flex items-center gap-1.5 whitespace-nowrap text-xs text-[#6b7280]">
            @if (r.ini) {
              <span
                class="flex size-[18px] items-center justify-center rounded-full bg-[#303030] text-[9px] font-bold text-white"
                >{{ r.ini }}</span
              >
            }
            {{ r.t }}
          </span>
        }
      </div>
    </div>
    <div
      class="grid gap-[5px] transition-[grid-template-columns] duration-500 ease-[cubic-bezier(.3,1.1,.5,1)]"
      [style.grid-template-columns]="columnas()"
    >
      @for (p of pasos(); track p.t; let i = $index) {
        @let conTexto = i === foco();
        <div
          [title]="p.titulo"
          (mouseenter)="hover.set(i)"
          (mouseleave)="hover.set(null)"
          class="flex min-w-0 flex-col gap-[9px] pt-1.5"
        >
          <div
            class="relative h-2.5 rounded-full transition-[background-color,box-shadow] duration-300"
            [style.background]="p.hecho ? '#303030' : '#ececec'"
            [style.box-shadow]="hover() === i ? '0 0 0 3px rgba(48,48,48,.08)' : 'none'"
          >
            <span
              class="absolute inset-y-0 left-0 rounded-full transition-[width] duration-[900ms] ease-[cubic-bezier(.3,1.1,.5,1)]"
              [class.rayas]="p.actual"
              [style.width]="p.relleno"
            ></span>
            @if (p.actual) {
              <span
                title="Aquí va tu solicitud"
                class="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#303030] shadow-[0_0_0_3px_#fff,0_4px_10px_-3px_rgba(0,0,0,.35)]"
                [style.left]="p.relleno"
              ></span>
            }
          </div>
          <span class="flex min-w-0 flex-col gap-px">
            <span
              class="flex min-w-0 items-center gap-[5px] truncate text-xs"
              [style.font-weight]="p.peso"
              [style.color]="p.tColor"
              ><app-ic [nombre]="p.icono" [size]="13" class="shrink-0" />
              @if (conTexto) {
                <span class="min-w-0 truncate">{{ p.t }}</span>
              }
            </span>
            @if (conTexto) {
              <span
                class="truncate text-[11px] transition-colors duration-200"
                [style.color]="hover() === i ? '#111827' : '#9ca3af'"
                >{{ p.fecha }}</span
              >
            }
          </span>
        </div>
      }
    </div>
    @if (x.respuesta) {
      <div class="rounded-xl bg-[#f6f6f6] px-3.5 py-2.5 text-[13px] leading-5 text-[#374151]">
        <strong class="font-semibold text-[#111827]">Respuesta de Goods:</strong> {{ x.respuesta }}
      </div>
    }
  `,
})
export class ProgresoSolicitudComponent {
  readonly solicitud = input.required<SolicitudProgreso>();

  protected readonly hover = signal<number | null>(null);

  protected readonly estado = computed(() => ESTADO_SOLICITUD[this.solicitud().estado]);
  protected readonly etapa = computed(() => etapaDe(this.solicitud()));
  protected readonly pasos = computed(() => pasosDe(this.solicitud()));
  /** El paso que se ensancha: el que tiene el mouse o en el que va. */
  protected readonly foco = computed(() => this.hover() ?? indicePaso(this.solicitud()));
  protected readonly columnas = computed(() =>
    this.pasos()
      .map((_, i) => (i === this.foco() ? 'minmax(0,2.6fr)' : 'minmax(0,1fr)'))
      .join(' '),
  );
}
