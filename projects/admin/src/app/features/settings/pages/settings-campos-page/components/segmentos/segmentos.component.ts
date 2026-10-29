import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';

export interface Segmento<K extends string = string> {
  k: K;
  t: string;
  icono?: string;
}

/** Control segmentado gris de la hoja (sección, formato, unidad antes/después, quién edita). */
@Component({
  selector: 'app-segmentos',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'grid gap-0.5 rounded-[10px] bg-[#f1f1f1] p-[3px]' },
  template: `
    @for (s of items(); track s.k) {
      @let on = s.k === valor();
      <button
        type="button"
        (click)="elegir.emit(s.k)"
        [disabled]="deshabilitado()"
        [title]="s.t"
        class="flex items-center justify-center gap-1.5 truncate whitespace-nowrap rounded-lg px-1.5 transition-[background-color,color,box-shadow] duration-200 disabled:cursor-default"
        [style.height.px]="alto()"
        [style.font-size.px]="tamano()"
        [style.background]="on ? '#fff' : 'transparent'"
        [style.font-weight]="on ? 600 : 500"
        [style.color]="on ? '#111827' : deshabilitado() ? '#c4c4c4' : '#6b7280'"
        [style.box-shadow]="on ? '0 1px 2px rgba(0,0,0,.08),0 0 0 1px rgba(0,0,0,.04)' : 'none'"
      >
        @if (s.icono) {
          <app-ic [nombre]="s.icono" [size]="14" />
        }
        {{ s.t }}
      </button>
    }
  `,
})
export class SegmentosComponent {
  readonly items = input.required<Segmento[]>();
  readonly valor = input<string | null>(null);
  readonly deshabilitado = input(false, { transform: booleanAttribute });
  readonly alto = input(28);
  readonly tamano = input(12.5);
  readonly elegir = output<string>();
}
