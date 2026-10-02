import { Routes } from '@angular/router';
import { UsuariosPageComponent } from './pages/usuarios-page/usuarios-page.component';

export const USUARIOS_ROUTES: Routes = [
  {
    path: '',
    component: UsuariosPageComponent,
    // Rastro de navegación global del topbar (§5.4.4, 2026-10-02) —
    // ver `NavigationTrailService`.
    data: { breadcrumb: 'Usuarios', icon: 'users' },
  },
];
