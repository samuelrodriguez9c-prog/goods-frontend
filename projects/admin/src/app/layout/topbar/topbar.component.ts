import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Barra superior del shell — versión mínima. Calcada solo en color
 * (`--color-topbar`, ver ADMIN_DISENO.md > "Lenguaje visual general") por
 * ahora: el diseño real (buscador global, ícono de asistente IA,
 * notificaciones, menú de usuario, y el modo contextual de
 * breadcrumb+título+acciones en pantallas de edición) es trabajo aparte,
 * todavía no especificado a nivel de composite.
 */
@Component({
  selector: 'app-topbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './topbar.component.html',
})
export class TopbarComponent {}
