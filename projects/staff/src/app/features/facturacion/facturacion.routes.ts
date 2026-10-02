import { Routes } from '@angular/router';
import { FacturacionPageComponent } from './pages/facturacion-page/facturacion-page.component';

export const FACTURACION_ROUTES: Routes = [
  {
    path: '',
    component: FacturacionPageComponent,
    // Rastro de navegación global del topbar (§5.4.4, 2026-10-02) —
    // ver `NavigationTrailService`.
    data: { breadcrumb: 'Facturación', icon: 'receipt-2' },
  },
];
