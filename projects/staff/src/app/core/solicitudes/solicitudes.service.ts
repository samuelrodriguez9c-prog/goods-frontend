import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CambioEstadoPayload,
  FiltroSolicitudes,
  ListadoSolicitudes,
  ResumenSolicitudes,
  SolicitudDetalle,
} from './models/solicitud.model';

/** Cliente de `/solicitudes` (backend `SolicitudController`, 2026-10-04). */
@Injectable({ providedIn: 'root' })
export class SolicitudesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/solicitudes`;

  resumen(): Observable<ResumenSolicitudes> {
    return this.http.get<ResumenSolicitudes>(`${this.base}/resumen`);
  }

  listar(filtro: FiltroSolicitudes): Observable<ListadoSolicitudes> {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(filtro)) {
      if (v !== undefined && v !== null && v !== '') params = params.set(k, String(v));
    }
    return this.http.get<ListadoSolicitudes>(this.base, { params });
  }

  obtener(id: number): Observable<SolicitudDetalle> {
    return this.http.get<SolicitudDetalle>(`${this.base}/${id}`);
  }

  cambiarEstado(id: number, payload: CambioEstadoPayload): Observable<SolicitudDetalle> {
    return this.http.patch<SolicitudDetalle>(`${this.base}/${id}/estado`, payload);
  }

  asignar(id: number, usuarioId: number | null): Observable<SolicitudDetalle> {
    return this.http.patch<SolicitudDetalle>(`${this.base}/${id}/asignar`, { usuarioId });
  }

  /** Sumar esta solicitud a otra igual (prioridad por demanda). */
  agrupar(id: number, principalId: number): Observable<SolicitudDetalle> {
    return this.http.patch<SolicitudDetalle>(`${this.base}/${id}/agrupar`, { principalId });
  }

  desagrupar(id: number): Observable<SolicitudDetalle> {
    return this.http.patch<SolicitudDetalle>(`${this.base}/${id}/desagrupar`, {});
  }

  comentar(id: number, texto: string, visibleCliente: boolean): Observable<SolicitudDetalle> {
    return this.http.post<SolicitudDetalle>(`${this.base}/${id}/comentarios`, { texto, visibleCliente });
  }
}
