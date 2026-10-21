import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { ICONOS } from '../../iconos';
import { PedidoStore } from '../../pedido.store';
import { TiendaStore } from '../../tienda.store';
import { NubesComponent } from '../nubes/nubes.component';
import { OlaComponent } from '../ola/ola.component';
import { SelloComponent } from '../sello/sello.component';

/** Paso 5 · Pedido enviado: el negocio responde por WhatsApp; «Seguir viendo productos». */
@Component({
  selector: 'app-paso-enviado',
  imports: [TablerIconComponent, NubesComponent, OlaComponent, SelloComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  templateUrl: './paso-enviado.component.html',
})
export class PasoEnviadoComponent {
  protected readonly st = inject(TiendaStore);
  protected readonly pd = inject(PedidoStore);
  protected readonly i = ICONOS;
}
