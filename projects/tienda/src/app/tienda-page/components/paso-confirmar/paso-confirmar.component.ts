import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { ICONOS } from '../../iconos';
import { PedidoStore } from '../../pedido.store';
import { TiendaStore } from '../../tienda.store';
import { NubesComponent } from '../nubes/nubes.component';
import { OlaComponent } from '../ola/ola.component';
import { SelloComponent } from '../sello/sello.component';

/** Paso 4 · ¿Ya lo enviaste?: sin «Volver»; con el pedido guardado avisa su número (el carrito ya se vació). */
@Component({
  selector: 'app-paso-confirmar',
  imports: [TablerIconComponent, NubesComponent, OlaComponent, SelloComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  templateUrl: './paso-confirmar.component.html',
})
export class PasoConfirmarComponent {
  protected readonly st = inject(TiendaStore);
  protected readonly pd = inject(PedidoStore);
  protected readonly i = ICONOS;
}
