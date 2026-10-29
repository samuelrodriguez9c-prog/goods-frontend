import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, expand, reduce } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ActualizarPerfilPayload } from './models/mi-perfil.model';
import { RespuestaPaginada, SesionAbierta, Usuario } from './models/usuario.model';

export interface PreferenciasCorreo {
  recordatorioCobro: boolean;
  pagosRecibidos: boolean;
  solicitudes: boolean;
}

export interface CrearEmpleadoPayload {
  correo: string;
  /** Rol con el que entra; sin él, `empleado_empresa`. */
  rolId?: number;
  /** Opcionales: sin nombre, la persona lo escribe al aceptar la invitación. */
  nombres?: string;
  apellidos?: string;
  /** Opcional: sin contraseña, el backend envía una invitación por correo. */
  password?: string;
  /** «Mensaje personal» (hasta 500): va en el correo, firmado por quien invita. */
  mensaje?: string;
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

  /**
   * Todas las personas del equipo, página por página (100 por pedido, el
   * máximo del backend). Usuarios y Roles agrupan y cuentan en el navegador,
   * así que necesitan el equipo completo y no solo la primera página.
   */
  todos(): Observable<Usuario[]> {
    return this.listar(1, 100).pipe(
      expand((r) => (r.page < r.totalPaginas ? this.listar(r.page + 1, 100) : EMPTY)),
      reduce((xs, r) => [...xs, ...r.data], [] as Usuario[]),
    );
  }

  /** Los atajos de teclado de la persona (los demás son los de fábrica). */
  guardarAtajos(atajos: Record<string, string>): Observable<Record<string, string>> {
    return this.http.put<Record<string, string>>(`${environment.apiUrl}/usuarios/me/atajos`, { atajos });
  }

  listar(page = 1, pageSize = 50): Observable<RespuestaPaginada<Usuario>> {
    return this.http.get<RespuestaPaginada<Usuario>>(`${environment.apiUrl}/usuarios`, {
      params: { page, pageSize },
    });
  }

  /**
   * Suma a alguien al equipo con `POST /usuarios/empleado` (no
   * `POST /usuarios`, que es el registro público). Si el correo ya es del
   * equipo responde 409 «Ya está en tu equipo.».
   */
  crearEmpleado(payload: CrearEmpleadoPayload): Observable<Usuario> {
    return this.http.post<Usuario>(`${environment.apiUrl}/usuarios/empleado`, payload);
  }

  /**
   * «Quitar del equipo»: el backend no borra la fila, le corta el acceso al
   * instante y anula su invitación. La Actividad conserva su nombre. No aplica
   * a uno mismo ni al dueño (403).
   */
  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/usuarios/${id}`);
  }

  /**
   * «Deshacer» de quitar: vuelve con sus datos, su rol y su acceso, pero sin
   * sesiones. Si tenía la invitación pendiente le llega un enlace nuevo
   * (`invitacionReenviada`).
   */
  restaurar(id: number): Observable<Usuario & { invitacionReenviada: boolean }> {
    return this.http.post<Usuario & { invitacionReenviada: boolean }>(
      `${environment.apiUrl}/usuarios/${id}/restaurar`,
      {},
    );
  }

  /**
   * «Acceso a Goods». Quitarlo cierra sus sesiones y le cierra el panel al
   * instante; no aplica a uno mismo ni al dueño (403).
   */
  cambiarAcceso(id: number, activo: boolean): Observable<Usuario> {
    return this.http.patch<Usuario>(`${environment.apiUrl}/usuarios/${id}/acceso`, { activo });
  }

  /** Sesiones vigentes, la más reciente primero. */
  sesiones(id: number): Observable<{ enLinea: boolean; sesiones: SesionAbierta[] }> {
    return this.http.get<{ enLinea: boolean; sesiones: SesionAbierta[] }>(
      `${environment.apiUrl}/usuarios/${id}/sesiones`,
    );
  }

  /**
   * Cierra una sesión: ese dispositivo vuelve al login cuando vence su token
   * de acceso (minutos). Si era la última, el corte es inmediato.
   */
  cerrarSesion(id: number, sesionId: number): Observable<{ quedan: number }> {
    return this.http.delete<{ quedan: number }>(`${environment.apiUrl}/usuarios/${id}/sesiones/${sesionId}`);
  }

  /** «Cerrar todas»: cada dispositivo vuelve al login ya. */
  cerrarSesiones(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/usuarios/${id}/sesiones`);
  }

  /**
   * Ids de quienes de la propia Empresa tienen Goods abierto ahora (sockets
   * conectados). Los cambios llegan en vivo con `presencia:cambio`.
   */
  enLinea(): Observable<{ ids: number[] }> {
    return this.http.get<{ ids: number[] }>(`${environment.apiUrl}/usuarios/en-linea`);
  }

  /** Manda un enlace nuevo de 48 h; el anterior deja de servir. Acepta el mismo `mensaje` que invitar. */
  reenviarInvitacion(id: number, mensaje?: string): Observable<{ venceEn: string }> {
    return this.http.post<{ venceEn: string }>(
      `${environment.apiUrl}/usuarios/${id}/reenviar-invitacion`,
      mensaje ? { mensaje } : {},
    );
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
