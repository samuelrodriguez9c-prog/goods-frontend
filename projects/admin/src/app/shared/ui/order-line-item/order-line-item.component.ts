import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { SelectionCheckboxComponent } from '../data-table/selection-checkbox.component';
import { formatMoney } from '../../utils/format-money';

export type OrderLineItemMode = 'readonly' | 'editable';
export type OrderLineItemPartialSeparator = 'of' | '/';

/**
 * Fila de ítem de pedido (producto + variante/SKU + precio × cantidad +
 * total) — ítem 2 de "Qué construir como librería propia" en
 * ADMIN_DISENO.md. Calcado de las capturas 106/130 (detalle de orden,
 * grupos "Unfulfilled"/"Removed", modo solo-lectura) y 133 (Edit order,
 * modo cantidad-editable).
 *
 * Dos modos, no tres — igual que documentado:
 * - `readonly`: precio y cantidad son texto plano, la cantidad se ve
 *   dentro de una píldora ("$10.00 × 10"). Así se ve en el detalle de la
 *   orden (grupos de fulfillment, resumen de removed, etc.).
 * - `editable`: el precio se resalta (color de acento, como en Shopify)
 *   y la cantidad pasa a ser un `<input>` real. Dentro de este modo hay
 *   dos variantes de formato, elegidas por si `maxQuantity` viene seteado:
 *     - sin `maxQuantity`: input simple (pantalla "Edit order", captura 133).
 *     - con `maxQuantity`: formato "X of Y" / "X / Y" (`partialSeparator`),
 *       usado en los flujos de hold y refund — ahí la cantidad editable
 *       es "cuántos de los Y originales" se ven afectados. No hay captura
 *       de esos modales en el muestreo, así que este formato sigue la
 *       descripción textual en ADMIN_DISENO.md ("Pedidos / Órdenes" >
 *       "Flujo 'Mark as on hold'" y "Flujo de reembolso").
 *
 * `selectable` agrega un checkbox a la izquierda (reutiliza
 * `SelectionCheckboxComponent`) para los flujos donde primero hay que
 * elegir qué líneas participan (hold, refund) antes de tocar la
 * cantidad. `removable` agrega el botón "X" de sacar la línea (solo
 * tiene sentido en "Edit order").
 */
@Component({
  selector: 'app-order-line-item',
  standalone: true,
  imports: [SelectionCheckboxComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-line-item.component.html',
})
export class OrderLineItemComponent {
  readonly imageUrl = input<string>('');
  readonly title = input.required<string>();
  /** Ej. "100g - Large" — se pinta como píldora gris, igual que Shopify. */
  readonly variant = input<string | null>(null);
  /** SKU u otro identificador corto, ej. "101" — texto plano al lado de la variante. */
  readonly sku = input<string | null>(null);

  readonly unitPrice = input.required<number>();
  readonly quantity = input.required<number>();
  /** Si viene seteado en modo `editable`, activa el formato "X of Y"/"X / Y". */
  readonly maxQuantity = input<number | null>(null);
  readonly partialSeparator = input<OrderLineItemPartialSeparator>('of');

  readonly mode = input<OrderLineItemMode>('readonly');
  readonly selectable = input<boolean>(false);
  readonly selected = input<boolean>(false);
  readonly removable = input<boolean>(false);
  /** Línea tachada — ej. ítems de una orden reembolsada (captura 61, #1003). */
  readonly struck = input<boolean>(false);

  readonly quantityChange = output<number>();
  readonly selectedChange = output<boolean>();
  readonly removed = output<void>();

  protected readonly isPartial = computed(() => this.mode() === 'editable' && this.maxQuantity() != null);

  protected readonly total = computed(() => this.unitPrice() * this.quantity());

  protected readonly formattedUnitPrice = computed(() => formatMoney(this.unitPrice()));
  protected readonly formattedTotal = computed(() => formatMoney(this.total()));

  protected onSelectedChange(value: boolean): void {
    this.selectedChange.emit(value);
  }

  protected onQuantityInput(rawValue: string): void {
    const max = this.maxQuantity();
    let next = Number(rawValue);
    if (!Number.isFinite(next)) {
      next = 0;
    }
    next = Math.max(0, Math.round(next));
    if (max != null) {
      next = Math.min(next, max);
    }
    this.quantityChange.emit(next);
  }
}
