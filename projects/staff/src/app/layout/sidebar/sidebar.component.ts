import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TablerIconComponent } from '@tabler/icons-angular';
import { AuthService } from '../../core/auth/auth.service';

interface NavItem {
  label: string;
  path: string;
  /** Nombre de ícono de Tabler (kebab-case, sin prefijo "Icon") —
   *  registrado en `app.config.ts` vía `provideTablerIcons`, mismo
   *  criterio que `admin/layout/sidebar/sidebar.component.ts`. */
  icon: string;
  exact: boolean;
  /** Permiso que hace falta tener para que el item tenga sentido
   *  mostrarlo — `undefined` para los 3 placeholders (Facturación/
   *  Ingresos/Soporte) que no pegan contra ningún endpoint protegido
   *  todavía. Antes de Fase 3 de `PROPUESTA_ROLES_Y_ACCESOS.md`, TODO
   *  rol de staff (solo existía `staff_goods`) tenía automáticamente el
   *  permiso de cada item — con roles de staff más chicos
   *  (`auditoria_goods`, `empleado_goods`) eso deja de ser cierto, así
   *  que el sidebar ahora oculta lo que la cuenta logueada no puede usar
   *  en vez de dejarla clickear a un 403. */
  permiso?: string;
}

/**
 * Navegación lateral del panel de staff — mismo lenguaje visual que
 * `admin/layout/sidebar/` (indicador deslizante de primer nivel, mismos
 * tokens de color) pero sin nada de la complejidad de ese sidebar
 * (submenú "árbol" de Products, sección "Sales channels"): acá los 5
 * items son todos de primer nivel, sin hijos — no hace falta esa
 * maquinaria, ver PIVOTE_SAAS_MULTITENANT.md §8 paso 5.
 *
 * Los primeros 5 items son el núcleo del panel de staff aprobado por
 * gerencia en §7.2: Empresas (clientes+plan+estado) y Altas pendientes
 * tienen pantalla real conectada al backend (`GET /empresas`);
 * Facturación, Ingresos y Soporte quedan como placeholder "TODO" — mismo
 * criterio que el Dashboard de `admin` hoy (ver ADMIN_DISENO.md >
 * "Dashboard / Analítica") — porque el backend todavía no tiene un
 * endpoint de historial de pagos, una vista de ingresos agregados, ni el
 * módulo de mensajería adaptado a conversaciones staff↔Empresa (el
 * `ChatModule` existente es cliente↔negocio, de un emprendimiento, no de
 * Goods con sus clientes).
 *
 * Los 5 items que siguen (Planes, Suscripciones, Auditoría, Usuarios,
 * Roles y permisos) se sumaron después (pedido explícito 2026-09-15:
 * "coloca en el sidebar todos los módulos que son de la empresa, todos
 * los que estén en el backend") — son módulos del backend que ya
 * existían (Plan/Suscripcion desde el paso 4 de §8, Auditoría desde
 * §7.5a) pero que hasta ahora no tenían pantalla propia en `staff`, solo
 * se consumían de refilón desde Empresas/Altas pendientes (ver
 * `core/catalog/plan-lookup.util.ts`). Usuarios/Roles y permisos son la
 * excepción a "ya existían sin pantalla": el backend siempre tuvo
 * `UsuarioController`/`RolController`, pero `staff_goods` no tenía los
 * permisos para usarlos (ver la migración
 * `SeedPermisosUsuariosRolesStaffGoods`) — antes solo `admin` podía, y
 * de hecho sobre CUALQUIER usuario de CUALQUIER Empresa hasta el fix de
 * aislamiento por tenant en `UsuarioService` del backend (ver ese
 * archivo para el detalle del hallazgo de seguridad).
 *
 * Sin ítem "Settings" separado (a diferencia de `admin`, que agrupa
 * Usuarios/Roles bajo una sección "Administración" con submenú): acá el
 * sidebar es plano a propósito (sin árbol de submenús, ver el resto de
 * este comentario), así que Usuarios y Roles y permisos son dos items de
 * primer nivel más, no una sección aparte.
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

  private readonly todosLosNavItems: NavItem[] = [
    { label: 'Empresas', path: '/empresas', icon: 'building', exact: false, permiso: 'empresas.ver' },
    { label: 'Altas pendientes', path: '/altas-pendientes', icon: 'user-plus', exact: false, permiso: 'empresas.ver' },
    { label: 'Planes', path: '/planes', icon: 'stack-2', exact: false, permiso: 'planes.ver' },
    { label: 'Suscripciones', path: '/suscripciones', icon: 'repeat', exact: false, permiso: 'suscripciones.ver' },
    { label: 'Facturación', path: '/facturacion', icon: 'receipt-2', exact: false },
    { label: 'Ingresos', path: '/ingresos', icon: 'report-money', exact: false },
    { label: 'Soporte', path: '/soporte', icon: 'headset', exact: false },
    { label: 'Auditoría', path: '/auditoria', icon: 'history', exact: false, permiso: 'auditoria.ver' },
    { label: 'Usuarios', path: '/usuarios', icon: 'users', exact: false, permiso: 'usuarios.ver' },
    { label: 'Roles y permisos', path: '/roles', icon: 'shield-lock', exact: false, permiso: 'roles.ver' },
  ];

  /** Fase 3 de `PROPUESTA_ROLES_Y_ACCESOS.md` §5.3 — ver el comentario de
   *  `NavItem.permiso`. Los 3 placeholders (sin `permiso`) siempre se
   *  muestran, igual que antes. */
  protected readonly navItems = computed(() => {
    const permisos = this.authService.currentUser()?.permisos ?? [];
    return this.todosLosNavItems.filter(
      (item) => !item.permiso || permisos.includes(item.permiso),
    );
  });

  /** Mismo mecanismo que `admin`: una única pill que se desliza entre
   *  items (hover, o si no hay hover, la ruta activa) — ver
   *  ADMIN_DISENO.md > "Sidebar > Animación" para el porqué del diseño. */
  protected readonly hoveredIndex = signal<number | null>(null);
  protected readonly activeIndex = signal(0);

  private readonly linkEls = viewChildren<ElementRef<HTMLElement>>('link');

  private readonly targetEl = computed(() => {
    const idx = this.hoveredIndex() ?? this.activeIndex();
    return this.linkEls()[idx]?.nativeElement ?? null;
  });

  protected readonly indicatorTop = computed(() => this.targetEl()?.offsetTop ?? 0);
  protected readonly indicatorHeight = computed(() => this.targetEl()?.offsetHeight ?? 0);
  protected readonly indicatorVisible = computed(() => this.targetEl() !== null);

  protected onActiveChange(index: number, isActive: boolean): void {
    if (isActive) {
      this.activeIndex.set(index);
    }
  }
}
