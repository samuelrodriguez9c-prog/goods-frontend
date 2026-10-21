import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RespuestaPaginada } from './models/empresa.model';
import { AjustesModulo, DesgloseModuloEmpresa, GestionarModuloPayload, ModuloCatalogo } from './models/modulo.model';

/**
 * Catálogo de módulos y excepciones por Empresa (conceder, revocar o quitar
 * un módulo fuera de lo que da el plan). Lee con `empresas.ver` y escribe
 * con `empresas.gestionar_modulos`.
 */
@Injectable({ providedIn: 'root' })
export class ModuloService {
  private readonly http = inject(HttpClient);

  /** Catálogo completo (`GET /modulos`); trae solo la primera página de 100. */
  listarCatalogo(): Observable<ModuloCatalogo[]> {
    const params = new HttpParams().set('pageSize', 100);
    return this.http
      .get<RespuestaPaginada<ModuloCatalogo>>(`${environment.apiUrl}/modulos`, { params })
      .pipe(map((respuesta) => respuesta.data));
  }

  listarDesglose(empresaId: number): Observable<DesgloseModuloEmpresa[]> {
    return this.http.get<DesgloseModuloEmpresa[]>(
      `${environment.apiUrl}/empresas/${empresaId}/modulos`,
    );
  }

  /** Concede o revoca un módulo; si ya había una excepción para ese módulo, la reemplaza. */
  gestionar(
    empresaId: number,
    payload: GestionarModuloPayload,
  ): Observable<{ moduloId: number; tipo: 'concedido' | 'revocado' }> {
    return this.http.post<{ moduloId: number; tipo: 'concedido' | 'revocado' }>(
      `${environment.apiUrl}/empresas/${empresaId}/modulos`,
      payload,
    );
  }

  ajustes(empresaId: number, codigo: string): Observable<AjustesModulo> {
    return this.http.get<AjustesModulo>(`${environment.apiUrl}/empresas/${empresaId}/modulos/${codigo}/ajustes`);
  }

  /**
   * Reemplaza los ajustes: lo que no viene vuelve al defecto, así que `{}` restablece.
   * @remarks Responde 400 si una clave o un valor no está en el catálogo del módulo.
   */
  guardarAjustes(empresaId: number, codigo: string, valores: Record<string, string>): Observable<AjustesModulo> {
    return this.http.put<AjustesModulo>(`${environment.apiUrl}/empresas/${empresaId}/modulos/${codigo}/ajustes`, valores);
  }

  /** Borra la excepción del módulo: la Empresa vuelve a lo que da su plan. */
  quitar(empresaId: number, moduloId: number): Observable<void> {
    return this.http.delete<void>(
      `${environment.apiUrl}/empresas/${empresaId}/modulos/${moduloId}`,
    );
  }
}
