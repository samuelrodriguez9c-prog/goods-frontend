import { inject } from '@angular/core';
import {
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';

// Rutas de auth que NUNCA deben pasar por la lógica de "reintentar tras
// refrescar": /login y /refresh en sí mismos no llevan Authorization
// (login todavía no tiene token; refresh manda el refreshToken en el
// body, no en el header), y meterlos en el flujo de reintento crearía un
// loop infinito si el refresh también devuelve 401 (refresh token
// vencido/revocado). /reset-password es el mismo caso: se llama sin
// sesión (el token viaja en el body, no en el header, ver
// ResetPasswordComponent), así que un 401 de acá es "Token inválido o
// expirado" del propio endpoint, no un access token vencido — sin este
// excluido, el interceptor intentaba `refrescarToken()` con un
// refreshToken inexistente (nadie logueado todavía) y el 400 de ESE
// intento ("refreshToken must be a string") tapaba el mensaje real del
// backend (encontrado probando la pantalla end-to-end, 2026-09-15).
const RUTAS_SIN_INTERCEPTAR = ['/auth/login', '/auth/refresh', '/auth/reset-password'];

/**
 * Adjunta `Authorization: Bearer <accessToken>` a cada request saliente
 * y, si el backend responde 401 (access token vencido), intenta
 * refrescar una sola vez y reintenta la request original con el token
 * nuevo. Si el refresh también falla, cierra la sesión local — el guard
 * de rutas (`authGuard`) se encarga de mandar a `/login` en la próxima
 * navegación.
 *
 * Funcional (`HttpInterceptorFn`) en vez de clase, consistente con el
 * resto del código (sin NgModule) — se registra en `app.config.ts` vía
 * `provideHttpClient(withInterceptors([authInterceptor]))`.
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
