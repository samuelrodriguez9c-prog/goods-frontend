import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Empresa, RespuestaPaginada } from './models/empresa.model';

/**
 * `GET /empresas` / `PATCH /empresas/:id/activar` del backend — exige
 * permiso `empresas.ver`/`empresas.activar`, que solo tiene el rol
 * `staff_goods` (ver PIVOTE_SAAS_MULTITENANT.md §8 paso 4, "Hallazgo de
 * seguridad corregido en el camino"), así que este servicio solo tiene
 * sentido acá, en `staff` — `admin` ni siquiera podría llamarlo (403).
 */
@Injectable({ providedIn: 'root' })
export class EmpresaService {
  private readonly http = inject(HttpClient);

  /** `pageSize=100` (el máximo que acepta `PaginationQueryDto`, ver el
   * backend) en vez de paginar de verdad — primera pasada de esta
   * pantalla (PIVOTE_SAAS_MULTITENANT.md §8 paso 5): agregar controles de
   * paginación reales queda para cuando la cantidad de Empresas lo
   * justifique. */
  listar(estado?: string): Observable<RespuestaPaginada<Empresa>> {
    let params = new HttpParams().set('pageSize', 100);
    if (estado) {
      params = params.set('estado', estado);
    }
    return this.http.get<RespuestaPaginada<Empresa>>(`${environment.apiUrl}/empresas`, {
      params,
    });
  }

  activar(id: number): Observable<Empresa> {
    return this.http.patch<Empresa>(`${environment.apiUrl}/empresas/${id}/activar`, {});
  }
}
