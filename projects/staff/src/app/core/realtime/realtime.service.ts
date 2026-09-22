import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

/**
 * Cliente de `RealtimeGateway` (backend, `modules/realtime/`) para
 * `staff` — primera vez que este proyecto necesita un socket (§4/§11
 * Paso 3, evento `empresa.activada` del asistente de activación, ver
 * `ActivarEmpresaWizardComponent`). La propuesta (§11 Paso 3) decía
 * "mismo patrón que el que ya conecta chat", pero al ir a reusarlo se
 * encontró que ese patrón no existe todavía del lado de Angular —
 * `ChatModule`/`RealtimeGateway` están construidos en el backend, pero
 * `admin/features/messages/` es solo un placeholder sin ningún socket
 * real (confirmado por grep: `socket.io-client` ni siquiera estaba en
 * `package.json` del workspace) — así que este servicio es el primero,
 * no una copia de uno existente.
 *
 * Un solo socket por sesión de la app (`providedIn: 'root'`, se conecta
 * recién al primer `escuchar()`, no en el constructor) — mismo criterio
 * que `RealtimeGateway` del backend describe del lado de Nest: "un
 * gateway único, no uno por feature". La autenticación va en
 * `auth: { token }` del handshake (`socket.handshake.auth.token`, ver
 * `RealtimeGateway.extraerToken` del backend) — el mismo `accessToken`
 * que ya usa `HttpClient` vía `AuthService`, sin un mecanismo aparte.
 *
 * No maneja reconexión con un token renovado: si el `accessToken` se
 * refresca mientras el socket sigue conectado, el socket no se entera
 * (la verificación del JWT en el backend solo pasa una vez, al conectar
 * — `RealtimeGateway.handleConnection` — no en cada evento). Para la
 * duración de una sesión del navegador esto no es un problema real: el
 * socket vive mientras la pestaña esté abierta, igual que la sesión de
 * `AuthService`.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly authService = inject(AuthService);
  private socket: Socket | null = null;

  private conectar(): Socket {
    if (this.socket) {
      return this.socket;
    }
    this.socket = io(environment.socketUrl, {
      auth: { token: this.authService.accessToken() },
    });
    return this.socket;
  }

  /** Observable "frío" en el sentido de que no dispara nada hasta que
   * alguien se suscribe — recién ahí se conecta el socket (si todavía no
   * lo estaba) y se registra el listener de `evento`. Al desuscribirse
   * (ej. el componente que escuchaba se destruye) se saca el listener,
   * pero el socket en sí se deja conectado — es compartido por toda la
   * app, no tiene sentido cerrarlo cada vez que un componente puntual
   * deja de escuchar. */
  escuchar<T>(evento: string): Observable<T> {
    const socket = this.conectar();
    return new Observable<T>((subscriber) => {
      const handler = (payload: T) => subscriber.next(payload);
      socket.on(evento, handler);
      return () => socket.off(evento, handler);
    });
  }

  /** Abre el socket para toda la sesión sin necesitar escuchar ningún
   * evento puntual — la llama `ShellComponent` (el layout raíz, se monta
   * apenas hay sesión activa) para que la presencia (`RealtimeGateway`
   * del backend, sala `staff:presencia`) quede activa desde que alguien
   * entra al panel, no recién cuando visita una pantalla que además
   * necesite escuchar algo (hoy, Usuarios o el asistente de activación).
   * Sin esto, alguien navegando por Empresas/Planes/etc. nunca contaría
   * como "conectado" aunque esté usando la app en ese momento — ver
   * ADMIN_DISENO.md. */
  mantenerConectado(): void {
    this.conectar();
  }
}
