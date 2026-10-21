import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ModuloPublico, PlanPublico, RespuestaPaginada } from '../models/plan-publico.model';
import {
  EmpresaRegistrada,
  RegistroPublicoEmpresaPayload,
} from '../models/registro-publico.model';

/**
 * Llamadas del registro público y de la página para escribirle a Goods. Todos
 * los endpoints son públicos: no hace falta sesión.
 */
@Injectable({ providedIn: 'root' })
export class RegistroPublicoService {
  private readonly http = inject(HttpClient);

  /** Catálogo de módulos activos, no derivado de los planes (ver `ModuloPublico`). */
  listarCatalogoModulos(): Observable<ModuloPublico[]> {
    return this.http.get<ModuloPublico[]>(`${environment.apiUrl}/modulos/publico`);
  }

  listarPlanes(): Observable<RespuestaPaginada<PlanPublico>> {
    const params = new HttpParams().set('pageSize', 100);
    return this.http
      .get<RespuestaPaginada<PlanPublico>>(`${environment.apiUrl}/planes`, { params })
      .pipe(
        map((respuesta) => ({
          ...respuesta,
          // `precio_mensual` es `decimal`: llega como string ("100000.00").
          // Se convierte una sola vez acá para que el resto trabaje con number.
          data: respuesta.data.map((plan) => ({
            ...plan,
            precioMensual: plan.precioMensual === null ? null : Number(plan.precioMensual),
          })),
        })),
      );
  }

  registrar(payload: RegistroPublicoEmpresaPayload): Observable<EmpresaRegistrada> {
    return this.http.post<EmpresaRegistrada>(
      `${environment.apiUrl}/empresas/registro-publico`,
      payload,
    );
  }

  /** Datos de la página para escribirle a Goods desde los correos de alta (`/registro/mensaje`). */
  verContacto(token: string): Observable<ContactoAlta> {
    return this.http.get<ContactoAlta>(`${environment.apiUrl}/empresas/registro-publico/contacto`, {
      params: { token },
    });
  }

  enviarContacto(token: string, texto: string): Observable<{ ok: true }> {
    return this.http.post<{ ok: true }>(`${environment.apiUrl}/empresas/registro-publico/contacto`, {
      token,
      texto,
    });
  }
}

export interface ContactoAlta {
  empresa: string;
  numeroSolicitud: string;
  puedeEscribir: boolean;
  estado: string;
  mensajes: { texto: string; creadoEn: string }[];
}
