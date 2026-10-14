import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Error al confirmar un pedido de la tienda porque ya no alcanza el stock, con salida a editar o a Inventario.
 *
 * Estructura creada antes del handoff de Pedidos y Clientes
 * (BRIEF_HANDOFF_PEDIDOS_Y_CLIENTES.md): se completa al integrarlo.
 */
@Component({
  selector: 'app-aviso-stock',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ``,
})
export class AvisoStockComponent {}
