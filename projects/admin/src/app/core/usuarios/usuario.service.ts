import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ActualizarPerfilPayload } from './models/mi-perfil.model';
import { RespuestaPaginada, Usuario } from './models/usuario.model';

export interface PreferenciasCorreo {
  recordatorioCobro: boolean;
  pagosRecibidos: boolean;
  solicitudes: boolean;
}

export interface CrearEmpleadoPayload {
  nombres: string;
  apellidos: string;
  correo: string;
  /** Opcional: sin contraseña, el backend envía una invitación por correo. */
  password?: string;
}

/**
 * Equipo de la Empresa y el propio perfil. El backend filtra por la Empresa
 * del token: nunca hace falta pasar `empresaId`.
 */
@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private readonly http = inject(HttpClient);

  /** Settings lo usa con el propio id y `T = MiPerfil`. */
  obtener<T = Usuario>(id: number): Observable<T> {
    return this.http.get<T>(`${environment.apiUrl}/usuarios/${id}`);
  }

  actualizar<T = Usuario>(id: number, payload: ActualizarPerfilPayload): Observable<T> {
    return this.http.patch<T>(`${environment.apiUrl}/usuarios/${id}`, payload);
  }

  listar(page = 1, pageSize = 50): Observable<RespuestaPaginada<Usuario>> {
    return this.http.get<RespuestaPaginada<Usuario>>(`${environment.apiUrl}/usuarios`, {
      params: { page, pageSize },
    });
  }

  /**
   * Suma a alguien al equipo con `POST /usuarios/empleado` (no
   * `POST /usuarios`, que es el registro público).
   */
  crearEmpleado(payload: CrearEmpleadoPayload): Observable<Usuario> {
    return this.http.post<Usuario>(`${environment.apiUrl}/usuarios/empleado`, payload);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/usuarios/${id}`);
  }

  /** Manda un enlace nuevo de 48 h; el anterior deja de servir. */
  reenviarInvitacion(id: number): Observable<{ venceEn: string }> {
    return this.http.post<{ venceEn: string }>(`${environment.apiUrl}/usuarios/${id}/reenviar-invitacion`, {});
  }

  /** Correos informativos que el usuario puede apagar (Settings → Correos). */
  preferenciasCorreo(): Observable<PreferenciasCorreo> {
    return this.http.get<PreferenciasCorreo>(`${environment.apiUrl}/usuarios/me/preferencias-correo`);
  }

  cambiarPreferenciasCorreo(cambios: Partial<PreferenciasCorreo>): Observable<PreferenciasCorreo> {
    return this.http.patch<PreferenciasCorreo>(`${environment.apiUrl}/usuarios/me/preferencias-correo`, cambios);
  }

  cambiarRol(id: number, rolId: number): Observable<Usuario> {
    return this.http.patch<Usuario>(`${environment.apiUrl}/usuarios/${id}/rol`, { rolId });
  }
}
