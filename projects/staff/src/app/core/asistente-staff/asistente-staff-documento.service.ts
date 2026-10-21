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

/**
 * Documentos internos que el Asistente de IA consulta. Es CRUD plano: el
 * backend trocea y genera los embeddings del `contenido` solo.
 */
@Injectable({ providedIn: 'root' })
export class AsistenteStaffDocumentoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/asistente-staff/documentos`;

  /** Hoy trae también `contenido`, pero no hay que contar con eso: el backend podría recortarlo. */
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

  /** Sube un PDF o .docx y devuelve su texto plano (sin IA), para precargar el
   * formulario; no guarda nada. Los .md y .txt se leen en el navegador. */
  extraerTexto(archivo: File): Observable<{ contenido: string }> {
    const formData = new FormData();
    formData.append('file', archivo, archivo.name);
    return this.http.post<{ contenido: string }>(`${this.base}/extraer-texto`, formData);
  }
}
