import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

/**
 * Bloque que se pliega animando la altura (grid 1fr ↔ 0fr).
 * Con `desborde`, abierto deja asomar sombras y contornos de las filas (clip-path
 * en vez de overflow oculto), como la lista de categorías.
 */
@Component({
  selector: 'app-desplegable',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]',
    '[class]': "abierto() ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'",
  },
  template: `
    <div
      class="min-h-0"
      [class]="
        !desborde()
          ? 'overflow-hidden'
          : abierto()
            ? 'overflow-visible transition-[clip-path] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] [clip-path:inset(-14px_-2px_-14px_-2px)]'
            : 'overflow-visible transition-[clip-path] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] [clip-path:inset(0_0_0_0)]'
      "
    >
      <ng-content />
    </div>
  `,
})
export class DesplegableComponent {
  readonly abierto = input.required<boolean>();
  readonly desborde = input(false, { transform: booleanAttribute });
}
