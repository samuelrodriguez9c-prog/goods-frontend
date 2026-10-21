import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RespuestaPaginada } from '../usuarios/models/usuario.model';
import { Notificacion } from './models/notificacion.model';

/** Notificaciones del usuario logueado de la Empresa (`/notificaciones`). */
@Injectable({ providedIn: 'root' })
export class NotificacionService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/notificaciones`;

  /**
   * @param pageSize - Bajo por defecto: la campanita solo muestra las últimas.
   * @param incluirOcultas - Incluye las que el usuario ocultó con
   * `ocultarTodas()`; la página «Todas las notificaciones» pasa `true`.
   */
  listar(
    soloNoLeidas = false,
    pageSize = 20,
    page = 1,
    incluirOcultas = false,
  ): Observable<RespuestaPaginada<Notificacion>> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (soloNoLeidas) {
      params = params.set('soloNoLeidas', true);
    }
    if (incluirOcultas) {
      params = params.set('incluirOcultas', true);
    }
    return this.http.get<RespuestaPaginada<Notificacion>>(this.base, { params });
  }

  marcarLeida(id: number): Observable<Notificacion> {
    return this.http.patch<Notificacion>(
      `${environment.apiUrl}/notificaciones/${id}/leida`,
      {},
    );
  }

  marcarNoLeida(id: number): Observable<Notificacion> {
    return this.http.patch<Notificacion>(
      `${environment.apiUrl}/notificaciones/${id}/no-leida`,
      {},
    );
  }

  marcarTodasLeidas(): Observable<void> {
    return this.http.patch<void>(`${environment.apiUrl}/notificaciones/leidas`, {});
  }

  /**
   * «Borrar todas» de la campanita. Las oculta en el backend para que no
   * reaparezcan al recargar; no las borra ni las marca leídas.
   */
  ocultarTodas(): Observable<void> {
    return this.http.patch<void>(
      `${environment.apiUrl}/notificaciones/ocultar-todas`,
      {},
    );
  }
}
