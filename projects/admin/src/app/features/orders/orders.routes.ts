import { Routes } from '@angular/router';
import { OrderListPageComponent } from './pages/order-list-page/order-list-page.component';

// Pedidos: una sola página con lista y hoja, como los módulos de Productos.
// `?pedido=ID` abre la hoja · `?nuevo=1` abre un pedido nuevo (`&cliente=ID`
// lo precarga). `/orders/:id` (enlaces de notificaciones) redirige a `?pedido=ID`.
export const ORDERS_ROUTES: Routes = [
  { path: '', component: OrderListPageComponent, data: { breadcrumb: 'Orders', icon: 'inbox' } },
  { path: ':id', redirectTo: ({ params }) => `/orders?pedido=${params['id']}` },
];
