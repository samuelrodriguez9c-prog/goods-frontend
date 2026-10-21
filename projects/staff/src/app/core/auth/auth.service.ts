import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NavigationTrailService } from '../navigation/navigation-trail.service';
import { CurrentUser } from './models/current-user.model';

const CLAVE_ACCESS_TOKEN = 'goods.staff.accessToken';
const CLAVE_REFRESH_TOKEN = 'goods.staff.refreshToken';

interface RespuestaTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Sesión del panel de staff: tokens en localStorage y perfil en memoria.
 *
 * @remarks
 * Duplicado a propósito del `AuthService` de `admin` en vez de compartido:
 * son apps con sesiones independientes y `shared-ui` es solo para UI.
 * Las claves llevan el prefijo `goods.staff.` para que se sepa de qué app
 * son al mirar el localStorage.
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

  readonly isAuthenticated = computed(() => this._accessToken() !== null);

  /**
   * Inicia sesión con `POST /auth/login-staff`, guarda los tokens y carga el perfil.
   *
   * @remarks
   * El backend responde 403 si la cuenta no es de staff ni tiene el acceso
   * especial de superadmin (`Usuario.accesoStaffGoods`); con ese acceso,
   * la sesión se abre prestando identidad de staff sin tocar su rol real.
   */
  login(correo: string, password: string): Observable<CurrentUser> {
    return this.http
      .post<RespuestaTokens>(`${environment.apiUrl}/auth/login-staff`, { correo, password })
      .pipe(
        tap((tokens) => this.guardarTokens(tokens)),
        switchMap(() => this.cargarPerfil()),
      );
  }

  cargarPerfil(): Observable<CurrentUser> {
    return this.http.get<CurrentUser>(`${environment.apiUrl}/auth/me`).pipe(
      tap((perfil) => this._currentUser.set(perfil)),
    );
  }

  /** Pide tokens nuevos con el refresh token guardado y los guarda. */
  refrescarToken(): Observable<RespuestaTokens> {
    const refreshToken = this._refreshToken();
    return this.http
      .post<RespuestaTokens>(`${environment.apiUrl}/auth/refresh`, { refreshToken })
      .pipe(tap((tokens) => this.guardarTokens(tokens)));
  }

  /** Revoca el refresh token en el backend (sin esperar ni avisar errores) y limpia la sesión local. */
  logout(): void {
    const refreshToken = this._refreshToken();
    if (refreshToken) {
      this.http
        .post(`${environment.apiUrl}/auth/logout`, { refreshToken })
        .subscribe({ error: () => undefined });
    }
    this.limpiarSesion();
  }

  /**
   * Envía el correo de recuperación de contraseña (`POST /auth/forgot-password`).
   *
   * @remarks
   * Settings lo usa para "Cambiar contraseña": el backend no permite cambiarla
   * por `PATCH` de usuario. Responde igual exista o no el correo, así que
   * solo hay que manejar errores de red.
   */
  solicitarRecuperacionPassword(correo: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${environment.apiUrl}/auth/forgot-password`, {
      correo,
    });
  }

  /**
   * Reenvía el código de verificación de correo (`POST /auth/send-verification`).
   * La respuesta no distingue si el correo ya estaba verificado.
   */
  reenviarVerificacionCorreo(correo: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${environment.apiUrl}/auth/send-verification`, {
      correo,
    });
  }

  /**
   * Confirma el código de 6 dígitos de verificación de correo (`POST /auth/verify-email`).
   * Falla si el código venció o es incorrecto: el que llama debe mostrar el error.
   */
  verificarCorreoConCodigo(correo: string, codigo: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${environment.apiUrl}/auth/verify-email`, {
      correo,
      codigo,
    });
  }

  /** Borra tokens, perfil y el rastro de navegación, sin llamar al backend. */
  limpiarSesion(): void {
    localStorage.removeItem(CLAVE_ACCESS_TOKEN);
    localStorage.removeItem(CLAVE_REFRESH_TOKEN);
    this._accessToken.set(null);
    this._refreshToken.set(null);
    this._currentUser.set(null);
    // Para que otra cuenta en la misma pestaña no herede el rastro de la anterior.
    this.navigationTrailService.reiniciar();
  }

  private guardarTokens(tokens: RespuestaTokens): void {
    localStorage.setItem(CLAVE_ACCESS_TOKEN, tokens.accessToken);
    localStorage.setItem(CLAVE_REFRESH_TOKEN, tokens.refreshToken);
    this._accessToken.set(tokens.accessToken);
    this._refreshToken.set(tokens.refreshToken);
  }
}
