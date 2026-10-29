import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NavigationTrailService } from '../navigation/navigation-trail.service';
import { CurrentUser } from './models/current-user.model';

const CLAVE_ACCESS_TOKEN = 'goods.accessToken';
const CLAVE_REFRESH_TOKEN = 'goods.refreshToken';

/** `GET /auth/enlace`: para armar `/reset-password` antes de enviar. */
export interface InfoEnlace {
  correo: string;
  nombres: string;
  apellidos: string;
  /** Sin contraseña todavía: invitación o activación («Crea tu contraseña»). */
  primeraVez: boolean;
  /** Invitación hecha solo con el correo: hay que pedir nombre y apellido. */
  necesitaNombre: boolean;
}

interface RespuestaTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Sesión del admin: tokens en localStorage (sobreviven a un F5) y perfil en
 * memoria (`GET /auth/me`).
 *
 * @remarks
 * El perfil no se guarda en localStorage para que un cambio de permisos se vea
 * al recargarlo, sin copias viejas. Quien adjunta el token y llama a
 * `refrescarToken()` ante un 401 es `authInterceptor`.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly navigationTrailService = inject(NavigationTrailService);

  private readonly _accessToken = signal<string | null>(
    localStorage.getItem(CLAVE_ACCESS_TOKEN),
  );
  private readonly _refreshToken = signal<string | null>(
    localStorage.getItem(CLAVE_REFRESH_TOKEN),
  );
  private readonly _currentUser = signal<CurrentUser | null>(null);

  readonly accessToken = this._accessToken.asReadonly();
  readonly currentUser = this._currentUser.asReadonly();

  // Solo mira si hay un token guardado, no si sigue vigente: si venció, el
  // interceptor intenta refrescar y, si falla, limpia la sesión.
  readonly isAuthenticated = computed(() => this._accessToken() !== null);

  /**
   * Inicia sesión y carga el perfil en el mismo paso.
   *
   * @returns El perfil; al emitir, los tokens ya están guardados y
   * `currentUser` listo.
   */
  login(correo: string, password: string): Observable<CurrentUser> {
    return this.http
      .post<RespuestaTokens>(`${environment.apiUrl}/auth/login`, { correo, password })
      .pipe(
        tap((tokens) => this.guardarTokens(tokens)),
        switchMap(() => this.cargarPerfil()),
      );
  }

  /** Pide `GET /auth/me` y lo deja en `currentUser`. También se usa solo, al arrancar con un token guardado. */
  cargarPerfil(): Observable<CurrentUser> {
    return this.http.get<CurrentUser>(`${environment.apiUrl}/auth/me`).pipe(
      tap((perfil) => this._currentUser.set(perfil)),
    );
  }

  /**
   * Pide tokens nuevos con el refresh token guardado.
   *
   * @remarks
   * El backend rota el refresh token en cada uso, así que se reemplazan los
   * dos tokens, no solo el de acceso.
   */
  refrescarToken(): Observable<RespuestaTokens> {
    const refreshToken = this._refreshToken();
    return this.http
      .post<RespuestaTokens>(`${environment.apiUrl}/auth/refresh`, { refreshToken })
      .pipe(tap((tokens) => this.guardarTokens(tokens)));
  }

  /** «No fui yo» del correo de contraseña cambiada (página `/cuenta/no-fui-yo`). */
  reportarCambioPassword(token: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${environment.apiUrl}/auth/reportar-cambio-password`, { token });
  }

  /** Datos del enlace del correo (público: el token es la credencial). 401 si venció o ya se usó. */
  infoEnlace(token: string): Observable<InfoEnlace> {
    return this.http.get<InfoEnlace>(`${environment.apiUrl}/auth/enlace`, { params: { token } });
  }

  /**
   * Define la contraseña con el token del enlace del correo. Al aceptar una
   * invitación sin nombre, `nombre` es obligatorio (si no, 400).
   *
   * @remarks
   * No guarda tokens: el backend cierra todas las sesiones al cambiar la
   * contraseña, así que después hay que entrar por `/login`.
   */
  resetPassword(
    token: string,
    password: string,
    nombre?: { nombres: string; apellidos: string },
  ): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${environment.apiUrl}/auth/reset-password`, {
      token,
      password,
      ...nombre,
    });
  }

  /**
   * Cierra la sesión en el backend y limpia el estado local aunque esa
   * llamada falle (por ejemplo, sin conexión), para no dejar a nadie atrapado.
   */
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
    // Rastro de navegación del topbar: una sesión nueva no hereda el de la anterior.
    this.navigationTrailService.reiniciar();
  }

  /** Manda al correo el enlace para cambiar la contraseña (Settings › Seguridad). */
  solicitarRecuperacionPassword(correo: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${environment.apiUrl}/auth/forgot-password`, { correo });
  }

  reenviarVerificacionCorreo(correo: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${environment.apiUrl}/auth/send-verification`, { correo });
  }

  /** Confirma el correo con el código de 6 dígitos que se le mandó. */
  verificarCorreoConCodigo(correo: string, codigo: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${environment.apiUrl}/auth/verify-email`, { correo, codigo });
  }

  private guardarTokens(tokens: RespuestaTokens): void {
    localStorage.setItem(CLAVE_ACCESS_TOKEN, tokens.accessToken);
    localStorage.setItem(CLAVE_REFRESH_TOKEN, tokens.refreshToken);
    this._accessToken.set(tokens.accessToken);
    this._refreshToken.set(tokens.refreshToken);
  }
}
