import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { RevelarDirective } from '../../../core/movimiento';
import { ProductoPublico } from '../../../core/tienda.model';
import { ICONOS } from '../../iconos';
import { TiendaStore } from '../../tienda.store';

/** Tarjeta-arco de un producto del catálogo: imagen o inicial, etiqueta (−% / Últimas unidades), + o cantidad, precio y «Preguntar». */
@Component({
  selector: 'app-tarjeta-producto',
  imports: [TablerIconComponent, RevelarDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  templateUrl: './tarjeta-producto.component.html',
})
export class TarjetaProductoComponent {
  protected readonly st = inject(TiendaStore);
  protected readonly i = ICONOS;
  readonly producto = input.required<ProductoPublico>();
  /** Posición en su sección: escalona la aparición (de a 4). */
  readonly indice = input(0);
}
