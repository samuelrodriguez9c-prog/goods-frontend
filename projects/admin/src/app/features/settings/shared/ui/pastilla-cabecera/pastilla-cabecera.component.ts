import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';
import { IcComponent } from '../../../../products/shared/ui/ic/ic.component';

/**
 * Pastilla junto al título de la página (va en el `[pastilla]` de
 * `app-modulo-cabecera`): con ícono o con punto, y el punto puede latir.
 */
@Component({
  selector: 'app-pastilla-cabecera',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'ml-1 inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full pl-2 pr-[9px] text-[11.5px] font-medium',
    '[style.background]': 'bg()',
    '[style.color]': 'fg()',
  },
  template: `
    @if (icono()) {
      <app-ic [nombre]="icono()!" [size]="12" />
    } @else if (punto()) {
      <span class="relative flex size-1.5">
        @if (latido()) {
          <span
            class="absolute inset-0 animate-[gp-latido_2.4s_ease-in-out_infinite] rounded-full"
            [style.background]="punto()"
          ></span>
        }
        <span class="relative size-1.5 rounded-full" [style.background]="punto()"></span>
      </span>
    }
    <ng-content />
  `,
})
export class PastillaCabeceraComponent {
  readonly bg = input('#e6e6e6');
  readonly fg = input('#374151');
  readonly icono = input<string | null>(null);
  readonly punto = input<string | null>(null);
  readonly latido = input(false, { transform: booleanAttribute });
}
