import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RespuestaPaginada } from './models/empresa.model';
import { DesgloseModuloEmpresa, GestionarModuloPayload, ModuloCatalogo } from './models/modulo.model';

/**
 * Módulos extra por Empresa (Fase 2 de
 * PROPUESTA_MODULOS_EXTRA_POR_EMPRESA.md, §11.4/§11.5) — los tres
 * endpoints que viven en `EmpresaController` (no en un
 * `ModuloController` separado, ver el comentario de ese controller):
 * el desglose completo del catálogo para una Empresa puntual, y
 * conceder/revocar/quitar una excepción puntual.
 *
 * Exige `empresas.ver` para leer y `empresas.gestionar_modulos` para
 * escribir — ambos ya otorgados a `admin_goods`/`staff_goods` (ver las
 * migraciones de sembrado de Fase 1/2), así que no hace falta ningún
 * chequeo extra acá: si el 403 llega, `AlertaService`/el interceptor de
 * errores HTTP ya lo muestran igual que cualquier otro endpoint.
 */
@Injectable({ providedIn: 'root' })
export class ModuloService {
  private readonly http = inject(HttpClient);

  /** `GET /modulos` (Fase 1, `modulos.ver`) — el catálogo completo de
   * `Modulo`, sin atarlo a ninguna Empresa. Lo usa
   * `ActivarEmpresaWizardComponent` (§11.7, Fase 2 paso 5) para poder
   * ofrecer cualquier módulo como extra, no solo los pedidos en el
   * checkout. `pageSize=100`, mismo límite que el resto de los catálogos
   * de este proyecto (`PlanService.listarTodos`, etc.). */
  listarCatalogo(): Observable<ModuloCatalogo[]> {
    const params = new HttpParams().set('pageSize', 100);
    return this.http
      .get<RespuestaPaginada<ModuloCatalogo>>(`${environment.apiUrl}/modulos`, { params })
      .pipe(map((respuesta) => respuesta.data));
  }

  /** `GET /empresas/:id/modulos` — el catálogo completo con de dónde sale
   * cada módulo para esta Empresa (plan/concedido/revocado). */
  listarDesglose(empresaId: number): Observable<DesgloseModuloEmpresa[]> {
    return this.http.get<DesgloseModuloEmpresa[]>(
      `${environment.apiUrl}/empresas/${empresaId}/modulos`,
    );
  }

  /** `POST /empresas/:id/modulos` — upsert: si ya había una excepción
   * cargada para ese módulo, se actualiza en el lugar (ver el docblock de
   * `ModuloAccessService.gestionarOverride` del backend). */
  gestionar(
    empresaId: number,
    payload: GestionarModuloPayload,
  ): Observable<{ moduloId: number; tipo: 'concedido' | 'revocado' }> {
    return this.http.post<{ moduloId: number; tipo: 'concedido' | 'revocado' }>(
      `${environment.apiUrl}/empresas/${empresaId}/modulos`,
      payload,
    );
  }

  /** `DELETE /empresas/:id/modulos/:moduloId` — vuelve al default del
   * plan (borra la excepción, no la "apaga"). */
  quitar(empresaId: number, moduloId: number): Observable<void> {
    return this.http.delete<void>(
      `${environment.apiUrl}/empresas/${empresaId}/modulos/${moduloId}`,
    );
  }
}
