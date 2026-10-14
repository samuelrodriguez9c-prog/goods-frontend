import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { debounceTime, filter, map } from 'rxjs';
import { IconChevronDown, IconChevronRight, IconKeyboard, TablerIconComponent } from '@tabler/icons-angular';
import { AuthService } from '../../core/auth/auth.service';
import { AtajosService } from '../../core/ui/atajos.service';
import { CambiosPendientesService } from '../../core/realtime/cambios-pendientes.service';
import { AsistenteChatStore } from '../../core/asistente/asistente-chat.store';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { WhatsappService } from '../../core/whatsapp/whatsapp.service';
import type { AsistenteConversacion } from '../../core/asistente/models/asistente.model';

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

/** Sección con título (estructura de Shopify: "Sales channels", "Apps"...). */
interface Seccion {
  clave: 'canales' | 'administracion';
  titulo: string;
  items: NavItem[];
}

/** Duración de la apertura/cierre del submenú (grid-template-rows). */
const MS_GRUPO = 200;
/** Secciones que el usuario plegó a mano (sobrevive a recargas). */
const CLAVE_PLEGADAS = 'goods.sidebar.plegadas';
/** Cuántas conversaciones del asistente se listan en el sidebar. */
const MAX_CONVERSACIONES = 3;

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
 * Secciones con título, con la estructura del sidebar de Shopify
 * (2026-10-13): debajo del menú principal van "Canales de venta" (Tienda
 * en línea, WhatsApp), "Administración" (Usuarios, Roles y permisos,
 * Solicitudes a Goods) y "Conversaciones con IA" (las últimas 3 del
 * asistente; el título lleva a `/asistente`). El título de las dos
 * primeras pliega/despliega la sección y se recuerda en localStorage. Una
 * sección sin ítems visibles no se muestra.
 *
 * Cada ítem se muestra si el plan de la Empresa incluye su módulo
 * (`modulosDisponibles`) y, si lo pide, el permiso del rol.
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
  private readonly asistente = inject(AsistenteChatStore);
  private readonly whatsapp = inject(WhatsappService);
  /** Chats de WhatsApp con mensajes sin leer (insignia del ítem, rediseño 2026-10-13). */
  protected readonly waNoLeidos = signal(0);
  private readonly conWhatsapp = computed(() => {
    const u = this.authService.currentUser();
    return !!u?.modulosDisponibles?.includes('whatsapp') && !!u?.permisos?.includes('whatsapp.ver');
  });
  protected readonly iconChevron = IconChevronDown;
  protected readonly iconSeccion = IconChevronRight;
  protected readonly iconAtajos = IconKeyboard;
  /** Guía de atajos (handoff-productos §4). Hoy el diálogo vive en Products. */
  protected readonly atajos = inject(AtajosService);

  private readonly principal: NavItem[] = [
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
  ];

  private readonly secciones: Seccion[] = [
    {
      clave: 'canales',
      titulo: 'Canales de venta',
      items: [
        // Tienda pública con "Pedir por WhatsApp" (2026-10-10).
        { label: 'Tienda en línea', path: '/tienda', icon: 'building-store', exact: false, codigo: 'tienda', permiso: 'tienda.configurar' },
        // WhatsApp Fase 1 (2026-10-11): bandeja del número del negocio.
        { label: 'WhatsApp', path: '/whatsapp', icon: 'brand-whatsapp', exact: false, codigo: 'whatsapp', permiso: 'whatsapp.ver' },
      ],
    },
    {
      clave: 'administracion',
      titulo: 'Administración',
      items: [
        { label: 'Usuarios', path: '/settings/usuarios', icon: 'users', exact: false, codigo: 'users', permiso: 'usuarios.ver' },
        { label: 'Roles y permisos', path: '/settings/roles', icon: 'shield-lock', exact: false, codigo: 'roles', permiso: 'roles.ver' },
        // Pedirle mejoras a Goods (2026-10-04): no depende del plan.
        { label: 'Solicitudes a Goods', path: '/settings/solicitudes', icon: 'bulb', exact: false, permiso: 'solicitudes.crear' },
      ],
    },
  ];

  private visible(i: NavItem): boolean {
    const u = this.authService.currentUser();
    return (
      (!i.codigo || (u?.modulosDisponibles ?? []).includes(i.codigo)) &&
      (!i.permiso || (u?.permisos ?? []).includes(i.permiso))
    );
  }

  /**
   * Bloques del sidebar ya filtrados por plan y permisos: el primero es el
   * menú principal (sin título) y le siguen las secciones con ítems. Cada
   * ítem lleva su índice en la lista plana (`idx`), que es el que usan la
   * píldora y los `#link`.
   */
  protected readonly bloques = computed(() => {
    let idx = 0;
    const conIdx = (l: NavItem[]) => l.filter((i) => this.visible(i)).map((item) => ({ item, idx: idx++ }));
    const principal = { clave: null, titulo: null, items: conIdx(this.principal) };
    const secciones = this.secciones
      .map((sec) => ({ clave: sec.clave, titulo: sec.titulo, items: conIdx(sec.items) }))
      .filter((sec) => sec.items.length);
    return [principal, ...secciones];
  });

  /** Lista plana, en el mismo orden que los `#link` del template. */
  protected readonly navItems = computed(() => this.bloques().flatMap((b) => b.items.map((x) => x.item)));

  // ── Secciones plegables ───────────────────────────────────────────────

  protected readonly plegadas = signal<ReadonlySet<string>>(leerPlegadas());

  protected seccionAbierta(clave: string | null): boolean {
    return !clave || !this.plegadas().has(clave);
  }

  protected toggleSeccion(clave: string): void {
    const p = new Set(this.plegadas());
    p.has(clave) ? p.delete(clave) : p.add(clave);
    this.plegadas.set(p);
    try {
      localStorage.setItem(CLAVE_PLEGADAS, JSON.stringify([...p]));
    } catch {
      /* sin storage: el plegado dura lo que la sesión */
    }
    this.medir.update((n) => n + 1);
    setTimeout(() => this.medir.update((n) => n + 1), MS_GRUPO + 20);
  }

  // ── Conversaciones con IA (como "Sidekick conversations") ────────────

  protected readonly conAsistente = computed(() =>
    (this.authService.currentUser()?.modulosDisponibles ?? []).includes('asistente_ia'),
  );

  protected readonly conversaciones = computed(() =>
    [...this.asistente.conversaciones()]
      .sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn))
      .slice(0, MAX_CONVERSACIONES),
  );

  protected tituloConversacion(c: AsistenteConversacion): string {
    return c.titulo?.trim() || 'Nueva conversación';
  }

  protected esConversacionActiva(c: AsistenteConversacion): boolean {
    return this.ruta() === '/asistente' && this.asistente.activaId() === c.id;
  }

  private cargarNoLeidosWa(): void {
    this.whatsapp.conversaciones({ noLeidas: true }).subscribe({ next: (r) => this.waNoLeidos.set(r.conNoLeidos), error: () => undefined });
  }

  /** Abre la conversación en la pantalla completa del asistente. */
  protected abrirConversacion(c: AsistenteConversacion): void {
    this.asistente.seleccionar(c.id);
    this.router.navigateByUrl('/asistente');
  }

  constructor() {
    // El historial se carga una sola vez (el store lo comparte con el mini
    // chat y la pantalla completa).
    effect(() => {
      if (this.conAsistente()) this.asistente.cargar();
    });
    effect(() => {
      if (this.conWhatsapp()) this.cargarNoLeidosWa();
    });
    inject(RealtimeService)
      .escuchar('whatsapp:cambio')
      .pipe(debounceTime(600), takeUntilDestroyed())
      .subscribe(() => this.conWhatsapp() && this.cargarNoLeidosWa());
  }

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
  /** "Atajos" solo se muestra donde el diálogo está montado (lista de Products). */
  protected readonly conAtajos = computed(() => this.ruta() === '/products');

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

  // ── Píldora (una sola para ítems de primer nivel y del submenú) ────────

  /** Se incrementa para forzar a recalcular posiciones (offsetTop no es reactivo). */
  private readonly medir = signal(0);
  protected readonly hoveredIndex = signal<number | null>(null);
  private readonly linkEls = viewChildren<ElementRef<HTMLElement>>('link');

  /** Ítem de primer nivel de la ruta actual (Products también con sus hijos). */
  protected readonly activeIndex = computed(() =>
    this.navItems().findIndex((i) => this.coincide(i.path, i.exact)),
  );

  /** Índice plano → clave de su sección (null = menú principal). */
  private readonly seccionDe = computed(() => {
    const m = new Map<number, string | null>();
    for (const b of this.bloques()) for (const x of b.items) m.set(x.idx, b.clave);
    return m;
  });

  private readonly navEl = viewChild.required<ElementRef<HTMLElement>>('nav');

  /** El ítem con submenú (Products) y si está desplegado. */
  private readonly grupo = computed(() => this.navItems().find((i) => i.hijos) ?? null);
  private readonly grupoAbierto = computed(() => {
    const g = this.grupo();
    return !!g && this.abierto(g);
  });

  /**
   * Dónde va la píldora: lo que está bajo el mouse (un ítem o un hijo del
   * submenú) o, si no hay nada, la ruta actual. Estando en un hijo, la
   * píldora va al hijo y no a Products (si el submenú está plegado, vuelve
   * a Products). Es UNA sola píldora que se desliza entre los dos niveles.
   */
  private readonly targetEl = computed(() => {
    this.medir();
    const hijos = this.childEls();
    const hc = this.hoveredChild();
    if (hc !== null && this.grupoAbierto()) return hijos[hc]?.nativeElement ?? null;

    const hi = this.hoveredIndex();
    if (hi === null && this.grupoAbierto()) {
      const activo = this.hijosVisibles().findIndex((h) => this.coincide(h.path, false));
      if (activo >= 0) return hijos[activo]?.nativeElement ?? null;
    }
    const idx = hi ?? this.activeIndex();
    // Un ítem de una sección plegada no tiene dónde mostrar la píldora.
    if (idx < 0 || !this.seccionAbierta(this.seccionDe().get(idx) ?? null)) return null;
    return this.linkEls()[idx]?.nativeElement ?? null;
  });

  /**
   * Posición relativa al `<nav>` medida con `getBoundingClientRect` (y no
   * con `offsetTop`): los hijos del submenú cuelgan de un contenedor
   * `relative`, así que su `offsetParent` no es el `<nav>`.
   */
  private readonly caja = computed(() => {
    this.medir();
    const el = this.targetEl();
    if (!el) return { top: 0, alto: 0 };
    const nav = this.navEl().nativeElement;
    const r = el.getBoundingClientRect();
    return { top: r.top - nav.getBoundingClientRect().top + nav.scrollTop, alto: r.height };
  });

  protected readonly indicatorTop = computed(() => this.caja().top);
  protected readonly indicatorHeight = computed(() => this.caja().alto);
  protected readonly indicatorVisible = computed(() => this.targetEl() !== null);

  protected hoverItem(i: number): void {
    this.hoveredIndex.set(i);
    this.hoveredChild.set(null);
  }

  protected hoverHijo(n: number): void {
    this.hoveredChild.set(n);
    this.hoveredIndex.set(null);
  }

  protected soltarHover(): void {
    this.hoveredIndex.set(null);
    this.hoveredChild.set(null);
  }

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

function leerPlegadas(): ReadonlySet<string> {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_PLEGADAS) ?? '[]');
    return new Set(Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}
