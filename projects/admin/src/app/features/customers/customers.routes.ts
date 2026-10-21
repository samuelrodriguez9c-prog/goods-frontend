import { Routes } from '@angular/router';
import { CustomerListPageComponent } from './pages/customer-list-page/customer-list-page.component';

// Clientes: lista y hoja en una sola página. `?cliente=ID` abre la ficha · `?nuevo=1` abre un cliente nuevo.
export const CUSTOMERS_ROUTES: Routes = [
  { path: '', component: CustomerListPageComponent, data: { breadcrumb: 'Customers', icon: 'user' } },
  { path: 'new', redirectTo: '/customers?nuevo=1' },
  { path: ':id', redirectTo: ({ params }) => `/customers?cliente=${params['id']}` },
];
