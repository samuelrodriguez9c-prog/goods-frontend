import { ChangeDetectionStrategy, Component, ElementRef, inject, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TablerIconComponent } from '@tabler/icons-angular';
import { ICONOS } from '../../iconos';
import { PedidoStore } from '../../pedido.store';
import { TiendaStore } from '../../tienda.store';
import { OlaComponent } from '../ola/ola.component';
import { PiePasoComponent } from '../pie-paso/pie-paso.component';

const NOTAS_RAPIDAS = ['Entregar en la tarde', 'Es un regalo', 'Llamar antes de llegar'];

/** Paso 2 · Tus datos: nombre y celular (los exige el backend), nota con atajos y la casilla de promociones. */
@Component({
  selector: 'app-paso-datos',
  imports: [FormsModule, TablerIconComponent, OlaComponent, PiePasoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  templateUrl: './paso-datos.component.html',
})
export class PasoDatosComponent {
  protected readonly st = inject(TiendaStore);
  protected readonly pd = inject(PedidoStore);
  protected readonly i = ICONOS;
  protected readonly notasRapidas = NOTAS_RAPIDAS;
  private readonly nombreRef = viewChild<ElementRef<HTMLInputElement>>('inputNombre');

  constructor() {
    this.st.refs.nombre = this.nombreRef;
  }
}
