import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
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

  listar(): Observable<RespuestaPaginada<UsuarioGoods>> {
    const params = new HttpParams().set('pageSize', 100);
    return this.http.get<RespuestaPaginada<UsuarioGoods>>(`${environment.apiUrl}/usuarios`, {
      params,
    });
  }

  crear(payload: CrearUsuarioGoodsPayload): Observable<UsuarioGoods> {
    return this.http.post<UsuarioGoods>(`${environment.apiUrl}/usuarios`, payload);
  }

  actualizar(id: number, payload: ActualizarUsuarioGoodsPayload): Observable<UsuarioGoods> {
    return this.http.patch<UsuarioGoods>(`${environment.apiUrl}/usuarios/${id}`, payload);
  }

  cambiarRol(id: number, rolId: number): Observable<UsuarioGoods> {
    return this.http.patch<UsuarioGoods>(`${environment.apiUrl}/usuarios/${id}/rol`, { rolId });
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/usuarios/${id}`);
  }
}
