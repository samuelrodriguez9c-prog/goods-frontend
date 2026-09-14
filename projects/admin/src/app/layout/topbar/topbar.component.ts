import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IconBell, IconRobot, IconSearch, TablerIconComponent } from '@tabler/icons-angular';
import { AuthService } from '../../core/auth/auth.service';

/**
 * Barra superior del shell. Construida por partes calcando la captura
 * 106 de Shopify (ver ADMIN_DISENO.md > "Topbar"):
 * - Izquierda (hecho): wordmark "Goods" + badge de versión.
 * - Centro (hecho): buscador global (solo estructura/estilo — sin lógica
 *   de búsqueda real ni atajo de teclado ⌘K funcional todavía).
 * - Derecha (hecho): ícono de asistente IA, notificaciones, avatar +
 *   nombre de usuario + logout — el avatar/nombre ya salen de
 *   `AuthService.currentUser()` (antes eran "AD"/"Admin" fijos, ver
 *   PIVOTE_SAAS_MULTITENANT.md §8 punto 2); notificaciones y asistente
 *   IA siguen sin lógica real (ver ADMIN_DISENO.md > "Topbar > Derecha").
 * El modo contextual de pantallas de edición (breadcrumb+título+acciones,
 * aviso de "cambios sin guardar") es trabajo aparte, todavía no
 * especificado a nivel de composite.
 *
 * Íconos: `@tabler/icons-angular` (reemplaza a `@lucide/angular` — ver
 * ADMIN_DISENO.md > "Topbar > Tipografía e íconos" para la decisión
 * completa). Los tres íconos de acá se quedan de línea/outline —solo
 * los de Home/Products/Customers del sidebar van rellenos—, así que se
 * pasan por referencia de objeto (`[icon]="iconSearch"`) sin necesidad
 * de `provideTablerIcons`, igual de "solo lo que se usa" que antes.
 */
@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './topbar.component.html',
})
export class TopbarComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly iconSearch = IconSearch;
  protected readonly iconBot = IconRobot;
  protected readonly iconBell = IconBell;

  protected readonly currentUser = this.authService.currentUser;

  // Iniciales para el avatar (ej. "Julián Ríos" -> "JR"). Si por lo que
  // sea currentUser todavía no cargó (instante entre navegar al shell y
  // que resuelva cargarPerfil()), cae a "…" en vez de romper.
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
