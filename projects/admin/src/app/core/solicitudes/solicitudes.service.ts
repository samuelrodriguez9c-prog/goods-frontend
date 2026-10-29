import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AreaSolicitud,
  CrearSolicitudPayload,
  Solicitud,
  SolicitudPublica,
} from './models/solicitud.model';

interface Paginado<T> {
  data: T[];
  total: number;
}

/**
 * Lo que la Empresa le pide a Goods (`/mis-solicitudes`). La Empresa sale del
 * token: no hay forma de ver ni pedir por otra.
 */
@Injectable({ providedIn: 'root' })
export class SolicitudesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/mis-solicitudes`;

  listar(): Observable<Paginado<Solicitud>> {
    return this.http.get<Paginado<Solicitud>>(this.base, { params: { pageSize: 100 } });
  }

  obtener(id: number): Observable<Solicitud> {
    return this.http.get<Solicitud>(`${this.base}/${id}`);
  }

  crear(payload: CrearSolicitudPayload): Observable<Solicitud> {
    return this.http.post<Solicitud>(this.base, payload);
  }

  comentar(id: number, texto: string): Observable<Solicitud> {
    return this.http.post<Solicitud>(`${this.base}/${id}/comentarios`, { texto });
  }

  cancelar(id: number, motivo?: string): Observable<Solicitud> {
    return this.http.post<Solicitud>(`${this.base}/${id}/cancelar`, { motivo });
  }

  /** Áreas (módulos) y sus secciones para el modal «Nueva solicitud». */
  areas(): Observable<AreaSolicitud[]> {
    return this.http.get<AreaSolicitud[]>(`${this.base}/areas`);
  }

  /**
   * «Adjuntar captura»: hasta 4 por envío y 8 por solicitud (PNG, JPG, WebP o
   * GIF de 5 MB). Devuelve el detalle con sus `adjuntos`.
   */
  adjuntar(id: number, archivos: File[]): Observable<Solicitud> {
    const form = new FormData();
    for (const a of archivos) form.append('archivos', a, a.name);
    return this.http.post<Solicitud>(`${this.base}/${id}/adjuntos`, form);
  }

  /** Las capturas son privadas: se piden con el token y se muestran como blob. */
  adjunto(id: number, adjuntoId: number): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/adjuntos/${adjuntoId}`, { responseType: 'blob' });
  }

  // Tablero «De otras tiendas»

  tablero(orden: 'votadas' | 'recientes' = 'votadas'): Observable<Paginado<SolicitudPublica>> {
    return this.http.get<Paginado<SolicitudPublica>>(`${this.base}/tablero`, {
      params: { orden, pageSize: 100 },
    });
  }

  obtenerDelTablero(id: number): Observable<SolicitudPublica> {
    return this.http.get<SolicitudPublica>(`${this.base}/tablero/${id}`);
  }

  /** Votar también hace que la persona la siga. */
  votar(id: number): Observable<SolicitudPublica> {
    return this.http.post<SolicitudPublica>(`${this.base}/${id}/voto`, {});
  }

  quitarVoto(id: number): Observable<SolicitudPublica> {
    return this.http.delete<SolicitudPublica>(`${this.base}/${id}/voto`);
  }

  /** Sirve para las propias y para las del tablero. */
  seguir(id: number, sigo: boolean): Observable<{ sigo: boolean }> {
    const url = `${this.base}/${id}/seguir`;
    return sigo ? this.http.post<{ sigo: boolean }>(url, {}) : this.http.delete<{ sigo: boolean }>(url);
  }
}

export function mensajeDeError(err: unknown, porDefecto = 'No se pudo completar. Intenta de nuevo.'): string {
  if (err instanceof HttpErrorResponse) {
    const m = (err.error as { message?: string | string[] } | null)?.message;
    if (m) return Array.isArray(m) ? m.join(' ') : m;
  }
  return porDefecto;
}
