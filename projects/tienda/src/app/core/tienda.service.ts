import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { Entrega, PedidoWhatsapp, TiendaPublica } from './tienda.model';

/** Endpoints públicos de la tienda (`/tiendas/:slug…`), sin sesión. */
@Injectable({ providedIn: 'root' })
export class TiendaService {
  private readonly http = inject(HttpClient);

  /**
   * La tienda publicada con su catálogo.
   *
   * @remarks
   * Si no se puede mostrar responde 404 con `TiendaNoDisponible` en el cuerpo:
   * `motivo` dice qué pantalla mostrar.
   */
  ver(slug: string) {
    return this.http.get<TiendaPublica>(`${environment.apiUrl}/tiendas/${encodeURIComponent(slug)}`);
  }

  /**
   * Arma el mensaje de WhatsApp con los precios y el stock de ahora.
   *
   * @remarks
   * Si el plan del negocio incluye Pedidos, además guarda el pedido y avisa al
   * equipo: llamarlo dos veces crea dos pedidos. Errores que hay que manejar:
   * - 409: algo se agotó o no alcanza; el mensaje dice qué.
   * - 404: la tienda dejó de estar disponible.
   * - 400: datos inválidos (nombre, celular, dirección con domicilio).
   * - 429: demasiados pedidos desde ese celular en poco tiempo.
   *
   * @param body - `direccion` es obligatoria con `entrega: 'domicilio'`.
   * @returns El texto, el enlace `wa.me` y `numero` (null si no se guardó).
   */
  armarPedido(
    slug: string,
    body: {
      items: { productoId: number; cantidad: number }[];
      nombre: string;
      telefono: string;
      nota?: string;
      aceptaPromociones?: boolean;
      entrega?: Entrega;
      direccion?: string;
    },
  ) {
    return this.http.post<PedidoWhatsapp>(`${environment.apiUrl}/tiendas/${encodeURIComponent(slug)}/pedido-whatsapp`, body);
  }
}
