import { ChangeDetectionStrategy, Component, ElementRef, inject, viewChild } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { FocoDialogoDirective } from '../../../core/foco-dialogo';
import { BurbujaDirective } from '../../../core/movimiento';
import { ICONOS } from '../../iconos';
import { PedidoStore } from '../../pedido.store';
import { TiendaStore } from '../../tienda.store';
import { PasoConfirmarComponent } from '../paso-confirmar/paso-confirmar.component';
import { PasoDatosComponent } from '../paso-datos/paso-datos.component';
import { PasoEntregaComponent } from '../paso-entrega/paso-entrega.component';
import { PasoEnviadoComponent } from '../paso-enviado/paso-enviado.component';
import { PasoMensajeComponent } from '../paso-mensaje/paso-mensaje.component';
import { PasoProductosComponent } from '../paso-productos/paso-productos.component';

/**
 * Isla «Tu pedido»: barra flotante cerrada ↔ hoja abierta (`PedidoStore.isla`).
 * Abierta: título del paso, riel de los 4 pasos, error del envío y los 6
 * pasos en un carril que se desliza; solo el paso actual es interactivo
 * (`[inert]` en los demás) y el foco queda dentro mientras está abierta.
 */
@Component({
  selector: 'app-isla-pedido',
  imports: [
    TablerIconComponent, FocoDialogoDirective, BurbujaDirective, PasoProductosComponent, PasoEntregaComponent,
    PasoDatosComponent, PasoMensajeComponent, PasoConfirmarComponent, PasoEnviadoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  templateUrl: './isla-pedido.component.html',
})
export class IslaPedidoComponent {
  protected readonly st = inject(TiendaStore);
  protected readonly pd = inject(PedidoStore);
  protected readonly i = ICONOS;
  /** Destino del punto que «vuela» al agregar un producto. */
  private readonly islaRef = viewChild<ElementRef<HTMLElement>>('islaEl');

  constructor() {
    this.st.refs.isla = this.islaRef;
  }
}
