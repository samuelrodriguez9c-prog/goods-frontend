// projects/staff/src/app/features/asistente/asistente.routes.ts
//
// Hasta el 2026-10-02, `/asistente` era una entrada única (`loadComponent`
// directo en `app.routes.ts`). Pasa a `loadChildren` acá porque sumó una
// segunda pantalla (`documentos`, Fase 6 — gestión de los documentos
// internos que el asistente busca por similitud) que necesita su PROPIO
// breadcrumb ("Documentos internos", distinto de "Asistente de IA") sin
// dejar de vivir bajo el mismo paraguas: `TopbarComponent.enAsistente`
// chequea `startsWith('/asistente')`, así que las dos rutas siguen
// mostrando el mismo botón "Volver al panel" sin tocar ese componente.
//
// Mismo `canActivate: [authGuard]` que antes (movido del objeto de ruta
// de `app.routes.ts` a cada hijo acá, `loadChildren` no lo hereda solo).
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
