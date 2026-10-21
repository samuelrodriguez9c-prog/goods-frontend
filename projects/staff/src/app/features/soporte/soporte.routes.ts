import { Routes } from '@angular/router';
import { SoportePageComponent } from './pages/soporte-page/soporte-page.component';

export const SOPORTE_ROUTES: Routes = [
  {
    path: '',
    component: SoportePageComponent,
    // Lo lee el rastro de navegación del topbar (`NavigationTrailService`).
    data: { breadcrumb: 'Soporte', icon: 'headset' },
  },
];
