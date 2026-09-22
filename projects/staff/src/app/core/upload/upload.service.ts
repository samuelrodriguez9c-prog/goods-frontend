import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ArchivoSubido {
  url: string;
}

/**
 * `POST /upload` — subida genérica autenticada del backend
 * (`UploadController`): cualquier cuenta logueada puede subir un archivo y
 * recibir su URL de vuelta; asociar esa URL a algo puntual (acá,
 * `Usuario.imagenPerfil` vía `UsuarioService.actualizar`) es un paso
 * aparte, este servicio no sabe ni le importa para qué se va a usar.
 *
 * Vive en `core/upload/` (no en `core/usuarios/` ni en `features/settings/`)
 * porque el endpoint es genérico — el primer consumidor es la foto de
 * perfil de Settings, pero cualquier feature futura que necesite subir un
 * archivo reusa este mismo servicio en vez de otro POST a mano.
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
