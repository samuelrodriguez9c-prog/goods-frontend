import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IconCheck, TablerIconComponent } from '@tabler/icons-angular';
import { CatalogoFiltrosStore } from '../../shared/catalogo-filtros.store';

/** Popover de filtros del catálogo: secciones a la izquierda (Estado, Categoría, Foto, Agrupar) y sus opciones a la derecha. */
@Component({
  selector: 'app-tienda-filtros',
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tienda-filtros.component.html',
  host: { class: 'contents' },
})
export class TiendaFiltrosComponent {
  protected readonly fl = inject(CatalogoFiltrosStore);
  protected readonly i = { check: IconCheck };
}
