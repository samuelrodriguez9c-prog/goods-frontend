import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Permiso, Rol } from './models/rol.model';

export interface GuardarRolPayload {
  nombre: string;
  descripcion?: string;
  activo?: boolean;
}

/**
 * Roles y permisos del sistema (`GET /roles`, `GET /permisos`) — exige
 * `roles.ver`/`permisos.ver` (`admin`/`staff_goods`, ver la migración
 * `SeedPermisosUsuariosRolesStaffGoods`). A diferencia de `usuarios`, acá
 * NO hay aislamiento por Empresa: los roles/permisos son el mismo
 * catálogo para todo el sistema (los define quien tiene el permiso, sea
 * `admin` de un negocio armando sus propios roles internos o
 * `staff_goods` gestionando el sistema completo) — ver
 * `RolController`/`PermisoController` del backend, ninguno de los dos
 * pasa por `TenantContextService`.
 *
 * Es la pantalla "Roles y permisos" del sidebar de staff
 * (PIVOTE_SAAS_MULTITENANT.md §8).
 */
@Injectable({ providedIn: 'root' })
export class RolService {
  private readonly http = inject(HttpClient);

  listar(): Observable<Rol[]> {
    return this.http.get<Rol[]>(`${environment.apiUrl}/roles`);
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

  /** Reemplaza el set completo de permisos del rol (`PUT`, no incremental
   * — ver `AsignarPermisosDto` del backend). */
  asignarPermisos(id: number, permisoIds: number[]): Observable<Rol> {
    return this.http.put<Rol>(`${environment.apiUrl}/roles/${id}/permisos`, { permisoIds });
  }

  listarPermisos(): Observable<Permiso[]> {
    return this.http.get<Permiso[]>(`${environment.apiUrl}/permisos`);
  }
}
