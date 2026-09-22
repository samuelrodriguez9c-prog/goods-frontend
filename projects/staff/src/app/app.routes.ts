import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { ShellComponent } from './layout/shell/shell.component';

export const routes: Routes = [
  {
    // Igual que en `admin`: pantalla sin sidebar/topbar, sin guard — es
    // justo a donde `authGuard` redirige cuando falta sesión.
    path: 'login',
    loadComponent: () =>
      import('./core/auth/pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      {
        // Sin "Dashboard" propio todavía (§8 paso 5 no lo pidió) — la
        // entrada por defecto es Empresas, primera pantalla real del panel.
        path: '',
        pathMatch: 'full',
        redirectTo: 'empresas',
      },
      {
        path: 'empresas',
        loadChildren: () => import('./features/empresas/empresas.routes').then((m) => m.EMPRESAS_ROUTES),
      },
      {
        path: 'altas-pendientes',
        loadChildren: () =>
          import('./features/altas-pendientes/altas-pendientes.routes').then(
            (m) => m.ALTAS_PENDIENTES_ROUTES,
          ),
      },
      {
        path: 'planes',
        loadChildren: () => import('./features/planes/planes.routes').then((m) => m.PLANES_ROUTES),
      },
      {
        path: 'suscripciones',
        loadChildren: () =>
          import('./features/suscripciones/suscripciones.routes').then(
            (m) => m.SUSCRIPCIONES_ROUTES,
          ),
      },
      {
        path: 'facturacion',
        loadChildren: () =>
          import('./features/facturacion/facturacion.routes').then((m) => m.FACTURACION_ROUTES),
      },
      {
        path: 'ingresos',
        loadChildren: () =>
          import('./features/ingresos/ingresos.routes').then((m) => m.INGRESOS_ROUTES),
      },
      {
        path: 'soporte',
        loadChildren: () => import('./features/soporte/soporte.routes').then((m) => m.SOPORTE_ROUTES),
      },
      {
        path: 'auditoria',
        loadChildren: () =>
          import('./features/auditoria/auditoria.routes').then((m) => m.AUDITORIA_ROUTES),
      },
      {
        path: 'usuarios',
        loadChildren: () =>
          import('./features/usuarios/usuarios.routes').then((m) => m.USUARIOS_ROUTES),
      },
      {
        path: 'roles',
        loadChildren: () => import('./features/roles/roles.routes').then((m) => m.ROLES_ROUTES),
      },
      {
        // Perfil de la propia cuenta — pedido 2026-09-22 (ver
        // `SettingsPageComponent` y `SidebarComponent.settingsItem`). Sin
        // `permiso` acá tampoco: cualquier cuenta de staff entra a su
        // propio Settings.
        path: 'settings',
        loadChildren: () =>
          import('./features/settings/settings.routes').then((m) => m.SETTINGS_ROUTES),
      },
    ],
  },
];
