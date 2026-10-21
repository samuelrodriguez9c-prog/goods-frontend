import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IcComponent } from '../ic/ic.component';

/**
 * Pie fijo de la hoja mientras se crea o edita algo: el error del guardado,
 * un resumen a la izquierda (total del pedido) y Descartar / Guardar a la
 * derecha. Va proyectado en `app-hoja` con el atributo `pie`.
 */
@Component({
  selector: 'app-pie-formulario',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex shrink-0 flex-col gap-2 border-t border-[#f1f1f1] bg-white px-6 py-3' },
  template: `
    @if (error()) {
      <div class="flex animate-[fade-in-up_.2s_ease-out] items-start gap-2 rounded-[10px] bg-[#fff1f0] px-2.5 py-2 text-[12.5px] leading-[18px] text-[#7a1d10]">
        <app-ic nombre="alert-triangle" [size]="15" class="mt-px text-[#d82c0d]" />{{ error() }}
      </div>
    }
    <div class="flex items-center gap-2">
      @if (total()) {
        <span class="flex min-w-0 flex-col">
          <span class="font-[Archivo] text-[17px] font-semibold text-gray-900 tabular-nums">{{ total() }}</span>
          @if (nota()) {
            <span class="truncate text-[11px] text-gray-400">{{ nota() }}</span>
          }
        </span>
      }
      <span class="flex-1"></span>
      <button type="button" class="gp-btn" (click)="descartar.emit()">Descartar</button>
      <button type="button" class="gp-btn-primario" [disabled]="guardando()" (click)="guardar.emit()">
        <app-ic nombre="check" [size]="14" />{{ guardando() ? 'Guardando…' : texto() }}
      </button>
    </div>
  `,
})
export class PieFormularioComponent {
  /** Texto grande de la izquierda (vacío = no se muestra). */
  readonly total = input('');
  readonly nota = input('');
  readonly error = input('');
  readonly guardando = input(false);
  readonly texto = input('Guardar');
  readonly guardar = output<void>();
  readonly descartar = output<void>();
}
