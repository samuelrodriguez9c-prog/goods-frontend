import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Permiso, Rol, RolAsignable } from './models/rol.model';

export interface GuardarRolPayload {
  nombre: string;
  descripcion?: string;
  /** Ícono de Tabler sin `ti-` («chef-hat»). */
  icono?: string;
}

/**
 * Roles y permisos de la Empresa: CRUD de sus roles propios.
 *
 * @remarks
 * Los permisos se piden a `GET /permisos/asignables`, nunca a `GET /permisos`:
 * el catálogo completo trae permisos reservados a staff (`empresas.ver`,
 * `auditoria.ver`…) y el dueño no tiene `permisos.ver`.
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

  /**
   * El nombre es único por Empresa sin distinguir mayúsculas, y no puede
   * repetir el de una plantilla: si choca, 409 con el motivo en español.
   */
  crear(payload: GuardarRolPayload): Observable<Rol> {
    return this.http.post<Rol>(`${environment.apiUrl}/roles`, payload);
  }

  actualizar(id: number, payload: Partial<GuardarRolPayload>): Observable<Rol> {
    return this.http.patch<Rol>(`${environment.apiUrl}/roles/${id}`, payload);
  }

  /** 409 si alguien del equipo todavía lo tiene. Quien se quitó del equipo pasa a Empleado. */
  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/roles/${id}`);
  }

  /**
   * Reemplaza todos los permisos del rol (no es incremental). El backend
   * rechaza los permisos reservados a staff y avisa `permisos:cambio` a cada
   * persona con ese rol.
   */
  asignarPermisos(id: number, permisoIds: number[]): Observable<Rol> {
    return this.http.put<Rol>(`${environment.apiUrl}/roles/${id}/permisos`, { permisoIds });
  }
}
