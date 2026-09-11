import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Placeholder — usa `OrderLineItemComponent` en modo `editable` (sin
 * `maxQuantity`, formato simple) + `removable`. Ver ADMIN_DISENO.md >
 * "Flujo de edición de orden ('Edit order')".
 */
@Component({
  selector: 'app-order-edit-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-8">
      <h1 class="text-lg font-semibold text-gray-900">Edit order</h1>
      <p class="mt-2 text-sm text-gray-500">
        TODO: edición real del pedido (ver ADMIN_DISENO.md &gt; "Flujo de edición de orden").
      </p>
    </div>
  `,
})
export class OrderEditPageComponent {}
