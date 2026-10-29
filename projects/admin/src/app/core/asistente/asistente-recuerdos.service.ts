import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AsistenteRecuerdo, ListaRecuerdos } from './models/asistente.model';

/**
 * Cliente de `/asistente/recuerdos`: la pantalla «Lo que el asistente
 * recuerda» y la tarjeta «¿Lo recuerdo?» del chat. Lo de la Empresa pide el
 * permiso `asistente.recuerdos` (sin él, 403); lo personal es de cada quien.
 */
@Injectable({ providedIn: 'root' })
export class AsistenteRecuerdosService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/asistente/recuerdos`;

  listar(): Observable<ListaRecuerdos> {
    return this.http.get<ListaRecuerdos>(this.base);
  }

  crear(texto: string, alcance: AsistenteRecuerdo['alcance']): Observable<AsistenteRecuerdo> {
    return this.http.post<AsistenteRecuerdo>(this.base, { texto, alcance });
  }

  editar(id: number, texto: string): Observable<AsistenteRecuerdo> {
    return this.http.patch<AsistenteRecuerdo>(`${this.base}/${id}`, { texto });
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  /** «Guardar» en la tarjeta: la propuesta pasa a recordarse. */
  guardar(id: number): Observable<AsistenteRecuerdo> {
    return this.http.post<AsistenteRecuerdo>(`${this.base}/${id}/guardar`, {});
  }

  descartar(id: number): Observable<AsistenteRecuerdo> {
    return this.http.post<AsistenteRecuerdo>(`${this.base}/${id}/descartar`, {});
  }
}
