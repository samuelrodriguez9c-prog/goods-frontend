import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: ':slug',
    loadComponent: () => import('./tienda-page/tienda-page.component').then((m) => m.TiendaPageComponent),
  },
  {
    path: '**',
    loadComponent: () => import('./sin-tienda/sin-tienda.component').then((m) => m.SinTiendaComponent),
  },
];
