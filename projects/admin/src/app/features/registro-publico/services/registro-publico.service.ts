import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PlanPublico, RespuestaPaginada } from '../models/plan-publico.model';
import {
  EmpresaRegistrada,
  RegistroPublicoEmpresaPayload,
} from '../models/registro-publico.model';

/**
 * Llamadas al backend de la página pública de registro/checkout (§5) —
 * ambos endpoints son públicos, sin `Authorization` (no pasan por
 * `authInterceptor`, no hace falta sesión): `GET /planes` (solo activos)
 * y `POST /empresas/registro-publico`.
 *
 * Primer feature de `admin` que llama al backend real (login aparte, en
 * `core/auth`) — el resto de `features/` (products, customers, orders...)
 * todavía trabaja con datos mock, ver MODULOS_PENDIENTES.md.
 */
@Injectable({ providedIn: 'root' })
export class RegistroPublicoService {
  private readonly http = inject(HttpClient);

  listarPlanes(): Observable<RespuestaPaginada<PlanPublico>> {
    const params = new HttpParams().set('pageSize', 100);
    return this.http
      .get<RespuestaPaginada<PlanPublico>>(`${environment.apiUrl}/planes`, { params })
      .pipe(
        map((respuesta) => ({
          ...respuesta,
          // `precio_mensual` es `decimal` en Postgres — TypeORM/pg lo manda
          // como STRING sobre JSON para no perder precisión (ej.
          // "100000.00"), no como number. Se coerce acá, una sola vez en
          // el borde del sistema, para que el resto del componente
          // (formateo, comparar cuál plan es más barato) trabaje con un
          // number de verdad en vez de tener que acordarse en cada lugar.
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
}
