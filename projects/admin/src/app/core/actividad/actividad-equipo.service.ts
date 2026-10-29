import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type AreaActividad = 'productos' | 'inventario' | 'compras' | 'pedidos' | 'clientes' | 'tienda' | 'whatsapp' | 'equipo' | 'ajustes';

/** Qué clase de acción fue: da el ícono y el color en la lista. */
export type TipoAccion = 'crear' | 'editar' | 'estado' | 'ajuste' | 'eliminar' | 'acceso';
/** Desde dónde: el panel en un computador, el celular o la bandeja de WhatsApp. */
export type OrigenAccion = 'panel' | 'app' | 'whatsapp';

/** Un dato que cambió, ya en texto (`$ 4.000 → $ 4.500`). */
export interface CambioActividad {
  campo: string;
  /** `null` si estaba vacío (se llenó al crear o editar). */
  antes: string | null;
  /** `null` si quedó vacío (se borró o se vació). */
  despues: string | null;
}

export interface ItemActividad {
  id: number;
  fecha: string;
  usuario: { id: number; nombre: string } | null;
  area: AreaActividad;
  tipo: TipoAccion;
  origen: OrigenAccion;
  texto: string;
  /** Ruta del panel donde se ve lo que se tocó. */
  enlace: { ruta: string; params?: Record<string, string | number> } | null;
  /** Lo que se tocó: `{ tipo: 'pedido', ref: '#1043' }`. `null` en acciones viejas o ajustes generales. */
  registro: { tipo: string; id: number; nombre: string | null; ref: string } | null;
  /** Antes → después por dato. Vacío en lo registrado antes de guardar los cambios. */
  cambios: CambioActividad[];
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
  /** Hasta 100; por defecto 50. */
  pageSize?: number;
}

/** `GET /actividad-equipo` (Plan Plus, permiso `actividad.ver`). */
@Injectable({ providedIn: 'root' })
export class ActividadEquipoService {
  private readonly http = inject(HttpClient);

  listar(f: FiltroActividad): Observable<RespuestaActividad> {
    let params = new HttpParams().set('desde', f.desde.toISOString()).set('hasta', f.hasta.toISOString()).set('pageSize', f.pageSize ?? 50);
    if (f.usuarioId != null) params = params.set('usuarioId', f.usuarioId);
    if (f.area) params = params.set('area', f.area);
    if (f.page) params = params.set('page', f.page);
    return this.http.get<RespuestaActividad>(`${environment.apiUrl}/actividad-equipo`, { params });
  }
}
