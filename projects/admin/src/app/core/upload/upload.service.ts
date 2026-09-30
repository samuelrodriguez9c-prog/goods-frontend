import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ArchivoSubido } from './models/archivo-subido.model';

/**
 * Cliente del endpoint genérico `POST /upload` (backend,
 * `UploadController`) — primera vez que `admin` lo necesita desde el
 * frontend. Se usa desde el modo documento del Asistente de IA (§5.5 de
 * `PROPUESTA_ASISTENTE_IA_RAG.md`) para persistir el PDF/imagen original
 * de la factura recién al confirmar (nunca durante la extracción en sí
 * — ver el docblock de `ExtraccionFacturaProveedorService`, backend:
 * el archivo se manda dos veces al servidor, primero en memoria para
 * `POST /asistente/facturas-proveedor/extraer`, y solo si el usuario
 * confirma se vuelve a mandar acá para que quede guardado en disco con
 * una URL permanente).
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
