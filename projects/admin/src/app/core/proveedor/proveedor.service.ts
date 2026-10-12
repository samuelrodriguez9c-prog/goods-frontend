import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Proveedor, ProveedorPayload } from './models/proveedor.model';

export interface CrearProveedorPayload extends ProveedorPayload {
  nombre: string;
}

/** Cliente de `ProveedorController` (filtra por la Empresa del token). */
@Injectable({ providedIn: 'root' })
export class ProveedorService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/proveedores`;

  listar(): Observable<Proveedor[]> {
    return this.http.get<Proveedor[]>(this.base);
  }

  crear(payload: CrearProveedorPayload): Observable<Proveedor> {
    return this.http.post<Proveedor>(this.base, payload);
  }

  actualizar(id: number, payload: ProveedorPayload): Observable<Proveedor> {
    return this.http.patch<Proveedor>(`${this.base}/${id}`, payload);
  }

  /** 409 si tiene compras registradas. */
  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
