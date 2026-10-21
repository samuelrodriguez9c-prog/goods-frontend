import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Placeholder de Descuentos. */
// TODO(front): listado y crear/editar códigos sobre `/descuentos`, que el backend ya tiene completo.
@Component({
  selector: 'app-discount-list-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-8">
      <h1 class="text-lg font-semibold text-gray-900">Discounts</h1>
      <p class="mt-2 text-sm text-gray-500">
        TODO: listado real de códigos de descuento (ver ADMIN_DISENO.md &gt; "Sidebar").
      </p>
    </div>
  `,
})
export class DiscountListPageComponent {}
