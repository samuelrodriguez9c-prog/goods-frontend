import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Plan } from './models/plan.model';
import { RespuestaPaginada } from './models/empresa.model';

/** Body de `POST /planes` y `PATCH /planes/:id` (en el PATCH todo es
 * opcional). `activo` solo tiene efecto por PATCH, para reactivar. */
export interface GuardarPlanPayload {
  nombre: string;
  descripcion?: string | null;
  precioMensual?: number | null;
  caracteristicas?: string[];
  activo?: boolean;
  /** 0 = sin prueba; hasta `DIAS_PRUEBA_MAX`. */
  diasPrueba?: number;
}

/** `precio_mensual` es `decimal` en Postgres y llega como string por JSON:
 * se convierte a number una vez por respuesta. */
function coercerPlan(plan: Plan): Plan {
  return {
    ...plan,
    precioMensual: plan.precioMensual === null ? null : Number(plan.precioMensual),
  };
}

/**
 * Catálogo de planes para staff (`planes.ver`). Los planes no se borran,
 * se desactivan: una suscripción puede seguir apuntando a ellos.
 */
@Injectable({ providedIn: 'root' })
export class PlanService {
  private readonly http = inject(HttpClient);

  /**
   * `GET /planes/todos`: incluye los desactivados (el `GET /planes` público no),
   * porque una suscripción vieja puede apuntar a uno. Trae hasta 100.
   */
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

  /** `DELETE /planes/:id`: el backend desactiva el plan, no borra la fila. */
  desactivar(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/planes/${id}`);
  }

  /** Reactiva un plan desactivado (`PATCH` con `activo: true`). */
  reactivar(id: number): Observable<Plan> {
    return this.actualizar(id, { activo: true });
  }
}
