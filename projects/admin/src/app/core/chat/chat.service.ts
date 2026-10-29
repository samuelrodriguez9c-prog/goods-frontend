import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RespuestaPaginada } from '../usuarios/models/usuario.model';
import { Conversacion, EstadoSoporte, Mensaje } from './models/conversacion.model';

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

  /**
   * Mensaje con imágenes (hasta 4, PNG/JPG/WebP/GIF de 5 MB). El texto
   * puede ir vacío si va al menos una.
   */
  enviarConImagenes(
    id: number,
    cuerpo: string,
    archivos: File[],
    respondeAId?: number,
  ): Observable<Mensaje> {
    const fd = new FormData();
    archivos.forEach((a) => fd.append('archivos', a, a.name));
    if (cuerpo) fd.append('cuerpo', cuerpo);
    if (respondeAId) fd.append('respondeAId', String(respondeAId));
    return this.http.post<Mensaje>(`${this.base}/${id}/mensajes/adjuntos`, fd);
  }

  /** Marca leídos los mensajes de soporte al abrir el hilo (las ✓✓ del otro lado). */
  marcarLeida(id: number): Observable<{ marcados: number; leidoEn: string | null }> {
    return this.http.post<{ marcados: number; leidoEn: string | null }>(
      `${this.base}/${id}/leida`,
      {},
    );
  }

  /** Una imagen del chat como blob: es privada y el `<img>` no puede pedirla con la sesión. */
  imagen(id: number, adjuntoId: number): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/adjuntos/${adjuntoId}`, { responseType: 'blob' });
  }

  /** Si hay alguien de soporte conectado, el horario, el tiempo de respuesta y hasta 3 caras del equipo. */
  estadoSoporte(): Observable<EstadoSoporte> {
    return this.http.get<EstadoSoporte>(`${environment.apiUrl}/chat/soporte/estado`);
  }
}
