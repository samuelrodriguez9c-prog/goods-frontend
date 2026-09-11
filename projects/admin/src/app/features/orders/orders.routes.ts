import { Routes } from '@angular/router';
import { OrderListPageComponent } from './pages/order-list-page/order-list-page.component';
import { OrderDetailPageComponent } from './pages/order-detail-page/order-detail-page.component';
import { OrderEditPageComponent } from './pages/order-edit-page/order-edit-page.component';
import { OrderRefundPageComponent } from './pages/order-refund-page/order-refund-page.component';

export const ORDERS_ROUTES: Routes = [
  { path: '', component: OrderListPageComponent },
  { path: ':id', component: OrderDetailPageComponent },
  { path: ':id/edit', component: OrderEditPageComponent },
  { path: ':id/refund', component: OrderRefundPageComponent },
];
