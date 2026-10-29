import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RespuestaPaginada } from '../catalog/models/empresa.model';
import { Conversacion, Mensaje } from './models/conversacion.model';

/**
 * Bandeja de soporte (`/chat/conversaciones`). Leer conversaciones ajenas
 * exige `conversaciones.ver`; cerrar y asignar, `conversaciones.gestionar`.
 */
@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/chat/conversaciones`;

  /**
   * `SoportePageComponent` la pide sin filtro y separa "sin asignar" y
   * "mías" en el cliente: con decenas de conversaciones no hace falta paginar.
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

  /**
   * Primera página del hilo.
   * @param pageSize - Máximo 100: el backend responde 400 si es mayor.
   */
  listarMensajes(id: number, pageSize = 100): Observable<RespuestaPaginada<Mensaje>> {
    // TODO(front): paginar el hilo; hoy una conversación con más de 100 mensajes se corta.
    const params = new HttpParams().set('page', 1).set('pageSize', pageSize);
    return this.http.get<RespuestaPaginada<Mensaje>>(`${this.base}/${id}/mensajes`, { params });
  }

  /** @param respondeAId - Mensaje citado; debe ser de esta misma conversación. */
  enviarMensaje(id: number, cuerpo: string, respondeAId?: number): Observable<Mensaje> {
    return this.http.post<Mensaje>(`${this.base}/${id}/mensajes`, { cuerpo, respondeAId });
  }

  /**
   * Mensaje con imágenes (hasta 4, PNG/JPG/WebP/GIF de 5 MB). El texto
   * puede ir vacío si va al menos una.
   */
  enviarConImagenes(id: number, cuerpo: string, archivos: File[], respondeAId?: number): Observable<Mensaje> {
    const fd = new FormData();
    archivos.forEach((a) => fd.append('archivos', a, a.name));
    if (cuerpo) fd.append('cuerpo', cuerpo);
    if (respondeAId) fd.append('respondeAId', String(respondeAId));
    return this.http.post<Mensaje>(`${this.base}/${id}/mensajes/adjuntos`, fd);
  }

  cerrar(id: number): Observable<Conversacion> {
    return this.http.patch<Conversacion>(`${this.base}/${id}/cerrar`, {});
  }

  asignar(id: number, agenteId: number): Observable<Conversacion> {
    return this.http.patch<Conversacion>(`${this.base}/${id}/asignar`, { agenteId });
  }

  /**
   * Marca leídos los mensajes del cliente (las ✓✓ de su lado). El backend solo
   * cuenta a quien la atiende, o a cualquiera si nadie la tomó: un supervisor
   * que mira no la marca y recibe `marcados: 0`.
   */
  marcarLeida(id: number): Observable<{ marcados: number; leidoEn: string | null }> {
    return this.http.post<{ marcados: number; leidoEn: string | null }>(`${this.base}/${id}/leida`, {});
  }

  /** Una imagen del chat como blob: es privada y el `<img>` no puede pedirla con la sesión. */
  imagen(id: number, adjuntoId: number): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/adjuntos/${adjuntoId}`, { responseType: 'blob' });
  }
}
