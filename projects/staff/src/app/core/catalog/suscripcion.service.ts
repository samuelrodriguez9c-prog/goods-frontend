import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RespuestaPaginada } from './models/empresa.model';
import {
  RegistrarPagoSuscripcionPayload,
  Suscripcion,
  SuscripcionPago,
} from './models/suscripcion.model';

/** 'pendiente' no se asigna a mano: solo lo pone el flujo de alta. */
export type EstadoAsignableSuscripcion = 'activa' | 'cancelada' | 'vencida';

/** Suscripciones de las Empresas: listado, cambio de plan y de estado, pruebas y pagos. */
@Injectable({ providedIn: 'root' })
export class SuscripcionService {
  private readonly http = inject(HttpClient);

  /**
   * Una página de 100 suscripciones.
   *
   * @remarks
   * Las pantallas traen todas las de un estado (con `traerTodo`) y las cruzan
   * en memoria por `empresaId`, en vez de pedir una por Empresa.
   * TODO(backend): si crecen mucho las Empresas, un endpoint que devuelva la
   * Empresa con su suscripción activa incluida.
   */
  listar(estado?: string, empresaId?: number, page = 1): Observable<RespuestaPaginada<Suscripcion>> {
    let params = new HttpParams().set('pageSize', 100).set('page', page);
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

  /** Cierra la suscripción vigente de la Empresa (si hay) y abre una nueva
   * con el plan indicado; la anterior queda en el historial. */
  cambiarPlan(empresaId: number, planId: number): Observable<Suscripcion> {
    return this.http.post<Suscripcion>(`${environment.apiUrl}/suscripciones/cambiar-plan`, {
      empresaId,
      planId,
    });
  }

  /** Vuelve a activar una suscripción vencida o cancelada, con el mismo plan u otro. */
  reactivar(id: number, planId: number): Observable<Suscripcion> {
    return this.http.post<Suscripcion>(`${environment.apiUrl}/suscripciones/${id}/reactivar`, { planId });
  }

  /** Suma días a una prueba en curso (hasta `DIAS_PRUEBA_MAX` en total). */
  extenderPrueba(id: number, dias: number, motivo: string): Observable<Suscripcion> {
    return this.http.post<Suscripcion>(`${environment.apiUrl}/suscripciones/${id}/extender-prueba`, { dias, motivo });
  }

  cambiarEstado(id: number, estado: EstadoAsignableSuscripcion): Observable<Suscripcion> {
    return this.http.patch<Suscripcion>(`${environment.apiUrl}/suscripciones/${id}/estado`, {
      estado,
    });
  }

  /** Registra un pago (`POST /facturacion/pagos`) y, en la misma llamada,
   * renueva la suscripción activa o vencida de la Empresa. */
  registrarPago(payload: RegistrarPagoSuscripcionPayload): Observable<SuscripcionPago> {
    return this.http.post<SuscripcionPago>(`${environment.apiUrl}/facturacion/pagos`, payload);
  }
}
