import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

/**
 * Barra superior del shell de staff — versión reducida de
 * `admin/layout/topbar/`: mismo wordmark izquierda + avatar/nombre/logout
 * derecha, pero SIN buscador central ni los íconos de asistente
 * IA/notificaciones (esos son features del admin de un emprendimiento —
 * el panel de staff no tiene, todavía, un equivalente real que mostrar
 * ahí, y agregar placeholders sin ningún plan concreto detrás sería
 * inventar alcance que nadie pidió).
 */
@Component({
  selector: 'app-topbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './topbar.component.html',
})
export class TopbarComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly currentUser = this.authService.currentUser;

  protected readonly initials = computed(() => {
    const usuario = this.currentUser();
    if (!usuario) {
      return '…';
    }
    const inicial = (texto: string) => texto.trim().charAt(0).toUpperCase();
    return `${inicial(usuario.nombres)}${inicial(usuario.apellidos)}` || '?';
  });

  protected readonly displayName = computed(() => {
    const usuario = this.currentUser();
    return usuario ? usuario.nombres : '…';
  });

  protected logout(): void {
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }
}
