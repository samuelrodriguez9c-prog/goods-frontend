import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Protege el árbol de rutas del shell — mismo criterio "optimista" que
 * `admin/core/auth/auth.guard.ts`: solo mira si HAY un accessToken
 * guardado, no si sigue vigente ni de quién es (ver comentario de
 * `AuthService` sobre por qué el chequeo de rol `staff_goods` vive en
 * `LoginComponent.submit()` y no acá — un guard corre síncrono, antes de
 * que `GET /auth/me` pueda resolver, así que acá no hay forma confiable
 * de mirar el rol en el primer render tras un F5).
 *
 * La seguridad real de todos modos no depende de este guard: cada
 * endpoint del backend exige sus propios permisos (`empresas.ver`,
 * `empresas.activar`, etc., ver `RequirePermissions`), que ningún usuario
 * de un emprendimiento tiene — así que aunque alguien burlara este guard,
 * el backend igual le devolvería 403 en cada request real.
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.parseUrl('/login');
};
