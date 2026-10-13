import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Espejo de `Categoria` del backend. */
export interface Categoria {
  id: number;
  nombre: string;
  descripcion: string | null;
  categoriaPadreId: number | null;
  imagen?: string | null;
  activo: boolean;
}

export type CategoriaPayload = Partial<Omit<Categoria, 'id'>>;

/** `GET /categorias` no pagina. El backend filtra por la Empresa del token. */
@Injectable({ providedIn: 'root' })
export class CategoriaService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/categorias`;

  listar(): Observable<Categoria[]> {
    return this.http.get<Categoria[]>(this.base);
  }

  crear(payload: CategoriaPayload & { nombre: string }): Observable<Categoria> {
    return this.http.post<Categoria>(this.base, payload);
  }

  actualizar(id: number, payload: CategoriaPayload): Observable<Categoria> {
    return this.http.patch<Categoria>(`${this.base}/${id}`, payload);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
