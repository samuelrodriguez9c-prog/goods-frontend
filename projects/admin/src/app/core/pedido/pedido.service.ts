import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RespuestaPaginada } from '../usuarios/models/usuario.model';
import {
  ActualizarPedidoPayload,
  CrearPedidoPayload,
  DetallePedido,
  EstadoPedido,
  FiltroPedidos,
  Pedido,
  ResumenPedidos,
} from './models/pedido.model';

/** Cliente de `PedidoController` (módulo `orders`, permisos `pedidos.*`). */
@Injectable({ providedIn: 'root' })
export class PedidoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/pedidos`;

  listar(filtro: FiltroPedidos = {}): Observable<RespuestaPaginada<Pedido>> {
    return this.http.get<RespuestaPaginada<Pedido>>(this.base, { params: this.params(filtro) });
  }

  /** Cuentas por estado, canal y pago, y lo vendido en el período. */
  resumen(rango: { desde?: string; hasta?: string } = {}): Observable<ResumenPedidos> {
    return this.http.get<ResumenPedidos>(`${this.base}/resumen`, { params: this.params(rango) });
  }

  detalle(id: number): Observable<DetallePedido> {
    return this.http.get<DetallePedido>(`${this.base}/${id}`);
  }

  crear(payload: CrearPedidoPayload): Observable<DetallePedido> {
    return this.http.post<DetallePedido>(this.base, payload);
  }

  /** Solo mientras está pendiente (409 si no). */
  actualizar(id: number, payload: ActualizarPedidoPayload): Observable<DetallePedido> {
    return this.http.patch<DetallePedido>(`${this.base}/${id}`, payload);
  }

  /** Confirmar un pedido de la tienda puede fallar con 409 si ya no alcanza el stock (el mensaje dice qué falta). */
  cambiarEstado(id: number, estado: EstadoPedido, motivo?: string): Observable<DetallePedido> {
    return this.http.patch<DetallePedido>(`${this.base}/${id}/estado`, motivo ? { estado, motivo } : { estado });
  }

  cancelar(id: number, motivo?: string): Observable<DetallePedido> {
    return this.http.patch<DetallePedido>(`${this.base}/${id}/cancelar`, motivo ? { motivo } : {});
  }

  marcarPago(id: number, estadoPago: 'pagado' | 'reembolsado', metodoPago?: string): Observable<DetallePedido> {
    return this.http.patch<DetallePedido>(`${this.base}/${id}/pago`, metodoPago ? { estadoPago, metodoPago } : { estadoPago });
  }

  agregarNota(id: number, texto: string): Observable<DetallePedido> {
    return this.http.post<DetallePedido>(`${this.base}/${id}/notas`, { texto });
  }

  private params(filtro: object): HttpParams {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(filtro)) if (v !== undefined && v !== '' && v !== null) params = params.set(k, String(v));
    return params;
  }
}
