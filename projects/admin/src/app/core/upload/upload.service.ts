import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ArchivoSubido } from './models/archivo-subido.model';

/**
 * Cliente de `POST /upload`: guarda un archivo y devuelve su URL permanente
 * (fotos de productos, logos, comprobantes).
 *
 * @remarks
 * En el modo documento del asistente la factura se manda dos veces: primero
 * a la extracción (en memoria, no se guarda) y acá solo si el usuario
 * confirma.
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
