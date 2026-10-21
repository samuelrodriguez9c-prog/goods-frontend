import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ArchivoSubido {
  url: string;
}

/**
 * Subida genérica de archivos (`POST /upload`): devuelve la URL. Asociarla a
 * algo (p. ej. la foto de perfil) es un paso aparte de quien llama.
 */
@Injectable({ providedIn: 'root' })
export class UploadService {
  private readonly http = inject(HttpClient);

  subir(archivo: File): Observable<ArchivoSubido> {
    const formData = new FormData();
    formData.append('file', archivo);
    return this.http.post<ArchivoSubido>(`${environment.apiUrl}/upload`, formData);
  }
}
