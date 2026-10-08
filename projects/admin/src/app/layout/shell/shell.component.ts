import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { AccesoEmpresaComponent } from '../acceso-empresa/acceso-empresa.component';
import { AlertaOverlayComponent } from '../../shared/ui/alerta-overlay/alerta-overlay.component';
import { AlertaPilaComponent } from '../../shared/ui/alerta-pila/alerta-pila.component';
import { PistaComponent } from '../../shared/ui/pista/pista.component';
import { AsistenteDockComponent } from '../asistente-dock/asistente-dock.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';

/**
 * Layout raíz del admin: topbar + sidebar + área de contenido — mismo
 * armado que el de staff desde 2026-10-07 (contenido al 90 %, pila de
 * alertas, pista y el botón del Asistente de IA pegado al borde).
 *
 * Se monta
 * como el componente de la ruta `''` en `app.routes.ts` (protegida por
 * `authGuard`), con cada feature colgando como ruta hija — así el login
 * vive en otra rama de rutas sin este layout, sin tener que tocar `App`.
 *
 * El perfil (`GET /auth/me`) tras un F5 lo pide `TopbarComponent`, igual
 * que en staff: `/asistente` vive fuera de este Shell y monta el mismo
 * topbar, así que ese es el único punto que cubre los dos casos.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    SidebarComponent,
    TopbarComponent,
    AccesoEmpresaComponent,
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

  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  /** Ver `AccesoEmpresaComponent`. */
  protected readonly acceso = computed(() => this.authService.currentUser()?.accesoEmpresa ?? null);

  /** Con la cuenta bloqueada se puede seguir usando el chat con Goods
   *  (`/messages`), las notificaciones y Settings (perfil, seguridad, correos). */
  private readonly router = inject(Router);
  protected readonly rutaLibre = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url),
      map((url) => ['/messages', '/notificaciones', '/settings'].some((r) => url === r || url.startsWith(r + '?') || url.startsWith(r + '/')) && !url.startsWith('/settings/')),
    ),
    { initialValue: false },
  );

  ngOnInit(): void {
    // Acceso en vivo (2026-10-04): cuando Goods registra un pago, anula uno,
    // suspende o reactiva la cuenta, o el cron la vence, el backend emite
    // `acceso:cambio` y el panel se bloquea o desbloquea sin recargar
    // (también se recalculan los módulos del sidebar).
    if (this.authService.isAuthenticated()) {
      this.realtime
        .escuchar<{ empresaId: number }>('acceso:cambio')
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.authService.cargarPerfil().subscribe({ error: () => undefined }));
    }
  }
}
