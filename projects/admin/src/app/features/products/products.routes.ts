import { Routes } from '@angular/router';
import { ProductListPageComponent } from './pages/product-list-page/product-list-page.component';
import { ProductDetailPageComponent } from './pages/product-detail-page/product-detail-page.component';
import { ProductCategoriesPageComponent } from './pages/product-categories-page/product-categories-page.component';
import { ProductInventoryPageComponent } from './pages/product-inventory-page/product-inventory-page.component';
import { ProductSuppliersPageComponent } from './pages/product-suppliers-page/product-suppliers-page.component';
import { ProductPurchasesPageComponent } from './pages/product-purchases-page/product-purchases-page.component';

export const PRODUCTS_ROUTES: Routes = [
  { path: '', component: ProductListPageComponent, data: { breadcrumb: 'Products', icon: 'tag' } },
  // Rutas estáticas del submenú (ver ADMIN_DISENO.md > "Sidebar >
  // Submenús") ANTES de ':id' — si no, Angular matchea 'categorias' como
  // si fuera un id de producto y nunca llega a esta ruta.
  { path: 'categorias', component: ProductCategoriesPageComponent, data: { breadcrumb: 'Categorías', icon: 'category' } },
  { path: 'inventario', component: ProductInventoryPageComponent, data: { breadcrumb: 'Inventario', icon: 'packages' } },
  { path: 'proveedores', component: ProductSuppliersPageComponent, data: { breadcrumb: 'Proveedores', icon: 'truck' } },
  { path: 'compras', component: ProductPurchasesPageComponent, data: { breadcrumb: 'Compras', icon: 'shopping-cart' } },
  { path: ':id', component: ProductDetailPageComponent, data: { breadcrumb: 'Producto', icon: 'tag' } },
];
