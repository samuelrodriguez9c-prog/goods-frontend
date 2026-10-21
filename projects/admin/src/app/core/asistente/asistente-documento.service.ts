import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AsistenteDocumento } from './models/asistente.model';

export interface CrearDocumentoDto {
  titulo: string;
  contenido: string;
}

export type ActualizarDocumentoDto = Partial<CrearDocumentoDto>;

/**
 * Cliente de `/asistente/documentos`: políticas y manuales de la Empresa que
 * el asistente busca por similitud. El backend trocea y genera los embeddings
 * al guardar; acá es CRUD plano.
 */
@Injectable({ providedIn: 'root' })
export class AsistenteDocumentoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/asistente/documentos`;

  listar(): Observable<AsistenteDocumento[]> {
    return this.http.get<AsistenteDocumento[]>(this.base);
  }

  obtener(id: number): Observable<AsistenteDocumento> {
    return this.http.get<AsistenteDocumento>(`${this.base}/${id}`);
  }

  crear(dto: CrearDocumentoDto): Observable<AsistenteDocumento> {
    return this.http.post<AsistenteDocumento>(this.base, dto);
  }

  actualizar(id: number, dto: ActualizarDocumentoDto): Observable<AsistenteDocumento> {
    return this.http.patch<AsistenteDocumento>(`${this.base}/${id}`, dto);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  /**
   * Sube un PDF o .docx y devuelve su texto plano, sin IA. Solo sirve para
   * precargar el formulario: no guarda nada. Los .md/.txt se leen en el
   * navegador.
   */
  extraerTexto(archivo: File): Observable<{ contenido: string }> {
    const formData = new FormData();
    formData.append('file', archivo, archivo.name);
    return this.http.post<{ contenido: string }>(`${this.base}/extraer-texto`, formData);
  }
}
