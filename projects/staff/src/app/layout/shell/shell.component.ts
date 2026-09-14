import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';

/**
 * Layout raíz del panel de staff — copia del patrón de
 * `admin/layout/shell/shell.component.ts` (mismo motivo para el
 * `ngOnInit`: `currentUser` no se persiste, solo el accessToken, así que
 * tras un F5 hay que volver a pedir `GET /auth/me` antes de que el
 * topbar tenga algo real que mostrar).
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, TopbarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.component.html',
})
export class ShellComponent implements OnInit {
  private readonly authService = inject(AuthService);

  ngOnInit(): void {
    if (this.authService.isAuthenticated() && !this.authService.currentUser()) {
      this.authService.cargarPerfil().subscribe({ error: () => undefined });
    }
  }
}
