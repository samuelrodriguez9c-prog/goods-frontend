import { Routes } from '@angular/router';
import { SuscripcionesPageComponent } from './pages/suscripciones-page/suscripciones-page.component';

export const SUSCRIPCIONES_ROUTES: Routes = [
  {
    path: '',
    component: SuscripcionesPageComponent,
    // Rastro de navegación global del topbar (§5.4.4, 2026-10-02) —
    // ver `NavigationTrailService`.
    data: { breadcrumb: 'Suscripciones', icon: 'repeat' },
  },
];
