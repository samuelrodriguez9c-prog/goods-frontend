import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { Entrega, PedidoWhatsapp, TiendaPublica } from './tienda.model';

@Injectable({ providedIn: 'root' })
export class TiendaService {
  private readonly http = inject(HttpClient);

  ver(slug: string) {
    return this.http.get<TiendaPublica>(`${environment.apiUrl}/tiendas/${encodeURIComponent(slug)}`);
  }

  /**
   * `entrega` y `direccion` son NUEVOS (TODO backend): el mensaje suma
   * «Recojo en la tienda» o «Entrega a domicilio: …» antes de la nota.
   * Mientras el backend no los acepte, mandarlos dentro de `nota`.
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
