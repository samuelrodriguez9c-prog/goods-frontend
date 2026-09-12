import { Routes } from '@angular/router';
import { ShellComponent } from './layout/shell/shell.component';

export const routes: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      {
        path: '',
        loadChildren: () =>
          import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
      },
      {
        path: 'orders',
        loadChildren: () => import('./features/orders/orders.routes').then((m) => m.ORDERS_ROUTES),
      },
      {
        path: 'products',
        loadChildren: () =>
          import('./features/products/products.routes').then((m) => m.PRODUCTS_ROUTES),
      },
      {
        path: 'customers',
        loadChildren: () =>
          import('./features/customers/customers.routes').then((m) => m.CUSTOMERS_ROUTES),
      },
      {
        path: 'discounts',
        loadChildren: () =>
          import('./features/discounts/discounts.routes').then((m) => m.DISCOUNTS_ROUTES),
      },
      {
        path: 'messages',
        loadChildren: () =>
          import('./features/messages/messages.routes').then((m) => m.MESSAGES_ROUTES),
      },
      {
        path: 'settings',
        loadChildren: () =>
          import('./features/settings/settings.routes').then((m) => m.SETTINGS_ROUTES),
      },
      {
        // Página de validación visual de shared/ui/ — no es una pantalla de
        // negocio, ver features/dev-showcase.
        path: 'dev',
        loadChildren: () =>
          import('./features/dev-showcase/dev-showcase.routes').then(
            (m) => m.DEV_SHOWCASE_ROUTES,
          ),
      },
    ],
  },
];
