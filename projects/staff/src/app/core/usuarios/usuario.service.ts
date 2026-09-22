import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ActualizarPerfilPayload } from './models/mi-perfil.model';
import { RespuestaPaginada, UsuarioGoods } from './models/usuario.model';

/** Body de `POST /usuarios` — mismos campos que `CreateUsuarioDto` del
 * backend que de verdad hacen falta para dar de alta a alguien del
 * personal de Goods (el resto del DTO es de e-commerce: dirección,
 * marketing, etc., no aplica acá). */
export interface CrearUsuarioGoodsPayload {
  nombres: string;
  apellidos: string;
  correo: string;
  telefono?: string;
  password: string;
}

export interface ActualizarUsuarioGoodsPayload {
  nombres?: string;
  apellidos?: string;
  telefono?: string;
  /** Ver `UsuarioGoods.imagenPerfil` — la URL ya subida (ver
   *  `core/upload/upload.service.ts`), nunca el archivo en sí: ese POST
   *  es un paso aparte, este PATCH solo asocia la URL resultante. */
  imagenPerfil?: string;
}

/**
 * Personal de Goods (`GET /usuarios`, exige `usuarios.ver`) — desde el
 * fix de aislamiento por tenant en `UsuarioService` del backend (ver ese
 * archivo), `staff_goods` acá ve únicamente usuarios con `empresaId
 * null` (sus propios colegas), nunca el equipo de un cliente. Es la
 * pantalla "Usuarios" del sidebar de staff (PIVOTE_SAAS_MULTITENANT.md
 * §8).
 *
 * `POST /usuarios` (público, sin permiso) siempre asigna el rol por
 * defecto (`cliente`, salvo que sea el primer usuario del sistema —
 * ver `resolverRolIdInicial` del backend) y nunca `empresaId` — por eso
 * `crear()` encadena un `PATCH /usuarios/:id/rol` inmediatamente después
 * para dejar al usuario nuevo con el rol de Goods que se eligió en el
 * formulario (ver `UsuariosPageComponent`, que arma esa secuencia).
 */
@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private readonly http = inject(HttpClient);

  /** `GET /usuarios/:id` — el backend permite ver el PROPIO perfil sin
   *  ningún permiso especial (`usuarios.ver` solo hace falta para ver el
   *  de alguien más, ver `UsuarioController.verificarPropioOPermiso`), así
   *  que `features/settings/` lo usa así: cualquier cuenta de staff, tenga
   *  o no `usuarios.ver`, puede traer su propio registro completo.
   *
   *  Genérico en el tipo de respuesta (por defecto `UsuarioGoods`, lo que
   *  ya usaba `features/usuarios/`) para que `features/settings/` pueda
   *  pedir el mismo endpoint tipado contra `MiPerfil` (más campos — ver
   *  ese modelo) sin duplicar este método ni forzar a `UsuarioGoods` a
   *  cargar con columnas que esa pantalla no necesita. */
  obtener<T = UsuarioGoods>(id: number): Observable<T> {
    return this.http.get<T>(`${environment.apiUrl}/usuarios/${id}`);
  }

  listar(): Observable<RespuestaPaginada<UsuarioGoods>> {
    const params = new HttpParams().set('pageSize', 100);
    return this.http.get<RespuestaPaginada<UsuarioGoods>>(`${environment.apiUrl}/usuarios`, {
      params,
    });
  }

  crear(payload: CrearUsuarioGoodsPayload): Observable<UsuarioGoods> {
    return this.http.post<UsuarioGoods>(`${environment.apiUrl}/usuarios`, payload);
  }

  /** Mismo criterio genérico que `obtener()` — `features/settings/` pasa
   *  un `ActualizarPerfilPayload` (más campos que
   *  `ActualizarUsuarioGoodsPayload`, ver ese modelo) y pide de vuelta un
   *  `MiPerfil`, sin que esto deje de servir a `features/usuarios/` con
   *  su payload/respuesta de siempre (tipo por defecto). */
  actualizar<TRespuesta = UsuarioGoods>(
    id: number,
    payload: ActualizarUsuarioGoodsPayload | ActualizarPerfilPayload,
  ): Observable<TRespuesta> {
    return this.http.patch<TRespuesta>(`${environment.apiUrl}/usuarios/${id}`, payload);
  }

  cambiarRol(id: number, rolId: number): Observable<UsuarioGoods> {
    return this.http.patch<UsuarioGoods>(`${environment.apiUrl}/usuarios/${id}/rol`, { rolId });
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/usuarios/${id}`);
  }

  /** Foto de quién está conectado AHORA (`RealtimeGateway.usuariosEnLineaIds`
   * del backend) — es solo el punto de partida; `usuarios-page` se suscribe
   * aparte a `RealtimeService` para las actualizaciones en vivo después de
   * esta carga (ver `EVENTO_PRESENCIA_CAMBIO`). */
  enLinea(): Observable<{ ids: number[] }> {
    return this.http.get<{ ids: number[] }>(`${environment.apiUrl}/usuarios/en-linea`);
  }
}
