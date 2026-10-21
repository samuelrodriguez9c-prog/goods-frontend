import { inject } from '@angular/core';
import {
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';

// Rutas que no pasan por "refrescar y reintentar": no llevan sesión (el token,
// si hay, va en el body), así que un 401 es la respuesta real del endpoint.
// Reintentarlas haría un loop si el refresh también da 401, o taparía el
// mensaje del backend con el error del refresh.
// Coincide por `includes`.
const RUTAS_SIN_INTERCEPTAR = [
  '/auth/login',
  '/auth/refresh',
  '/auth/reset-password',
  '/auth/reportar-cambio-password',
  '/empresas/registro-publico/contacto',
];

/**
 * Adjunta `Authorization: Bearer <accessToken>` a cada request y, ante un
 * 401, refresca una sola vez y reintenta. Si el refresh falla, limpia la
 * sesión; `authGuard` manda a `/login` en la próxima navegación.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  if (RUTAS_SIN_INTERCEPTAR.some((ruta) => req.url.includes(ruta))) {
    return next(req);
  }

  const accessToken = authService.accessToken();
  const requestConToken = accessToken
    ? req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } })
    : req;

  return next(requestConToken).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      return authService.refrescarToken().pipe(
        switchMap((tokens) =>
          next(
            req.clone({ setHeaders: { Authorization: `Bearer ${tokens.accessToken}` } }),
          ),
        ),
        catchError((refreshError: unknown) => {
          authService.limpiarSesion();
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
