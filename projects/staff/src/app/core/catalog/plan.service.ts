import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Plan } from './models/plan.model';
import { RespuestaPaginada } from './models/empresa.model';

/** `GET /planes/todos` — catálogo completo (incluye planes desactivados),
 * exige `planes.ver` (solo `staff_goods`). A diferencia de `GET /planes`
 * (público, para el checkout — ver `PlanController`), acá sí hace falta
 * ver planes inactivos: una Suscripción vieja puede apuntar a un plan que
 * el staff ya retiró del catálogo público. */
@Injectable({ providedIn: 'root' })
export class PlanService {
  private readonly http = inject(HttpClient);

  listarTodos(): Observable<RespuestaPaginada<Plan>> {
    const params = new HttpParams().set('pageSize', 100);
    return this.http.get<RespuestaPaginada<Plan>>(`${environment.apiUrl}/planes/todos`, {
      params,
    });
  }
}
