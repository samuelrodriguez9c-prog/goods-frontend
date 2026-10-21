import { Routes } from '@angular/router';
import { SettingsPageComponent } from './pages/settings-page/settings-page.component';

/**
 * Una sola ruta: aquí Settings es solo el perfil de la propia cuenta. El equipo
 * se gestiona en los ítems Usuarios y Roles y permisos del sidebar, así que no
 * hace falta un árbol de sub-páginas como en `admin/features/settings/`.
 */
export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    component: SettingsPageComponent,
    // Lo lee el rastro de navegación del topbar (`NavigationTrailService`).
    data: { breadcrumb: 'Settings', icon: 'settings-2' },
  },
];
