import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RespuestaPaginada } from '../catalog/models/empresa.model';
import { Conversacion, Mensaje } from './models/conversacion.model';

/**
 * Cliente de `POST /chat/conversaciones` (backend, `modules/chat/`) para el
 * lado de `staff` — la bandeja de soporte de §7.2/§8 de
 * `PIVOTE_SAAS_MULTITENANT.md`, que hasta ahora era un placeholder (ver
 * `SoportePageComponent`). Exige `conversaciones.ver` para `listarBandeja`/
 * `obtener`/`listarMensajes` de una conversación ajena, y
 * `conversaciones.gestionar` para `cerrar`/`asignar` — ver la migración
 * `AjustarPermisosDeConversacionesPorRol` (2026-09-23), que le dio esos
 * permisos a `admin_goods`/`staff_goods`/`empleado_goods`.
 */
@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/chat/conversaciones`;

  /**
   * `SoportePageComponent` pide la bandeja SIN filtro (pageSize alto) y
   * calcula "sin asignar"/"mías" en el cliente a partir de esa misma
   * lista — más simple que tres requests en paralelo por cada filtro, y a
   * esta escala (decenas de conversaciones, no miles) no hace falta la
   * paginación real todavía. El parámetro queda igual disponible para
   * cuando haga falta.
   */
  listarBandeja(
    filtro?: 'sin_asignar' | 'mias',
    page = 1,
    pageSize = 100,
  ): Observable<RespuestaPaginada<Conversacion>> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (filtro) {
      params = params.set('filtro', filtro);
    }
    return this.http.get<RespuestaPaginada<Conversacion>>(this.base, { params });
  }

  obtener(id: number): Observable<Conversacion> {
    return this.http.get<Conversacion>(`${this.base}/${id}`);
  }

  /** `pageSize` tope 100 — `PaginationQueryDto` del backend lo valida con
   * `@Max(100)` y rechaza (400) cualquier valor mayor, sin excepción para
   * este endpoint. Una conversación con más de 100 mensajes no está
   * contemplada en esta primera versión (no hay paginación real del
   * hilo todavía — ver el comentario de `listarBandeja` sobre por qué a
   * esta escala no hace falta). */
  listarMensajes(id: number, pageSize = 100): Observable<RespuestaPaginada<Mensaje>> {
    const params = new HttpParams().set('page', 1).set('pageSize', pageSize);
    return this.http.get<RespuestaPaginada<Mensaje>>(`${this.base}/${id}/mensajes`, { params });
  }

  /** `respondeAId` opcional — "responder a un mensaje" (ver
   * `EnviarMensajeDto`/migración `AgregarRespondeAIdAMensajes` del
   * backend, 2026-09-23). El backend valida que pertenezca a esta misma
   * conversación. */
  enviarMensaje(id: number, cuerpo: string, respondeAId?: number): Observable<Mensaje> {
    return this.http.post<Mensaje>(`${this.base}/${id}/mensajes`, { cuerpo, respondeAId });
  }

  cerrar(id: number): Observable<Conversacion> {
    return this.http.patch<Conversacion>(`${this.base}/${id}/cerrar`, {});
  }

  asignar(id: number, agenteId: number): Observable<Conversacion> {
    return this.http.patch<Conversacion>(`${this.base}/${id}/asignar`, { agenteId });
  }
}
