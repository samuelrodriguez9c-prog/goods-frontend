import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Plan } from './models/plan.model';
import { RespuestaPaginada } from './models/empresa.model';

/** Body de `POST /planes` / `PATCH /planes/:id` — mismos campos que
 * `CreatePlanDto` del backend, todos opcionales para el PATCH (el
 * componente decide qué manda). `activo` solo tiene efecto real por PATCH
 * (reactivar un plan desactivado) — ver el comentario agregado en
 * `CreatePlanDto` del backend. */
export interface GuardarPlanPayload {
  nombre: string;
  descripcion?: string | null;
  precioMensual?: number | null;
  caracteristicas?: string[];
  activo?: boolean;
}

/** `precio_mensual` es `decimal` en Postgres — TypeORM/pg lo manda como
 * string por JSON (ver el mismo bug ya documentado en
 * `RegistroPublicoService` de `admin`, ADMIN_DISENO.md > "Registro
 * público (checkout)"). Se coerce acá, una sola vez por respuesta, para
 * que el resto de este servicio y de `PlanesPageComponent` trabajen con
 * un number de verdad. */
function coercerPlan(plan: Plan): Plan {
  return {
    ...plan,
    precioMensual: plan.precioMensual === null ? null : Number(plan.precioMensual),
  };
}

/**
 * `GET /planes/todos` — catálogo completo (incluye planes desactivados),
 * exige `planes.ver` (solo `staff_goods`). A diferencia de `GET /planes`
 * (público, para el checkout — ver `PlanController`), acá sí hace falta
 * ver planes inactivos: una Suscripción vieja puede apuntar a un plan que
 * el staff ya retiró del catálogo público.
 *
 * `crear`/`actualizar`/`eliminar` son la pantalla de Planes del sidebar
 * de staff (PIVOTE_SAAS_MULTITENANT.md §8) — `eliminar` en realidad
 * desactiva (`PlanService.remove` del backend no borra la fila, ver esa
 * entidad: un plan con Suscripciones apuntándole no se puede borrar de
 * verdad), por eso el botón en la pantalla dice "Desactivar", no
 * "Eliminar".
 */
@Injectable({ providedIn: 'root' })
export class PlanService {
  private readonly http = inject(HttpClient);

  listarTodos(): Observable<RespuestaPaginada<Plan>> {
    const params = new HttpParams().set('pageSize', 100);
    return this.http
      .get<RespuestaPaginada<Plan>>(`${environment.apiUrl}/planes/todos`, { params })
      .pipe(map((respuesta) => ({ ...respuesta, data: respuesta.data.map(coercerPlan) })));
  }

  crear(payload: GuardarPlanPayload): Observable<Plan> {
    return this.http
      .post<Plan>(`${environment.apiUrl}/planes`, payload)
      .pipe(map(coercerPlan));
  }

  actualizar(id: number, payload: Partial<GuardarPlanPayload>): Observable<Plan> {
    return this.http
      .patch<Plan>(`${environment.apiUrl}/planes/${id}`, payload)
      .pipe(map(coercerPlan));
  }

  /** Desactiva (`DELETE /planes/:id`) — ver el comentario de la clase. */
  desactivar(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/planes/${id}`);
  }

  /** Reactiva un plan ya desactivado — mismo endpoint que `actualizar`,
   * con `activo: true` explícito (ver el campo nuevo en `CreatePlanDto`
   * del backend). */
  reactivar(id: number): Observable<Plan> {
    return this.actualizar(id, { activo: true });
  }
}
