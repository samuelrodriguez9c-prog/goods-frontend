import { Routes } from '@angular/router';
import { ProductListPageComponent } from './pages/product-list-page/product-list-page.component';
import { ProductDetailPageComponent } from './pages/product-detail-page/product-detail-page.component';
import { ProductCategoriesPageComponent } from './pages/product-categories-page/product-categories-page.component';
import { ProductInventoryPageComponent } from './pages/product-inventory-page/product-inventory-page.component';
import { ProductSuppliersPageComponent } from './pages/product-suppliers-page/product-suppliers-page.component';
import { ProductPurchasesPageComponent } from './pages/product-purchases-page/product-purchases-page.component';

export const PRODUCTS_ROUTES: Routes = [
  { path: '', component: ProductListPageComponent },
  // Rutas estáticas del submenú (ver ADMIN_DISENO.md > "Sidebar >
  // Submenús") ANTES de ':id' — si no, Angular matchea 'categorias' como
  // si fuera un id de producto y nunca llega a esta ruta.
  { path: 'categorias', component: ProductCategoriesPageComponent },
  { path: 'inventario', component: ProductInventoryPageComponent },
  { path: 'proveedores', component: ProductSuppliersPageComponent },
  { path: 'compras', component: ProductPurchasesPageComponent },
  { path: ':id', component: ProductDetailPageComponent },
];
