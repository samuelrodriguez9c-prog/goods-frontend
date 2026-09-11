import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Placeholder — usa `QuickAdjustPopoverComponent` en la sección de
 * Inventory. Ver ADMIN_DISENO.md > "Ficha de producto (patrón de
 * detalle más elaborado del admin)".
 */
@Component({
  selector: 'app-product-detail-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-8">
      <h1 class="text-lg font-semibold text-gray-900">Product detail</h1>
      <p class="mt-2 text-sm text-gray-500">
        TODO: ficha real del producto (ver ADMIN_DISENO.md &gt; "Ficha de producto").
      </p>
    </div>
  `,
})
export class ProductDetailPageComponent {}
