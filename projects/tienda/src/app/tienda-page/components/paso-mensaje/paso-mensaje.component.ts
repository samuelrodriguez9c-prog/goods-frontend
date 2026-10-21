import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { ICONOS } from '../../iconos';
import { PedidoStore } from '../../pedido.store';
import { TiendaStore } from '../../tienda.store';
import { NubesComponent } from '../nubes/nubes.component';
import { OlaComponent } from '../ola/ola.component';

/** Paso 3 · Así le llegará: vista previa del mensaje de WhatsApp y «Enviar por WhatsApp». */
@Component({
  selector: 'app-paso-mensaje',
  imports: [TablerIconComponent, NubesComponent, OlaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  templateUrl: './paso-mensaje.component.html',
})
export class PasoMensajeComponent {
  protected readonly st = inject(TiendaStore);
  protected readonly pd = inject(PedidoStore);
  protected readonly i = ICONOS;
}
