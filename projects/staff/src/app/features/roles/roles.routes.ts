import { Routes } from '@angular/router';
import { RolesPageComponent } from './pages/roles-page/roles-page.component';

export const ROLES_ROUTES: Routes = [
  {
    path: '',
    component: RolesPageComponent,
    // Lo lee el rastro de navegación del topbar (`NavigationTrailService`).
    data: { breadcrumb: 'Roles y permisos', icon: 'shield-lock' },
  },
];
