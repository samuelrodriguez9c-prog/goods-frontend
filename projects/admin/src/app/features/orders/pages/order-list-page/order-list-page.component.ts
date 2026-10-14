import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Pedidos: lista (con franja de métricas, filtros y agrupar) + hoja del pedido con pestañas Productos, Cliente y entrega y Actividad; el pedido nuevo también se arma en la hoja.
 * ?pedido=ID abre la hoja · ?nuevo=1&cliente=ID abre uno nuevo
 *
 * Mismo patrón que los módulos de Productos v5 (cabecera con métricas,
 * lista a la izquierda unida a la hoja de la derecha). Los componentes de
 * esta página viven en `components/`, uno por carpeta. Se completa con el
 * handoff de Pedidos y Clientes (BRIEF_HANDOFF_PEDIDOS_Y_CLIENTES.md).
 */
@Component({
  selector: 'app-order-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-list-page.component.html',
})
export class OrderListPageComponent {}
