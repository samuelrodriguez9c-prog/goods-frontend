import { ChangeDetectionStrategy, Component, ElementRef, inject, viewChild, viewChildren } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { BurbujaDirective, RevelarDirective } from '../../../core/movimiento';
import { ICONOS } from '../../iconos';
import { TiendaStore } from '../../tienda.store';
import { TarjetaProductoComponent } from '../tarjeta-producto/tarjeta-producto.component';

/**
 * Catálogo por categorías (una sección por categoría con productos), las
 * categorías como chips en móvil y «Nada con …» cuando la búsqueda no
 * encuentra nada. Registra el ancla y las secciones para el scroll.
 */
@Component({
  selector: 'app-catalogo-tienda',
  imports: [TablerIconComponent, BurbujaDirective, RevelarDirective, TarjetaProductoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  templateUrl: './catalogo-tienda.component.html',
})
export class CatalogoTiendaComponent {
  protected readonly st = inject(TiendaStore);
  protected readonly i = ICONOS;
  private readonly catalogoRef = viewChild<ElementRef<HTMLElement>>('catalogo');
  private readonly seccionRefs = viewChildren<ElementRef<HTMLElement>>('seccion');

  constructor() {
    this.st.refs.catalogo = this.catalogoRef;
    this.st.refs.secciones = this.seccionRefs;
  }
}
