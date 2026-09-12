import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Placeholder — el backend (`InventarioModule`) ya está completo (stock
 * por producto + historial de movimientos, `GET /inventario`,
 * `?bajoMinimo`, ajuste manual, stock mínimo). Falta la página real:
 * listado con alerta de stock bajo + ver movimientos por producto.
 */
@Component({
  selector: 'app-product-inventory-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-8">
      <h1 class="text-lg font-semibold text-gray-900">Inventario</h1>
      <p class="mt-2 text-sm text-gray-500">
        TODO: listado real de inventario (ver ADMIN_DISENO.md &gt; "Productos / Inventario").
      </p>
    </div>
  `,
})
export class ProductInventoryPageComponent {}
