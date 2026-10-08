import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { ShellComponent } from './layout/shell/shell.component';

export const routes: Routes = [
  {
    // Pantalla sin sidebar/topbar — vive en su propia rama de rutas, tal
    // como anticipaba el comentario en shell.component.ts. Sin guard: es
    // justo la ruta a la que `authGuard` redirige cuando falta sesión.
    path: 'login',
    loadComponent: () =>
      import('./core/auth/pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    // Página pública de registro/checkout (PIVOTE_SAAS_MULTITENANT.md
    // §5) — mismo criterio que /login: sin sidebar/topbar, sin guard (un
    // visitante anónimo todavía no tiene cuenta). Vive acá adentro de
    // `admin` en vez de un proyecto Angular aparte porque no hay ningún
    // motivo de seguridad para separarla (a diferencia de `staff`, ver
    // §4) — es solo una ruta pública más.
    path: 'registro',
    loadComponent: () =>
      import(
        './features/registro-publico/pages/registro-publico-page/registro-publico-page.component'
      ).then((m) => m.RegistroPublicoPageComponent),
  },
  {
    // Pantalla a la que apunta el enlace del correo de "restablecer
    // contraseña" / confirmación de alta asistida (§8 punto 6 de
    // PROPUESTA_FLUJO_ALTA_ASISTIDA.md — antes no existía esta ruta, el
    // link del correo no tenía dónde caer). Mismo criterio que /login y
    // /registro: sin sidebar/topbar, sin guard (todavía no hay sesión —
    // el token viene en la query string, no en el Authorization header).
    path: 'reset-password',
    loadComponent: () =>
      import('./core/auth/pages/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent,
      ),
  },
  {
    // Enlace "escribinos" de los correos de alta: quien se registró
    // todavía no tiene cuenta ni chat. El token del correo dice qué
    // Empresa es (ver ContactoAltaService del backend).
    path: 'registro/mensaje',
    loadComponent: () =>
      import(
        './features/registro-publico/pages/mensaje-alta-page/mensaje-alta-page.component'
      ).then((m) => m.MensajeAltaPageComponent),
  },
  {
    // Botón "No fui yo" del correo de contraseña cambiada. Pide confirmar
    // con un clic (POST): los escáneres de enlaces de los correos abren
    // los GET solos y no deberían poder bloquear una cuenta.
    path: 'cuenta/no-fui-yo',
    loadComponent: () =>
      import('./core/auth/pages/no-fui-yo/no-fui-yo.component').then((m) => m.NoFuiYoComponent),
  },
  {
    // Asistente de IA a pantalla completa (2026-10-07, igual que staff):
    // fuera del Shell, monta su propio topbar con "Volver al panel".
    path: 'asistente',
    loadChildren: () => import('./features/asistente/asistente.routes').then((m) => m.ASISTENTE_ROUTES),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
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
        path: 'notificaciones',
        loadChildren: () =>
          import('./features/notificaciones/notificaciones.routes').then((m) => m.NOTIFICACIONES_ROUTES),
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
