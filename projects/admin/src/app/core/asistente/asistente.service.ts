import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AsistenteConversacion,
  AsistenteMensaje,
  FacturaProveedorExtraida,
} from './models/asistente.model';

/**
 * Cliente de `AsistenteController` (conversaciones, mensajes y lectura de
 * facturas de proveedor).
 *
 * @remarks
 * Todo exige el módulo `asistente_ia`: sin él, el backend responde 403. Acá
 * no se repite ese chequeo; el topbar oculta el ícono para no ofrecer un
 * botón que siempre falla.
 *
 * `abierto` vive acá porque el mini chat lo abre el topbar y lo pinta
 * `AsistenteDockComponent`, que no tienen relación padre e hijo.
 */
@Injectable({ providedIn: 'root' })
export class AsistenteService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/asistente`;

  readonly abierto = signal(false);

  abrirPanel(): void {
    this.abierto.set(true);
  }

  cerrarPanel(): void {
    this.abierto.set(false);
  }

  crearConversacion(titulo?: string): Observable<AsistenteConversacion> {
    return this.http.post<AsistenteConversacion>(`${this.base}/conversaciones`, {
      titulo,
    });
  }

  listarConversaciones(): Observable<AsistenteConversacion[]> {
    return this.http.get<AsistenteConversacion[]>(`${this.base}/conversaciones`);
  }

  listarMensajes(conversacionId: number): Observable<AsistenteMensaje[]> {
    return this.http.get<AsistenteMensaje[]>(
      `${this.base}/conversaciones/${conversacionId}/mensajes`,
    );
  }

  /**
   * Envía un mensaje del usuario al asistente.
   *
   * @returns Solo la respuesta final del asistente; el mensaje del usuario
   * ya quedó guardado en el servidor y no vuelve en la respuesta.
   */
  enviarMensaje(conversacionId: number, cuerpo: string): Observable<AsistenteMensaje> {
    return this.http.post<AsistenteMensaje>(
      `${this.base}/conversaciones/${conversacionId}/mensajes`,
      { cuerpo },
    );
  }

  /**
   * Guarda un mensaje de rol `asistente` sin pasar por el modelo. Lo usa el
   * modo documento para dejar en el hilo la confirmación de una compra
   * registrada.
   */
  registrarMensajeSistema(conversacionId: number, cuerpo: string): Observable<AsistenteMensaje> {
    return this.http.post<AsistenteMensaje>(
      `${this.base}/conversaciones/${conversacionId}/mensajes-sistema`,
      { cuerpo },
    );
  }

  renombrarConversacion(id: number, titulo: string): Observable<AsistenteConversacion> {
    return this.http.patch<AsistenteConversacion>(`${this.base}/conversaciones/${id}`, { titulo });
  }

  eliminarConversacion(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/conversaciones/${id}`);
  }

  /**
   * Sube una factura (imagen o PDF) y devuelve lo que leyó el modelo, cruzado
   * con el catálogo. No guarda nada: la compra se crea cuando el usuario
   * confirma.
   *
   * @remarks
   * No se fija `Content-Type`: `HttpClient` arma el boundary del `FormData`;
   * fijarlo a mano rompe el parseo en el backend.
   */
  extraerFacturaProveedor(archivo: File): Observable<FacturaProveedorExtraida> {
    const formData = new FormData();
    formData.append('file', archivo);
    return this.http.post<FacturaProveedorExtraida>(
      `${this.base}/facturas-proveedor/extraer`,
      formData,
    );
  }
}
