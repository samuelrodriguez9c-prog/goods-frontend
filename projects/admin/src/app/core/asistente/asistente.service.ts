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
 * Cliente de los 4 endpoints de `AsistenteController` (backend,
 * `modules/asistente/`) — ver PROPUESTA_ASISTENTE_IA_RAG.md §4.5/§5.1
 * pasos 8-9. Los 4 exigen el módulo `asistente_ia` (Plan Plus): si la
 * Empresa no lo tiene, el backend responde 403 (`ModuloGuard`) — acá no
 * se duplica ese chequeo, solo se oculta/deshabilita el ícono del topbar
 * (§5.1 paso 12, ver `TopbarComponent`) para no ofrecer un botón que
 * siempre falla.
 *
 * `abierto` (signal): estado global de visibilidad del panel lateral —
 * vive acá (no en `AsistentePanelComponent`) porque quien lo ABRE es
 * `TopbarComponent` y quien lo RENDERIZA es `ShellComponent`
 * (`AsistentePanelComponent`), dos componentes hermanos sin relación
 * padre/hijo directa — un service `providedIn: 'root'` es más simple acá
 * que inventar un `@Output` que suba hasta `ShellComponent` y baje nada.
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

  /** El backend devuelve únicamente el mensaje FINAL del asistente (no el
   * del usuario que lo disparó, ya guardado del lado del servidor antes
   * de llamar a OpenRouter) — `AsistentePanelComponent` refresca con
   * `listarMensajes` después de esto en vez de tratar de reconstruir el
   * mensaje del usuario a mano acá. */
  enviarMensaje(conversacionId: number, cuerpo: string): Observable<AsistenteMensaje> {
    return this.http.post<AsistenteMensaje>(
      `${this.base}/conversaciones/${conversacionId}/mensajes`,
      { cuerpo },
    );
  }

  /** §5.5.6 (2026-09-30) — guarda una confirmación de rol 'asistente' SIN
   * pasar por OpenRouter, usada por el modo documento tras registrar una
   * Compra: sin esto, confirmar volvía al chat sin dejar ningún rastro en
   * el hilo (bug real reportado por el usuario). */
  registrarMensajeSistema(conversacionId: number, cuerpo: string): Observable<AsistenteMensaje> {
    return this.http.post<AsistenteMensaje>(
      `${this.base}/conversaciones/${conversacionId}/mensajes-sistema`,
      { cuerpo },
    );
  }

  /** §5.5 — modo documento: sube la factura (imagen o PDF) y devuelve lo
   * que el modelo detectó + el cruce contra catálogo, sin persistir nada
   * todavía (ver `ExtraccionFacturaProveedorService`, backend: el
   * archivo viaja en memoria, se descarta si el usuario nunca confirma).
   * `multipart/form-data` — nunca se fija manualmente el header
   * `Content-Type` acá: `HttpClient` arma el boundary solo a partir del
   * `FormData`, fijarlo a mano rompería el parseo en el backend. */
  /** `PATCH /asistente/conversaciones/:id` — renombrar desde el rail. */
  renombrarConversacion(id: number, titulo: string): Observable<AsistenteConversacion> {
    return this.http.patch<AsistenteConversacion>(`${this.base}/conversaciones/${id}`, { titulo });
  }

  /** `DELETE /asistente/conversaciones/:id`. */
  eliminarConversacion(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/conversaciones/${id}`);
  }

  extraerFacturaProveedor(archivo: File): Observable<FacturaProveedorExtraida> {
    const formData = new FormData();
    formData.append('file', archivo);
    return this.http.post<FacturaProveedorExtraida>(
      `${this.base}/facturas-proveedor/extraer`,
      formData,
    );
  }
}
