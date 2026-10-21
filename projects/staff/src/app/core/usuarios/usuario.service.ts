import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ActualizarPerfilPayload } from './models/mi-perfil.model';
import { RespuestaPaginada, UsuarioGoods } from './models/usuario.model';

/** Body de `POST /usuarios` con lo necesario para el personal de Goods (el
 * resto del DTO es de e-commerce y no aplica). */
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
  /** URL ya subida con `UploadService`, no el archivo. */
  imagenPerfil?: string;
}

/**
 * Personal de Goods (`usuarios.ver`). El backend solo devuelve usuarios sin
 * Empresa: staff nunca ve el equipo de un cliente.
 */
@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private readonly http = inject(HttpClient);

  /**
   * El propio perfil no exige `usuarios.ver`; el de otro, sí.
   *
   * @remarks
   * Genérico para que Settings lo pida como `MiPerfil` (más campos) sin un
   * método aparte.
   */
  obtener<T = UsuarioGoods>(id: number): Observable<T> {
    return this.http.get<T>(`${environment.apiUrl}/usuarios/${id}`);
  }

  /** Trae hasta 100, sin paginar. */
  listar(): Observable<RespuestaPaginada<UsuarioGoods>> {
    const params = new HttpParams().set('pageSize', 100);
    return this.http.get<RespuestaPaginada<UsuarioGoods>>(`${environment.apiUrl}/usuarios`, {
      params,
    });
  }

  /**
   * Crea la cuenta con `POST /usuarios`, que siempre asigna el rol por
   * defecto y nunca `empresaId`.
   *
   * @remarks
   * No pone el rol de Goods: quien llama debe encadenar `cambiarRol()`
   * (lo hace `CrearUsuarioPanelComponent`).
   */
  crear(payload: CrearUsuarioGoodsPayload): Observable<UsuarioGoods> {
    return this.http.post<UsuarioGoods>(`${environment.apiUrl}/usuarios`, payload);
  }

  /** Genérico como `obtener()`: Settings manda un `ActualizarPerfilPayload` y recibe `MiPerfil`. */
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

  /** Ids de quién está conectado ahora. Es solo la foto inicial: los cambios
   * posteriores llegan por `RealtimeService`. */
  enLinea(): Observable<{ ids: number[] }> {
    return this.http.get<{ ids: number[] }>(`${environment.apiUrl}/usuarios/en-linea`);
  }
}
