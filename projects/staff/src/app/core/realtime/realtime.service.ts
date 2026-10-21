import { Injectable, effect, inject, untracked } from '@angular/core';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

/**
 * Socket único de la app contra `RealtimeGateway` del backend. Se conecta
 * con el primer `escuchar()` o `mantenerConectado()` y se autentica con el
 * `accessToken` en el handshake.
 *
 * @remarks
 * El backend verifica el token solo al conectar. Por eso el socket sigue a la
 * sesión: el token se lee en cada (re)conexión, y si cambia (otra cuenta, o un
 * refresh) se reconecta con el nuevo; al cerrar sesión se desconecta. Es
 * siempre el mismo `Socket`, así que los `escuchar()` activos no se pierden.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly authService = inject(AuthService);
  private socket: Socket | null = null;
  /** Token con el que se abrió la conexión actual. */
  private tokenConectado: string | null = null;

  constructor() {
    effect(() => {
      const token = this.authService.accessToken();
      untracked(() => this.seguirSesion(token));
    });
  }

  private conectar(): Socket {
    if (this.socket) {
      if (!this.socket.connected && this.authService.accessToken()) this.socket.connect();
      return this.socket;
    }
    this.socket = io(environment.socketUrl, {
      // Función, no valor: socket.io la llama en cada (re)conexión y así nunca usa un token viejo.
      auth: (cb) => {
        this.tokenConectado = this.authService.accessToken();
        cb({ token: this.tokenConectado });
      },
    });
    return this.socket;
  }

  private seguirSesion(token: string | null): void {
    if (!this.socket) return;
    if (!token) {
      this.socket.disconnect();
      this.tokenConectado = null;
    } else if (token !== this.tokenConectado) {
      this.socket.disconnect().connect();
    }
  }

  /**
   * Emite cada payload de `evento`.
   *
   * @remarks
   * Abre el socket al llamarlo (no al suscribirse) si todavía no estaba
   * abierto. El listener se registra al suscribirse y se saca al
   * desuscribirse; el socket queda abierto porque es compartido.
   */
  escuchar<T>(evento: string): Observable<T> {
    const socket = this.conectar();
    return new Observable<T>((subscriber) => {
      const handler = (payload: T) => subscriber.next(payload);
      socket.on(evento, handler);
      return () => socket.off(evento, handler);
    });
  }

  /** Abre el socket sin escuchar nada. `ShellComponent` lo llama al montar
   * para que el usuario cuente como conectado (presencia de staff) desde
   * que entra, en cualquier pantalla. */
  mantenerConectado(): void {
    this.conectar();
  }
}
