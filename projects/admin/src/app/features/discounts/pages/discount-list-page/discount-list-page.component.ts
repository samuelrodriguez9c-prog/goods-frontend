import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Placeholder — el backend (`DescuentoModule`) ya está completo:
 * `GET/POST/PATCH/DELETE /descuentos` (código opcional, tipo
 * porcentaje/monto fijo/envío gratis, alcance pedido/producto/categoría,
 * monto mínimo, vigencia, tope de usos total y por cliente — ver
 * MODULOS_PENDIENTES.md > "descuento" en el backend). Falta la página
 * real: listado + crear/editar código de descuento.
 */
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
