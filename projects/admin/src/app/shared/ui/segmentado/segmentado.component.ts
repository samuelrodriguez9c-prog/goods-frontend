import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export interface OpcionSegmentado<K extends string = string> {
  k: K;
  label: string;
  /** Cuenta gris al lado de la etiqueta (solo en la variante `pastilla`). */
  n?: number | null;
}

/**
 * Control segmentado compartido, en tres variantes:
 *
 * - `pastilla` (WhatsApp): N columnas iguales sobre `#f1f1f1`,
 *   bordes redondos y un indicador blanco que se desliza a la elegida; con
 *   cuenta (`n`). Plantillas (4 filtros) y Campañas (3).
 * - `caja` (Pedidos y Clientes, dentro de popovers y formularios): radio 10,
 *   la elegida en blanco con sombra y en negrita, sin animación de posición.
 * - `rejilla` (filtros de Compras): como `caja` pero con columnas del mismo
 *   ancho, texto de 12 px sin negrita y sin cambio de color al pasar el cursor.
 */
@Component({
  selector: 'app-segmentado',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './segmentado.component.html',
  host: { '[class]': 'claseHost()' },
})
export class SegmentadoComponent<K extends string = string> {
  readonly opciones = input.required<OpcionSegmentado<K>[]>();
  readonly valor = input.required<K>();
  readonly variante = input<'pastilla' | 'caja' | 'rejilla'>('pastilla');
  /** `pastilla`: relleno lateral de cada botón, 10px (Plantillas) u 11px (Campañas). */
  readonly ancho = input<'angosto' | 'normal'>('angosto');
  readonly cambiar = output<K>();

  protected readonly claseHost = computed(
    () =>
      ({
        caja: 'flex gap-0.5 rounded-[10px] bg-[#f1f1f1] p-[3px]',
        rejilla: 'grid auto-cols-[minmax(0,1fr)] grid-flow-col gap-0.5 rounded-[10px] bg-[#f1f1f1] p-[3px]',
        pastilla: 'relative grid auto-cols-fr grid-flow-col rounded-full bg-[#f1f1f1] p-0.5',
      })[this.variante()],
  );
  private readonly idx = computed(() => Math.max(0, this.opciones().findIndex((o) => o.k === this.valor())));
  protected readonly left = computed(() => `calc(2px + (100% - 4px) / ${this.opciones().length} * ${this.idx()})`);
  protected readonly width = computed(() => `calc((100% - 4px) / ${this.opciones().length})`);

  protected elegir(e: Event, k: K): void {
    // Dentro de un popover, el clic no tiene que cerrarlo.
    if (this.variante() === 'caja') e.stopPropagation();
    this.cambiar.emit(k);
  }
}
