import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { ICONOS } from '../../iconos';
import { PedidoStore } from '../../pedido.store';
import { NubesComponent } from '../nubes/nubes.component';

/** Pie fijo de los pasos 0–2 de la isla: etiqueta y valor a la izquierda, botón que avanza (`continuar`). */
@Component({
  selector: 'app-pie-paso',
  imports: [TablerIconComponent, NubesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <div class="relative z-[2] -mt-px flex shrink-0 items-center gap-4 py-2.5 pl-5 pr-3 text-bosque" [style.background]="bg()">
      <app-nubes [bg]="bg()" />
      <span class="relative flex flex-col"><span class="text-xs text-musgo">{{ etiqueta() }}</span><span class="font-display font-bold tracking-[-0.01em] tabular-nums" [class.text-2xl]="!chico()" [class.text-xl]="chico()">{{ valor() }}</span></span>
      <button type="button" (click)="pd.continuar()" class="relative ml-auto flex h-[52px] items-center gap-2 rounded-full bg-bosque px-6 text-[15px] font-semibold text-hoja transition-transform hover:bg-bosque-2 active:scale-[.97]">{{ boton() }}<tabler-icon [icon]="i.der" [size]="17" [stroke]="2" /></button>
    </div>
  `,
})
export class PiePasoComponent {
  protected readonly pd = inject(PedidoStore);
  protected readonly i = ICONOS;
  readonly bg = input.required<string>();
  readonly etiqueta = input.required<string>();
  readonly valor = input.required<string>();
  readonly boton = input.required<string>();
  readonly chico = input(false);
}
