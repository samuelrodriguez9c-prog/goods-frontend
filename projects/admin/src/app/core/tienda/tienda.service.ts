import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type MonedaTienda = 'COP' | 'USD';

/** Tienda pública propia (Fase 0 de PROPUESTA_WHATSAPP.md). */
export interface MiTienda {
  /** `false` = todavía no se guardó: son las sugerencias de Goods. */
  guardada: boolean;
  slug: string;
  activa: boolean;
  whatsapp: string | null;
  descripcion: string | null;
  logoUrl: string | null;
  moneda: MonedaTienda;
  mostrarAgotados: boolean;
  url: string;
  productosPublicados: number;
}

export type CambiosTienda = Partial<Omit<MiTienda, 'guardada' | 'url' | 'productosPublicados'>>;

@Injectable({ providedIn: 'root' })
export class TiendaService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/tienda/mia`;

  mia(): Observable<MiTienda> {
    return this.http.get<MiTienda>(this.base);
  }

  guardar(cambios: CambiosTienda): Observable<MiTienda> {
    return this.http.patch<MiTienda>(this.base, cambios);
  }

  /**
   * NUEVO (TODO backend): `GET /tienda/mia/slug-disponible?slug=…` → `{ disponible: boolean }`.
   * Hoy el PATCH responde 409 si el slug está tomado; esto solo adelanta el aviso mientras escribe.
   */
  slugDisponible(slug: string): Observable<{ disponible: boolean }> {
    return this.http.get<{ disponible: boolean }>(`${this.base}/slug-disponible`, { params: { slug } });
  }
}
