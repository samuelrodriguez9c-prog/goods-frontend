import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Protege las rutas del shell de forma optimista: solo mira si hay un
 * accessToken guardado, no si sigue vigente ni de quién es.
 *
 * @remarks
 * El guard corre antes de que `GET /auth/me` resuelva, así que no puede
 * mirar el rol; ese chequeo está en `LoginComponent.submit()`. La seguridad
 * real la da el backend: cada endpoint exige sus permisos y responde 403.
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.parseUrl('/login');
};
