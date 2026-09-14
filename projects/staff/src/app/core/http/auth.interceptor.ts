import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';

// Mismo criterio que `admin/core/http/auth.interceptor.ts`.
const RUTAS_SIN_INTERCEPTAR = ['/auth/login', '/auth/refresh'];

/**
 * Adjunta `Authorization: Bearer <accessToken>` a cada request saliente
 * y, ante un 401, refresca una sola vez y reintenta — copia exacta de
 * `admin/core/http/auth.interceptor.ts` (duplicado a propósito, ver
 * comentario de `AuthService` sobre por qué `staff` no comparte código de
 * auth con `admin`).
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
