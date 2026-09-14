import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';

/**
 * Layout raíz del admin: topbar + sidebar + área de contenido. Se monta
 * como el componente de la ruta `''` en `app.routes.ts` (protegida por
 * `authGuard`), con cada feature colgando como ruta hija — así el login
 * vive en otra rama de rutas sin este layout, sin tener que tocar `App`.
 *
 * `currentUser` (usado por el topbar) no se persiste en localStorage —
 * solo el accessToken. Por eso, al entrar acá con un token de una sesión
 * anterior (F5, o abrir una pestaña nueva) pero sin perfil todavía
 * cargado en memoria, hay que pedirlo — si no, el topbar se queda
 * mostrando "…" para siempre. `authGuard` ya garantizó que hay
 * accessToken antes de dejar entrar, así que esta llamada normalmente no
 * falla; si el token resultó vencido, `authInterceptor` intenta
 * refrescar y, si tampoco puede, limpia la sesión (el próximo intento de
 * navegar rebota a /login).
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
