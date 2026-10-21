import { Routes } from '@angular/router';
import { IngresosPageComponent } from './pages/ingresos-page/ingresos-page.component';

export const INGRESOS_ROUTES: Routes = [
  {
    path: '',
    component: IngresosPageComponent,
    // Lo lee el rastro de navegación del topbar (`NavigationTrailService`).
    data: { breadcrumb: 'Ingresos', icon: 'report-money' },
  },
];
