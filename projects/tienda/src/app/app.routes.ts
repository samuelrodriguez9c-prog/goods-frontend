import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: ':slug',
    loadComponent: () => import('./tienda-page/tienda-page.component').then((m) => m.TiendaPageComponent),
  },
  {
    // Raíz o dirección vacía: misma pantalla «Aquí no hay tienda». Reemplaza a `sin-tienda` (se puede borrar).
    path: '**',
    loadComponent: () => import('./no-disponible/no-disponible.component').then((m) => m.NoDisponibleComponent),
  },
];
