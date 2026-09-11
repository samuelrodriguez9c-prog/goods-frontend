import { Routes } from '@angular/router';
import { ProductListPageComponent } from './pages/product-list-page/product-list-page.component';
import { ProductDetailPageComponent } from './pages/product-detail-page/product-detail-page.component';

export const PRODUCTS_ROUTES: Routes = [
  { path: '', component: ProductListPageComponent },
  { path: ':id', component: ProductDetailPageComponent },
];
