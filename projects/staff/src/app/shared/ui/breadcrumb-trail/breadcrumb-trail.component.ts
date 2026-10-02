import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TablerIconComponent } from '@tabler/icons-angular';
import { NavigationTrailService } from '../../../core/navigation/navigation-trail.service';
import { IaMarcaComponent } from '../ia-marca/ia-marca.component';

/**
 * Rastro de navegación clickeable del topbar (§5.4.4, 2026-10-02) — lee
 * `NavigationTrailService.trail` y lo pinta como "Staff › Empresas ›
 * Usuarios › Settings", con el ícono de cada módulo + su nombre. El
 * último ítem (la página actual) va resaltado y SIN click (ya estás
 * ahí); los anteriores navegan de vuelta con `router.navigateByUrl`.
 *
 * Generaliza el breadcrumb fijo que antes solo vivía, hardcodeado, en
 * `AsistentePageComponent`/`TopbarComponent` (gateado por `enAsistente`)
 * — ver el comentario de `NavigationTrailService` para el porqué.
 *
 * `:host { display: contents }` para no agregar una caja propia: el
 * `<nav>` de adentro pasa a ser directamente el hijo flex del contenedor
 * de `TopbarComponent` que lo monta (mismo criterio que cualquier
 * "wrapper lógico" sin estilos propios).
 *
 * Íconos en `#2be0d5` (pedido explícito, 2026-10-02: "el color del icon
 * de asistente") — es el mismo turquesa que ya usa `IaMarcaComponent`
 * (ver ese componente), así que el ícono de `app-ia-marca` cuando el
 * ítem es "Asistente de IA" ya calzaba solo; acá se fuerza el mismo tono
 * en los `tabler-icon` del resto de los módulos para que todos los
 * ítems del rastro se vean consistentes entre sí.
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
