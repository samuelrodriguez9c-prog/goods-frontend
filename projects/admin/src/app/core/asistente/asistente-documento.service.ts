// projects/admin/src/app/core/asistente/asistente-documento.service.ts
//
// Cliente de `POST/GET/PATCH/DELETE /asistente/documentos` (backend,
// `modules/negocio/asistente/documentos/asistente-documento.service.ts`):
// políticas y manuales propios de la Empresa que el asistente busca por
// similitud. Calcado del de staff (2026-10-07). El backend trocea y embebe
// el contenido solo; acá es CRUD plano.
//
// `extraerTexto`: sube un PDF/.docx y devuelve su texto plano, sin IA. Los
// .md/.txt se leen directo en el navegador.
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

@Injectable({ providedIn: 'root' })
export class AsistenteDocumentoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/asistente/documentos`;

  /** El backend hoy devuelve la fila completa (incluido `contenido`), no
   * solo metadata — el propio docblock del service del backend lo deja
   * anotado como simplificación pendiente. Este método no depende de eso:
   * sirve igual si el día de mañana el backend recorta la respuesta. */
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

  /** Sube un PDF o .docx y recibe su texto plano — solo precarga el
   * formulario, no guarda nada (eso lo sigue haciendo `crear`/`actualizar`
   * cuando la persona confirma). */
  extraerTexto(archivo: File): Observable<{ contenido: string }> {
    const formData = new FormData();
    formData.append('file', archivo, archivo.name);
    return this.http.post<{ contenido: string }>(`${this.base}/extraer-texto`, formData);
  }
}
