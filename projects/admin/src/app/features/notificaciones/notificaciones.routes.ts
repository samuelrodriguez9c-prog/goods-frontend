import { Routes } from '@angular/router';
import { NotificacionesPageComponent } from './pages/notificaciones-page/notificaciones-page.component';

export const NOTIFICACIONES_ROUTES: Routes = [
  {
    path: '',
    component: NotificacionesPageComponent,
    // Rastro de navegación global del topbar (§5.4.4, 2026-10-02) —
    // ver `NavigationTrailService`.
    data: { breadcrumb: 'Notificaciones', icon: 'bell' },
  },
];
