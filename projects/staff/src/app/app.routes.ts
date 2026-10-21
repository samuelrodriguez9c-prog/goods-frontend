import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { ShellComponent } from './layout/shell/shell.component';

export const routes: Routes = [
  {
    // Sin shell ni guard: es a donde `authGuard` redirige cuando falta sesión.
    path: 'login',
    loadComponent: () =>
      import('./core/auth/pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    // Fuera del shell a propósito: el Asistente de IA trae su propia topbar
    // con "Volver al panel". No hay guard de permiso: el backend ya exige
    // `asistente_staff.usar` y `AsistenteDockComponent` oculta el acceso.
    // `icon: 'ia'` del hijo por defecto no es un ícono Tabler: le dice a
    // `BreadcrumbTrailComponent` que pinte `app-ia-marca`.
    path: 'asistente',
    loadChildren: () => import('./features/asistente/asistente.routes').then((m) => m.ASISTENTE_ROUTES),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      {
        // Sin dashboard: la entrada por defecto es Empresas.
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
        path: 'solicitudes',
        loadChildren: () =>
          import('./features/solicitudes/solicitudes.routes').then((m) => m.SOLICITUDES_ROUTES),
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
        // Destino de "Ver todas" en la campanita (`TopbarComponent`). Sin ítem
        // en el sidebar a propósito: no es un módulo de primer nivel.
        path: 'notificaciones',
        loadChildren: () =>
          import('./features/notificaciones/notificaciones.routes').then(
            (m) => m.NOTIFICACIONES_ROUTES,
          ),
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
        // Perfil de la propia cuenta: sin permiso, cualquier cuenta de staff
        // entra a su propio Settings.
        path: 'settings',
        loadChildren: () =>
          import('./features/settings/settings.routes').then((m) => m.SETTINGS_ROUTES),
      },
    ],
  },
];
