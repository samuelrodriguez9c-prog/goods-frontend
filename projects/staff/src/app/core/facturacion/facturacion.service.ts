import { HttpClient, HttpErrorResponse, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  EstadoCuenta,
  FiltroPagos,
  ListadoPagos,
  MonedaPago,
  PagoDetalle,
  PagoRegistrado,
  RegistrarPagoPayload,
  ResumenFacturacion,
} from './models/facturacion.model';

/** Cliente de `/facturacion` (backend `FacturacionController`, 2026-10-02). */
@Injectable({ providedIn: 'root' })
export class FacturacionService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/facturacion`;

  listar(filtro: FiltroPagos = {}): Observable<ListadoPagos> {
    return this.http.get<ListadoPagos>(`${this.base}/pagos`, { params: aParams(filtro) });
  }

  /** CSV de todos los pagos del filtro (sin paginar). */
  exportar(filtro: FiltroPagos = {}): Observable<HttpResponse<Blob>> {
    const { page: _p, pageSize: _s, ...resto } = filtro;
    return this.http.get(`${this.base}/pagos/exportar`, {
      params: aParams(resto),
      responseType: 'blob',
      observe: 'response',
    });
  }

  obtener(id: number): Observable<PagoDetalle> {
    return this.http.get<PagoDetalle>(`${this.base}/pagos/${id}`);
  }

  resumen(): Observable<ResumenFacturacion> {
    return this.http.get<ResumenFacturacion>(`${this.base}/resumen`);
  }

  estadoCuenta(empresaId: number): Observable<EstadoCuenta> {
    return this.http.get<EstadoCuenta>(`${this.base}/empresas/${empresaId}/estado-cuenta`);
  }

  registrar(payload: RegistrarPagoPayload): Observable<PagoRegistrado> {
    return this.http.post<PagoRegistrado>(`${this.base}/pagos`, payload);
  }

  crearCargo(empresaId: number, concepto: string, monto: number): Observable<EstadoCuenta> {
    return this.http.post<EstadoCuenta>(`${this.base}/empresas/${empresaId}/cargos`, { concepto, monto });
  }

  darDeBajaCargo(cargoId: number, motivo: string): Observable<EstadoCuenta> {
    return this.http.post<EstadoCuenta>(`${this.base}/cargos/${cargoId}/baja`, { motivo });
  }

  anular(id: number, motivo: string): Observable<PagoDetalle> {
    return this.http.post<PagoDetalle>(`${this.base}/pagos/${id}/anular`, { motivo });
  }
}

function aParams(filtro: object): HttpParams {
  let params = new HttpParams();
  for (const [clave, valor] of Object.entries(filtro)) {
    if (valor !== undefined && valor !== null && valor !== '') params = params.set(clave, String(valor));
  }
  return params;
}

// ── Formato compartido por las pantallas de Facturación ──────────────────

/** `$80.000` (COP, sin decimales) / `US$25.00` (USD). */
export function formatMonto(monto: number, moneda: MonedaPago = 'COP'): string {
  return moneda === 'USD'
    ? `US$${monto.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${Math.round(monto).toLocaleString('es-CO')}`;
}

// A mano y no con `toLocaleDateString('es-CO')`: esa da "1 de oct de 2026",
// demasiado largo para las celdas del panel.
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
const diaMes = (f: Date) => `${f.getDate()} ${MESES[f.getMonth()]}`;

/** `12 oct 2026`. */
export function formatFecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  const f = new Date(iso);
  return `${diaMes(f)} ${f.getFullYear()}`;
}

/** `12 oct – 12 nov 2026` (el año del inicio solo si cambia). */
export function formatPeriodo(desde: string | null, hasta: string | null): string {
  if (!desde || !hasta) return 'Período sin registrar';
  const d = new Date(desde);
  const h = new Date(hasta);
  const inicio = d.getFullYear() !== h.getFullYear() ? `${diaMes(d)} ${d.getFullYear()}` : diaMes(d);
  return `${inicio} – ${diaMes(h)} ${h.getFullYear()}`;
}

/** Abreviatura del mes (`oct`) — la fecha grande de cada fila del listado. */
export function mesCorto(iso: string): string {
  return MESES[new Date(iso).getMonth()];
}

/** YYYY-MM-DD en hora local (para los filtros `desde`/`hasta`). */
export function fechaIso(fecha: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())}`;
}

/** Mensaje legible de un error del backend (409/400/404 traen `message`). */
export function mensajeDeError(err: unknown, porDefecto = 'No se pudo completar la operación. Intenta de nuevo.'): string {
  if (err instanceof HttpErrorResponse) {
    const m = (err.error as { message?: string | string[] } | null)?.message;
    if (m) return Array.isArray(m) ? m.join(' ') : m;
  }
  return porDefecto;
}
