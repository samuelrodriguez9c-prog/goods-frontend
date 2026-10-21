import { Injectable, inject } from '@angular/core';
import { Observable, filter, map } from 'rxjs';
import { RealtimeService } from './realtime.service';

interface DatosCambioPayload {
  entidad: string;
}

const EVENTO_DATOS_CAMBIO = 'datos:cambio';

/**
 * Avisa a las pantallas de lista que alguien cambió datos que muestran, para
 * ofrecer "Hay cambios nuevos · Actualizar" sin recargar.
 *
 * @remarks
 * El backend emite `datos:cambio` por cada escritura exitosa, con el nombre
 * de `entidad` que usa para auditar. No distingue si el cambio lo hizo el
 * propio usuario: mostrar el aviso de más es inofensivo.
 */
@Injectable({ providedIn: 'root' })
export class CambiosEnVivoService {
  private readonly realtimeService = inject(RealtimeService);

  /**
   * @param entidades - Entidades que le importan a quien llama (p. ej.
   *   `['empresa', 'suscripcion']`). Sin ellas, avisa de cualquier cambio
   *   (lo usa Auditoría, que registra toda escritura).
   */
  huboCambio(entidades?: string[]): Observable<void> {
    return this.realtimeService.escuchar<DatosCambioPayload>(EVENTO_DATOS_CAMBIO).pipe(
      filter((p) => !entidades || entidades.includes(p.entidad)),
      map(() => undefined),
    );
  }
}
