import { Routes } from '@angular/router';
import { RolesPageComponent } from './pages/roles-page/roles-page.component';

export const ROLES_ROUTES: Routes = [
  {
    path: '',
    component: RolesPageComponent,
    // Rastro de navegación global del topbar (§5.4.4, 2026-10-02) —
    // ver `NavigationTrailService`.
    data: { breadcrumb: 'Roles y permisos', icon: 'shield-lock' },
  },
];
