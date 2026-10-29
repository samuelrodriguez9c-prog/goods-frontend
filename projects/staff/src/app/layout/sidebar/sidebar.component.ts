import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map } from 'rxjs';
import { TablerIconComponent } from '@tabler/icons-angular';
import { AuthService } from '../../core/auth/auth.service';
import { CambiosPendientesService } from '../../core/realtime/cambios-pendientes.service';

interface NavItem {
  label: string;
  path: string;
  /** Nombre de ícono de Tabler (kebab-case, sin prefijo "Icon"); tiene que
   *  estar registrado en `app.config.ts` vía `provideTablerIcons`. */
  icon: string;
  exact: boolean;
  /** Permiso necesario para mostrar el ítem; sin `permiso` se muestra
   *  siempre (hoy solo Soporte). Ocultar lo que la cuenta no puede usar
   *  evita que haga clic y caiga en un 403. */
  permiso?: string;
}

/**
 * Navegación lateral del panel de staff: lista plana de módulos (sin
 * submenús a propósito), filtrada por permisos, con una pill que se desliza
 * entre ítems.
 *
 * Settings va aparte, empujado al fondo con `mt-auto` y fuera del indicador
 * deslizante. Es el perfil de la propia cuenta, no la gestión de personal.
 */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  private readonly authService = inject(AuthService);
  /** Rutas con cambios en vivo que no se están viendo (punto turquesa). */
  protected readonly cambios = inject(CambiosPendientesService);

  private readonly todosLosNavItems: NavItem[] = [
    { label: 'Empresas', path: '/empresas', icon: 'building', exact: false, permiso: 'empresas.ver' },
    { label: 'Altas pendientes', path: '/altas-pendientes', icon: 'user-plus', exact: false, permiso: 'empresas.ver' },
    { label: 'Planes', path: '/planes', icon: 'stack-2', exact: false, permiso: 'planes.ver' },
    { label: 'Suscripciones', path: '/suscripciones', icon: 'repeat', exact: false, permiso: 'suscripciones.ver' },
    { label: 'Facturación', path: '/facturacion', icon: 'receipt-2', exact: false, permiso: 'facturacion.ver' },
    { label: 'Ingresos', path: '/ingresos', icon: 'report-money', exact: false, permiso: 'ingresos.ver' },
    { label: 'Solicitudes', path: '/solicitudes', icon: 'bulb', exact: false, permiso: 'solicitudes.ver' },
    { label: 'Soporte', path: '/soporte', icon: 'headset', exact: false },
    { label: 'Auditoría', path: '/auditoria', icon: 'history', exact: false, permiso: 'auditoria.ver' },
    { label: 'Usuarios', path: '/usuarios', icon: 'users', exact: false, permiso: 'usuarios.ver' },
    { label: 'Roles y permisos', path: '/roles', icon: 'shield-lock', exact: false, permiso: 'roles.ver' },
  ];

  /** Ítems cuyo `permiso` tiene la cuenta; los que no piden permiso, siempre. */
  protected readonly navItems = computed(() => {
    const permisos = this.authService.currentUser()?.permisos ?? [];
    return this.todosLosNavItems.filter(
      (item) => !item.permiso || permisos.includes(item.permiso),
    );
  });

  /** Fuera de `navItems` y del indicador deslizante. Sin `permiso`: es el
   *  perfil de la propia cuenta, que cualquier rol de staff puede editar
   *  (el backend permite `GET/PATCH /usuarios/:id` sobre el propio id). */
  protected readonly settingsItem: NavItem = {
    label: 'Configuración',
    path: '/settings',
    icon: 'settings-2',
    exact: true,
  };

  /** Una única pill que se desliza entre ítems: el del hover o, si no hay
   *  hover, el de la ruta activa. */
  protected readonly hoveredIndex = signal<number | null>(null);

  /** Índice del ítem de la ruta actual DENTRO de `navItems()` (-1 si la
   *  ruta no es de la lista, ej. Settings: la pill se oculta).
   *
   *  Sale de la URL + `navItems()` y no de `(isActiveChange)`: al entrar
   *  directo por URL, los ítems con `permiso` aparecen recién cuando llega
   *  `/auth/me`, la lista crece sin que `isActive` cambie y la pill quedaría
   *  en el índice viejo. */
  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  protected readonly activeIndex = computed(() => {
    const ruta = this.url().split(/[?#]/)[0];
    return this.navItems().findIndex((item) => ruta === item.path || ruta.startsWith(item.path + '/'));
  });

  private readonly linkEls = viewChildren<ElementRef<HTMLElement>>('link');

  private readonly targetEl = computed(() => {
    const idx = this.hoveredIndex() ?? this.activeIndex();
    return this.linkEls()[idx]?.nativeElement ?? null;
  });

  protected readonly indicatorTop = computed(() => this.targetEl()?.offsetTop ?? 0);
  protected readonly indicatorHeight = computed(() => this.targetEl()?.offsetHeight ?? 0);
  protected readonly indicatorVisible = computed(() => this.targetEl() !== null);

}
