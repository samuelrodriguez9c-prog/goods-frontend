import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';

// Coincide por `includes`, así que '/auth/login' también cubre '/auth/login-staff'.
const RUTAS_SIN_INTERCEPTAR = ['/auth/login', '/auth/refresh'];

/**
 * Adjunta `Authorization: Bearer <accessToken>` a cada request y, ante un
 * 401, refresca una sola vez y reintenta; si el refresh falla, limpia la sesión.
 * Copia de la de `admin` (ver `AuthService` sobre por qué no se comparte).
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
          next(req.clone({ setHeaders: { Authorization: `Bearer ${tokens.accessToken}` } })),
        ),
        catchError((refreshError: unknown) => {
          authService.limpiarSesion();
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
