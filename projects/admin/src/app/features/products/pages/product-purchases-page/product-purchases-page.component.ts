import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Placeholder — el backend (`CompraModule`) ya está completo (órdenes de
 * compra a proveedores, con líneas, recibir/cancelar). Falta la página
 * real: listado + crear orden de compra + recibir.
 */
@Component({
  selector: 'app-product-purchases-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-8">
      <h1 class="text-lg font-semibold text-gray-900">Compras</h1>
      <p class="mt-2 text-sm text-gray-500">
        TODO: listado real de órdenes de compra (ver ADMIN_DISENO.md &gt; "Productos / Inventario").
      </p>
    </div>
  `,
})
export class ProductPurchasesPageComponent {}
