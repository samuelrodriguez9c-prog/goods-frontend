import { Routes } from '@angular/router';
import { moduloGuard } from '../../core/auth/modulo.guard';
import { SettingsPageComponent } from './pages/settings-page/settings-page.component';
import { SettingsSolicitudesPageComponent } from './pages/settings-solicitudes-page/settings-solicitudes-page.component';
import { SettingsRolesPageComponent } from './pages/settings-roles-page/settings-roles-page.component';
import { SettingsUsersPageComponent } from './pages/settings-users-page/settings-users-page.component';

export const SETTINGS_ROUTES: Routes = [
  { path: '', component: SettingsPageComponent },
  // Módulos de plan `users` / `roles` (2026-10-02) — ver `moduloGuard`.
  { path: 'usuarios', component: SettingsUsersPageComponent, canActivate: [moduloGuard('users')] },
  { path: 'roles', component: SettingsRolesPageComponent, canActivate: [moduloGuard('roles')] },
  // Solicitudes de personalización (2026-10-04): no es un módulo del plan,
  // toda Empresa puede pedir (el backend exige `solicitudes.crear`).
  { path: 'solicitudes', component: SettingsSolicitudesPageComponent },
];
