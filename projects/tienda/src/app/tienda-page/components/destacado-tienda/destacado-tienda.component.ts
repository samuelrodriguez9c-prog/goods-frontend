import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { RevelarDirective } from '../../../core/movimiento';
import { ICONOS } from '../../iconos';
import { TiendaStore } from '../../tienda.store';

/** Primer producto `destacado` disponible, en grande, con cantidad y «Agregar». Sin destacado (o buscando) no se muestra. */
@Component({
  selector: 'app-destacado-tienda',
  imports: [TablerIconComponent, RevelarDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  templateUrl: './destacado-tienda.component.html',
})
export class DestacadoTiendaComponent {
  protected readonly st = inject(TiendaStore);
  protected readonly i = ICONOS;
  protected readonly Math = Math;
}
