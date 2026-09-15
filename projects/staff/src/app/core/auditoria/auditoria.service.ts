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
 * `GET /auditoria` — exige `auditoria.ver` (`admin`/`staff_goods`, ver la
 * migración `SeedPermisosAuditoria`). Es un historial de solo lectura
 * (lo llena únicamente `AuditoriaAccionInterceptor` del backend en cada
 * acción de escritura — nadie escribe acá a mano, ver la entidad), por
 * eso este servicio no tiene crear/editar/eliminar: la pantalla de
 * Auditoría del sidebar de staff (PIVOTE_SAAS_MULTITENANT.md §8) es
 * listado + filtros, nunca CRUD.
 */
@Injectable({ providedIn: 'root' })
export class AuditoriaService {
  private readonly http = inject(HttpClient);

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
