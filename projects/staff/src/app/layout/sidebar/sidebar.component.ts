import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  signal,
  viewChildren,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TablerIconComponent } from '@tabler/icons-angular';

interface NavItem {
  label: string;
  path: string;
  /** Nombre de ícono de Tabler (kebab-case, sin prefijo "Icon") —
   *  registrado en `app.config.ts` vía `provideTablerIcons`, mismo
   *  criterio que `admin/layout/sidebar/sidebar.component.ts`. */
  icon: string;
  exact: boolean;
}

/**
 * Navegación lateral del panel de staff — mismo lenguaje visual que
 * `admin/layout/sidebar/` (indicador deslizante de primer nivel, mismos
 * tokens de color) pero sin nada de la complejidad de ese sidebar
 * (submenú "árbol" de Products, sección "Sales channels"): acá los 5
 * items son todos de primer nivel, sin hijos — no hace falta esa
 * maquinaria, ver PIVOTE_SAAS_MULTITENANT.md §8 paso 5.
 *
 * Los 5 items son el núcleo del panel de staff aprobado por gerencia en
 * §7.2: Empresas (clientes+plan+estado) y Altas pendientes tienen
 * pantalla real conectada al backend (`GET /empresas`); Facturación,
 * Ingresos y Soporte quedan como placeholder "TODO" — mismo criterio que
 * el Dashboard de `admin` hoy (ver ADMIN_DISENO.md > "Dashboard /
 * Analítica") — porque el backend todavía no tiene un endpoint de
 * historial de pagos, una vista de ingresos agregados, ni el módulo de
 * mensajería adaptado a conversaciones staff↔Empresa (el `ChatModule`
 * existente es cliente↔negocio, de un emprendimiento, no de Goods con
 * sus clientes).
 *
 * Sin ítem "Settings" ni sección "Administración" (a diferencia de
 * `admin`): todavía no hay nada que configurar a nivel del panel de
 * staff en sí (no gestiona usuarios/roles de Goods desde acá todavía).
 */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  protected readonly navItems: NavItem[] = [
    { label: 'Empresas', path: '/empresas', icon: 'building', exact: false },
    { label: 'Altas pendientes', path: '/altas-pendientes', icon: 'user-plus', exact: false },
    { label: 'Facturación', path: '/facturacion', icon: 'receipt-2', exact: false },
    { label: 'Ingresos', path: '/ingresos', icon: 'report-money', exact: false },
    { label: 'Soporte', path: '/soporte', icon: 'headset', exact: false },
  ];

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
