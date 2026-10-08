import { Injectable, inject } from '@angular/core';
import { Observable, filter, map } from 'rxjs';
import { RealtimeService } from './realtime.service';

interface DatosCambioPayload {
  entidad: string;
}

const EVENTO_DATOS_CAMBIO = 'datos:cambio';

/**
 * Rastro de navegación "en vivo" (§5.4.4/§8, 2026-10-02) — envuelve
 * `RealtimeService.escuchar('datos:cambio')` (mismo socket que ya abre
 * `TopbarComponent` para las notificaciones) para que cada pantalla de
 * lista pueda mostrar un aviso "Hay cambios nuevos · Actualizar" cuando
 * OTRO actor (otro miembro del staff, o un cliente por el flujo público
 * de alta) cambió algo que esa pantalla muestra — sin tener que recargar
 * la página a mano. Backend: `AuditoriaAccionInterceptor` (global) emite
 * este evento una vez por cada escritura EXITOSA, con el mismo nombre de
 * `entidad` que ya usa para auditar (`EmpresaController` -> `'empresa'`,
 * etc. — ver ese archivo).
 *
 * Deliberadamente NO intenta distinguir "este cambio lo hice yo mismo en
 * otra pestaña/acción" de "lo hizo otro" — el aviso es un simple banner
 * no intrusivo que el usuario puede ignorar o tocar, así que mostrarlo
 * de más (ej. justo después de tu propia acción, que ya refrescó sola)
 * es inofensivo: como mucho, tocás "Actualizar" y ves los mismos datos
 * de nuevo.
 */
@Injectable({ providedIn: 'root' })
export class CambiosEnVivoService {
  private readonly realtimeService = inject(RealtimeService);

  /** `entidades`: lista de entidades que le importan a quien llama (ej.
   *  `['empresa', 'suscripcion']`). Se omite (o se pasa `undefined`) para
   *  escuchar CUALQUIER cambio sin filtrar — lo usa `AuditoriaPageComponent`,
   *  porque cualquier escritura exitosa en cualquier parte de la app ya
   *  generó una fila nueva en su propia tabla. */
  huboCambio(entidades?: string[]): Observable<void> {
    return this.realtimeService.escuchar<DatosCambioPayload>(EVENTO_DATOS_CAMBIO).pipe(
      filter((p) => !entidades || entidades.includes(p.entidad)),
      map(() => undefined),
    );
  }
}
