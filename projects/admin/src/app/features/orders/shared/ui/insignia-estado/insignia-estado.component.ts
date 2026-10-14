import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Badge del estado del pedido (pendiente · confirmado · enviado · entregado · cancelado · devuelto).
 *
 * Estructura creada antes del handoff de Pedidos y Clientes
 * (BRIEF_HANDOFF_PEDIDOS_Y_CLIENTES.md): se completa al integrarlo.
 */
@Component({
  selector: 'app-insignia-estado',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ``,
})
export class InsigniaEstadoComponent {}
