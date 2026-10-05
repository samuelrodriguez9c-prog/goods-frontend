import { Routes } from '@angular/router';
import { SolicitudesPageComponent } from './pages/solicitudes-page/solicitudes-page.component';

export const SOLICITUDES_ROUTES: Routes = [
  {
    path: '',
    component: SolicitudesPageComponent,
    data: { breadcrumb: 'Solicitudes', icon: 'bulb' },
  },
];
