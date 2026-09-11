import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';

/**
 * Layout raíz del admin: topbar + sidebar + área de contenido. Se monta
 * como el componente de la ruta `''` en `app.routes.ts`, con cada
 * feature colgando como ruta hija — así el día de mañana una pantalla
 * sin sidebar (ej. login) puede vivir en otra rama de rutas sin este
 * layout, sin tener que tocar `App`.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, TopbarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.component.html',
})
export class ShellComponent {}
