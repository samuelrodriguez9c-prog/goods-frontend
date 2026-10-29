import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

/**
 * Socket único de la sesión contra `RealtimeGateway`. Se conecta en el
 * primer `escuchar()` y se autentica con el `accessToken` de `AuthService`.
 *
 * @remarks
 * No se reconecta con el token renovado: el socket sigue con el token con el
 * que se abrió.
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

  /**
   * Abre el socket si hace falta y devuelve el evento como Observable. El
   * listener se registra al suscribirse y se saca al desuscribirse; el
   * socket queda abierto para el resto de la app.
   */
  /**
   * Cierra el socket y lo olvida: el próximo `escuchar()` abre uno nuevo con
   * el token de ese momento. Se usa cuando el backend corta la sesión.
   */
  reiniciar(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  escuchar<T>(evento: string): Observable<T> {
    const socket = this.conectar();
    return new Observable<T>((subscriber) => {
      const handler = (payload: T) => subscriber.next(payload);
      socket.on(evento, handler);
      return () => socket.off(evento, handler);
    });
  }
}
