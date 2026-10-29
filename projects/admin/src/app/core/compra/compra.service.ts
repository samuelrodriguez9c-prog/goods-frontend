import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, expand, reduce } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RespuestaPaginada } from '../usuarios/models/usuario.model';
import { ActualizarCompraPayload, Compra, CrearCompraPayload } from './models/compra.model';

/** Borrador del pedido para el proveedor (`GET /compras/:id/mensaje-proveedor`). */
export interface MensajeProveedor {
  compraId: number;
  codigo: string;
  proveedor: string;
  texto: string;
  telefono: string | null;
  /** `https://wa.me/…?text=…`, o null sin un celular usable. */
  enlace: string | null;
  nota: string | null;
}

/** Cliente de `CompraController` (permisos `compras.*`). */
@Injectable({ providedIn: 'root' })
export class CompraService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/compras`;

  /** Todas las compras, página por página (de la más nueva a la más vieja). */
  todas(): Observable<Compra[]> {
    const pagina = (page: number) =>
      this.http.get<RespuestaPaginada<Compra>>(this.base, { params: { page, pageSize: 100 } });
    return pagina(1).pipe(
      expand((r) => (r.page < r.totalPaginas ? pagina(r.page + 1) : EMPTY)),
      reduce((xs, r) => [...xs, ...r.data], [] as Compra[]),
    );
  }

  crear(payload: CrearCompraPayload): Observable<Compra> {
    return this.http.post<Compra>(this.base, payload);
  }

  actualizar(id: number, payload: ActualizarCompraPayload): Observable<Compra> {
    return this.http.patch<Compra>(`${this.base}/${id}`, payload);
  }

  /** El stock de cada línea entra al inventario. */
  recibir(id: number): Observable<Compra> {
    return this.http.patch<Compra>(`${this.base}/${id}/recibir`, {});
  }

  mensajeProveedor(id: number): Observable<MensajeProveedor> {
    return this.http.get<MensajeProveedor>(`${this.base}/${id}/mensaje-proveedor`);
  }

  /** `motivo` queda en las notas. */
  cancelar(id: number, motivo?: string): Observable<Compra> {
    return this.http.patch<Compra>(`${this.base}/${id}/cancelar`, motivo ? { motivo } : {});
  }
}
