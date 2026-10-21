import { ChangeDetectionStrategy, Component, ElementRef, inject, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TablerIconComponent } from '@tabler/icons-angular';
import { ICONOS } from '../../iconos';
import { PedidoStore } from '../../pedido.store';
import { TiendaStore } from '../../tienda.store';
import { OlaComponent } from '../ola/ola.component';
import { PiePasoComponent } from '../pie-paso/pie-paso.component';

/** Paso 1 · Entrega: recoger en la tienda o domicilio (con la dirección, que se enfoca sola). */
@Component({
  selector: 'app-paso-entrega',
  imports: [FormsModule, TablerIconComponent, OlaComponent, PiePasoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  templateUrl: './paso-entrega.component.html',
})
export class PasoEntregaComponent {
  protected readonly st = inject(TiendaStore);
  protected readonly pd = inject(PedidoStore);
  protected readonly i = ICONOS;
  private readonly dirRef = viewChild<ElementRef<HTMLInputElement>>('inputDir');

  constructor() {
    this.st.refs.dir = this.dirRef;
  }
}
