import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { PedidoWhatsapp, TiendaPublica } from './tienda.model';

@Injectable({ providedIn: 'root' })
export class TiendaService {
  private readonly http = inject(HttpClient);

  ver(slug: string) {
    return this.http.get<TiendaPublica>(`${environment.apiUrl}/tiendas/${encodeURIComponent(slug)}`);
  }

  armarPedido(
    slug: string,
    body: { items: { productoId: number; cantidad: number }[]; nombre?: string; nota?: string; aceptaPromociones?: boolean },
  ) {
    return this.http.post<PedidoWhatsapp>(`${environment.apiUrl}/tiendas/${encodeURIComponent(slug)}/pedido-whatsapp`, body);
  }
}
