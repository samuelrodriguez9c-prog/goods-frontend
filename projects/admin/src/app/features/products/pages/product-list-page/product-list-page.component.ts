import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-product-list-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-8">
      <h1 class="text-lg font-semibold text-gray-900">Products</h1>
      <p class="mt-2 text-sm text-gray-500">
        TODO: listado real de productos (ver ADMIN_DISENO.md &gt; "Productos / Inventario").
      </p>
    </div>
  `,
})
export class ProductListPageComponent {}
