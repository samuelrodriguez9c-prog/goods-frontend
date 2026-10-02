import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AsistenteStaffConversacion,
  AsistenteStaffMensaje,
  ComprobantePagoExtraido,
} from './models/asistente-staff.model';

/**
 * Cliente de los 4 endpoints de `AsistenteStaffController` (backend,
 * `modules/asistente-staff/`) — ver PROPUESTA_ASISTENTE_IA_RAG.md §5.4.
 * Calcado de `admin/core/asistente/asistente.service.ts`, con dos
 * diferencias: pega contra `/asistente-staff` (no `/asistente`), y el
 * gating del lado del backend es por PERMISO (`asistente_staff.usar`,
 * `PermissionsGuard`) en vez de por módulo de plan (`ModuloGuard`) — acá
 * tampoco se duplica ese chequeo, solo se oculta el ícono del topbar
 * (ver `TopbarComponent`) si la cuenta no tiene ese permiso.
 *
 * `abierto` (signal): mismo motivo que en `admin` — quien ABRE el panel
 * es `TopbarComponent` y quien lo RENDERIZA es `ShellComponent`. Desde el
 * rediseño (2026-09-30) significa "mini chat abierto"
 * (`AsistenteDockComponent`, antes `AsistenteStaffPanelComponent`), dos
 * hermanos sin relación padre/hijo directa.
 */
@Injectable({ providedIn: 'root' })
export class AsistenteStaffService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/asistente-staff`;

  readonly abierto = signal(false);

  abrirPanel(): void {
    this.abierto.set(true);
  }

  cerrarPanel(): void {
    this.abierto.set(false);
  }

  crearConversacion(titulo?: string): Observable<AsistenteStaffConversacion> {
    return this.http.post<AsistenteStaffConversacion>(`${this.base}/conversaciones`, {
      titulo,
    });
  }

  listarConversaciones(): Observable<AsistenteStaffConversacion[]> {
    return this.http.get<AsistenteStaffConversacion[]>(`${this.base}/conversaciones`);
  }

  listarMensajes(conversacionId: number): Observable<AsistenteStaffMensaje[]> {
    return this.http.get<AsistenteStaffMensaje[]>(
      `${this.base}/conversaciones/${conversacionId}/mensajes`,
    );
  }

  /** El backend devuelve únicamente el mensaje FINAL del asistente — mismo
   * criterio que `admin`: `AsistenteStaffPanelComponent` refresca con
   * `listarMensajes` después de esto en vez de reconstruir a mano el
   * mensaje del usuario. */
  enviarMensaje(conversacionId: number, cuerpo: string): Observable<AsistenteStaffMensaje> {
    return this.http.post<AsistenteStaffMensaje>(
      `${this.base}/conversaciones/${conversacionId}/mensajes`,
      { cuerpo },
    );
  }

  /** §5.5.6 (2026-09-30) — espejo de `AsistenteService.registrarMensajeSistema`
   * de `admin` (ver su docblock): confirma un `SuscripcionPago` registrado
   * desde el modo documento sin pasar por OpenRouter. */
  registrarMensajeSistema(
    conversacionId: number,
    cuerpo: string,
  ): Observable<AsistenteStaffMensaje> {
    return this.http.post<AsistenteStaffMensaje>(
      `${this.base}/conversaciones/${conversacionId}/mensajes-sistema`,
      { cuerpo },
    );
  }

  /** §5.5 — modo documento: sube el comprobante de pago (imagen o PDF) y
   * devuelve lo que el modelo detectó, sin persistir nada todavía (ver
   * `ExtraccionComprobantePagoService`, backend: el archivo viaja en
   * memoria, se descarta si nunca se confirma). Mismo criterio que
   * `AsistenteService.extraerFacturaProveedor` de `admin`: nunca se fija
   * el header `Content-Type` a mano, `HttpClient` arma el boundary solo
   * a partir del `FormData`. */
  extraerComprobantePago(archivo: File): Observable<ComprobantePagoExtraido> {
    const formData = new FormData();
    formData.append('file', archivo);
    return this.http.post<ComprobantePagoExtraido>(
      `${this.base}/comprobantes-pago/extraer`,
      formData,
    );
  }

  /** Rediseño (2026-09-30), `PATCH /asistente-staff/conversaciones/:id` —
   * endpoint PENDIENTE en el backend (`modules/asistente-staff/`). Hasta
   * que exista, `AsistenteChatStore.renombrar` revierte el cambio
   * optimista si esta llamada falla. */
  renombrarConversacion(id: number, titulo: string): Observable<AsistenteStaffConversacion> {
    return this.http.patch<AsistenteStaffConversacion>(`${this.base}/conversaciones/${id}`, { titulo });
  }

  /** Rediseño (2026-09-30), `DELETE /asistente-staff/conversaciones/:id` —
   * mismo criterio que `renombrarConversacion`: endpoint pendiente, el
   * store revierte si falla. */
  eliminarConversacion(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/conversaciones/${id}`);
  }
}
