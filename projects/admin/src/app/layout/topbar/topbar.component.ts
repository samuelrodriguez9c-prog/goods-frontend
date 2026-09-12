import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IconBell, IconRobot, IconSearch, TablerIconComponent } from '@tabler/icons-angular';

/**
 * Barra superior del shell. Construida por partes calcando la captura
 * 106 de Shopify (ver ADMIN_DISENO.md > "Topbar"):
 * - Izquierda (hecho): wordmark "Goods" + badge de versión.
 * - Centro (hecho): buscador global (solo estructura/estilo — sin lógica
 *   de búsqueda real ni atajo de teclado ⌘K funcional todavía).
 * - Derecha (hecho): ícono de asistente IA, notificaciones, avatar +
 *   nombre de usuario — todos sin lógica real todavía (ver
 *   ADMIN_DISENO.md > "Topbar > Derecha").
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
  protected readonly iconSearch = IconSearch;
  protected readonly iconBot = IconRobot;
  protected readonly iconBell = IconBell;
}
