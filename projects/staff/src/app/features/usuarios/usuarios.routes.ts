import { Routes } from '@angular/router';
import { UsuariosPageComponent } from './pages/usuarios-page/usuarios-page.component';

export const USUARIOS_ROUTES: Routes = [
  {
    path: '',
    component: UsuariosPageComponent,
    // Rastro de navegación del topbar: ver `NavigationTrailService`.
    data: { breadcrumb: 'Usuarios', icon: 'users' },
  },
];
