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
import { TablerIconComponent } from '@tabler/icons-angular';
import { filter, map } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';

interface SubNavItem {
  label: string;
  path: string;
}

interface NavItem {
  label: string;
  path: string;
  /** Nombre de ícono de Tabler (kebab-case, sin prefijo "Icon") — se
   *  registra abajo en `provideTablerIcons` y se pasa directo al
   *  `<tabler-icon>` del template, sin necesidad de un `@switch`. */
  icon: string;
  /** Solo el item de Dashboard necesita match exacto (vive en '/'). */
  exact: boolean;
  /** Código de `Modulo` (§10.2 de PROPUESTA_MODULOS_EXTRA_POR_EMPRESA.md)
   *  que la Empresa necesita tener en su plan para ver este item — mismo
   *  código que usa el backend en `@RequireModulo` (`ModuloGuard`, §10.3).
   *  Coincide 1 a 1 con cada item de `navItems` de hoy (dashboard/orders/
   *  products/customers/discounts/messages). Opcional porque `settingsItem`
   *  (abajo) reutiliza esta misma interfaz pero NO pasa por
   *  `navItemsVisibles` — Settings no es un módulo, siempre está visible. */
  codigo?: string;
  /** Submenú tipo Shopify, variante "árbol" (ver ADMIN_DISENO.md >
   *  "Sidebar > Submenús") — a diferencia de la captura de referencia
   *  original, acá solo entran hijos que ya son rutas reales que cargan
   *  algo (aunque hoy sea un placeholder "TODO", mismo patrón que el
   *  resto de páginas de `features/*`) — nunca un link a una ruta que no
   *  existe. */
  children?: SubNavItem[];
}

/** Un hijo de submenú "árbol", ya "aplanado" con el `path` de su grupo
 *  dueño — ver `flatChildren` más abajo para el porqué. */
interface FlatChild extends SubNavItem {
  groupPath: string;
}

/** Hijo de una `SidebarSection` tipo "Sales channels" — a diferencia de
 *  `SubNavItem` (hijos del árbol de Products), estos SÍ llevan ícono
 *  propio: se renderizan como un item de primer nivel en miniatura (ícono
 *  + texto, fondo simple al hover), no como una fila de texto colgando de
 *  un conector. */
interface SectionChild {
  label: string;
  path: string;
  icon: string;
  /** Permiso necesario para que tenga sentido mostrar este item — Fase 5
   *  de `PROPUESTA_ROLES_Y_ACCESOS.md` (§6 paso 5): antes de sembrar
   *  `empleado_empresa`, todo el que entraba a `admin` (siempre `admin`
   *  viejo, o después `dueno_empresa`) tenía los mismos permisos, así que
   *  no hacía falta filtrar nada acá — con un empleado de permisos
   *  acotados de verdad en la mezcla, dejar los links siempre visibles
   *  llevaría a un 403 al primer click (`empleado_empresa` no tiene
   *  `usuarios.ver` ni `usuarios.cambiar_rol`). Mismo criterio que ya se
   *  usó en `staff/layout/sidebar/sidebar.component.ts`. */
  permiso: string;
}

/** Un grupo de sidebar tipo "Sales channels"/"Apps" de la captura de
 *  referencia: un encabezado que SOLO expande/contrae — no navega a
 *  ningún lado, por eso no tiene `path` ni `icon` propios, a diferencia
 *  de un `NavItem` como Products o Settings — y revela una lista plana de
 *  `SectionChild` con ícono. Sin el conector tipo árbol de
 *  Products/Settings: acá cada hijo ya se distingue por su propio ícono,
 *  calcado de cómo se ven "Online Store"/"Agentic"/"Point of Sale" en la
 *  referencia (fila completa, no una fila de texto indentada). */
interface SidebarSection {
  /** Clave única para `manuallyOpenGroups` / auto-expandir por URL — NUNCA
   *  es una ruta real, este grupo no navega. */
  key: string;
  label: string;
  children: SectionChild[];
}

