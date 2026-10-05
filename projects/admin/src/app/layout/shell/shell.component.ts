import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AccesoEmpresaComponent } from '../acceso-empresa/acceso-empresa.component';
import { AsistentePanelComponent } from '../asistente-panel/asistente-panel.component';
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
  imports: [RouterOutlet, SidebarComponent, TopbarComponent, AsistentePanelComponent, AccesoEmpresaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.component.html',
})
export class ShellComponent implements OnInit {
  private readonly authService = inject(AuthService);

  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  /** Ver `AccesoEmpresaComponent`. */
  protected readonly acceso = computed(() => this.authService.currentUser()?.accesoEmpresa ?? null);

  ngOnInit(): void {
    if (this.authService.isAuthenticated() && !this.authService.currentUser()) {
      this.authService.cargarPerfil().subscribe({ error: () => undefined });
    }
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
