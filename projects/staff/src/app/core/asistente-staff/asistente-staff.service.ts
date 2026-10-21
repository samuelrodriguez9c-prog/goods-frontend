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
 * Cliente de `/asistente-staff` (conversaciones con el Asistente de IA y
 * extracción de comprobantes). El backend exige el permiso
 * `asistente_staff.usar`; acá no se repite el chequeo.
 */
@Injectable({ providedIn: 'root' })
export class AsistenteStaffService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/asistente-staff`;

  /** Mini chat abierto. Vive acá porque lo abre el topbar y lo pinta el
   * shell, que no son padre e hijo. */
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

  /** @returns Solo la respuesta final del asistente (sin streaming), no el mensaje del usuario. */
  enviarMensaje(conversacionId: number, cuerpo: string): Observable<AsistenteStaffMensaje> {
    return this.http.post<AsistenteStaffMensaje>(
      `${this.base}/conversaciones/${conversacionId}/mensajes`,
      { cuerpo },
    );
  }

  /** Guarda en la conversación un mensaje fijo del asistente (p. ej. la
   * confirmación de un pago registrado) sin pasar por el modelo. */
  registrarMensajeSistema(
    conversacionId: number,
    cuerpo: string,
  ): Observable<AsistenteStaffMensaje> {
    return this.http.post<AsistenteStaffMensaje>(
      `${this.base}/conversaciones/${conversacionId}/mensajes-sistema`,
      { cuerpo },
    );
  }

  /**
   * Sube un comprobante de pago (imagen o PDF) y devuelve lo que detectó el
   * modelo, sin guardar nada: el pago se registra aparte, al confirmar.
   */
  extraerComprobantePago(archivo: File): Observable<ComprobantePagoExtraido> {
    // Sin `Content-Type` a mano: `HttpClient` arma el boundary a partir del `FormData`.
    const formData = new FormData();
    formData.append('file', archivo);
    return this.http.post<ComprobantePagoExtraido>(
      `${this.base}/comprobantes-pago/extraer`,
      formData,
    );
  }

  renombrarConversacion(id: number, titulo: string): Observable<AsistenteStaffConversacion> {
    return this.http.patch<AsistenteStaffConversacion>(`${this.base}/conversaciones/${id}`, { titulo });
  }

  eliminarConversacion(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/conversaciones/${id}`);
  }
}
