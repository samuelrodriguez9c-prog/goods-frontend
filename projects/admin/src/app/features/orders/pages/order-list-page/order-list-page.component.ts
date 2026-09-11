import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Placeholder — el listado real usa el composite `DataTableComponent` +
 * `StatusBadgeComponent` (ver `shared/ui/`), con datos de
 * `OrdersApiService` (pendiente en `services/`) en vez de los mocks que
 * hoy viven en la página de showcase (`features/dev-showcase`).
 */
@Component({
  selector: 'app-order-list-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-8">
      <h1 class="text-lg font-semibold text-gray-900">Orders</h1>
      <p class="mt-2 text-sm text-gray-500">
        TODO: listado real de pedidos (ver ADMIN_DISENO.md &gt; "Pedidos / Órdenes").
      </p>
    </div>
  `,
})
export class OrderListPageComponent {}
