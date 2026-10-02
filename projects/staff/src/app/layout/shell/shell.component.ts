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
 * Layout raíz del panel de staff.
 *
 * La carga de perfil tras un F5 (`currentUser` no se persiste, solo el
 * accessToken, así que hay que volver a pedir `GET /auth/me`) YA NO vive
 * acá — se movió al constructor de `TopbarComponent` (§5.4.4, 2026-10-01)
 * porque `/asistente` es una ruta de nivel superior FUERA de este Shell
 * que también monta ese mismo topbar, y necesitaba el mismo bootstrap al
 * recargar directo ahí. Ver el comentario de ese constructor.
 *
 * También abre acá el socket de `RealtimeService` (ver
 * `RealtimeService.mantenerConectado`) para que la presencia ("¿quién
 * está en línea ahora?" en la matriz de Usuarios) quede activa desde que
 * alguien entra al panel — en la práctica, `TopbarComponent.escuchar(...)`
 * ya abre ese mismo socket apenas se monta (en cualquiera de las dos
 * rutas de nivel superior), así que esta llamada queda como refuerzo
 * explícito, no como la única vía.
 *
 * `AlertaPilaComponent`/`AlertaOverlayComponent` (LEEME.md §12, integrado
 * 2026-09-22) van acá — una sola vez para toda la sesión — porque el
 * estado vive en `AlertaService` (`providedIn: 'root'`): una operación
 * lanzada en una pantalla sigue avisando si el usuario navega a otra
 * antes de que termine.
 *
 * `PistaComponent` (LEEME.md §18, integrado 2026-09-23) va por el mismo
 * motivo: `PistaService` también es `providedIn: 'root'`, un solo aviso
 * transversal para toda la sesión.
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
