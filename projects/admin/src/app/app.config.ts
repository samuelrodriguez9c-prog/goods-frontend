import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // PrimeNG usa @angular/animations (vía provideAnimationsAsync) para las
    // transiciones de overlays (dropdowns, dialogs, popovers). Angular marca
    // @angular/animations como deprecado a favor de animate.enter/leave, pero
    // PrimeNG 21.x todavía depende de la API clásica — se revisará cuando
    // PrimeNG migre.
    provideAnimationsAsync(),
    providePrimeNG({
      // Sin preset de estilo (Aura/Material/Lara/Nora): el look final se
      // construye con Tailwind + `pt` (pass-through) sobre cada componente,
      // para calcar el lenguaje visual de Polaris documentado en
      // ADMIN_DISENO.md, en vez de partir de un tema ya vestido y pelear
      // contra su estética por defecto.
      //
      // Nota: el tipo expone también `unstyled: true`, pero en esta versión
      // (21.1.10) está marcado como @experimental / "not yet implemented" —
      // `theme: 'none'` es el mecanismo real y funcional para lograr lo mismo.
      theme: 'none',
    }),
  ],
};
