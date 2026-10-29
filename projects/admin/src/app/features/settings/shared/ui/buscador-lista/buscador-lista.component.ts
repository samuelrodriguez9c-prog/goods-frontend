import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  booleanAttribute,
  input,
  model,
  viewChild,
} from '@angular/core';
import { IcComponent } from '../../../../products/shared/ui/ic/ic.component';

/** Buscador en pastilla de las listas de Settings. Con `atajo` muestra la tecla `/` (la página llama `enfocar()`). */
@Component({
  selector: 'app-buscador-lista',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'flex min-w-0 flex-1 items-center gap-2 rounded-full bg-[#e6e6e6] px-3 transition-[background-color,box-shadow] duration-200 focus-within:bg-white focus-within:shadow-[0_0_0_1px_#d4d4d4]',
  },
  template: `
    <app-ic nombre="search" [size]="15" class="text-[#8a8a8a]" />
    <input
      #campo
      [value]="valor()"
      (input)="valor.set($any($event.target).value)"
      [placeholder]="placeholder()"
      class="min-w-0 flex-1 border-0 bg-transparent py-2 text-[13px] text-[#111827] outline-none"
    />
    @if (valor()) {
      <button type="button" (click)="valor.set('')" title="Limpiar" class="flex text-[#8a8a8a]">
        <app-ic nombre="x" [size]="13" />
      </button>
    }
    @if (atajo()) {
      <kbd class="rounded bg-[#d9d9d9] px-1.5 font-sans text-[11px] leading-[17px] text-[#6b7280]"
        >/</kbd
      >
    }
  `,
})
export class BuscadorListaComponent {
  readonly valor = model('');
  readonly placeholder = input('Buscar');
  readonly atajo = input(false, { transform: booleanAttribute });
  private readonly campo = viewChild.required<ElementRef<HTMLInputElement>>('campo');

  enfocar(): void {
    this.campo().nativeElement.focus();
  }
}
