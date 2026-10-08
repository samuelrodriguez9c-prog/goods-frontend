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
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { IconChevronDown, TablerIconComponent } from '@tabler/icons-angular';
import { AuthService } from '../../core/auth/auth.service';
import { CambiosPendientesService } from '../../core/realtime/cambios-pendientes.service';

interface NavItem {
  label: string;
  path: string;
  /** Nombre de ícono de Tabler (kebab-case), registrado en `app.config.ts`. */
  icon: string;
  exact: boolean;
  /** Código de `Modulo` que tiene que estar en el plan (`modulosDisponibles`). */
  codigo?: string;
  /** Permiso que hace falta además del módulo. */
  permiso?: string;
  hijos?: { label: string; path: string; icon: string }[];
}

/** Duración de la apertura/cierre del submenú (grid-template-rows). */
const MS_GRUPO = 200;

/**
 * Navegación lateral del admin — rediseño 2026-10-07: mismo sidebar que
 * `staff` (ancho 224 px, ítems compactos de 13 px, píldora que se desliza
 * entre ítems, punto turquesa de "hay cambios", Settings al fondo).
 *
 * Products conserva el submenú "árbol" que ya tenía el admin (pedido
 * explícito, 2026-10-08):
 * - Se despliega con la técnica `grid-template-rows` 0fr → 1fr + fade
 *   (el contenido nunca se desmonta, solo se anima su fila).
 * - Conector a la izquierda: un único trazo que nace debajo de Products y
 *   cuya altura crece/encoge hasta el centro del hijo bajo el mouse (o el
 *   activo, sin hover), doblando en un codo redondeado. Trazo punteado
 *   (dashed) y cada hijo con su ícono (pedido 2026-10-08).
 * - Se abre solo cuando la ruta actual está adentro, y el chevron lo abre
 *   o cierra a mano.
 *
 * Cada ítem se muestra si el plan de la Empresa incluye su módulo
 * (`modulosDisponibles`) y, si lo pide, el permiso del rol. Usuarios,
 * Roles y permisos y Solicitudes a Goods son ítems de primer nivel, igual
 * que en staff.
 */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly cambios = inject(CambiosPendientesService);
  protected readonly iconChevron = IconChevronDown;

  private readonly todos: NavItem[] = [
    { label: 'Dashboard', path: '/', icon: 'home-2', exact: true, codigo: 'dashboard' },
    { label: 'Orders', path: '/orders', icon: 'inbox', exact: false, codigo: 'orders' },
    {
      label: 'Products',
      path: '/products',
      icon: 'tag',
      exact: false,
      codigo: 'products',
      hijos: [
        { label: 'Categorías', path: '/products/categorias', icon: 'category' },
        { label: 'Inventario', path: '/products/inventario', icon: 'packages' },
        { label: 'Proveedores', path: '/products/proveedores', icon: 'truck' },
        { label: 'Compras', path: '/products/compras', icon: 'shopping-cart' },
      ],
    },
    { label: 'Customers', path: '/customers', icon: 'user', exact: false, codigo: 'customers' },
    { label: 'Discounts', path: '/discounts', icon: 'discount-2', exact: false, codigo: 'discounts' },
    { label: 'Messages', path: '/messages', icon: 'message-circle-2', exact: false, codigo: 'messages' },
    { label: 'Usuarios', path: '/settings/usuarios', icon: 'users', exact: false, codigo: 'users', permiso: 'usuarios.ver' },
    { label: 'Roles y permisos', path: '/settings/roles', icon: 'shield-lock', exact: false, codigo: 'roles', permiso: 'roles.ver' },
    // Pedirle mejoras a Goods (2026-10-04): no depende del plan.
    { label: 'Solicitudes a Goods', path: '/settings/solicitudes', icon: 'bulb', exact: false, permiso: 'solicitudes.crear' },
  ];

  protected readonly navItems = computed(() => {
    const u = this.authService.currentUser();
    const modulos = u?.modulosDisponibles ?? [];
    const permisos = u?.permisos ?? [];
    return this.todos.filter(
      (i) => (!i.codigo || modulos.includes(i.codigo)) && (!i.permiso || permisos.includes(i.permiso)),
    );
  });

  /** Settings: link simple al fondo, fuera de la píldora (igual que staff). */
  protected readonly settingsItem = { label: 'Settings', path: '/settings', icon: 'settings-2' };

  protected readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  protected readonly ruta = computed(() => this.url().split(/[?#]/)[0]);

  private coincide(path: string, exact: boolean): boolean {
    const r = this.ruta();
    return exact ? r === path : r === path || r.startsWith(path + '/');
  }

  protected esHijoActivo(path: string): boolean {
    return this.coincide(path, false);
  }

  // ── Grupo (Products) ───────────────────────────────────────────────────

  /** Grupos que el usuario abrió o cerró a mano (gana sobre "estoy adentro"). */
  private readonly manual = signal<ReadonlyMap<string, boolean>>(new Map());

  protected abierto(item: NavItem): boolean {
    const m = this.manual().get(item.path);
    if (m !== undefined) return m;
    return !!item.hijos?.some((h) => this.coincide(h.path, false));
  }

  protected toggleGrupo(item: NavItem): void {
    const m = new Map(this.manual());
    m.set(item.path, !this.abierto(item));
    this.manual.set(m);
    // Los ítems de abajo se corren mientras dura la animación: se vuelve a
    // medir al terminar para que la píldora quede donde corresponde.
    this.medir.update((n) => n + 1);
    setTimeout(() => this.medir.update((n) => n + 1), MS_GRUPO + 20);
  }

  // ── Píldora de primer nivel (mismo mecanismo que staff) ────────────────

  /** Se incrementa para forzar a recalcular posiciones (offsetTop no es reactivo). */
  private readonly medir = signal(0);
  protected readonly hoveredIndex = signal<number | null>(null);
  private readonly linkEls = viewChildren<ElementRef<HTMLElement>>('link');

  /** Ítem de primer nivel de la ruta actual (Products también con sus hijos). */
  protected readonly activeIndex = computed(() =>
    this.navItems().findIndex((i) => this.coincide(i.path, i.exact)),
  );

  private readonly targetEl = computed(() => {
    this.medir();
    const idx = this.hoveredIndex() ?? this.activeIndex();
    return idx >= 0 ? (this.linkEls()[idx]?.nativeElement ?? null) : null;
  });

  protected readonly indicatorTop = computed(() => (this.medir(), this.targetEl()?.offsetTop ?? 0));
  protected readonly indicatorHeight = computed(() => (this.medir(), this.targetEl()?.offsetHeight ?? 0));
  protected readonly indicatorVisible = computed(() => this.targetEl() !== null);

  // ── Conector "árbol" de los hijos ──────────────────────────────────────

  protected readonly hoveredChild = signal<number | null>(null);
  private readonly childEls = viewChildren<ElementRef<HTMLElement>>('childLink');

  private readonly hijosVisibles = computed(() => this.navItems().find((i) => i.hijos)?.hijos ?? []);

  private readonly childTarget = computed(() => {
    this.medir();
    const idx = this.hoveredChild() ?? this.hijosVisibles().findIndex((h) => this.coincide(h.path, false));
    return idx >= 0 ? (this.childEls()[idx]?.nativeElement ?? null) : null;
  });

  protected readonly conectorVisible = computed(() => this.childTarget() !== null);
  protected readonly conectorAlto = computed(() => {
    const el = this.childTarget();
    return el ? el.offsetTop + el.offsetHeight / 2 : 0;
  });
}
