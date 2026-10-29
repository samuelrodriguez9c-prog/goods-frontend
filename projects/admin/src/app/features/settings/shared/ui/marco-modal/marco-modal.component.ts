import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IcComponent } from '../../../../products/shared/ui/ic/ic.component';

/**
 * Velo y panel de los modales de Settings (entra con `st-pop`). Un clic en el
 * velo emite `cerrar`; Esc lo maneja la página, que sabe en qué orden cerrar.
 * Dentro van `app-modal-cabecera`, el cuerpo y `app-pie-modal`.
 */
@Component({
  selector: 'app-marco-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'fixed inset-0 z-[70] flex animate-[st-fade-in_.2s_both] items-center justify-center bg-[rgba(10,10,10,.42)] p-6',
    '(click)': 'cerrar.emit()',
  },
  template: `
    <div
      (click)="$event.stopPropagation()"
      role="dialog"
      [attr.aria-label]="etiqueta()"
      [style.width.px]="ancho()"
      [style.height]="alto()"
      class="flex max-h-full max-w-full animate-[st-pop_.28s_cubic-bezier(.2,.8,.2,1)_both] flex-col overflow-hidden rounded-[18px] bg-white shadow-[0_0_0_1px_rgba(0,0,0,.06),0_40px_80px_-30px_rgba(0,0,0,.5)]"
    >
      <ng-content />
    </div>
  `,
})
export class MarcoModalComponent {
  readonly etiqueta = input.required<string>();
  readonly ancho = input(880);
  /** Alto fijo del panel (`'min(600px,100%)'`); sin él crece con el contenido. */
  readonly alto = input<string | null>(null);
  readonly cerrar = output<void>();
}

/** Pie de los modales: texto de estado a la izquierda, Cancelar y la acción principal. */
@Component({
  selector: 'app-pie-modal',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex items-center justify-between gap-3 border-t border-[#f2f2f2] px-[18px] py-3',
  },
  template: `
    <span class="min-w-0 truncate text-[12.5px] text-[#6b7280]">{{ texto() }}</span>
    <div class="flex shrink-0 gap-2">
      <button
        type="button"
        (click)="cancelar.emit()"
        class="rounded-lg px-3 py-[7px] text-[13px] font-medium text-[#4b5563] hover:bg-[#f4f4f4] hover:text-[#111827]"
      >
        Cancelar
      </button>
      <button
        type="button"
        (click)="aceptar.emit()"
        [disabled]="deshabilitado()"
        class="flex items-center gap-1.5 rounded-lg px-3 py-[7px] text-[13px] font-medium transition-colors duration-200 enabled:bg-[#303030] enabled:text-white disabled:cursor-not-allowed disabled:bg-[#ececec] disabled:text-[#a3a3a3]"
      >
        <app-ic [nombre]="icono()" [size]="14" />{{ accion() }}
      </button>
    </div>
  `,
})
export class PieModalComponent {
  readonly texto = input('');
  readonly accion = input.required<string>();
  readonly icono = input('plus');
  readonly deshabilitado = input(false);
  readonly cancelar = output<void>();
  readonly aceptar = output<void>();
}
