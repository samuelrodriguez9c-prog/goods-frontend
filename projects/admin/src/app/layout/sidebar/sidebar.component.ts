import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavItem {
  label: string;
  path: string;
  /** Solo el item de Dashboard necesita match exacto (vive en '/'). */
  exact: boolean;
}

/**
 * Navegación lateral del shell — versión mínima: texto plano, sin
 * íconos ni submenús expandibles todavía (Orders → Drafts/Shipping
 * labels, Products → Collections/Inventory, descritos en
 * ADMIN_DISENO.md > "Lenguaje visual general", quedan pendientes). Los
 * 4 items de acá son exactamente las 4 áreas ya documentadas —
 * Dashboard, Orders, Products, Customers — no las secciones extra de
 * Shopify (Discounts, Markets, Content, etc.) que están fuera del
 * alcance definido para Goods.
 */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  protected readonly navItems: NavItem[] = [
    { label: 'Dashboard', path: '/', exact: true },
    { label: 'Orders', path: '/orders', exact: false },
    { label: 'Products', path: '/products', exact: false },
    { label: 'Customers', path: '/customers', exact: false },
  ];
}
