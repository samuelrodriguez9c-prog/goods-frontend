import { Routes } from '@angular/router';
import { IngresosPageComponent } from './pages/ingresos-page/ingresos-page.component';

export const INGRESOS_ROUTES: Routes = [
  {
    path: '',
    component: IngresosPageComponent,
    // Rastro de navegación global del topbar (§5.4.4, 2026-10-02) —
    // ver `NavigationTrailService`.
    data: { breadcrumb: 'Ingresos', icon: 'report-money' },
  },
];
