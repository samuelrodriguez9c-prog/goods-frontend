import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Placeholder — el backend (`ChatModule` + `RealtimeGateway`) ya está
 * completo y verificado de punta a punta (bandeja compartida, asignación
 * híbrida, WebSockets — ver MODULOS_PENDIENTES.md). Lo que falta acá no
 * es el backend: es que el admin todavía no tiene autenticación real
 * (`core/auth` sigue vacío) — sin un usuario logueado real no hay JWT
 * para el gateway ni para llamar `GET /chat/conversaciones`. Mismo
 * bloqueo identificado para conectar la campana de notificaciones.
 */
@Component({
  selector: 'app-message-list-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-8">
      <h1 class="text-lg font-semibold text-gray-900">Messages</h1>
      <p class="mt-2 text-sm text-gray-500">
        TODO: bandeja real de conversaciones (ver ADMIN_DISENO.md &gt; "Sidebar") — requiere
        login real en el admin (core/auth) antes de poder conectarse.
      </p>
    </div>
  `,
})
export class MessageListPageComponent {}
