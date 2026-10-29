import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AsistenteAccion } from './models/asistente.model';

/**
 * «Confirmar» y «Descartar» de lo que propone el asistente. El backend vuelve
 * a revisar el permiso de la acción y no la ejecuta dos veces: un segundo
 * «Confirmar» devuelve la acción ya hecha.
 */
@Injectable({ providedIn: 'root' })
export class AsistenteAccionesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/asistente/acciones`;

  confirmar(id: number): Observable<AsistenteAccion> {
    return this.http.post<AsistenteAccion>(`${this.base}/${id}/confirmar`, {});
  }

  descartar(id: number): Observable<AsistenteAccion> {
    return this.http.post<AsistenteAccion>(`${this.base}/${id}/descartar`, {});
  }
}
