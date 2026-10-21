import { Routes } from '@angular/router';
import { EmpresasPageComponent } from './pages/empresas-page/empresas-page.component';

export const EMPRESAS_ROUTES: Routes = [
  {
    path: '',
    component: EmpresasPageComponent,
    // Lo lee el rastro de navegación del topbar (`NavigationTrailService`).
    data: { breadcrumb: 'Empresas', icon: 'building' },
  },
];
