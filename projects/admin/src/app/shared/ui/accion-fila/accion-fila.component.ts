import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IcComponent } from '../../../features/products/shared/ui/ic/ic.component';
import type { AccionFila } from '../../../features/products/shared/filas';

/**
 * Botón circular de la fila con el cursor encima: a la izquierda el verbo
 * (12/600 #303030 + flecha) y debajo qué pasa (10.5/500 #9ca3af), máx. 76 px
 * para que la fila no se apriete; a la derecha el círculo de 32 px.
 *
 * - `fuerte`: círculo #303030, ícono blanco, halo `0 0 0 4px #e8e8e8`.
 * - `suave`: círculo blanco, `inset 0 0 0 1px #d4d4d4` + halo `#f1f1f1`.
 * - Entra con `pop-in` .3 s; hover del círculo `scale(1.06)`; activo `scale(.96)`.
 * - `title` / `aria-label` = la frase completa («Recibir C-0014 y sumar el stock»).
 */
@Component({
  selector: 'app-accion-fila',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex h-[38px] items-center animate-[fade-in_.15s_ease-out]' },
  template: `
    @let a = accion();
    <button type="button" (click)="$event.stopPropagation(); accionar.emit()" [title]="a.titulo" [attr.aria-label]="a.titulo"
      class="group flex shrink-0 cursor-pointer items-center gap-[9px] rounded-full text-right whitespace-nowrap active:scale-[.96]">
      <span class="flex max-w-[76px] animate-[fade-in_.2s] flex-col items-end gap-px overflow-hidden">
        <span class="flex items-center gap-[3px] text-[12px] leading-[15px] font-semibold text-[#303030]">
          {{ a.verbo }}<app-ic nombre="arrow-right" [size]="12" class="text-[#9ca3af]" />
        </span>
        <span class="max-w-full truncate text-[10.5px] leading-[13px] font-medium text-[#9ca3af]">{{ a.nota }}</span>
      </span>
      <span class="flex size-8 animate-[pop-in_.3s_cubic-bezier(.2,.8,.2,1)] items-center justify-center rounded-full transition-[transform,box-shadow] duration-200 group-hover:scale-[1.06]"
        [class]="a.peso === 'fuerte'
          ? 'bg-[#303030] text-white shadow-[0_0_0_4px_#e8e8e8]'
          : 'bg-white text-[#303030] shadow-[inset_0_0_0_1px_#d4d4d4,0_0_0_4px_#f1f1f1]'">
        <app-ic [nombre]="a.icono" [size]="16" />
      </span>
    </button>
  `,
})
export class AccionFilaComponent {
  readonly accion = input.required<AccionFila>();
  readonly accionar = output<void>();
}
