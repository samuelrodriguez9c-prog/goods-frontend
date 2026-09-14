import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RespuestaPaginada } from './models/empresa.model';
import { Suscripcion } from './models/suscripcion.model';

/**
 * `GET /suscripciones` — exige `suscripciones.ver` (solo `staff_goods`).
 *
 * Sin filtro por `empresaId` acá a propósito: la pantalla de Empresas
 * necesita el plan de TODAS las filas visibles a la vez, y pedirlo una
 * por una (N llamadas por cada Empresa en pantalla) sería mucho más
 * lento que traer de una vez las suscripciones de un estado dado
 * (`pageSize=100`, mismo límite/criterio que `EmpresaService.listar`) y
 * cruzarlas en memoria por `empresaId` — ver
 * `EmpresasPageComponent.mapaPlanPorEmpresa`. Con pocos cientos de
 * Empresas esto alcanza sin problema; si el volumen crece, este es el
 * primer lugar a optimizar (ej. un endpoint que ya devuelva la Empresa
 * con su Suscripción activa incluida).
 */
@Injectable({ providedIn: 'root' })
export class SuscripcionService {
  private readonly http = inject(HttpClient);

  listar(estado?: string): Observable<RespuestaPaginada<Suscripcion>> {
    let params = new HttpParams().set('pageSize', 100);
    if (estado) {
      params = params.set('estado', estado);
    }
    return this.http.get<RespuestaPaginada<Suscripcion>>(`${environment.apiUrl}/suscripciones`, {
      params,
    });
  }
}
