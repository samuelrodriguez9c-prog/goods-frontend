import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Control segmentado (dentro de popovers y formularios): la opción activa en blanco. */
@Component({
  selector: 'app-segmento',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex gap-0.5 rounded-[10px] bg-[#f1f1f1] p-[3px]' },
  template: `
    @for (o of opciones(); track o[0]) {
      <button type="button" (click)="$event.stopPropagation(); elegir.emit(o[0])"
        class="h-7 flex-1 cursor-pointer whitespace-nowrap rounded-lg px-2.5 text-[12.5px] transition-[background-color,color,box-shadow] duration-200 ease-[ease]"
        [class]="o[0] === valor() ? 'bg-white font-semibold text-[#111827] shadow-[0_1px_2px_rgba(0,0,0,.08),0_0_0_1px_rgba(0,0,0,.04)]' : 'bg-transparent font-medium text-[#6b7280] hover:text-[#111827]'">
        {{ o[1] }}
      </button>
    }
  `,
})
export class SegmentoComponent {
  /** `[clave, texto]` */
  readonly opciones = input.required<[string, string][]>();
  readonly valor = input.required<string>();
  readonly elegir = output<string>();
}
