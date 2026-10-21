import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Empresa, EmpresaConDueno, EstadoEmpresa, RespuestaPaginada } from './models/empresa.model';

/** Estado de la conexión de WhatsApp de una Empresa. */
export interface ConexionWhatsapp {
  cuenta: {
    numero: string;
    nombreVisible: string | null;
    estado: 'conectada' | 'desconectada' | 'error';
    calidad: string | null;
    modo: 'registro_integrado' | 'manual';
    conectadaEn: string;
    ultimoError: string | null;
  } | null;
  /** Cuánto usa el asistente de IA (lo paga Goods) y las campañas; solo conteos. */
  uso: {
    asistenteActivo: boolean;
    respuestasIa24h: number;
    respuestasIa30d: number;
    limiteDiario: number;
    campanas30d: number;
    mensajesCampana30d: number;
  };
}

/** Decisión de staff sobre un módulo al finalizar la llamada de alta (sin
 * `motivo`: no hace falta justificar cada línea). */
export interface ModuloFinalPayload {
  moduloId: number;
  tipo: 'concedido' | 'revocado';
}

/** Campos editables en cualquier estado; sin `nombre` a propósito (ver `corregirNombre`). */
export interface DatosEditablesEmpresa {
  rubro?: string;
  correoContacto?: string;
  telefonoContacto?: string;
}

/** Filtros de servidor de `GET /empresas`. El de plan no está porque el
 * backend no lo resuelve: `EmpresasPageComponent` lo aplica en memoria. */
export interface FiltroEmpresa {
  estado?: EstadoEmpresa;
  buscar?: string;
  desde?: string;
  hasta?: string;
  /** Página (de a 100); ver `traerTodo` para traerlas todas. */
  page?: number;
}

/** Un renglón del historial de la Empresa. */
export interface ActividadEmpresa {
  fecha: string;
  tipo: 'alta' | 'estado' | 'cobro' | 'modulo' | 'solicitud' | 'datos';
  texto: string;
  quien: string | null;
}

/**
 * Empresas y el flujo de alta asistida. Todos los endpoints exigen permisos
 * `empresas.*` de staff: desde `admin` responderían 403.
 */
@Injectable({ providedIn: 'root' })
export class EmpresaService {
  private readonly http = inject(HttpClient);

  /**
   * Una página de 100 Empresas (el máximo del backend); para todas, usa `traerTodo`.
   *
   * @param filtro - Filtros de servidor, o solo el estado como atajo (`listar('pendiente')`).
   */
  listar(filtro: EstadoEmpresa | FiltroEmpresa = {}): Observable<RespuestaPaginada<Empresa>> {
    const f: FiltroEmpresa = typeof filtro === 'string' ? { estado: filtro } : filtro;
    let params = new HttpParams().set('pageSize', 100).set('page', f.page ?? 1);
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

  /** A diferencia de `listar()`, trae `duenoUsuario`. */
  obtenerUno(id: number): Observable<EmpresaConDueno> {
    return this.http.get<EmpresaConDueno>(`${environment.apiUrl}/empresas/${id}`);
  }

  actividad(id: number): Observable<ActividadEmpresa[]> {
    return this.http.get<ActividadEmpresa[]>(`${environment.apiUrl}/empresas/${id}/actividad`);
  }

  /** Si el número de WhatsApp está conectado y cuánto se usa; nunca trae los chats. */
  whatsapp(id: number): Observable<ConexionWhatsapp> {
    return this.http.get<ConexionWhatsapp>(`${environment.apiUrl}/whatsapp/empresas/${id}/conexion`);
  }

  /**
   * Activa la Empresa en un solo paso: crea el usuario dueño y le manda el correo.
   * @deprecated Usa `llamadaFinalizada`; el asistente de activación ya no llama a este.
   */
  activar(id: number): Observable<Empresa> {
    return this.http.patch<Empresa>(`${environment.apiUrl}/empresas/${id}/activar`, {});
  }

  /** `solicitud_recibida` → `pendiente`. */
  enviarAAltasPendientes(id: number): Observable<Empresa> {
    return this.http.post<Empresa>(
      `${environment.apiUrl}/empresas/${id}/enviar-a-altas-pendientes`,
      {},
    );
  }

  actualizar(id: number, datos: DatosEditablesEmpresa): Observable<Empresa> {
    return this.http.patch<Empresa>(`${environment.apiUrl}/empresas/${id}`, datos);
  }

  /** Corrige el nombre durante el alta. Responde 409 si la Empresa ya está `activa`. */
  corregirNombre(id: number, nombre: string): Observable<Empresa> {
    return this.http.patch<Empresa>(`${environment.apiUrl}/empresas/${id}/nombre`, { nombre });
  }

  /** @param fechaHora - ISO completo (`new Date(valorDelInput).toISOString()`), no el valor crudo de `datetime-local`. */
  programarLlamada(id: number, fechaHora: string): Observable<Empresa> {
    return this.http.patch<Empresa>(`${environment.apiUrl}/empresas/${id}/programar-llamada`, {
      fechaHora,
    });
  }

  /**
   * Cierra la llamada de alta: crea el usuario dueño sin contraseña, pasa la
   * Empresa a `informacion_corroborada` y le manda el enlace de confirmación.
   *
   * @param modulosFinales - Excepciones de módulo que se crean en la misma llamada.
   * @param diasPrueba - Días de prueba acordados; sin él, se usan los del plan.
   */
  llamadaFinalizada(id: number, modulosFinales?: ModuloFinalPayload[], diasPrueba?: number): Observable<Empresa> {
    return this.http.patch<Empresa>(`${environment.apiUrl}/empresas/${id}/llamada-finalizada`, {
      modulosFinales,
      ...(diasPrueba !== undefined ? { diasPrueba } : {}),
    });
  }

  /** Reenvía el enlace de confirmación con un token nuevo, sin duplicar el usuario. */
  reenviarEnlace(id: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${environment.apiUrl}/empresas/${id}/reenviar-enlace`,
      {},
    );
  }

  /** @param motivo - Obligatorio para el backend. */
  rechazar(id: number, motivo: string): Observable<Empresa> {
    return this.http.patch<Empresa>(`${environment.apiUrl}/empresas/${id}/rechazar`, { motivo });
  }

  // Ciclo de vida de una Empresa activa (permiso `empresas.cambiar_estado`).

  /** `activa` → `suspendida` (la suscripción no se toca). */
  suspender(id: number, motivo: string): Observable<Empresa> {
    return this.http.patch<Empresa>(`${environment.apiUrl}/empresas/${id}/suspender`, { motivo });
  }

  /** `activa`/`suspendida` → `cancelada`; también cancela la suscripción. */
  darDeBaja(id: number, motivo: string): Observable<Empresa> {
    return this.http.patch<Empresa>(`${environment.apiUrl}/empresas/${id}/dar-de-baja`, { motivo });
  }

  /** Vuelve a `activa`. Desde `cancelada` exige `planId` (abre una suscripción nueva). */
  reactivar(id: number, datos: { motivo?: string; planId?: number }): Observable<Empresa> {
    return this.http.patch<Empresa>(`${environment.apiUrl}/empresas/${id}/reactivar`, datos);
  }
}
