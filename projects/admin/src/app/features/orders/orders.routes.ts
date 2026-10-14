import { Routes } from '@angular/router';
import { OrderListPageComponent } from './pages/order-list-page/order-list-page.component';

/**
 * Pedidos (PROPUESTA_PEDIDOS_Y_CLIENTES.md): una sola página con la lista
 * y la hoja, igual que los módulos de Productos v5.
 * `?pedido=ID` abre la hoja · `?nuevo=1` abre un pedido nuevo
 * (`&cliente=ID` lo precarga). `/orders/:id` (enlaces de notificaciones)
 * redirige a `?pedido=ID`.
 */
export const ORDERS_ROUTES: Routes = [
  { path: '', component: OrderListPageComponent, data: { breadcrumb: 'Orders', icon: 'inbox' } },
  { path: ':id', redirectTo: ({ params }) => `/orders?pedido=${params['id']}` },
];
