import { ChangeDetectionStrategy, Component, ElementRef, inject, viewChild } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { BurbujaDirective } from '../../../core/movimiento';
import { ICONOS } from '../../iconos';
import { TiendaStore } from '../../tienda.store';

/** Hero verde con burbujas: «Recibiendo pedidos», nombre grande, frase, «Ver productos» / «Escribir» y los 3 pasos. */
@Component({
  selector: 'app-hero-tienda',
  imports: [TablerIconComponent, BurbujaDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  templateUrl: './hero-tienda.component.html',
})
export class HeroTiendaComponent {
  protected readonly st = inject(TiendaStore);
  protected readonly i = ICONOS;
  /** El contenido del hero se desplaza y se desvanece con el scroll (lo pinta la página). */
  private readonly heroRef = viewChild<ElementRef<HTMLElement>>('hero');

  constructor() {
    this.st.refs.hero = this.heroRef;
  }
}
