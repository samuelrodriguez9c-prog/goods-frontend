import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Placeholder — el backend (`CategoriaModule`) ya está completo
 * (`GET/POST/PATCH/DELETE /categorias`, con subcategorías). Falta la
 * página real: listado + crear/editar categoría.
 */
@Component({
  selector: 'app-product-categories-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-8">
      <h1 class="text-lg font-semibold text-gray-900">Categorías</h1>
      <p class="mt-2 text-sm text-gray-500">
        TODO: listado real de categorías (ver ADMIN_DISENO.md &gt; "Productos / Inventario").
      </p>
    </div>
  `,
})
export class ProductCategoriesPageComponent {}
