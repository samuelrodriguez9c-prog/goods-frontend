import { ChangeDetectionStrategy, Component, computed, inject, model } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogoStore } from '../../../../../products/shared/catalogo.store';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';

/**
 * Paso 4 · el catálogo: la tienda muestra los productos activos de
 * Products (con precio y foto). Aquí se decide si los agotados se ven.
 */
@Component({
  selector: 'app-seccion-catalogo',
  standalone: true,
  imports: [IcComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3' },
  template: `
    <div class="grid grid-cols-3 gap-2">
      @for (x of cifras(); track x.t) {
        <div class="flex flex-col gap-0.5 rounded-[14px] bg-[#fafafa] px-3.5 py-3">
          <span class="text-[11.5px] text-[#8a8a8a]">{{ x.t }}</span>
          <span class="gp-cifra text-[18px]" [style.color]="x.c">{{ x.v }}</span>
        </div>
      }
    </div>
    <div class="flex items-center gap-3 rounded-[14px] px-0.5">
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="text-[13px] font-semibold text-[#111827]">Mostrar los agotados</span>
        <span class="text-[12px] leading-[17px] text-[#8a8a8a]">
          {{ mostrarAgotados() ? 'Se ven con la etiqueta «Agotado» y no se pueden pedir.' : 'Se esconden hasta que vuelva a haber stock.' }}
        </span>
      </span>
      <button type="button" role="switch" [attr.aria-checked]="mostrarAgotados()" aria-label="Mostrar los agotados" (click)="mostrarAgotados.set(!mostrarAgotados())"
        class="relative h-[24px] w-[42px] shrink-0 cursor-pointer rounded-full transition-colors duration-200" [class]="mostrarAgotados() ? 'bg-[#303030]' : 'bg-[#d4d4d4]'">
        <span class="absolute top-[3px] left-[3px] size-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.25)] transition-transform duration-200"
          [style.transform]="mostrarAgotados() ? 'translateX(18px)' : 'none'"></span>
      </button>
    </div>
    <a routerLink="/products" class="flex w-fit items-center gap-1.5 text-[12.5px] font-medium text-[#303030] underline-offset-2 hover:underline">
      {{ visibles() ? 'Editar productos, precios y fotos' : 'Cargar productos en tu catálogo' }}<app-ic nombre="arrow-right" [size]="13" />
    </a>
  `,
})
export class SeccionCatalogoComponent {
  private readonly cat = inject(CatalogoStore);
  readonly mostrarAgotados = model.required<boolean>();

  private readonly activos = computed(() => this.cat.productos().filter((p) => p.estado !== 'descontinuado'));
  private readonly agotados = computed(
    () => this.activos().filter((p) => { const s = this.cat.stockDe(p.id); return p.estado === 'agotado' || s.disponible - s.reservado <= 0; }).length,
  );
  readonly visibles = computed(() => this.activos().length - (this.mostrarAgotados() ? 0 : this.agotados()));
  protected readonly cifras = computed(() => [
    { t: 'En la tienda', v: String(this.visibles()), c: '#111827' },
    { t: 'Agotados', v: String(this.agotados()), c: this.agotados() ? '#b45309' : '#111827' },
    { t: 'Con foto', v: this.activos().length ? Math.round((this.activos().filter((p) => p.imagenes.length).length / this.activos().length) * 100) + ' %' : '—', c: '#111827' },
  ]);
}