/**
 * Navegación lateral del shell. Calcada de la captura 106 de Shopify
 * (ícono + texto, pill de item activo, Settings fijo abajo) — ver
 * ADMIN_DISENO.md > "Sidebar". Además de los 4 items originales de Goods
 * (Dashboard/Orders/Products/Customers) más Settings, ahora suma:
 * - **Discounts** y **Messages** como items nuevos de primer nivel — ya
 *   tienen backend real (`DescuentoModule`, `ChatModule`), a diferencia de
 *   Growth/Markets/Finance/Analytics/Sales channels/Apps de la captura
 *   original, que siguen fuera de alcance.
 * - **Submenú "árbol" de Products** (Categorías/Inventario/Proveedores/
 *   Compras) — cada hijo es una ruta real nueva (placeholder "TODO" por
 *   ahora, igual que el resto de `features/*`), nunca un link muerto.
 * - **Sección "Administración"** (Usuarios / Roles y permisos), calcada
 *   del patrón "Sales channels" de la captura — no del patrón de
 *   Products. Ver el comentario de `administracionSection` más abajo
 *   para el porqué de la diferencia.
 *
 * Íconos: `@tabler/icons-angular`, registrados con `provideTablerIcons` en
 * `app.config.ts` (`EnvironmentProviders` no puede ir en el `providers`
 * de un componente, solo a nivel de app o de ruta).
 *
 * Indicador deslizante de primer nivel (ver ADMIN_DISENO.md > "Sidebar >
 * Animación"): una única pill absolutamente posicionada que se desliza
 * entre items — al pasar el mouse (`hoveredIndex`) o, si no hay hover,
 * sobre el item de la ruta activa (`activeIndex`, actualizado vía
 * `(isActiveChange)` de cada `routerLinkActive`). Solo aplica a los items
 * de primer nivel del `@for` (Dashboard/Orders/Products/Customers/
 * Discounts/Messages).
 *
 * Submenú "árbol" (solo Products — ver ADMIN_DISENO.md > "Sidebar >
 * Submenús"): expandir/contraer anima la altura real vía la técnica CSS
 * `grid-template-rows` `0fr → 1fr` (sin medir nada por JS: el contenido
 * nunca se desmonta del DOM, solo se le clippea la altura), y los hijos
 * tienen su propio conector deslizante — una línea tipo "árbol" (trazo
 * vertical + codo hacia la derecha, dibujada con `border-left`/
 * `border-bottom` + radio de esquina, NO un ícono fijo) que nace pegada
 * arriba (justo debajo del item padre) y CRECE/ENCOGE hasta alcanzar al
 * hijo bajo el mouse (o, sin hover, al hijo activo). Se apoya en el mismo
 * mecanismo que la pill de arriba (offsetTop/offsetHeight reales vía
 * `viewChildren`) pero acotado a CADA wrapper de submenú (que es su
 * propio `position: relative`, así el offsetTop de un link nunca se
 * "escapa" hacia otro grupo ni hacia el indicador de primer nivel).
 *
 * Sección "Sales channels" (`administracionSection`): comparte el mismo
 * mecanismo de expandir/contraer (`grid-template-rows`, `toggleGroup`)
 * pero NO tiene conector ni mide nada por JS — sus hijos son filas
 * completas con ícono, se resuelven solo con CSS (`routerLinkActive` +
 * `hover:bg-nav-active`), igual que cualquier link simple del sidebar.
 */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  protected readonly navItems: NavItem[] = [
    { label: 'Dashboard', path: '/', icon: 'home-2-filled', exact: true, codigo: 'dashboard' },
    { label: 'Orders', path: '/orders', icon: 'inbox', exact: false, codigo: 'orders' },
    {
      label: 'Products',
      path: '/products',
      icon: 'tag-filled',
      exact: false,
      codigo: 'products',
      children: [
        { label: 'Categorías', path: '/products/categorias' },
        { label: 'Inventario', path: '/products/inventario' },
        { label: 'Proveedores', path: '/products/proveedores' },
        { label: 'Compras', path: '/products/compras' },
      ],
    },
    {
      label: 'Customers',
      path: '/customers',
      icon: 'user-filled',
      exact: false,
      codigo: 'customers',
    },
    {
      label: 'Discounts',
      path: '/discounts',
      icon: 'discount-2',
      exact: false,
      codigo: 'discounts',
    },
    {
      label: 'Messages',
      path: '/messages',
      icon: 'message-circle-2',
      exact: false,
      codigo: 'messages',
    },
  ];

  /** Items de primer nivel visibles para la Empresa logueada ahora — filtra
   *  `navItems` por `CurrentUser.modulosDisponibles` (§10.5 de
   *  PROPUESTA_MODULOS_EXTRA_POR_EMPRESA.md), mismo patrón que
   *  `administracionChildrenVisibles` filtra por `permisos`. Esto es SOLO
   *  UX (ocultar del menú lo que la Empresa no contrató) — quien de verdad
   *  impide el acceso es `ModuloGuard` en el backend, así que un link roto
   *  a mano (o una ruta escrita directo en la barra) sigue devolviendo 403,
   *  nunca datos. El resto del componente (indicador deslizante, índices,
   *  `flatChildren`) opera sobre ESTA lista filtrada, nunca sobre
   *  `navItems` cruda — así los índices de `viewChildren('link')` (que
   *  siguen el orden real del DOM) calzan siempre con los índices que este
   *  computed produce. */
  protected readonly navItemsVisibles = computed(() => {
    const modulos = this.authService.currentUser()?.modulosDisponibles ?? [];
    return this.navItems.filter(
      (item) => item.codigo !== undefined && modulos.includes(item.codigo),
    );
  });

  /** Settings queda fuera de `navItems`/del indicador deslizante de primer
   *  nivel (está separado del grupo, empujado abajo con `mt-auto`) — es un
   *  link simple, sin submenú propio: "Usuarios" y "Roles y permisos" ya
   *  no cuelgan de acá (ver `administracionSection`). */
  protected readonly settingsItem: NavItem = {
    label: 'Settings',
    path: '/settings',
    icon: 'settings-2',
    exact: true,
  };

  /** Sección tipo "Sales channels"/"Apps" de la captura de referencia —
   *  un encabezado sin ruta propia que despliega una lista de ítems con
   *  ícono. Acá agrupa "Usuarios" y "Roles y permisos" — antes vivían
   *  como submenú "árbol" de Settings, pero el usuario pidió sacarlos de
   *  ahí y calcar en su lugar este patrón visual distinto (sin conector,
   *  con ícono por ítem). Las rutas se mantienen bajo `/settings/*`
   *  (no cambian, `SETTINGS_ROUTES` sigue siendo su dueño) — lo único que
   *  cambió es DESDE DÓNDE se navega a ellas en el sidebar, no la URL en
   *  sí. Separados en dos ítems (no un solo "Usuarios y roles") porque
   *  son recursos y endpoints distintos en el backend:
   *  `UsuarioController` (`/usuarios`) vs. `RolController` +
   *  `PermisoController` (`/roles`, `/permisos`). Ubicada justo arriba de
   *  Settings (mismo lugar relativo que "Sales channels"/"Apps" en la
   *  referencia: después de los items principales, antes de la sección
   *  fija de abajo) — ver ADMIN_DISENO.md > "Sidebar > Submenús". */
  protected readonly administracionSection: SidebarSection = {
    key: 'administracion',
    label: 'Administración',
    children: [
      { label: 'Usuarios', path: '/settings/usuarios', icon: 'users', permiso: 'usuarios.ver' },
      {
        label: 'Roles y permisos',
        path: '/settings/roles',
        icon: 'shield-lock',
        // Fase 6 de PROPUESTA_ROLES_Y_ACCESOS.md (§5.4): ahora que los
        // roles son tenant-scoped, `SettingsRolesPageComponent` pega
        // contra `GET /roles` de verdad (antes, en la Fase 5, esta
        // pantalla era de solo lectura y usaba `GET /roles/asignables`,
        // por eso se gateaba con `usuarios.cambiar_rol` en vez de
        // `roles.ver` — `dueno_empresa` no tenía ese permiso todavía). La
        // migración `OtorgarPermisosDeRolesADuenoEmpresa` ya le dio
        // `roles.ver` a `dueno_empresa`, así que gatear por acá con ese
        // mismo permiso es lo consistente con lo que el backend exige.
        permiso: 'roles.ver',
      },
    ],
  };

  /** Hijos visibles de `administracionSection` para quien esté logueado
   *  ahora — ver el comentario de `SectionChild.permiso`. */
  protected readonly administracionChildrenVisibles = computed(() => {
    const permisos = this.authService.currentUser()?.permisos ?? [];
    return this.administracionSection.children.filter((child) =>
      permisos.includes(child.permiso),
    );
  });

  /** Índice bajo el mouse ahora mismo, o `null` si no está hovereando el
   *  grupo de nav (`nav (mouseleave)` lo limpia). */
  protected readonly hoveredIndex = signal<number | null>(null);
  /** Índice de la ruta activa — se actualiza desde `(isActiveChange)` de
   *  cada `routerLinkActive`, nunca se calcula la ruta a mano acá para no
   *  duplicar la lógica de matching que ya vive en el propio directive. */
  protected readonly activeIndex = signal(0);

  /** Un `ElementRef` por cada `#link` de primer nivel del `@for` — misma
   *  cantidad y orden que `navItems` (los links de un submenú desplegado
   *  no llevan `#link`, no participan de este indicador). */
  private readonly linkEls = viewChildren<ElementRef<HTMLElement>>('link');

  private readonly targetEl = computed(() => {
    const idx = this.hoveredIndex() ?? this.activeIndex();
    return this.linkEls()[idx]?.nativeElement ?? null;
  });

  protected readonly indicatorTop = computed(() => this.targetEl()?.offsetTop ?? 0);
  protected readonly indicatorHeight = computed(() => this.targetEl()?.offsetHeight ?? 0);
  protected readonly indicatorVisible = computed(() => this.targetEl() !== null);

  /** URL actual como signal (para saber si algún hijo de un grupo está
   *  activo y así auto-expandirlo al navegar directo a esa ruta) — no hay
   *  forma de leer `router.url` reactivamente sin esto, `Router` no expone
   *  un signal propio de la URL. */
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** Grupos/secciones que el usuario desplegó/contrajo a mano — Set de
   *  `item.path` (grupos árbol) o `section.key` (secciones tipo "Sales
   *  channels"), nunca de índice, para no depender del orden en que se
   *  declaran. */
  private readonly manuallyOpenGroups = signal<ReadonlySet<string>>(new Set());

  /** Todos los hijos del submenú "árbol" de Products, "aplanados" en un
   *  solo array en el mismo orden en que el template los renderiza —
   *  `childLinkEls()[k]` (por `#childLink`) corresponde siempre a
   *  `flatChildren()[k]`. Esto evita tener que pedirle a `viewChildren`
   *  una query separada por grupo (no existe forma directa de acotarla
   *  dentro de un `@for`). Los hijos de `administracionSection` NO entran
   *  acá — no tienen conector que medir, son filas simples. */
  protected readonly flatChildren = computed<FlatChild[]>(() => {
    const result: FlatChild[] = [];
    for (const item of this.navItemsVisibles()) {
      for (const child of item.children ?? []) {
        result.push({ ...child, groupPath: item.path });
      }
    }
    return result;
  });

  private readonly childLinkEls = viewChildren<ElementRef<HTMLElement>>('childLink');

  /** Índice (dentro de `flatChildren`) del hijo bajo el mouse ahora mismo. */
  protected readonly hoveredChildIndex = signal<number | null>(null);
  /** Índice del hijo activo (ruta actual) — mismo criterio que
   *  `activeIndex` de primer nivel. */
  protected readonly activeChildIndex = signal<number | null>(null);

  private readonly childTargetIndex = computed(
    () => this.hoveredChildIndex() ?? this.activeChildIndex(),
  );

  private readonly childTargetEl = computed(() => {
    const idx = this.childTargetIndex();
    return idx !== null ? (this.childLinkEls()[idx]?.nativeElement ?? null) : null;
  });

  /** Alto del "tronco" del conector — no es la altura de una fila (eso era
   *  la versión anterior, un ícono que saltaba de fila en fila), es la
   *  distancia desde el techo del wrapper (pegado al padre, `top: 0`)
   *  hasta el CENTRO vertical del hijo objetivo. El propio `<div>` del
   *  template dibuja el "codo" con `border-left` + `border-bottom` +
   *  radio en la esquina — al animar solo este alto, la línea se ve
   *  "extendiéndose" hacia abajo (o encogiéndose hacia arriba) en vez de
   *  saltar de una posición a otra. */
  protected readonly childElbowHeight = computed(() => {
    const el = this.childTargetEl();
    return el ? el.offsetTop + el.offsetHeight / 2 : 0;
  });

  protected onActiveChange(index: number, isActive: boolean): void {
    if (isActive) {
      this.activeIndex.set(index);
    }
  }

  /** Un grupo "árbol" (Products) se ve abierto si el usuario lo desplegó a
   *  mano, o si la URL actual cae dentro de alguno de sus hijos — así no
   *  se esconde el hijo activo al entrar directo a esa URL (recarga de
   *  página, link externo). */
  protected isGroupOpen(item: NavItem): boolean {
    if (!item.children) {
      return false;
    }
    const url = this.currentUrl();
    const childActive = item.children.some((child) => url.startsWith(child.path));
    return childActive || this.manuallyOpenGroups().has(item.path);
  }

  /** Mismo criterio que `isGroupOpen`, generalizado para una
   *  `SidebarSection` (que no tiene `path` propio, así que la clave para
   *  el Set es `section.key` en vez de una ruta). */
  protected isSectionOpen(section: SidebarSection): boolean {
    const url = this.currentUrl();
    const childActive = section.children.some((child) => url.startsWith(child.path));
    return childActive || this.manuallyOpenGroups().has(section.key);
  }

  protected toggleGroup(key: string): void {
    const next = new Set(this.manuallyOpenGroups());
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this.manuallyOpenGroups.set(next);
  }

  /** Busca el índice plano de un hijo puntual — llamado desde el template
   *  con (groupPath, childPath); los arrays son de a lo sumo 5 elementos
   *  en total, un `findIndex` acá no es un problema de performance. */
  protected childFlatIndex(groupPath: string, childPath: string): number {
    return this.flatChildren().findIndex(
      (c) => c.groupPath === groupPath && c.path === childPath,
    );
  }

  protected onChildActiveChange(flatIndex: number, isActive: boolean): void {
    if (isActive) {
      this.activeChildIndex.set(flatIndex);
    } else if (this.activeChildIndex() === flatIndex) {
      this.activeChildIndex.set(null);
    }
  }

  protected onChildAreaMouseLeave(): void {
    this.hoveredChildIndex.set(null);
  }

  /** El offsetTop/offsetHeight de arriba solo tiene sentido dentro del
   *  wrapper del grupo dueño del hijo objetivo (cada wrapper de submenú es
   *  su propio `position: relative` — ver comentario de la clase), así
   *  que cada grupo pregunta esto antes de dibujar SU flecha. */
  protected isChildArrowInGroup(groupPath: string): boolean {
    const idx = this.childTargetIndex();
    if (idx === null) {
      return false;
    }
    return this.flatChildren()[idx]?.groupPath === groupPath;
  }
}
