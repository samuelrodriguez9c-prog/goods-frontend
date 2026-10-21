import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { AlertaOverlayComponent } from '../../shared/ui/alerta-overlay/alerta-overlay.component';
import { AlertaPilaComponent } from '../../shared/ui/alerta-pila/alerta-pila.component';
import { PistaComponent } from '../../shared/ui/pista/pista.component';
import { AsistenteDockComponent } from '../asistente-dock/asistente-dock.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';

/**
 * Layout raíz del panel de staff: topbar, sidebar, `<main>` y los avisos
 * globales.
 *
 * El perfil tras un F5 (`GET /auth/me`) no se carga acá sino en
 * `TopbarComponent`, porque `/asistente` monta ese topbar fuera de este shell.
 *
 * Abre el socket de `RealtimeService` para que la presencia (quién está en
 * línea, en Usuarios) quede activa desde la entrada. `TopbarComponent` también
 * lo abre al montarse; esta llamada es un refuerzo, no la única vía.
 *
 * Alertas, overlay y Pista se montan una sola vez acá: su estado vive en
 * servicios `root`, así que una operación lanzada en una pantalla sigue
 * avisando aunque el usuario navegue a otra.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    SidebarComponent,
    TopbarComponent,
    AlertaPilaComponent,
    AlertaOverlayComponent,
    PistaComponent,
    AsistenteDockComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.component.html',
})
export class ShellComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly realtimeService = inject(RealtimeService);

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.realtimeService.mantenerConectado();
    }
  }
}
