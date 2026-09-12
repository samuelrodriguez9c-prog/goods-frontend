import { Routes } from '@angular/router';
import { SettingsPageComponent } from './pages/settings-page/settings-page.component';
import { SettingsRolesPageComponent } from './pages/settings-roles-page/settings-roles-page.component';
import { SettingsUsersPageComponent } from './pages/settings-users-page/settings-users-page.component';

export const SETTINGS_ROUTES: Routes = [
  { path: '', component: SettingsPageComponent },
  { path: 'usuarios', component: SettingsUsersPageComponent },
  { path: 'roles', component: SettingsRolesPageComponent },
];
