import { CanDeactivateFn, Routes } from '@angular/router';
import { ProductListPageComponent } from './pages/product-list-page/product-list-page.component';

/** Con cambios sin guardar no se sale: la pila se sacude y abre "Cambios sin guardar". */
const sinCambiosPendientes: CanDeactivateFn<ProductListPageComponent> = (pagina) => pagina.puedeSalir();

// Products y sus cuatro módulos (Categorías, Inventario, Proveedores, Compras), que se cargan por separado.
// Las rutas fijas van antes de ':id'; si no, 'categorias' se toma como un id.
export const PRODUCTS_ROUTES: Routes = [
  {
    path: '',
    component: ProductListPageComponent,
    canDeactivate: [sinCambiosPendientes],
    data: { breadcrumb: 'Products', icon: 'tag' },
  },
  {
    path: 'categorias',
    loadComponent: () => import('./pages/product-categories-page/product-categories-page.component').then((m) => m.ProductCategoriesPageComponent),
    data: { breadcrumb: 'Categorías', icon: 'category' },
  },
  // ?producto=ID abre la hoja
  {
    path: 'inventario',
    loadComponent: () => import('./pages/product-inventory-page/product-inventory-page.component').then((m) => m.ProductInventoryPageComponent),
    data: { breadcrumb: 'Inventario', icon: 'packages' },
  },
  // ?proveedor=ID abre la hoja
  {
    path: 'proveedores',
    loadComponent: () => import('./pages/product-suppliers-page/product-suppliers-page.component').then((m) => m.ProductSuppliersPageComponent),
    data: { breadcrumb: 'Proveedores', icon: 'truck' },
  },
  // ?compra=ID abre la hoja · ?nueva=1&proveedor=ID abre una compra nueva con ese proveedor
  {
    path: 'compras',
    loadComponent: () => import('./pages/product-purchases-page/product-purchases-page.component').then((m) => m.ProductPurchasesPageComponent),
    data: { breadcrumb: 'Compras', icon: 'shopping-cart' },
  },
  // La ficha vive en la hoja de Products.
  { path: ':id', redirectTo: ({ params }) => `/products?producto=${params['id']}` },
];
