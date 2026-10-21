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
 * Roles y permisos (`roles.ver`, `permisos.ver`). A diferencia de usuarios,
 * no se aíslan por Empresa: es un solo catálogo para todo el sistema.
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

  /** Reemplaza todos los permisos del rol por `permisoIds` (no suma a los que tenía). */
  asignarPermisos(id: number, permisoIds: number[]): Observable<Rol> {
    return this.http.put<Rol>(`${environment.apiUrl}/roles/${id}/permisos`, { permisoIds });
  }

  listarPermisos(): Observable<Permiso[]> {
    return this.http.get<Permiso[]>(`${environment.apiUrl}/permisos`);
  }
}
