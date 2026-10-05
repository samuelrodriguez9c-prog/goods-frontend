import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MovimientosDelMes, ResumenIngresos } from './models/ingresos.model';

/** Cliente de `/ingresos` (backend `IngresosController`, 2026-10-04). */
@Injectable({ providedIn: 'root' })
export class IngresosService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/ingresos`;

  resumen(meses: number): Observable<ResumenIngresos> {
    return this.http.get<ResumenIngresos>(`${this.base}/resumen`, { params: new HttpParams().set('meses', meses) });
  }

  movimientos(mes: string): Observable<MovimientosDelMes> {
    return this.http.get<MovimientosDelMes>(`${this.base}/movimientos`, { params: new HttpParams().set('mes', mes) });
  }

  exportar(meses: number): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.base}/exportar`, {
      params: new HttpParams().set('meses', meses),
      responseType: 'blob',
      observe: 'response',
    });
  }
}

const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

/** `2026-10` → `octubre 2026` (o `oct 26` en corto). */
export function nombreMes(clave: string, corto = false): string {
  const [anio, mes] = clave.split('-').map(Number);
  return corto ? `${MESES_CORTOS[mes - 1]} ${String(anio).slice(2)}` : `${MESES_LARGOS[mes - 1]} ${anio}`;
}

/** `$1,2 M` / `$860 mil` / `$900` — para ejes y textos compactos. */
export function montoCompacto(monto: number): string {
  const abs = Math.abs(monto);
  const signo = monto < 0 ? '−' : '';
  if (abs >= 1_000_000) return `${signo}$${(abs / 1_000_000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M`;
  if (abs >= 1_000) return `${signo}$${Math.round(abs / 1_000).toLocaleString('es-CO')} mil`;
  return `${signo}$${Math.round(abs).toLocaleString('es-CO')}`;
}
