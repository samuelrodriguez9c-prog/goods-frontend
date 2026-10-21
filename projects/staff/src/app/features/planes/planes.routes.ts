import { Routes } from '@angular/router';
import { PlanesPageComponent } from './pages/planes-page/planes-page.component';

export const PLANES_ROUTES: Routes = [
  {
    path: '',
    component: PlanesPageComponent,
    // Lo lee el rastro de navegación del topbar (`NavigationTrailService`).
    data: { breadcrumb: 'Planes', icon: 'stack-2' },
  },
];
