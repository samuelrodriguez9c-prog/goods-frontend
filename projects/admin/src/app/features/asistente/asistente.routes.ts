// Dos pantallas bajo `/asistente` (el chat y `documentos`), cada una con su
// miga. Las dos muestran «Volver al panel» porque `TopbarComponent.enAsistente`
// mira `startsWith('/asistente')`. El guard va en cada hija porque
// `loadChildren` no lo hereda.
import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth/auth.guard';

export const ASISTENTE_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    data: { breadcrumb: 'Asistente de IA', icon: 'ia' },
    loadComponent: () =>
      import('./pages/asistente-page/asistente-page.component').then(
        (m) => m.AsistentePageComponent,
      ),
  },
  {
    path: 'documentos',
    canActivate: [authGuard],
    data: { breadcrumb: 'Documentos', icon: 'file-text' },
    loadComponent: () =>
      import('./pages/documentos-internos-page/documentos-internos-page.component').then(
        (m) => m.DocumentosInternosPageComponent,
      ),
  },
];
