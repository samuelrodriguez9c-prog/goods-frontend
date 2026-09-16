import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Estilo (`pt`) compartido para cualquier `p-table` del admin — se pasa
 * directo a `[pt]` del `p-table` de cada pantalla (ver ejemplo de uso en
 * `app.html`). Estiliza únicamente el "esqueleto" de la tabla (thead,
 * tbody, bordes); el checkbox de selección NO se resuelve acá — ver
 * {@link SelectionCheckboxComponent} y la nota de diseño en ese archivo
 * sobre por qué no se usa `p-tableCheckbox`/`p-tableHeaderCheckbox`.
 *
 * Nota de diseño: `DataTableComponent` (más abajo) NO envuelve `p-table`
 * — se probó esa variante y falló: los `<ng-template pTemplate="header">`
 * escritos por el consumidor no llegan a ser detectados por `p-table`
 * cuando este vive dentro de OTRO componente y el contenido se reenvía
 * con un `<ng-content>` intermedio (el `ContentChildren(PrimeTemplate)`
 * de `p-table` no atraviesa ese segundo nivel de proyección — confirmado
 * armando un caso mínimo de prueba). La solución real es más simple:
 * `p-table` se usa tal cual en cada pantalla (con todo su API nativo de
 * sorting/paginación/filtros intacto, sin tener que re-exponer cada
 * input uno por uno acá), y este archivo solo aporta el "preset" visual
 * (`dataTablePt`) más la barra de selección de abajo.
 */
export function dataTablePt() {
  return {
    table: 'w-full border-collapse text-sm',
    thead:
      '[&_th]:border-b [&_th]:border-gray-200 [&_th]:bg-canvas-bg [&_th]:px-4 [&_th]:py-2.5 ' +
      '[&_th]:text-left [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-gray-500',
    tbody:
      '[&_tr]:border-b [&_tr]:border-gray-100 [&_tr:last-child]:border-0 ' +
      '[&_tr:hover]:bg-canvas-bg/60 [&_td]:px-4 [&_td]:py-3 [&_td]:align-middle',
  };
}

/**
 * "Shell" de tabla con selección múltiple — envuelve cualquier `p-table`
 * (proyectado tal cual, con su API nativa completa) en la tarjeta
 * redondeada del admin, y agrega la barra de "N selected" + acciones en
 * lote que reemplaza la barra de búsqueda/filtro mientras haya filas
 * marcadas (ver ADMIN_DISENO.md > "Lenguaje visual general" y "Qué
 * construir como librería propia", ítem 6).
 *
 * Slot `[toolbar]` (opcional, ver `SearchToolbarComponent`): se
 * proyecta ANTES de la barra de selección, así que cuando hay filas
 * marcadas la barra de "N selected" tapa el buscador en vez de convivir
 * con él — mismo comportamiento que Shopify (capturas 61/446, ver
 * ADMIN_DISENO.md > "Barra de búsqueda y filtros").
 *
 * Uso:
 * ```html
 * <app-data-table [selectedCount]="selectedRows().length">
 *   <app-search-toolbar toolbar ... />
 *   <button bulkActions>Export</button>
 *   <p-table [value]="rows" [(selection)]="selectedRows" dataKey="id"
 *            selectionMode="multiple" [pt]="dataTablePt()">
 *     <ng-template pTemplate="header">
 *       <tr>
 *         <th><app-selection-checkbox ... /></th>
 *         ...
 *       </tr>
 *     </ng-template>
 *     <ng-template pTemplate="body" let-row>...</ng-template>
 *   </p-table>
 * </app-data-table>
 * ```
 */
@Component({
  selector: 'app-data-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './data-table.component.html',
})
export class DataTableComponent {
  /** Cantidad de filas seleccionadas — la calcula el consumidor desde su propio `p-table`. */
  readonly selectedCount = input<number>(0);
}
