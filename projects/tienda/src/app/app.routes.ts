import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: ':slug',
    loadComponent: () => import('./tienda-page/tienda-page.component').then((m) => m.TiendaPageComponent),
  },
  {
    // Enlace directo a un producto (el que se copia en la ficha del admin):
    // la misma tienda, con su detalle abierto.
    path: ':slug/p/:producto',
    loadComponent: () => import('./tienda-page/tienda-page.component').then((m) => m.TiendaPageComponent),
  },
  {
    // Raíz o dirección vacía: la misma pantalla «Aquí no hay tienda».
    path: '**',
    loadComponent: () => import('./no-disponible/no-disponible.component').then((m) => m.NoDisponibleComponent),
  },
];
