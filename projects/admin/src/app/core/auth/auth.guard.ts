import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Protege el árbol de rutas del shell (ver `app.routes.ts`): sin
 * accessToken guardado, redirige a `/login` en vez de dejar pasar la
 * navegación. Chequeo "optimista" (solo mira si HAY un token, no si
 * sigue vigente) — si el token ya expiró, la primera request real lo
 * descubre vía 401 y `authInterceptor` intenta refrescar; si el refresh
 * también falla, `authInterceptor` limpia la sesión y la SIGUIENTE
 * navegación (ej. el usuario hace click en otro ítem del sidebar) recién
 * ahí rebota acá al guard.
 *
 * Funcional (`CanActivateFn`), igual criterio que `authInterceptor`: sin
 * NgModule, se registra directo como `canActivate: [authGuard]` en la
 * ruta del shell.
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.parseUrl('/login');
};
