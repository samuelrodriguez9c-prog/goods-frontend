import { Routes } from '@angular/router';
import { AltasPendientesPageComponent } from './pages/altas-pendientes-page/altas-pendientes-page.component';

export const ALTAS_PENDIENTES_ROUTES: Routes = [
  {
    path: '',
    component: AltasPendientesPageComponent,
    // Lo lee el rastro de navegación del topbar (`NavigationTrailService`).
    data: { breadcrumb: 'Altas pendientes', icon: 'user-plus' },
  },
];
