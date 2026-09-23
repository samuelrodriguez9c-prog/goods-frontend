import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

/**
 * Cliente de `RealtimeGateway` (backend, `modules/realtime/`) para `admin`
 * — espejo exacto de `staff/core/realtime/realtime.service.ts` (mismo
 * patrón: un socket único por sesión, `providedIn: 'root'`, conexión
 * perezosa recién al primer `escuchar()`, autenticación vía
 * `auth: { token }` con el `accessToken` de `AuthService`). Primera vez
 * que `admin` necesita esto — lo usa `MessageListPageComponent` para
 * recibir mensajes nuevos en tiempo real (sala `usuario:<id>`, ver
 * `RealtimeGateway.handleConnection` del backend).
 *
 * No maneja reconexión con un token renovado (misma limitación aceptada
 * del lado de `staff`, ver ese archivo).
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

  /** Observable "frío": no conecta ni registra nada hasta que alguien se
   * suscribe. Al desuscribirse se saca el listener, pero el socket queda
   * conectado (compartido por toda la app). */
  escuchar<T>(evento: string): Observable<T> {
    const socket = this.conectar();
    return new Observable<T>((subscriber) => {
      const handler = (payload: T) => subscriber.next(payload);
      socket.on(evento, handler);
      return () => socket.off(evento, handler);
    });
  }

  /** Abre el socket sin necesitar escuchar ningún evento puntual. No se
   * llama desde `ShellComponent` (a diferencia de `staff`) — acá el socket
   * se conecta recién cuando el usuario entra a Messages, que es la única
   * pantalla de `admin` que lo necesita por ahora. */
  mantenerConectado(): void {
    this.conectar();
  }
}
