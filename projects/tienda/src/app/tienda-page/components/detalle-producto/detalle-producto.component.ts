import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { FocoDialogoDirective } from '../../../core/foco-dialogo';
import { ICONOS } from '../../iconos';
import { TiendaStore } from '../../tienda.store';

/** Detalle de producto: modal centrado (escritorio) · hoja inferior a todo el ancho (móvil). Esc o clic afuera lo cierran. */
@Component({
  selector: 'app-detalle-producto',
  imports: [TablerIconComponent, FocoDialogoDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  templateUrl: './detalle-producto.component.html',
})
export class DetalleProductoComponent {
  protected readonly st = inject(TiendaStore);
  protected readonly i = ICONOS;
  protected readonly Math = Math;
}
