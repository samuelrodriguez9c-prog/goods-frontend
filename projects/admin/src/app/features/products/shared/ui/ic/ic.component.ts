import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { icono } from '../iconos';

/**
 * Ícono por nombre corto (`'truck-delivery'`, `'cash'`…), resuelto contra
 * `ICONOS`. Para las plantillas que arman el ícono desde datos (tablas de
 * estado, canales, grupos) sin importar cada `Icon*` a mano.
 */
@Component({
  selector: 'app-ic',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0' },
  template: `<tabler-icon [icon]="ic()" [size]="size()" [stroke]="stroke()" />`,
})
export class IcComponent {
  readonly nombre = input.required<string>();
  readonly size = input(16);
  readonly stroke = input(2);
  protected readonly ic = computed(() => icono(this.nombre()));
}
