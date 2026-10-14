import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export interface OpcionSegmentado<K extends string = string> {
  k: K;
  label: string;
  n: number;
}

/**
 * Segmentado del módulo WhatsApp (LEEME §2): N columnas iguales sobre
 * `#f1f1f1` y un indicador blanco que se desliza a la opción elegida.
 * Lo usan Plantillas (4 filtros) y Campañas (3).
 */
@Component({
  selector: 'app-segmentado',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './segmentado.component.html',
  host: { class: 'relative grid auto-cols-fr grid-flow-col rounded-full bg-[#f1f1f1] p-0.5' },
})
export class SegmentadoComponent<K extends string = string> {
  readonly opciones = input.required<OpcionSegmentado<K>[]>();
  readonly valor = input.required<K>();
  /** Relleno lateral de cada botón: 10px (Plantillas) u 11px (Campañas). */
  readonly ancho = input<'angosto' | 'normal'>('angosto');
  readonly cambiar = output<K>();

  private readonly idx = computed(() => Math.max(0, this.opciones().findIndex((o) => o.k === this.valor())));
  protected readonly left = computed(() => `calc(2px + (100% - 4px) / ${this.opciones().length} * ${this.idx()})`);
  protected readonly width = computed(() => `calc((100% - 4px) / ${this.opciones().length})`);
}
