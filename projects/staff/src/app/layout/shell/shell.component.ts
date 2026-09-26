import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { AlertaOverlayComponent } from '../../shared/ui/alerta-overlay/alerta-overlay.component';
import { AlertaPilaComponent } from '../../shared/ui/alerta-pila/alerta-pila.component';
import { PistaComponent } from '../../shared/ui/pista/pista.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';

/**
 * Layout raíz del panel de staff — copia del patrón de
 * `admin/layout/shell/shell.component.ts` (mismo motivo para el
 * `ngOnInit`: `currentUser` no se persiste, solo el accessToken, así que
 * tras un F5 hay que volver a pedir `GET /auth/me` antes de que el
 * topbar tenga algo real que mostrar).
 *
 * También abre acá el socket de `RealtimeService` (ver
 * `RealtimeService.mantenerConectado`) — es el único lugar que se monta
 * para TODA sesión de staff autenticada, sin importar en qué pantalla
 * esté: la presencia ("¿quién está en línea ahora?" en la matriz de
 * Usuarios) necesita eso, no que la sesión además tenga abierta una
 * pantalla puntual que escuche algo (Usuarios, el asistente de
 * activación).
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
  imports: [RouterOutlet, SidebarComponent, TopbarComponent, AlertaPilaComponent, AlertaOverlayComponent, PistaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.component.html',
})
export class ShellComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly realtimeService = inject(RealtimeService);

  ngOnInit(): void {
    if (this.authService.isAuthenticated() && !this.authService.currentUser()) {
      this.authService.cargarPerfil().subscribe({ error: () => undefined });
    }
    if (this.authService.isAuthenticated()) {
      this.realtimeService.mantenerConectado();
    }
  }
}
