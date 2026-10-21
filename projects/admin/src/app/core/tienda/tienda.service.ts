import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type MonedaTienda = 'COP' | 'USD';

/** Una fila del horario en texto; `horas: null` = cerrado. */
export interface FilaHorario {
  dias: string;
  horas: string | null;
}
/** Usuario de cada red (sin @ ni enlace). */
export interface RedesTienda {
  instagram?: string;
  facebook?: string;
  tiktok?: string;
}

/** Configuración de la tienda en línea de la Empresa. */
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
  /** Bajo el hero de la tienda pública. */
  ciudad: string | null;
  /** Para «Recoger en tienda» y el pie. Sin dato, la tienda arranca en domicilio. */
  direccionTienda: string | null;
  redes: RedesTienda;
  horario: FilaHorario[];
  url: string;
  productosPublicados: number;
}

export interface SlugDisponible {
  disponible: boolean;
  motivo: 'libre' | 'propia' | 'ocupada' | 'reservada' | 'invalida';
}

export type CambiosTienda = Partial<Omit<MiTienda, 'guardada' | 'url' | 'productosPublicados' | 'redes'>> & {
  /** Reemplaza todas las redes: la que vaya en null (o no vaya) se quita. */
  redes?: { instagram: string | null; facebook: string | null; tiktok: string | null };
};

/** Configuración de la tienda en línea de la Empresa (`/tienda/mia`). */
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
   * Adelanta si la dirección está libre mientras el dueño escribe (`propia` = ya es la suya).
   * El PATCH igual responde 409 si otro la toma antes.
   */
  slugDisponible(slug: string): Observable<SlugDisponible> {
    return this.http.get<SlugDisponible>(`${this.base}/slug-disponible`, { params: { slug } });
  }
}
