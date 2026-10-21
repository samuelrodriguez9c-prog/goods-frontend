import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, inject, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconAdjustmentsHorizontal, IconLayoutGrid, IconPackage, IconSearch, IconX, TablerIconComponent } from '@tabler/icons-angular';
import { CatalogoFiltrosStore } from '../../shared/catalogo-filtros.store';
import { TiendaConfigStore } from '../../shared/tienda-config.store';
import { TiendaCabezaComponent } from '../tienda-cabeza/tienda-cabeza.component';
import { TiendaCatalogoListaComponent } from '../tienda-catalogo-lista/tienda-catalogo-lista.component';
import { TiendaEtiquetaComponent } from '../tienda-etiqueta/tienda-etiqueta.component';
import { TiendaFiltrosComponent } from '../tienda-filtros/tienda-filtros.component';

/**
 * Tarjeta · Catálogo: moneda, agotados y la lista de productos con
 * búsqueda, filtros (popover) y grupos plegables. Clic afuera cierra el popover.
 */
@Component({
  selector: 'app-tienda-ficha-catalogo',
  imports: [FormsModule, TablerIconComponent, TiendaCabezaComponent, TiendaEtiquetaComponent, TiendaFiltrosComponent, TiendaCatalogoListaComponent],
  providers: [CatalogoFiltrosStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tienda-ficha-catalogo.component.html',
  host: { class: 'contents', '(document:click)': 'fl.fOpen.set(false)' },
})
export class TiendaFichaCatalogoComponent {
  protected readonly s = inject(TiendaConfigStore);
  protected readonly fl = inject(CatalogoFiltrosStore);
  protected readonly i = { grid: IconLayoutGrid, paquete: IconPackage, buscar: IconSearch, cerrar: IconX, filtros: IconAdjustmentsHorizontal };
  private readonly sec = viewChild.required<ElementRef<HTMLElement>>('sec');

  constructor() {
    afterNextRender(() => this.s.registrarTarjeta('catalogo', this.sec().nativeElement));
  }
}
