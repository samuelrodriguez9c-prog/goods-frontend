import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RespuestaPaginada, Usuario } from './models/usuario.model';

export interface CrearEmpleadoPayload {
  nombres: string;
  apellidos: string;
  correo: string;
  password: string;
}

/**
 * Equipo de MI Empresa, del lado `admin` (`PROPUESTA_ROLES_Y_ACCESOS.md`
 * §6 paso 5) — `GET /usuarios` ya viene filtrado por tenant desde el
 * backend (`usuarios.ver`), así que acá nunca hace falta pasar
 * `empresaId`: siempre trae a mi propio equipo, nunca el de otra Empresa.
 * `crearEmpleado` pega contra `POST /usuarios/empleado` (no
 * `POST /usuarios`, que es el registro público de un `cliente`) — ver
 * `UsuarioController.crearEmpleado` del backend.
 */
@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private readonly http = inject(HttpClient);

  listar(page = 1, pageSize = 50): Observable<RespuestaPaginada<Usuario>> {
    return this.http.get<RespuestaPaginada<Usuario>>(`${environment.apiUrl}/usuarios`, {
      params: { page, pageSize },
    });
  }

  crearEmpleado(payload: CrearEmpleadoPayload): Observable<Usuario> {
    return this.http.post<Usuario>(`${environment.apiUrl}/usuarios/empleado`, payload);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/usuarios/${id}`);
  }

  cambiarRol(id: number, rolId: number): Observable<Usuario> {
    return this.http.patch<Usuario>(`${environment.apiUrl}/usuarios/${id}/rol`, { rolId });
  }
}
