import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';

/**
 * Proyecto `tienda` (tercer proyecto del workspace, previsto en
 * PIVOTE_SAAS_MULTITENANT.md §7.1): lo ve cualquiera, sin sesión, casi
 * siempre desde el celular. Sin PrimeNG ni `shared-ui`: es una sola
 * pantalla y tiene que cargar rápido con datos móviles.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch()),
  ],
};
