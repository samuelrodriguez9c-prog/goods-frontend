import { Routes } from '@angular/router';
import { AuditoriaPageComponent } from './pages/auditoria-page/auditoria-page.component';

export const AUDITORIA_ROUTES: Routes = [
  {
    path: '',
    component: AuditoriaPageComponent,
    // Lo lee el rastro de navegación del topbar (`NavigationTrailService`).
    data: { breadcrumb: 'Auditoría', icon: 'history' },
  },
];
