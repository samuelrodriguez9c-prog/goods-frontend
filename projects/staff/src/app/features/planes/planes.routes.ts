import { Routes } from '@angular/router';
import { PlanesPageComponent } from './pages/planes-page/planes-page.component';

export const PLANES_ROUTES: Routes = [
  {
    path: '',
    component: PlanesPageComponent,
    // Rastro de navegación global del topbar (§5.4.4, 2026-10-02) —
    // ver `NavigationTrailService`.
    data: { breadcrumb: 'Planes', icon: 'stack-2' },
  },
];
