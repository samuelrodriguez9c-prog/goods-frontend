import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type AreaActividad = 'productos' | 'inventario' | 'compras' | 'pedidos' | 'clientes' | 'tienda' | 'whatsapp' | 'equipo' | 'ajustes';

export interface ItemActividad {
  id: number;
  fecha: string;
  usuario: { id: number; nombre: string } | null;
  area: AreaActividad;
  texto: string;
  /** Ruta del panel donde se ve lo que se tocó. */
  enlace: { ruta: string; params?: Record<string, string | number> } | null;
}

export interface RespuestaActividad {
  items: ItemActividad[];
  total: number;
  page: number;
  pageSize: number;
  desde: string;
  hasta: string;
  porPersona: { usuarioId: number; nombre: string; acciones: number; ultimaEn: string }[];
  porArea: Partial<Record<AreaActividad, number>>;
}

export interface FiltroActividad {
  /** Instantes (inicio y fin del período en la hora de quien mira). */
  desde: Date;
  hasta: Date;
  usuarioId?: number | null;
  area?: AreaActividad | null;
  page?: number;
}

/** `GET /actividad-equipo` (Plan Plus, permiso `actividad.ver`). */
@Injectable({ providedIn: 'root' })
export class ActividadEquipoService {
  private readonly http = inject(HttpClient);

  listar(f: FiltroActividad): Observable<RespuestaActividad> {
    let params = new HttpParams().set('desde', f.desde.toISOString()).set('hasta', f.hasta.toISOString()).set('pageSize', 50);
    if (f.usuarioId != null) params = params.set('usuarioId', f.usuarioId);
    if (f.area) params = params.set('area', f.area);
    if (f.page) params = params.set('page', f.page);
    return this.http.get<RespuestaActividad>(`${environment.apiUrl}/actividad-equipo`, { params });
  }
}
