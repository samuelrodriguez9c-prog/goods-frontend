import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IcComponent } from '../../../../products/shared/ui/ic/ic.component';
import { CANAL, Canal } from '../../ventas.modelos';

/**
 * Ícono del canal del pedido (panel, tienda en línea o WhatsApp) en su
 * cuadro de color. `esquina` lo pega abajo a la derecha del avatar de la
 * hoja, con el aro blanco.
 */
@Component({
  selector: 'app-icono-canal',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex shrink-0 items-center justify-center rounded-lg',
    '[class]': "esquina() ? 'absolute -bottom-[5px] -right-[5px] shadow-[0_0_0_3px_#fff]' : ''",
    '[style.width.px]': 'tam()',
    '[style.height.px]': 'tam()',
    '[style.background-color]': 'c().bg',
    '[style.color]': 'c().fg',
    '[title]': "c().t + ' · ' + c().d",
  },
  template: `<app-ic [nombre]="c().ic" [size]="Math.round(tam() * 0.54)" />`,
})
export class IconoCanalComponent {
  readonly canal = input.required<Canal>();
  readonly tam = input(24);
  readonly esquina = input(false);
  protected readonly c = computed(() => CANAL[this.canal()]);
  protected readonly Math = Math;
}
