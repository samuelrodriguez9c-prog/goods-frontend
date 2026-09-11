import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Placeholder — el detalle real usa `OrderLineItemComponent` en modo
 * `readonly` por grupo de fulfillment, más timeline (ítem 5, pendiente
 * de construir). Ver ADMIN_DISENO.md > "Página de detalle de la orden".
 */
@Component({
  selector: 'app-order-detail-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-8">
      <h1 class="text-lg font-semibold text-gray-900">Order detail</h1>
      <p class="mt-2 text-sm text-gray-500">
        TODO: detalle real del pedido (ver ADMIN_DISENO.md &gt; "Página de detalle de la orden").
      </p>
    </div>
  `,
})
export class OrderDetailPageComponent {}
