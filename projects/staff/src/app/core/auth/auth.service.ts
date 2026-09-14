import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CurrentUser } from './models/current-user.model';

const CLAVE_ACCESS_TOKEN = 'goods.staff.accessToken';
const CLAVE_REFRESH_TOKEN = 'goods.staff.refreshToken';

interface RespuestaTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Estado de sesión del panel de staff — mismo diseño que
 * `admin/core/auth/auth.service.ts` (tokens en localStorage, perfil en
 * memoria), duplicado a propósito en vez de compartido vía `shared-ui`:
 * son dos apps con sesiones completamente independientes (un usuario de
 * staff nunca comparte sesión con un usuario de una Empresa), y
 * `shared-ui` es para composites de UI, no para lógica de negocio — ver
 * PIVOTE_SAAS_MULTITENANT.md §4 sobre por qué son proyectos aparte.
 *
 * Claves de localStorage con prefijo `staff.` distinto al de `admin`
 * (`goods.accessToken`) — aunque cada Angular app ya vive en su propio
 * origen (puerto/dominio distinto) y por lo tanto en su propio
 * localStorage, el prefijo deja explícito en el propio nombre de la clave
 * a qué app pertenece, para cuando alguien mire el localStorage del
 * navegador durante un debug.
 *
 * `POST /auth/login` es EL MISMO endpoint que usa `admin` — el backend no
 * distingue "login de staff" de "login de un emprendimiento", ambos son
 * `Usuario` con roles distintos (ver `Usuario.empresaId` nullable). Lo que
 * sí es exclusivo de acá es `authGuard`: además de exigir un token,
 * exige que el rol devuelto por `GET /auth/me` sea `staff_goods` — así
 * alguien con credenciales de un emprendimiento no puede loguearse en el
 * panel de staff aunque conozca esta URL.
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

  readonly isAuthenticated = computed(() => this._accessToken() !== null);

  login(correo: string, password: string): Observable<CurrentUser> {
    return this.http
      .post<RespuestaTokens>(`${environment.apiUrl}/auth/login`, { correo, password })
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

  refrescarToken(): Observable<RespuestaTokens> {
    const refreshToken = this._refreshToken();
    return this.http
      .post<RespuestaTokens>(`${environment.apiUrl}/auth/refresh`, { refreshToken })
      .pipe(tap((tokens) => this.guardarTokens(tokens)));
  }

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
