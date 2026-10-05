import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconArrowUp, TablerIconComponent } from '@tabler/icons-angular';

/**
 * Aviso "N cambios nuevos · Actualizar" — v2 píldora flotante (LEEME §8).
 *
 * Mismo selector y mismo `(actualizar)` que antes: las páginas no cambian.
 * El host es `sticky` y de alto 0, así que no empuja la tabla: la píldora
 * flota centrada sobre el contenido y acompaña el scroll de `<main>`.
 * Nunca reordena filas por su cuenta — eso pasa recién al tocar Actualizar.
 *
 * `cantidad` es opcional: sin ella dice "Hay cambios nuevos".
 */
@Component({
  selector: 'app-aviso-datos-nuevos',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'pointer-events-none sticky top-3 z-30 flex h-0 justify-center overflow-visible' },
  template: `
    <button
      type="button"
      (click)="actualizar.emit()"
      class="pointer-events-auto flex h-9 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-full bg-[#1a1a1a] py-[7px] pl-3 pr-[7px] text-white shadow-[0_10px_24px_-8px_rgba(0,0,0,0.4)] transition-transform duration-150 animate-[vivo-entrar_320ms_cubic-bezier(0.2,0.8,0.2,1)_both] active:scale-[0.97]"
    >
      <tabler-icon [icon]="flecha" [size]="14" [stroke]="2" class="text-[#2be0d5]" />
      <span class="text-[12.5px]">
        @if (cantidad() > 0) {
          <strong class="font-semibold">{{ cantidad() }}</strong> {{ palabra() }}
        } @else {
          Hay cambios nuevos
        }
      </span>
      <span class="rounded-full bg-[#2be0d5] px-2.5 py-[3px] text-xs font-semibold text-[#0a0a0a]">Actualizar</span>
    </button>
  `,
})
export class AvisoDatosNuevosComponent {
  readonly cantidad = input<number>(0);
  readonly actualizar = output<void>();

  protected readonly flecha = IconArrowUp;
  protected readonly palabra = computed(() => (this.cantidad() === 1 ? 'cambio nuevo' : 'cambios nuevos'));
}
