import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Control segmentado gris (opciones del mismo ancho; la elegida en blanco). */
@Component({
  selector: 'app-control-segmentado',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'grid auto-cols-[minmax(0,1fr)] grid-flow-col gap-0.5 rounded-[10px] bg-[#f1f1f1] p-[3px]' },
  template: `
    @for (o of opciones(); track o.k) {
      <button type="button" (click)="elegir.emit(o.k)"
        class="h-7 cursor-pointer rounded-lg text-[12px] font-medium whitespace-nowrap transition-[background-color,color] duration-200 ease-[ease]"
        [class]="o.k === valor() ? 'bg-white text-[#111827] shadow-[0_1px_2px_rgba(0,0,0,.08),0_0_0_1px_rgba(0,0,0,.04)]' : 'bg-transparent text-[#6b7280]'">
        {{ o.label }}
      </button>
    }
  `,
})
export class ControlSegmentadoComponent {
  readonly opciones = input.required<{ k: string; label: string }[]>();
  readonly valor = input.required<string>();
  readonly elegir = output<string>();
}
