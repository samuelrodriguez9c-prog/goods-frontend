import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Empresa, EmpresaConDueno, EstadoEmpresa, RespuestaPaginada } from './models/empresa.model';

/** Campos editables desde el panel de detalle en cualquier estado (§3.2 /
 * `UpdateEmpresaDto` del backend) — a propósito sin `nombre`, ver
 * `corregirNombre`. */
export interface DatosEditablesEmpresa {
  rubro?: string;
  correoContacto?: string;
  telefonoContacto?: string;
}

/** Filtros de `GET /empresas` que soporta `ListarEmpresasQueryDto` del
 * backend (§3.1/§11 Paso 2) — mismo patrón que `FiltroAuditoria` de
 * `AuditoriaService`. El filtro de plan de §3.1 NO está acá a propósito:
 * el backend todavía no lo resuelve en servidor (ver el comentario en
 * `ListarEmpresasQueryDto`), así que `EmpresasPageComponent` lo aplica en
 * memoria sobre `filas()` en vez de mandarlo como query param. */
export interface FiltroEmpresa {
  estado?: EstadoEmpresa;
  buscar?: string;
  desde?: string;
  hasta?: string;
}

/**
 * `GET /empresas` y el resto de los endpoints del asistente de alta
 * asistida (PROPUESTA_FLUJO_ALTA_ASISTIDA.md §5/§10/§11) — todos exigen
 * permisos (`empresas.ver`/`empresas.gestionar_alta`/`empresas.rechazar`,
 * `empresas.editar`) que solo tiene el rol `staff_goods` (ver
 * PIVOTE_SAAS_MULTITENANT.md §8 paso 4, "Hallazgo de seguridad corregido
 * en el camino"), así que este servicio solo tiene sentido acá, en
 * `staff` — `admin` ni siquiera podría llamarlo (403).
 */
@Injectable({ providedIn: 'root' })
export class EmpresaService {
  private readonly http = inject(HttpClient);

  /** `pageSize=100` (el máximo que acepta `PaginationQueryDto`, ver el
   * backend) en vez de paginar de verdad — primera pasada de esta
   * pantalla (PIVOTE_SAAS_MULTITENANT.md §8 paso 5): agregar controles de
   * paginación reales queda para cuando la cantidad de Empresas lo
   * justifique.
   *
   * `filtro` cubre los filtros de servidor de §3.1/§11 Paso 2 (ver
   * `FiltroEmpresa`) — sigue aceptando pasar solo el estado como antes
   * (`listar('pendiente')`), porque `estado` es el único campo de
   * `FiltroEmpresa`. */
  listar(filtro: EstadoEmpresa | FiltroEmpresa = {}): Observable<RespuestaPaginada<Empresa>> {
    const f: FiltroEmpresa = typeof filtro === 'string' ? { estado: filtro } : filtro;
    let params = new HttpParams().set('pageSize', 100);
    if (f.estado) {
      params = params.set('estado', f.estado);
    }
    if (f.buscar) {
      params = params.set('buscar', f.buscar);
    }
    if (f.desde) {
      params = params.set('desde', f.desde);
    }
    if (f.hasta) {
      params = params.set('hasta', f.hasta);
    }
    return this.http.get<RespuestaPaginada<Empresa>>(`${environment.apiUrl}/empresas`, {
      params,
    });
  }

  /** `GET /empresas/:id` — a diferencia de `listar()`, esta sí trae
   * `duenoUsuario` (ver `EmpresaConDueno`), para el panel de detalle
   * (§3.2) y el asistente de activación (§4). */
  obtenerUno(id: number): Observable<EmpresaConDueno> {
    return this.http.get<EmpresaConDueno>(`${environment.apiUrl}/empresas/${id}`);
  }

  /** Legado — activa la Empresa de un tirón (crea el Usuario dueño y
   * dispara el correo, todo en un solo paso). El backend lo mantiene
   * intacto a propósito como código de vuelta (ver §10 Paso 3 punto 8 de
   * la propuesta), pero el asistente nuevo de §4/§11 no lo llama más: usa
   * `llamadaFinalizada` en su lugar, que es el mismo efecto repartido en
   * los pasos del asistente. */
  activar(id: number): Observable<Empresa> {
    return this.http.patch<Empresa>(`${environment.apiUrl}/empresas/${id}/activar`, {});
  }

  /** `solicitud_recibida` → `pendiente` (botón "Mandar a Altas
   * pendientes" del panel de detalle, §11 Paso 3). */
  enviarAAltasPendientes(id: number): Observable<Empresa> {
    return this.http.post<Empresa>(
      `${environment.apiUrl}/empresas/${id}/enviar-a-altas-pendientes`,
      {},
    );
  }

  /** Rubro/correo/teléfono — editable en cualquier estado desde el panel
   * de detalle (§3.2), a propósito sin `nombre` (ver `corregirNombre`). */
  actualizar(id: number, datos: DatosEditablesEmpresa): Observable<Empresa> {
    return this.http.patch<Empresa>(`${environment.apiUrl}/empresas/${id}`, datos);
  }

  /** Solo desde el paso 1 del asistente de activación, y solo mientras la
   * Empresa no está `activa` (el backend devuelve 409 si ya lo está, ver
   * `CorregirNombreEmpresaDto`). */
  corregirNombre(id: number, nombre: string): Observable<Empresa> {
    return this.http.patch<Empresa>(`${environment.apiUrl}/empresas/${id}/nombre`, { nombre });
  }

  /** Botón "Programar llamada" — `fechaHora` en formato ISO, tal como lo
   * da `<input type="datetime-local">` + `new Date(...).toISOString()`. */
  programarLlamada(id: number, fechaHora: string): Observable<Empresa> {
    return this.http.patch<Empresa>(`${environment.apiUrl}/empresas/${id}/programar-llamada`, {
      fechaHora,
    });
  }

  /** El paso central del asistente (§4 paso 1 → paso 2): crea el Usuario
   * dueño sin contraseña, pasa a `informacion_corroborada` y manda el
   * enlace de confirmación — todo en esta única llamada. */
  llamadaFinalizada(id: number): Observable<Empresa> {
    return this.http.patch<Empresa>(`${environment.apiUrl}/empresas/${id}/llamada-finalizada`, {});
  }

  /** Botón "Reenviar enlace" del paso 2 del asistente — mismo mecanismo,
   * token nuevo, no duplica el Usuario ya creado. */
  reenviarEnlace(id: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${environment.apiUrl}/empresas/${id}/reenviar-enlace`,
      {},
    );
  }

  /** `motivo` es obligatorio del lado del backend (`RechazarEmpresaDto`). */
  rechazar(id: number, motivo: string): Observable<Empresa> {
    return this.http.patch<Empresa>(`${environment.apiUrl}/empresas/${id}/rechazar`, { motivo });
  }
}
