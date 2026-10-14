import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { pl, slug } from '../../../../shared/formato';
import { icono } from '../../../../shared/ui/iconos';
import { Borrador, Tono } from '../../categorias.util';
import { TarjetaHojaComponent } from '../tarjeta-hoja/tarjeta-hoja.component';

/** Pestaña Tienda de la hoja: vista previa de la tarjeta en la tienda y su dirección. */
@Component({
  selector: 'app-pestana-tienda',
  standalone: true,
  imports: [TablerIconComponent, TarjetaHojaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'grid grid-cols-[repeat(auto-fit,_minmax(max(270px,_calc((100%_-_12px)_/_2)),_1fr))] gap-3 pt-4' },
  template: `
    @let d = borrador();
    <app-tarjeta-hoja icono="eye" titulo="Vista previa" descripcion="Así se ve la categoría en la tienda." class="items-center">
      <div
        class="relative w-65 overflow-hidden rounded-[14px] bg-white shadow-[0_10px_24px_-14px_rgba(0,0,0,.3)] transition-[opacity] duration-300 ease-[ease]"
        [class.opacity-55]="!d.activo"
      >
        <div class="relative flex aspect-[16/10] items-center justify-center" [style.background]="fondo()" [style.color]="tono().tinta">
          @if (d.imagen) {
            <span class="absolute inset-0 bg-cover bg-center" [style.background-image]="'url(' + d.imagen + ')'"></span>
          } @else {
            <tabler-icon [icon]="icono(tono().icono)" [size]="44" [stroke]="2" class="opacity-85" />
          }
          @if (!d.activo) {
            <span class="absolute top-2.5 right-2.5 rounded-full bg-[#303030] px-2 py-0.5 text-[11px] font-medium text-white">Oculta</span>
          }
        </div>
        <div class="flex flex-col gap-1 px-3.5 pt-3 pb-3.5">
          <span class="font-[Archivo] text-[16px] leading-[1.25] font-semibold">{{ d.nombre.trim() || 'Nombre de la categoría' }}</span>
          <span class="line-clamp-2 text-[12px] leading-[17px] text-[#6b7280]">{{ d.descripcion || 'Sin descripción' }}</span>
          <span class="mt-1 text-[11.5px] font-semibold text-[#00605b]">{{ pl(productos(), 'producto', 'productos') }} →</span>
        </div>
      </div>
      @if (subcategorias().length) {
        <div class="flex max-w-75 flex-wrap justify-center gap-1.5">
          @for (k of subcategorias(); track k) {
            <span class="rounded-full bg-[#f4f4f4] px-2.5 py-[3px] text-[11.5px] font-medium text-[#303030]">{{ k }}</span>
          }
        </div>
      }
    </app-tarjeta-hoja>
    <app-tarjeta-hoja icono="world" titulo="Dirección en la tienda" descripcion="Se genera con el nombre de la categoría.">
      <span class="flex min-w-0 items-center gap-1.5 rounded-[10px] bg-white px-3 py-[9px] text-[12px] text-[#4b5563] shadow-[0_0_0_1px_#ececec]">
        <tabler-icon [icon]="icono('link')" [size]="14" [stroke]="2" class="shrink-0 text-[#8a8a8a]" />
        <span class="truncate">…/c/{{ slug(d.nombre) || 'categoria' }}</span>
        <span class="ml-auto shrink-0 rounded-full bg-[#f1f1f1] px-[7px] py-[1px] text-[10.5px] text-[#6b7280]">Requiere backend</span>
      </span>
      @if (!d.activo) {
        <p class="flex items-center gap-2.5 rounded-xl bg-[#f6f6f6] py-[9px] pr-3 pl-[9px] text-[12.5px] leading-[17px] text-pretty text-[#4b5563]">
          <span class="flex size-6 shrink-0 items-center justify-center rounded-lg bg-[#ebebeb]">
            <tabler-icon [icon]="icono('eye-off')" [size]="14" [stroke]="2" />
          </span>
          Está inactiva: no aparece en el menú de la tienda ni en las búsquedas.
        </p>
      }
    </app-tarjeta-hoja>
  `,
})
export class PestanaTiendaComponent {
  readonly borrador = input.required<Borrador>();
  readonly tono = input.required<Tono>();
  readonly productos = input(0);
  /** Nombres de las subcategorías activas (solo en una principal). */
  readonly subcategorias = input<string[]>([]);

  protected readonly icono = icono;
  protected readonly pl = pl;
  protected readonly slug = slug;
  /** Con imagen, el gris de fondo de la foto; sin imagen, el tono de la categoría. */
  protected readonly fondo = computed(() => (this.borrador().imagen ? '#f1f1f1' : this.tono().fondo));
}
