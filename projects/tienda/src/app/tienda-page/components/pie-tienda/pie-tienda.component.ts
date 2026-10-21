import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { environment } from '../../../../environments/environment';
import { BurbujaDirective } from '../../../core/movimiento';
import { ICONOS } from '../../iconos';
import { PedidoStore } from '../../pedido.store';
import { TiendaStore } from '../../tienda.store';

/** Pie: logo y redes, columnas Catálogo · Tienda · Contacto · Horario, crédito de Goods y la ola de burbujas con «Escríbenos». */
@Component({
  selector: 'app-pie-tienda',
  imports: [TablerIconComponent, BurbujaDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  templateUrl: './pie-tienda.component.html',
})
export class PieTiendaComponent {
  protected readonly st = inject(TiendaStore);
  protected readonly pd = inject(PedidoStore);
  protected readonly i = ICONOS;
  protected readonly goodsRegistro = environment.goodsRegistro;
  protected readonly anio = new Date().getFullYear();
}
