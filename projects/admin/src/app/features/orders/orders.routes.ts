import { Routes } from '@angular/router';
import { OrderListPageComponent } from './pages/order-list-page/order-list-page.component';
import { OrderDetailPageComponent } from './pages/order-detail-page/order-detail-page.component';
import { OrderEditPageComponent } from './pages/order-edit-page/order-edit-page.component';
import { OrderRefundPageComponent } from './pages/order-refund-page/order-refund-page.component';

export const ORDERS_ROUTES: Routes = [
  { path: '', component: OrderListPageComponent, data: { breadcrumb: 'Orders', icon: 'inbox' } },
  { path: ':id', component: OrderDetailPageComponent, data: { breadcrumb: 'Pedido', icon: 'inbox' } },
  { path: ':id/edit', component: OrderEditPageComponent, data: { breadcrumb: 'Editar pedido', icon: 'inbox' } },
  { path: ':id/refund', component: OrderRefundPageComponent, data: { breadcrumb: 'Reembolso', icon: 'inbox' } },
];
