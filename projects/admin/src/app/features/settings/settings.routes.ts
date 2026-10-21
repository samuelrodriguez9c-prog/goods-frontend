import { Routes } from '@angular/router';
import { moduloGuard } from '../../core/auth/modulo.guard';
import { SettingsPageComponent } from './pages/settings-page/settings-page.component';
import { SettingsSolicitudesPageComponent } from './pages/settings-solicitudes-page/settings-solicitudes-page.component';
import { SettingsCamposPageComponent } from './pages/settings-campos-page/settings-campos-page.component';
import { SettingsActividadPageComponent } from './pages/settings-actividad-page/settings-actividad-page.component';
import { SettingsRolesPageComponent } from './pages/settings-roles-page/settings-roles-page.component';
import { SettingsUsersPageComponent } from './pages/settings-users-page/settings-users-page.component';

export const SETTINGS_ROUTES: Routes = [
  { path: '', component: SettingsPageComponent, data: { breadcrumb: 'Settings', icon: 'settings-2' } },
  // `users` y `roles` son módulos del plan (ver `moduloGuard`).
  { path: 'usuarios', component: SettingsUsersPageComponent, canActivate: [moduloGuard('users')], data: { breadcrumb: 'Usuarios', icon: 'users' } },
  { path: 'roles', component: SettingsRolesPageComponent, canActivate: [moduloGuard('roles')], data: { breadcrumb: 'Roles y permisos', icon: 'shield-lock' } },
  // Solicitudes no es un módulo del plan: toda Empresa puede pedir (el backend exige `solicitudes.crear`).
  { path: 'solicitudes', component: SettingsSolicitudesPageComponent, data: { breadcrumb: 'Solicitudes a Goods', icon: 'bulb' } },
  { path: 'campos', component: SettingsCamposPageComponent, data: { breadcrumb: 'Campos propios', icon: 'forms' } },
  { path: 'actividad', component: SettingsActividadPageComponent, canActivate: [moduloGuard('actividad_equipo')], data: { breadcrumb: 'Actividad del equipo', icon: 'history' } },
];
