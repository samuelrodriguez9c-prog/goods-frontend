import { Routes } from '@angular/router';
import { SuscripcionesPageComponent } from './pages/suscripciones-page/suscripciones-page.component';

export const SUSCRIPCIONES_ROUTES: Routes = [
  {
    path: '',
    component: SuscripcionesPageComponent,
    // Lo lee el rastro de navegación del topbar (`NavigationTrailService`).
    data: { breadcrumb: 'Suscripciones', icon: 'repeat' },
  },
];
