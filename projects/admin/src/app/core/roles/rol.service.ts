import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Permiso, Rol, RolAsignable } from './models/rol.model';

export interface GuardarRolPayload {
  nombre: string;
  descripcion?: string;
}

/**
 * Roles y permisos vistos desde `admin` (`PROPUESTA_ROLES_Y_ACCESOS.md`
 * §6 paso 5, ampliado en la Fase 6 — §5.4). Desde que `Rol.empresaId`
 * existe, `dueno_empresa` tiene `roles.ver/crear/editar/eliminar` y
 * `permisos.asignar` (ver la migración
 * `OtorgarPermisosDeRolesADuenoEmpresa`) — así que, a diferencia de la
 * versión de solo lectura de la Fase 5, esto ya pega contra el mismo
 * `GET /roles` que usa `staff`. La diferencia real con el `RolService`
 * de `staff` es `listarPermisosAsignables()`: acá NUNCA se pega contra
 * `GET /permisos` (el catálogo completo, que trae los códigos de
 * `PERMISOS_RESERVADOS_STAFF` — cosas como `empresas.ver`/
 * `auditoria.ver`, de administración de Goods) porque `dueno_empresa`
 * deliberadamente no tiene `permisos.ver`. `GET /permisos/asignables`
 * (`RolService.findAsignablesPermisos` del backend) es el catálogo ya
 * recortado a lo que un dueño puede de verdad asignarle a un rol propio.
 */
@Injectable({ providedIn: 'root' })
export class RolService {
  private readonly http = inject(HttpClient);

  listar(): Observable<Rol[]> {
    return this.http.get<Rol[]>(`${environment.apiUrl}/roles`);
  }

  listarAsignables(): Observable<RolAsignable[]> {
    return this.http.get<RolAsignable[]>(`${environment.apiUrl}/roles/asignables`);
  }

  listarPermisosAsignables(): Observable<Permiso[]> {
    return this.http.get<Permiso[]>(`${environment.apiUrl}/permisos/asignables`);
  }

  crear(payload: GuardarRolPayload): Observable<Rol> {
    return this.http.post<Rol>(`${environment.apiUrl}/roles`, payload);
  }

  actualizar(id: number, payload: Partial<GuardarRolPayload>): Observable<Rol> {
    return this.http.patch<Rol>(`${environment.apiUrl}/roles/${id}`, payload);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/roles/${id}`);
  }

  /** Reemplaza el set completo de permisos del rol propio (`PUT`, no
   * incremental — el backend rechaza cualquier código reservado, ver
   * `PERMISOS_RESERVADOS_STAFF`). */
  asignarPermisos(id: number, permisoIds: number[]): Observable<Rol> {
    return this.http.put<Rol>(`${environment.apiUrl}/roles/${id}/permisos`, { permisoIds });
  }
}
