import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Protege las rutas del shell: sin token guardado, manda a `/login`.
 *
 * @remarks
 * Solo mira si hay token, no si sigue vigente. Si venció, el primer 401 lo
 * descubre; si el refresh falla, `authInterceptor` limpia la sesión y la
 * siguiente navegación cae acá.
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.parseUrl('/login');
};
