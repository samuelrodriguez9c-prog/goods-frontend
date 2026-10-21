import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TablerIconComponent } from '@tabler/icons-angular';
import { NavigationTrailService } from '../../../core/navigation/navigation-trail.service';
import { IaMarcaComponent } from '../ia-marca/ia-marca.component';

/**
 * Rastro de navegación del topbar ("› Empresas › Usuarios › Settings"):
 * pinta `NavigationTrailService.trail` con el ícono y el nombre de cada
 * módulo. El último ítem es la página actual y no es clickeable; los
 * anteriores navegan de vuelta.
 *
 * `:host { display: contents }` para que el `<nav>` sea directamente hijo
 * flex del contenedor del topbar. Los íconos van en `#2be0d5`, el turquesa
 * de `IaMarcaComponent`, para que todos los ítems se vean iguales.
 */
@Component({
  selector: 'app-breadcrumb-trail',
  standalone: true,
  imports: [TablerIconComponent, IaMarcaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [':host { display: contents; }'],
  templateUrl: './breadcrumb-trail.component.html',
})
export class BreadcrumbTrailComponent {
  private readonly router = inject(Router);
  protected readonly trailService = inject(NavigationTrailService);

  protected ir(href: string): void {
    this.router.navigateByUrl(href);
  }
}
