import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * Ajustes que Goods configuró para un módulo de esta Empresa (cómo arranca
 * la pantalla). Los cambia solo staff; acá solo se leen.
 */
@Injectable({ providedIn: 'root' })
export class AjustesModuloService {
  private readonly http = inject(HttpClient);

  /**
   * Los ajustes efectivos del módulo, ya con los defectos.
   * @returns `{}` si no se pudieron leer: la pantalla sigue con los suyos.
   */
  de<T extends object>(codigo: string): Observable<Partial<T>> {
    return this.http
      .get<{ ajustes: Partial<T> }>(`${environment.apiUrl}/modulos/ajustes/${codigo}`)
      .pipe(
        map((r) => r.ajustes),
        catchError(() => of({} as Partial<T>)),
      );
  }
}
