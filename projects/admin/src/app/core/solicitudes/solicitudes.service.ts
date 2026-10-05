import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CrearSolicitudPayload, Solicitud } from './models/solicitud.model';

interface Paginado<T> {
  data: T[];
  total: number;
}

/**
 * Lo que la Empresa le pide a Goods (`/mis-solicitudes`, 2026-10-04). La
 * Empresa sale del token: no hay forma de ver ni pedir por otra.
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
}

export function mensajeDeError(err: unknown, porDefecto = 'No se pudo completar. Intenta de nuevo.'): string {
  if (err instanceof HttpErrorResponse) {
    const m = (err.error as { message?: string | string[] } | null)?.message;
    if (m) return Array.isArray(m) ? m.join(' ') : m;
  }
  return porDefecto;
}
