import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RespuestaPaginada } from '../usuarios/models/usuario.model';
import { Conversacion, Mensaje } from './models/conversacion.model';

/**
 * Chat de la Empresa con soporte de Goods: crear la propia conversación,
 * listar las suyas y leer o mandar mensajes.
 *
 * @remarks
 * No hay bandeja, cierre ni asignación como en `staff`: piden
 * `conversaciones.gestionar`, que los roles de una Empresa no tienen para no
 * gestionar conversaciones ajenas.
 */
@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/chat/conversaciones`;

  /** Abre una conversación con su primer mensaje: el backend no acepta conversaciones vacías. */
  crear(mensaje: string): Observable<Conversacion> {
    return this.http.post<Conversacion>(this.base, { mensaje });
  }

  // Sin paginación real: una Empresa tiene pocas conversaciones con soporte.
  listarMias(page = 1, pageSize = 100): Observable<RespuestaPaginada<Conversacion>> {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http.get<RespuestaPaginada<Conversacion>>(`${this.base}/mias`, { params });
  }

  obtener(id: number): Observable<Conversacion> {
    return this.http.get<Conversacion>(`${this.base}/${id}`);
  }

  // El backend rechaza `pageSize` > 100 (`@Max(100)` en `PaginationQueryDto`): no subirlo sin cambiar eso.
  listarMensajes(id: number, pageSize = 100): Observable<RespuestaPaginada<Mensaje>> {
    const params = new HttpParams().set('page', 1).set('pageSize', pageSize);
    return this.http.get<RespuestaPaginada<Mensaje>>(`${this.base}/${id}/mensajes`, { params });
  }

  /** @param respondeAId - Mensaje que se cita al responder (opcional). */
  enviarMensaje(id: number, cuerpo: string, respondeAId?: number): Observable<Mensaje> {
    return this.http.post<Mensaje>(`${this.base}/${id}/mensajes`, { cuerpo, respondeAId });
  }
}
