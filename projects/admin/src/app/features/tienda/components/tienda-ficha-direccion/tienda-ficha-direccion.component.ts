import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, inject, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconAlertCircle, IconCircleCheck, IconCircleCheckFilled, IconCircleXFilled, IconLink, TablerIconComponent } from '@tabler/icons-angular';
import { TiendaConfigStore } from '../../shared/tienda-config.store';
import { TiendaCabezaComponent } from '../tienda-cabeza/tienda-cabeza.component';
import { TiendaEtiquetaComponent } from '../tienda-etiqueta/tienda-etiqueta.component';

/** Tarjeta · Dirección: el slug, con el aviso de libre / ocupada / reservada mientras se escribe. */
@Component({
  selector: 'app-tienda-ficha-direccion',
  imports: [FormsModule, TablerIconComponent, TiendaCabezaComponent, TiendaEtiquetaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tienda-ficha-direccion.component.html',
  host: { class: 'contents' },
})
export class TiendaFichaDireccionComponent {
  protected readonly s = inject(TiendaConfigStore);
  protected readonly i = { link: IconLink, checkLleno: IconCircleCheckFilled, xLleno: IconCircleXFilled, alerta: IconAlertCircle, checkCirc: IconCircleCheck };
  private readonly sec = viewChild.required<ElementRef<HTMLElement>>('sec');

  constructor() {
    afterNextRender(() => this.s.registrarTarjeta('direccion', this.sec().nativeElement));
  }
}
