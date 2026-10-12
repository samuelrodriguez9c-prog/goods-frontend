import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { CatalogoStore } from '../../../shared/catalogo.store';
import { pl } from '../../../shared/formato';
import { icono } from '../../../shared/ui/iconos';
import { ordenarArbol } from '../categorias.util';
import { MenuActivo } from '../menu-activo';
import { ProductosCategoria } from '../productos-categoria';

/** Barra flotante de los productos marcados en la pestaña Productos: Mover a… / Quitar de la categoría. */
@Component({
  selector: 'app-barra-seleccion',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'toolbar',
    'aria-label': 'Acciones de la selección',
    class: 'fixed bottom-6 left-[50%] max-w-[calc(100vw_-_32px)] [transform:translateX(-50%)]',
    '[class]': "menu.abierto('moverA') ? 'z-[92]' : 'z-[89]'",
    '(click)': '$event.stopPropagation()',
  },
  template: `
    <div class="flex h-11 animate-[alerta-in_360ms_cubic-bezier(.2,.8,.2,1)_both] items-center gap-0.5 rounded-[22px] bg-[#1a1a1a] pr-1.5 pl-3.5 text-white shadow-[0_12px_32px_-8px_rgba(0,0,0,.35)]">
      <!-- Check que se dibuja al aparecer -->
      <svg width="18" height="18" viewBox="0 0 44 44" fill="none" class="block shrink-0 overflow-visible">
        <circle cx="22" cy="22" r="18" class="stroke-[#2be0d5] [stroke-width:3.6]"></circle>
        <path
          d="M14.5 22.4 L19.6 27.5 L29.5 17.2"
          class="animate-[trazo_450ms_cubic-bezier(.65,0,.35,1)_140ms_both] stroke-[#2be0d5] [stroke-dasharray:60] [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:3.6]"
        ></path>
      </svg>
      <strong class="pr-2.5 pl-2 text-[13px] font-semibold whitespace-nowrap tabular-nums">
        {{ pl(estado.seleccion().size, 'seleccionado', 'seleccionados') }}
      </strong>
      <span class="mr-1 h-4.5 w-[1px] bg-[#333]"></span>
      <div class="relative">
        <button
          type="button"
          (click)="alternarMover($event)"
          [title]="permiso()"
          class="flex h-7.5 cursor-pointer items-center gap-1.5 rounded-full px-[11px] text-[12.5px] font-medium whitespace-nowrap text-[#e5e5e5] transition-[background-color,color] duration-150 ease-[ease] hover:bg-[#2a2a2a]! hover:text-white!"
          [class.opacity-45]="!puedeEditar()"
        >
          <tabler-icon [icon]="i.mover" [size]="14" [stroke]="2" />Mover a
          <tabler-icon [icon]="i.arriba" [size]="12" [stroke]="2" class="text-[#8c8c8c]" />
        </button>
        @if (menu.abierto('moverA')) {
          <div class="absolute bottom-[calc(100%_+_12px)] left-0 max-h-80 w-60 animate-[alerta-in_260ms_cubic-bezier(.2,.8,.2,1)_both] overflow-y-auto rounded-[14px] bg-[#1a1a1a] p-[5px] text-white shadow-[0_12px_32px_-8px_rgba(0,0,0,.35)]">
            @for (c of destinos(); track c.id) {
              <button
                type="button"
                (click)="estado.moverSeleccion(c.id, 'movidos a «' + c.nombre + '»')"
                class="flex h-8 w-full cursor-pointer items-center gap-2 rounded-[10px] pr-2.5 text-left text-[12.5px] whitespace-nowrap text-[#e5e5e5] hover:bg-[#2a2a2a]! hover:text-white!"
                [class]="c.categoriaPadreId ? 'pl-7' : 'pl-2.5'"
              >
                <tabler-icon [icon]="icono(c.categoriaPadreId ? 'corner-down-right' : s.tono(c.id)[2])" [size]="15" [stroke]="2" class="text-[#8c8c8c]" />
                <span class="overflow-hidden text-ellipsis">{{ c.nombre }}</span>
              </button>
            }
          </div>
        }
      </div>
      <button
        type="button"
        (click)="estado.moverSeleccion(null, 'quitados de la categoría')"
        [title]="permiso()"
        class="flex h-7.5 cursor-pointer items-center gap-1.5 rounded-full px-[11px] text-[12.5px] font-medium whitespace-nowrap text-[#e5e5e5] transition-[background-color,color] duration-150 ease-[ease] hover:bg-[#2a2a2a]! hover:text-white!"
        [class.opacity-45]="!puedeEditar()"
      >
        <tabler-icon [icon]="i.quitar" [size]="14" [stroke]="2" />Quitar de la categoría
      </button>
      <button
        type="button"
        (click)="limpiar()"
        aria-label="Quitar selección"
        title="Quitar selección (Esc)"
        class="ml-1 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#8c8c8c] transition-[background-color,color] duration-150 ease-[ease] hover:bg-[#2a2a2a]! hover:text-white!"
      >
        <tabler-icon [icon]="i.cerrar" [size]="14" [stroke]="2" />
      </button>
    </div>
  `,
})
export class BarraSeleccionComponent {
  protected readonly s = inject(CatalogoStore);
  protected readonly estado = inject(ProductosCategoria);
  protected readonly menu = inject(MenuActivo);

  /** Categoría abierta (no aparece entre los destinos). */
  readonly categoriaId = input.required<number>();

  protected readonly pl = pl;
  protected readonly icono = icono;
  protected readonly i = { mover: icono('folder-symlink'), arriba: icono('chevron-up'), quitar: icono('folder-minus'), cerrar: icono('x') };
  protected readonly puedeEditar = computed(() => this.s.puede('productos.editar'));
  protected readonly permiso = computed(() => (this.puedeEditar() ? '' : 'Necesitas el permiso productos.editar'));
  protected readonly destinos = computed(() => ordenarArbol(this.s.categorias()).filter((c) => c.id !== this.categoriaId()));

  protected alternarMover(e: Event): void {
    if (!this.s.niega('productos.editar')) this.menu.alternar('moverA', e);
  }
  protected limpiar(): void {
    this.estado.seleccion.set(new Set());
    this.menu.cerrar();
  }
}
