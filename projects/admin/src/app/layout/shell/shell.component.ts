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
 * Layout del admin: topbar, sidebar y contenido (al 90 %), con la pila de
 * alertas, la pista y el botón del asistente. Es la ruta `''` protegida por
 * `authGuard`; cada feature cuelga como hija y el login queda fuera.
 *
 * @remarks
 * El perfil tras un F5 lo pide `TopbarComponent`, no el Shell: `/asistente`
 * vive fuera del Shell y monta el mismo topbar, así que es el único punto que
 * cubre los dos casos.
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

  /** Acceso de la Empresa (ver `AccesoEmpresaComponent`). */
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
    // Cuando Goods registra o anula un pago, suspende o reactiva la cuenta, o
    // el cron la vence, el backend emite `acceso:cambio`: el panel se bloquea
    // o desbloquea sin recargar (y se recalculan los módulos del sidebar).
    if (this.authService.isAuthenticated()) {
      this.realtime
        .escuchar<{ empresaId: number }>('acceso:cambio')
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.authService.cargarPerfil().subscribe({ error: () => undefined }));
    }
  }
}
