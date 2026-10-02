import { Routes } from '@angular/router';
import { AuditoriaPageComponent } from './pages/auditoria-page/auditoria-page.component';

export const AUDITORIA_ROUTES: Routes = [
  {
    path: '',
    component: AuditoriaPageComponent,
    // Rastro de navegación global del topbar (§5.4.4, 2026-10-02) —
    // ver `NavigationTrailService`.
    data: { breadcrumb: 'Auditoría', icon: 'history' },
  },
];
