import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Nuevo pedido / editar uno pendiente: productos, cliente, entrega, descuento y resumen. Se usa en la hoja de Pedidos, en la ficha del cliente ("Nuevo pedido para este cliente") y en el panel de WhatsApp.
 *
 * Estructura creada antes del handoff de Pedidos y Clientes
 * (BRIEF_HANDOFF_PEDIDOS_Y_CLIENTES.md): se completa al integrarlo.
 */
@Component({
  selector: 'app-formulario-pedido',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ``,
})
export class FormularioPedidoComponent {}
