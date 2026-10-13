import { Injectable, signal } from '@angular/core';

export type MenuCategorias = 'agrupar' | 'acciones' | 'estado' | 'padre' | 'orden' | 'moverA';

/**
 * El menú abierto de la pantalla (uno a la vez). Lo provee la página: ella lo
 * cierra con clic afuera o Esc, y las pestañas y la barra de selección lo abren.
 */
@Injectable()
export class MenuActivo {
  readonly actual = signal<MenuCategorias | null>(null);

  abierto(k: MenuCategorias): boolean {
    return this.actual() === k;
  }
  alternar(k: MenuCategorias, e?: Event): void {
    e?.stopPropagation();
    this.actual.update((m) => (m === k ? null : k));
  }
  cerrar(): void {
    this.actual.set(null);
  }
}
