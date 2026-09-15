import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RespuestaPaginada } from './models/empresa.model';
import { Suscripcion } from './models/suscripcion.model';

/** 'activa' | 'cancelada' | 'vencida' — 'pendiente' no es asignable a
 * mano (ver `CambiarEstadoSuscripcionDto` del backend: solo lo asigna el
 * propio flujo de alta). */
export type EstadoAsignableSuscripcion = 'activa' | 'cancelada' | 'vencida';

/**
 * `GET /suscripciones` — exige `suscripciones.ver` (solo `staff_goods`).
 *
 * `listar` sin `empresaId` (solo `estado`) es la que ya usan Empresas/
 * Altas pendientes: la pantalla de Empresas necesita el plan de TODAS
 * las filas visibles a la vez, y pedirlo una por una (N llamadas por
 * cada Empresa en pantalla) sería mucho más lento que traer de una vez
 * las suscripciones de un estado dado (`pageSize=100`, mismo límite/
 * criterio que `EmpresaService.listar`) y cruzarlas en memoria por
 * `empresaId` — ver `EmpresasPageComponent.mapaPlanPorEmpresa`. Con
 * pocos cientos de Empresas esto alcanza sin problema; si el volumen
 * crece, este es el primer lugar a optimizar (ej. un endpoint que ya
 * devuelva la Empresa con su Suscripción activa incluida).
 *
 * `cambiarPlan`/`cambiarEstado` son la pantalla nueva de Suscripciones
 * del sidebar de staff (PIVOTE_SAAS_MULTITENANT.md §8, §7.2 upgrade/
 * downgrade manual).
 */
@Injectable({ providedIn: 'root' })
export class SuscripcionService {
  private readonly http = inject(HttpClient);

  listar(estado?: string, empresaId?: number): Observable<RespuestaPaginada<Suscripcion>> {
    let params = new HttpParams().set('pageSize', 100);
    if (estado) {
      params = params.set('estado', estado);
    }
    if (empresaId) {
      params = params.set('empresaId', empresaId);
    }
    return this.http.get<RespuestaPaginada<Suscripcion>>(`${environment.apiUrl}/suscripciones`, {
      params,
    });
  }

  /** `POST /suscripciones/cambiar-plan` — cierra la suscripción vigente
   * de esa Empresa (si la hay) y abre una nueva al plan indicado, sin
   * perder el historial (ver `Suscripcion.entity.ts` del backend). */
  cambiarPlan(empresaId: number, planId: number): Observable<Suscripcion> {
    return this.http.post<Suscripcion>(`${environment.apiUrl}/suscripciones/cambiar-plan`, {
      empresaId,
      planId,
    });
  }

  /** `PATCH /suscripciones/:id/estado`. */
  cambiarEstado(id: number, estado: EstadoAsignableSuscripcion): Observable<Suscripcion> {
    return this.http.patch<Suscripcion>(`${environment.apiUrl}/suscripciones/${id}/estado`, {
      estado,
    });
  }
}
