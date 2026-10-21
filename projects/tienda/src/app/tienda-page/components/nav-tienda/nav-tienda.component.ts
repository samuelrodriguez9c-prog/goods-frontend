import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, signal, viewChild, viewChildren } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TablerIconComponent } from '@tabler/icons-angular';
import { ICONOS } from '../../iconos';
import { PedidoStore } from '../../pedido.store';
import { TiendaStore } from '../../tienda.store';

/**
 * Nav flotante: transparente sobre el hero y píldora blanca al bajar
 * (`TiendaStore.nav`). Logo o monograma, categorías con indicador que
 * sigue a la sección visible, búsqueda que se despliega y botón «Pedido».
 */
@Component({
  selector: 'app-nav-tienda',
  imports: [FormsModule, TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  templateUrl: './nav-tienda.component.html',
})
export class NavTiendaComponent {
  protected readonly st = inject(TiendaStore);
  protected readonly pd = inject(PedidoStore);
  protected readonly i = ICONOS;
  protected readonly indicador = signal({ w: 0, x: 0, o: 0 });
  private readonly navRefs = viewChildren<ElementRef<HTMLElement>>('navBtn');
  private readonly busquedaRef = viewChild<ElementRef<HTMLInputElement>>('inputBusqueda');

  constructor() {
    this.st.refs.busqueda = this.busquedaRef;
    effect(() => { this.st.seccionActiva(); this.navRefs(); queueMicrotask(() => this.moverIndicador()); });
  }

  private moverIndicador(): void {
    const k = this.st.secciones().findIndex((s) => s.id === this.st.seccionActiva());
    const btn = k >= 0 ? this.navRefs()[k]?.nativeElement : null;
    this.indicador.set(btn ? { w: btn.offsetWidth, x: btn.offsetLeft, o: 1 } : { ...this.indicador(), o: 0 });
  }
}
