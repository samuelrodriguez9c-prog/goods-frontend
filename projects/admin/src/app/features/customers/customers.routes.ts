import { Routes } from '@angular/router';
import { CustomerListPageComponent } from './pages/customer-list-page/customer-list-page.component';
import { CustomerCreatePageComponent } from './pages/customer-create-page/customer-create-page.component';
import { CustomerDetailPageComponent } from './pages/customer-detail-page/customer-detail-page.component';

export const CUSTOMERS_ROUTES: Routes = [
  { path: '', component: CustomerListPageComponent, data: { breadcrumb: 'Customers', icon: 'user' } },
  { path: 'new', component: CustomerCreatePageComponent, data: { breadcrumb: 'Nuevo cliente', icon: 'user' } },
  { path: ':id', component: CustomerDetailPageComponent, data: { breadcrumb: 'Cliente', icon: 'user' } },
];
