import { Injectable, inject } from '@angular/core';
import { Observable, filter, map } from 'rxjs';
import { RealtimeService } from './realtime.service';

interface DatosCambioPayload {
  entidad: string;
}

const EVENTO_DATOS_CAMBIO = 'datos:cambio';

/**
 * Avisa a una pantalla de lista que alguien cambió algo de lo que muestra,
 * para ofrecer «Hay cambios nuevos · Actualizar» sin recargar a mano.
 *
 * @remarks
 * Escucha `datos:cambio`, que el backend emite una vez por cada escritura
 * exitosa con el nombre de la entidad. No distingue los cambios propios de
 * los ajenos: un aviso de más es inofensivo.
 */
@Injectable({ providedIn: 'root' })
export class CambiosEnVivoService {
  private readonly realtimeService = inject(RealtimeService);

  /** @param entidades - Las que le importan a quien llama (`['producto', 'inventario']`); sin ella, cualquier cambio. */
  huboCambio(entidades?: string[]): Observable<void> {
    return this.realtimeService.escuchar<DatosCambioPayload>(EVENTO_DATOS_CAMBIO).pipe(
      filter((p) => !entidades || entidades.includes(p.entidad)),
      map(() => undefined),
    );
  }
}
