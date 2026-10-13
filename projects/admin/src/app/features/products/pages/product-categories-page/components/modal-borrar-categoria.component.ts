import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { CatalogoStore } from '../../../shared/catalogo.store';
import { icono } from '../../../shared/ui/iconos';
import { nombreCategoria, ordenarArbol } from '../categorias.util';

/**
 * Confirmación de "Eliminar categoría". Si tiene productos se elige a dónde
 * moverlos (o dejarlos sin categoría); si tiene subcategorías, avisa que pasan
 * a ser principales.
 */
@Component({
  selector: 'app-modal-borrar-categoria',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'fixed inset-0 z-[80] flex animate-[fade_.18s_ease-out] items-center justify-center bg-[rgba(10,10,10,.45)] p-6',
    '(click)': 'cerrar.emit()',
  },
  template: `
    <div
      (click)="$event.stopPropagation()"
      class="flex max-h-[calc(100vh_-_48px)] w-115 max-w-full animate-[gp-entra_.22s_cubic-bezier(.2,.8,.2,1)] flex-col overflow-hidden rounded-2xl bg-white text-[13px] text-[#111827] shadow-[0_30px_60px_-20px_rgba(0,0,0,.45)]"
    >
      <div class="flex items-start gap-2.5 pt-4 pr-3.5 pb-2.5 pl-4.5">
        <span class="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span class="font-[Archivo] text-[16px] font-semibold">Eliminar «{{ nombre() }}»</span>
        </span>
        <button type="button" (click)="cerrar.emit()" class="flex cursor-pointer rounded-[7px] p-[5px] text-[#6b7280] hover:bg-[#f1f1f1]!">
          <tabler-icon [icon]="i.cerrar" [size]="16" [stroke]="2" />
        </button>
      </div>
      <div class="flex flex-col gap-3 overflow-y-auto px-4.5 pt-1 pb-4">
        @if (!productos() && !subcategorias()) {
          <p class="leading-[1.5] text-pretty text-[#4b5563]">No tiene productos ni subcategorías.</p>
        } @else {
          <div class="flex flex-col gap-2.5">
            @if (productos()) {
              <span class="font-medium">Mueve sus {{ productos() }} {{ productos() === 1 ? 'producto' : 'productos' }} a…</span>
              <div class="max-h-65 overflow-y-auto rounded-xl border border-[#ececec] p-1">
                @for (o of destinos(); track o.id) {
                  <button
                    type="button"
                    (click)="destino.set(o.id)"
                    class="flex h-8.5 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] hover:bg-[#f5f5f5]!"
                  >
                    <span
                      class="flex size-4 items-center justify-center rounded-full border-[1.5px] border-solid"
                      [class]="destino() === o.id ? 'border-[#303030]' : 'border-[#d4d4d4]'"
                    >
                      <span class="size-2 rounded-full bg-[#303030]" [class.opacity-0]="destino() !== o.id"></span>
                    </span>
                    {{ o.nombre }}
                  </button>
                }
              </div>
            }
            @if (subcategorias()) {
              <div class="flex gap-2 rounded-[10px] bg-[#f5f5f5] px-3 py-2.5 text-[12.5px] text-[#4b5563]">
                <tabler-icon [icon]="i.info" [size]="16" [stroke]="2" />
                {{ subcategorias() === 1 ? 'Sus 1 subcategoría pasa a ser principal.' : 'Sus ' + subcategorias() + ' subcategorías pasan a ser principales.' }}
              </div>
            }
          </div>
        }
      </div>
      <div class="flex justify-end gap-2 border-t border-t-[#f0f0f0] bg-[#fcfcfc] px-4.5 py-3">
        <button
          type="button"
          (click)="cerrar.emit()"
          class="h-8 cursor-pointer rounded-[9px] border border-[#e5e5e5] bg-white px-3 text-[13px] font-medium text-[#303030]"
        >
          Cancelar
        </button>
        <button
          type="button"
          (click)="confirmar.emit(destino())"
          class="h-8 cursor-pointer rounded-[9px] bg-[#d82c0d] px-3 text-[13px] font-medium text-white"
        >
          {{ productos() ? 'Mover y eliminar' : 'Eliminar' }}
        </button>
      </div>
    </div>
  `,
})
export class ModalBorrarCategoriaComponent {
  private readonly s = inject(CatalogoStore);

  readonly categoriaId = input.required<number>();
  /** Productos directos de la categoría. */
  readonly productos = input(0);
  readonly subcategorias = input(0);
  /** A dónde mover sus productos (null = dejarlos sin categoría). */
  readonly confirmar = output<number | null>();
  readonly cerrar = output<void>();

  protected readonly i = { cerrar: icono('x'), info: icono('info-circle') };
  protected readonly destino = signal<number | null>(null);
  protected readonly nombre = computed(() => nombreCategoria(this.s, this.categoriaId()));
  /** Otras categorías, sin ella ni sus subcategorías. */
  protected readonly destinos = computed(() => {
    const id = this.categoriaId();
    return [
      { id: null, nombre: 'Dejarlos sin categoría' },
      ...ordenarArbol(this.s.categorias())
        .filter((c) => c.id !== id && c.categoriaPadreId !== id)
        .map((c) => ({ id: c.id as number | null, nombre: (c.categoriaPadreId ? nombreCategoria(this.s, c.categoriaPadreId) + ' › ' : '') + c.nombre })),
    ];
  });
}
