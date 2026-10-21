import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RespuestaPaginada } from '../catalog/models/empresa.model';
import { AuditoriaAccion } from './models/auditoria-accion.model';

export interface FiltroAuditoria {
  usuarioId?: number;
  entidad?: string;
  desde?: string;
  hasta?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Historial de auditoría (`auditoria.ver`). Es de solo lectura: lo llena el
 * backend en cada escritura, por eso no hay crear, editar ni eliminar.
 */
@Injectable({ providedIn: 'root' })
export class AuditoriaService {
  private readonly http = inject(HttpClient);

  /** Páginas de 30 por defecto (`filtro.pageSize` para cambiarlo). */
  listar(filtro: FiltroAuditoria = {}): Observable<RespuestaPaginada<AuditoriaAccion>> {
    let params = new HttpParams().set('pageSize', filtro.pageSize ?? 30);
    if (filtro.page) {
      params = params.set('page', filtro.page);
    }
    if (filtro.usuarioId) {
      params = params.set('usuarioId', filtro.usuarioId);
    }
    if (filtro.entidad) {
      params = params.set('entidad', filtro.entidad);
    }
    if (filtro.desde) {
      params = params.set('desde', filtro.desde);
    }
    if (filtro.hasta) {
      params = params.set('hasta', filtro.hasta);
    }
    return this.http.get<RespuestaPaginada<AuditoriaAccion>>(`${environment.apiUrl}/auditoria`, {
      params,
    });
  }
}
