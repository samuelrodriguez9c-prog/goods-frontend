import { Routes } from '@angular/router';
import { CustomerListPageComponent } from './pages/customer-list-page/customer-list-page.component';
import { CustomerCreatePageComponent } from './pages/customer-create-page/customer-create-page.component';
import { CustomerDetailPageComponent } from './pages/customer-detail-page/customer-detail-page.component';

export const CUSTOMERS_ROUTES: Routes = [
  { path: '', component: CustomerListPageComponent },
  { path: 'new', component: CustomerCreatePageComponent },
  { path: ':id', component: CustomerDetailPageComponent },
];
