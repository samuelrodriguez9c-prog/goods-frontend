import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Placeholder — el backend (`ProveedorModule`) ya está completo (CRUD de
 * proveedores). Falta la página real: listado + crear/editar proveedor.
 */
@Component({
  selector: 'app-product-suppliers-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-8">
      <h1 class="text-lg font-semibold text-gray-900">Proveedores</h1>
      <p class="mt-2 text-sm text-gray-500">
        TODO: listado real de proveedores (ver ADMIN_DISENO.md &gt; "Productos / Inventario").
      </p>
    </div>
  `,
})
export class ProductSuppliersPageComponent {}
