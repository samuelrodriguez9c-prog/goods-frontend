import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CurrentUser } from './models/current-user.model';

const CLAVE_ACCESS_TOKEN = 'goods.accessToken';
const CLAVE_REFRESH_TOKEN = 'goods.refreshToken';

interface RespuestaTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Estado de sesión del admin: tokens (persistidos en localStorage, para
 * sobrevivir un refresh de página) + perfil/rol/permisos (en memoria,
 * salen de `GET /auth/me` — nunca se guardan en localStorage porque no
 * hace falta y así un cambio de permisos en el backend se refleja apenas
 * se recargue `currentUser`, no queda una copia vieja dando vueltas).
 *
 * `authInterceptor` (core/http) es quien realmente adjunta el
 * `accessToken` a cada request y dispara `refrescarToken()` ante un 401;
 * este servicio expone los métodos pero no se "auto-engancha" a HttpClient.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly _accessToken = signal<string | null>(
    localStorage.getItem(CLAVE_ACCESS_TOKEN),
  );
  private readonly _refreshToken = signal<string | null>(
    localStorage.getItem(CLAVE_REFRESH_TOKEN),
  );
  private readonly _currentUser = signal<CurrentUser | null>(null);

  readonly accessToken = this._accessToken.asReadonly();
  readonly currentUser = this._currentUser.asReadonly();

  // Solo mira si hay un access token guardado — no valida que siga
  // vigente (eso lo resuelve el backend en cada request; ver
  // authInterceptor). Sirve para decisiones "optimistas" como el guard
  // de rutas, que igual se corrige solo si el token ya expiró (el
  // interceptor intenta refrescar, y si el refresh también falla, acá
  // mismo se llama logout() y el guard vuelve a mandar a /login).
  readonly isAuthenticated = computed(() => this._accessToken() !== null);

  /** POST /auth/login + carga inmediata del perfil, así quien llama
   * termina con accessToken guardado y currentUser ya listo en un solo
   * paso (el login page no tiene que encadenar dos llamadas). */
  login(correo: string, password: string): Observable<CurrentUser> {
    return this.http
      .post<RespuestaTokens>(`${environment.apiUrl}/auth/login`, { correo, password })
      .pipe(
        tap((tokens) => this.guardarTokens(tokens)),
        switchMap(() => this.cargarPerfil()),
      );
  }

  /** GET /auth/me — separado de login() porque también hace falta solo
   * (ej. al arrancar la app con un accessToken ya guardado de una sesión
   * anterior, antes de mostrar el shell). */
  cargarPerfil(): Observable<CurrentUser> {
    return this.http.get<CurrentUser>(`${environment.apiUrl}/auth/me`).pipe(
      tap((perfil) => this._currentUser.set(perfil)),
    );
  }

  /** POST /auth/refresh — usado por authInterceptor ante un 401. El
   * backend rota el refresh token en cada uso (ver
   * AuthService.refrescarToken del backend), así que acá también hay
   * que reemplazar los dos tokens guardados, no solo el access token. */
  refrescarToken(): Observable<RespuestaTokens> {
    const refreshToken = this._refreshToken();
    return this.http
      .post<RespuestaTokens>(`${environment.apiUrl}/auth/refresh`, { refreshToken })
      .pipe(tap((tokens) => this.guardarTokens(tokens)));
  }

  /** POST /auth/reset-password — pantalla `/reset-password`
   * (ResetPasswordComponent). A diferencia de `login()`, esto NO guarda
   * tokens: el backend revoca todas las sesiones activas al cambiar la
   * contraseña (ver `AuthService.resetPassword` del backend), así que
   * quien restablece su contraseña siempre vuelve a `/login` a entrar de
   * nuevo, nunca queda logueado automáticamente. */
  resetPassword(token: string, password: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${environment.apiUrl}/auth/reset-password`, {
      token,
      password,
    });
  }

  /** Best-effort: revoca la sesión en el backend, pero limpia el estado
   * local aunque la llamada falle (ej. sin conexión) — no tiene sentido
   * dejar a alguien "atrapado" logueado localmente porque el logout de
   * verdad no llegó a salir. */
  logout(): void {
    const refreshToken = this._refreshToken();
    if (refreshToken) {
      this.http
        .post(`${environment.apiUrl}/auth/logout`, { refreshToken })
        .subscribe({ error: () => undefined });
    }
    this.limpiarSesion();
  }

  limpiarSesion(): void {
    localStorage.removeItem(CLAVE_ACCESS_TOKEN);
    localStorage.removeItem(CLAVE_REFRESH_TOKEN);
    this._accessToken.set(null);
    this._refreshToken.set(null);
    this._currentUser.set(null);
  }

  private guardarTokens(tokens: RespuestaTokens): void {
    localStorage.setItem(CLAVE_ACCESS_TOKEN, tokens.accessToken);
    localStorage.setItem(CLAVE_REFRESH_TOKEN, tokens.refreshToken);
    this._accessToken.set(tokens.accessToken);
    this._refreshToken.set(tokens.refreshToken);
  }
}
