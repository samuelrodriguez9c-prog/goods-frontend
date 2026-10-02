import { Routes } from '@angular/router';
import { SoportePageComponent } from './pages/soporte-page/soporte-page.component';

export const SOPORTE_ROUTES: Routes = [
  {
    path: '',
    component: SoportePageComponent,
    // Rastro de navegación global del topbar (§5.4.4, 2026-10-02) —
    // ver `NavigationTrailService`.
    data: { breadcrumb: 'Soporte', icon: 'headset' },
  },
];
