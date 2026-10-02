import { Routes } from '@angular/router';
import { AltasPendientesPageComponent } from './pages/altas-pendientes-page/altas-pendientes-page.component';

export const ALTAS_PENDIENTES_ROUTES: Routes = [
  {
    path: '',
    component: AltasPendientesPageComponent,
    // Rastro de navegación global del topbar (§5.4.4, 2026-10-02) —
    // ver `NavigationTrailService`.
    data: { breadcrumb: 'Altas pendientes', icon: 'user-plus' },
  },
];
