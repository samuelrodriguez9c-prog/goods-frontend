import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Placeholder — usa `OrderLineItemComponent` en modo `editable` +
 * `maxQuantity` (formato "X / Y") + `selectable`. Ver ADMIN_DISENO.md >
 * "Flujo de reembolso (página dedicada, no modal)".
 */
@Component({
  selector: 'app-order-refund-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-8">
      <h1 class="text-lg font-semibold text-gray-900">Refund</h1>
      <p class="mt-2 text-sm text-gray-500">
        TODO: reembolso real del pedido (ver ADMIN_DISENO.md &gt; "Flujo de reembolso").
      </p>
    </div>
  `,
})
export class OrderRefundPageComponent {}
