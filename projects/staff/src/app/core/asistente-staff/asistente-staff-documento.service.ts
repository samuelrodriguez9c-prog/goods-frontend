// projects/staff/src/app/core/asistente-staff/asistente-staff-documento.service.ts
//
// Cliente de `POST/GET/PATCH/DELETE /asistente-staff/documentos` (backend,
// `modules/asistente-staff/documentos/asistente-staff-documento.service.ts`)
// — Fase 6 (§5.6.4 de PROPUESTA_ASISTENTE_IA_RAG.md). Hasta el 2026-10-02
// esto se cargaba a mano por Postman/Thunder Client porque no existía
// ninguna pantalla — `DocumentosInternosPageComponent` es esa pantalla,
// este es el servicio que consume.
//
// El backend trocea y embebe el `contenido` solo (ver `trocearTexto` y
// `AsistenteStaffEmbeddingService` del lado del servidor) — este service
// no hace nada con eso, solo CRUD plano sobre la fila del documento.
//
// `extraerTexto` (§5.6.5, 2026-10-02): cliente de
// `POST /asistente-staff/documentos/extraer-texto` — sube un PDF/.docx y
// devuelve su texto plano, SIN IA (ver el docblock del endpoint,
// backend). Los .md/.txt NO pasan por acá: `DocumentosInternosPageComponent`
// los lee directo en el navegador con `FileReader`.
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AsistenteStaffDocumento } from './models/asistente-staff.model';

export interface CrearDocumentoStaffDto {
  titulo: string;
  contenido: string;
}

export type ActualizarDocumentoStaffDto = Partial<CrearDocumentoStaffDto>;

@Injectable({ providedIn: 'root' })
export class AsistenteStaffDocumentoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/asistente-staff/documentos`;

  /** El backend hoy devuelve la fila completa (incluido `contenido`), no
   * solo metadata — el propio docblock del service del backend lo deja
   * anotado como simplificación pendiente. Este método no depende de eso:
   * sirve igual si el día de mañana el backend recorta la respuesta. */
  listar(): Observable<AsistenteStaffDocumento[]> {
    return this.http.get<AsistenteStaffDocumento[]>(this.base);
  }

  obtener(id: number): Observable<AsistenteStaffDocumento> {
    return this.http.get<AsistenteStaffDocumento>(`${this.base}/${id}`);
  }

  crear(dto: CrearDocumentoStaffDto): Observable<AsistenteStaffDocumento> {
    return this.http.post<AsistenteStaffDocumento>(this.base, dto);
  }

  actualizar(id: number, dto: ActualizarDocumentoStaffDto): Observable<AsistenteStaffDocumento> {
    return this.http.patch<AsistenteStaffDocumento>(`${this.base}/${id}`, dto);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  /** Sube un PDF o .docx y recibe su texto plano — solo precarga el
   * formulario, no guarda nada (eso lo sigue haciendo `crear`/`actualizar`
   * cuando el staff confirma). */
  extraerTexto(archivo: File): Observable<{ contenido: string }> {
    const formData = new FormData();
    formData.append('file', archivo, archivo.name);
    return this.http.post<{ contenido: string }>(`${this.base}/extraer-texto`, formData);
  }
}
