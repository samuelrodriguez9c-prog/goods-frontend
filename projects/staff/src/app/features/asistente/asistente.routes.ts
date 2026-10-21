// Rutas hijas de `/asistente`: el chat y la gestión de los documentos internos
// que el asistente busca por similitud. Cada una lleva su propio breadcrumb;
// las dos quedan bajo `/asistente`, así que `TopbarComponent.enAsistente`
// (`startsWith('/asistente')`) les muestra el botón "Volver al panel".
// `canActivate` va en cada hija porque `loadChildren` no lo hereda.
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
    data: { breadcrumb: 'Documentos internos', icon: 'file-text' },
    loadComponent: () =>
      import('./pages/documentos-internos-page/documentos-internos-page.component').then(
        (m) => m.DocumentosInternosPageComponent,
      ),
  },
];
