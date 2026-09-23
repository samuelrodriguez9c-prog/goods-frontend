import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RespuestaPaginada } from '../usuarios/models/usuario.model';
import { Conversacion, Mensaje } from './models/conversacion.model';

/**
 * Cliente de `POST /chat/conversaciones` (backend, `modules/chat/`) para
 * el lado de `admin` — el tenant (`dueno_empresa`/`empleado_empresa`)
 * hablando con soporte de Goods. A diferencia de `staff/core/chat/
 * chat.service.ts`, acá NO hay `listarBandeja`/`cerrar`/`asignar`: esos
 * requieren `conversaciones.gestionar`, permiso que estos roles ya NO
 * tienen (ver migración `AjustarPermisosDeConversacionesPorRol`,
 * 2026-09-23 — se les quitó justamente porque no debían poder gestionar
 * conversaciones ajenas). Este servicio solo cubre lo que el controller
 * permite sin ese permiso: crear la propia conversación, listar "mías",
 * y mandar/leer mensajes de una conversación propia.
 */
@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/chat/conversaciones`;

  /** Abre una conversación nueva con un primer mensaje obligatorio — el
   * backend no admite crear una conversación vacía (`CrearConversacionDto`
   * exige `mensaje`). `pedidoId` es opcional, no lo usa la primera versión
   * de esta pantalla (no hay selector de pedido todavía). */
  crear(mensaje: string): Observable<Conversacion> {
    return this.http.post<Conversacion>(this.base, { mensaje });
  }

  /** Mismo criterio que `staff`: pageSize alto, sin paginación real
   * todavía (un tenant no va a tener más de un puñado de conversaciones
   * con soporte). */
  listarMias(page = 1, pageSize = 100): Observable<RespuestaPaginada<Conversacion>> {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http.get<RespuestaPaginada<Conversacion>>(`${this.base}/mias`, { params });
  }

  obtener(id: number): Observable<Conversacion> {
    return this.http.get<Conversacion>(`${this.base}/${id}`);
  }

  /** `pageSize` tope 100 — mismo límite duro (`@Max(100)`) del backend
   * que ya causó un bug real del lado de `staff` (ver `ChatService` de
   * ese proyecto): no subir este valor sin tocar `PaginationQueryDto`. */
  listarMensajes(id: number, pageSize = 100): Observable<RespuestaPaginada<Mensaje>> {
    const params = new HttpParams().set('page', 1).set('pageSize', pageSize);
    return this.http.get<RespuestaPaginada<Mensaje>>(`${this.base}/${id}/mensajes`, { params });
  }

  /** `respondeAId` opcional — "responder a un mensaje" (ver el mismo
   * comentario en la versión de `staff`). */
  enviarMensaje(id: number, cuerpo: string, respondeAId?: number): Observable<Mensaje> {
    return this.http.post<Mensaje>(`${this.base}/${id}/mensajes`, { cuerpo, respondeAId });
  }
}
