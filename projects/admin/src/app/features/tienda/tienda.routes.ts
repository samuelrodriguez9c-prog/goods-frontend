import { Routes } from '@angular/router';
import { TiendaPageComponent } from './pages/tienda-page/tienda-page.component';

export const TIENDA_ROUTES: Routes = [
  { path: '', component: TiendaPageComponent, data: { breadcrumb: 'Tienda en línea', icon: 'building-store' } },
];
