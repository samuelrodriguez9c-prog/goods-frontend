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
 *
 * El aviso de acceso especial ya no es una píldora ámbar suelta a la
 * izquierda del avatar (rediseño del handoff, 2026-09-22): es una segunda
 * línea dentro del propio bloque de usuario ("Superadmin | Acceso
 * especial"), porque el dato es *sobre esa cuenta*, no un estado suelto
 * de la aplicación. El `title` con la explicación completa se movió del
 * badge viejo al bloque de usuario. En sesión normal el bloque queda
 * exactamente como antes (avatar + nombre en una línea).
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
    return usuario ? `${usuario.nombres + ` ` + usuario.apellidos}` : '…';
  });

  // Fase 7 de PROPUESTA_ROLES_Y_ACCESOS.md (§5.5) — "lo que más impacto
  // tiene en seguridad" según la propia propuesta: quien esté usando el
  // acceso especial de superadmin tiene que verlo escrito en pantalla en
  // TODO momento dentro del panel de staff, no solo enterarse por lo que
  // pueda o no hacer. `esSesionCrossPanelStaff` viaja en la sesión (JWT +
  // GET /auth/me), nunca hace falta volver a pedirlo.
  protected readonly esCrossPanelStaff = computed(
    () => this.currentUser()?.esSesionCrossPanelStaff ?? false,
  );

  protected logout(): void {
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }
}
