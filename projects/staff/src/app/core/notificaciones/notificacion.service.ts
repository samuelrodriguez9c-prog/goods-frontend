import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RespuestaPaginada } from '../catalog/models/empresa.model';
import { Notificacion } from './models/notificacion.model';

/**
 * Cliente de `GET /notificaciones/staff` (backend, `modules/notificacion/`)
 * — separada a propósito de `/notificaciones` (esa es de `admin`, ver el
 * comentario de `NotificacionController`): mismo servicio del lado del
 * backend, pero ruta propia para que quede claro cuál le corresponde a
 * cada panel.
 */
@Injectable({ providedIn: 'root' })
export class NotificacionService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/notificaciones/staff`;

  /** `pageSize` bajo por default — la campanita solo necesita mostrar las
   * últimas, no un historial completo. `page` se suma acá (2026-09-23,
   * segunda vuelta) para la página "Todas las notificaciones"
   * (`NotificacionesPageComponent`) — el dropdown de la campanita sigue
   * usándolo sin pasar `page` (se queda en la página 1 por default).
   * `incluirOcultas` (tercera vuelta, mismo día): por default el
   * dropdown NO trae lo que el usuario ya "borró" con `ocultarTodas()` —
   * la plantilla "Ver todas las notificaciones" lo pasa en `true` para
   * seguir mostrándolas ahí. */
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

  marcarTodasLeidas(): Observable<void> {
    return this.http.patch<void>(`${environment.apiUrl}/notificaciones/leidas`, {});
  }

  /** Tercera vuelta (2026-09-23): "Borrar todas" del dropdown de la
   * campanita ahora persiste en el backend (antes era solo en memoria,
   * ver `TopbarComponent.idsOcultos`) — así no reaparecen al recargar.
   * Nunca borra filas ni las marca leídas (ver
   * `NotificacionService.ocultarTodas` del backend). */
  ocultarTodas(): Observable<void> {
    return this.http.patch<void>(
      `${environment.apiUrl}/notificaciones/ocultar-todas`,
      {},
    );
  }
}
