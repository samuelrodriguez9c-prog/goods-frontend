import { Routes } from '@angular/router';
import { EmpresasPageComponent } from './pages/empresas-page/empresas-page.component';

export const EMPRESAS_ROUTES: Routes = [
  {
    path: '',
    component: EmpresasPageComponent,
    // Rastro de navegación global del topbar (§5.4.4, 2026-10-02) —
    // ver `NavigationTrailService`.
    data: { breadcrumb: 'Empresas', icon: 'building' },
  },
];
