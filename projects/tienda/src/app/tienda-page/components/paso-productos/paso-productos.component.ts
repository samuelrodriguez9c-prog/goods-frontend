import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { ICONOS } from '../../iconos';
import { PedidoStore } from '../../pedido.store';
import { TiendaStore } from '../../tienda.store';
import { PiePasoComponent } from '../pie-paso/pie-paso.component';

/** Paso 0 · Tu pedido: las líneas en tarjetas deslizables (sumar/quitar), «Seguir comprando» y «Agrega también». */
@Component({
  selector: 'app-paso-productos',
  imports: [TablerIconComponent, PiePasoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  templateUrl: './paso-productos.component.html',
})
export class PasoProductosComponent {
  protected readonly st = inject(TiendaStore);
  protected readonly pd = inject(PedidoStore);
  protected readonly i = ICONOS;
}
