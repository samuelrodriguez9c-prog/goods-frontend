import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';

export type AccionMasiva = 'activar' | 'desactivar' | 'borrar';

/** Barra fija abajo al centro con lo que se puede hacer con los campos marcados. */
@Component({
  selector: 'app-barra-seleccion',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'fixed bottom-6 left-1/2 z-[85] flex -translate-x-1/2 animate-[st-fade-in-up_.25s_both] items-center gap-1 rounded-full bg-[#1a1a1a] py-1.5 pl-4 pr-1.5 text-[13px] text-white shadow-[0_18px_40px_-12px_rgba(0,0,0,.5)]',
  },
  template: `
    <span class="mr-2 font-medium tabular-nums"
      >{{ cuenta() }} {{ cuenta() === 1 ? 'seleccionado' : 'seleccionados' }}</span
    >
    <button
      type="button"
      (click)="accion.emit('activar')"
      class="flex h-8 items-center gap-1.5 rounded-full px-3 hover:bg-white/10"
    >
      <app-ic nombre="eye" [size]="15" />Activar
    </button>
    <button
      type="button"
      (click)="accion.emit('desactivar')"
      class="flex h-8 items-center gap-1.5 rounded-full px-3 hover:bg-white/10"
    >
      <app-ic nombre="eye-off" [size]="15" />Desactivar
    </button>
    <button
      type="button"
      (click)="accion.emit('borrar')"
      class="flex h-8 items-center gap-1.5 rounded-full px-3 text-[#ffb4a6] hover:bg-white/10"
    >
      <app-ic nombre="trash" [size]="15" />Eliminar
    </button>
    <button
      type="button"
      (click)="limpiar.emit()"
      title="Quitar selección (Esc)"
      class="ml-1 flex size-8 items-center justify-center rounded-full hover:bg-white/10"
    >
      <app-ic nombre="x" [size]="15" />
    </button>
  `,
})
export class BarraSeleccionComponent {
  readonly cuenta = input.required<number>();
  readonly accion = output<AccionMasiva>();
  readonly limpiar = output<void>();
}
