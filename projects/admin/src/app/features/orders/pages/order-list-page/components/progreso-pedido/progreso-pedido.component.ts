import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Pendiente → Confirmado → Enviado → Entregado (cancelado y devuelto como salida).
 *
 * Estructura creada antes del handoff de Pedidos y Clientes
 * (BRIEF_HANDOFF_PEDIDOS_Y_CLIENTES.md): se completa al integrarlo.
 */
@Component({
  selector: 'app-progreso-pedido',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ``,
})
export class ProgresoPedidoComponent {}
