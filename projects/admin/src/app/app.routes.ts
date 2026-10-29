import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { moduloGuard } from './core/auth/modulo.guard';
import { ShellComponent } from './layout/shell/shell.component';

export const routes: Routes = [
  {
    // Sin sidebar ni topbar y sin guard: es a donde `authGuard` manda cuando falta sesión.
    path: 'login',
    loadComponent: () =>
      import('./core/auth/pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    // Registro público (checkout): sin sidebar, topbar ni guard. Vive en
    // `admin` y no en un proyecto aparte porque, a diferencia de `staff`, no
    // hay motivo de seguridad para separarla.
    path: 'registro',
    loadComponent: () =>
      import(
        './features/registro-publico/pages/registro-publico-page/registro-publico-page.component'
      ).then((m) => m.RegistroPublicoPageComponent),
  },
  {
    // Destino del enlace para definir o restablecer la contraseña (también
    // confirma el alta). Sin guard: no hay sesión, el token viene en la URL.
    path: 'reset-password',
    loadComponent: () =>
      import('./core/auth/pages/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent,
      ),
  },
  {
    // Enlace para escribirle a Goods desde los correos de alta: quien se
    // registró todavía no tiene cuenta ni chat. El token del correo dice qué
    // Empresa es.
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
    // Asistente a pantalla completa: fuera del Shell, con su propio topbar y «Volver al panel».
    path: 'asistente',
    data: { breadcrumb: 'Asistente de IA', icon: 'ia' },
    loadChildren: () => import('./features/asistente/asistente.routes').then((m) => m.ASISTENTE_ROUTES),
  },
  {
    // Migas del topbar: cada sección lleva su `data.breadcrumb` y sus páginas
    // el suyo (ver `NavigationTrailService`).
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
        data: { breadcrumb: 'Pedidos', icon: 'inbox' },
        loadChildren: () => import('./features/orders/orders.routes').then((m) => m.ORDERS_ROUTES),
      },
      {
        path: 'products',
        data: { breadcrumb: 'Productos', icon: 'tag' },
        loadChildren: () =>
          import('./features/products/products.routes').then((m) => m.PRODUCTS_ROUTES),
      },
      {
        path: 'customers',
        data: { breadcrumb: 'Clientes', icon: 'user' },
        loadChildren: () =>
          import('./features/customers/customers.routes').then((m) => m.CUSTOMERS_ROUTES),
      },
      {
        path: 'discounts',
        data: { breadcrumb: 'Descuentos', icon: 'discount-2' },
        loadChildren: () =>
          import('./features/discounts/discounts.routes').then((m) => m.DISCOUNTS_ROUTES),
      },
      {
        path: 'messages',
        data: { breadcrumb: 'Mensajes', icon: 'message-circle-2' },
        loadChildren: () =>
          import('./features/messages/messages.routes').then((m) => m.MESSAGES_ROUTES),
      },
      {
        path: 'whatsapp',
        data: { breadcrumb: 'WhatsApp', icon: 'brand-whatsapp' },
        canActivate: [moduloGuard('whatsapp')],
        loadChildren: () => import('./features/whatsapp/whatsapp.routes').then((m) => m.WHATSAPP_ROUTES),
      },
      {
        // Configuración de la tienda en línea (la tienda pública es el proyecto `tienda`).
        path: 'tienda',
        data: { breadcrumb: 'Tienda en línea', icon: 'building-store' },
        canActivate: [moduloGuard('tienda')],
        loadChildren: () => import('./features/tienda/tienda.routes').then((m) => m.TIENDA_ROUTES),
      },
      {
        path: 'notificaciones',
        data: { breadcrumb: 'Notificaciones', icon: 'bell' },
        loadChildren: () =>
          import('./features/notificaciones/notificaciones.routes').then((m) => m.NOTIFICACIONES_ROUTES),
      },
      {
        path: 'settings',
        data: { breadcrumb: 'Configuración', icon: 'settings-2' },
        loadChildren: () =>
          import('./features/settings/settings.routes').then((m) => m.SETTINGS_ROUTES),
      },
      {
        // Vitrina de los componentes de `shared/ui`; no es una pantalla de negocio.
        path: 'dev',
        loadChildren: () =>
          import('./features/dev-showcase/dev-showcase.routes').then(
            (m) => m.DEV_SHOWCASE_ROUTES,
          ),
      },
    ],
  },
];
