import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IconChevronDown, IconPencil, IconPhotoOff, TablerIconComponent } from '@tabler/icons-angular';
import { CatalogoFiltrosStore } from '../../shared/catalogo-filtros.store';
import { ESTADOS_TIENDA } from '../../shared/tienda-config.modelo';
import { TiendaConfigStore } from '../../shared/tienda-config.store';

/**
 * Productos del catálogo en grupos plegables (por estado, categoría o sin
 * agrupar). Cada fila lleva a Productos con clic, Enter o Espacio.
 */
@Component({
  selector: 'app-tienda-catalogo-lista',
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tienda-catalogo-lista.component.html',
  host: { class: 'contents' },
})
export class TiendaCatalogoListaComponent {
  protected readonly s = inject(TiendaConfigStore);
  protected readonly fl = inject(CatalogoFiltrosStore);
  protected readonly i = { chevron: IconChevronDown, sinFoto: IconPhotoOff, lapiz: IconPencil };
  protected readonly ESTADOS = ESTADOS_TIENDA;

  protected stockTxt(n: number | null): string { return n === null ? '' : n ? `${n} u.` : 'Sin stock'; }
  protected stockColor(n: number | null): string { return !n ? '#b42318' : n < 5 ? '#8a6100' : '#303030'; }
  protected stockAncho(n: number | null): string { return `${n ? Math.max(6, Math.min(100, (n / 40) * 100)) : 0}%`; }
}
