import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { icono } from '../../../../shared/ui/iconos';
import { Miniatura } from '../../compras.modelo';

type Tamano = 'linea' | 'opcion' | 'modal';

const TAMANO: Record<Tamano, string> = {
  linea: 'size-[30px] rounded-[9px] font-[Archivo] font-semibold',
  opcion: 'size-7 rounded-[9px] font-[Archivo] font-semibold',
  modal: 'size-[30px] rounded-[7px] text-[12px] font-semibold',
};
const TIPO: Record<Miniatura['tipo'], string> = {
  imagen: 'border-solid border-[#eeeeee] bg-[#f1f1f1] text-white',
  icono: 'border-solid border-transparent',
  inicial: 'border-dashed border-[#d4d4d4] bg-[#fafafa] text-[#9ca3af]',
};

/** Miniatura cuadrada del producto (líneas, buscador de productos y modal Recibir). */
@Component({
  selector: 'app-miniatura-producto',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex shrink-0 items-center justify-center overflow-hidden border',
    '[class]': 'clases()',
    '[style.background-color]': 'tono()?.fondo',
    '[style.color]': 'tono()?.tinta',
  },
  template: `
    @let m = miniatura();
    @if (m.tipo === 'imagen') {
      <span class="block size-full bg-cover bg-center" [style.background-image]="'url(' + m.url + ')'"></span>
    } @else if (m.tipo === 'icono') {
      <tabler-icon [icon]="icono(m.icono)" [size]="15" [stroke]="2" />
    } @else {
      <span>{{ m.letra }}</span>
    }
  `,
})
export class MiniaturaProductoComponent {
  readonly miniatura = input.required<Miniatura>();
  readonly tamano = input<Tamano>('linea');

  protected readonly icono = icono;
  protected readonly clases = computed(() => TAMANO[this.tamano()] + ' ' + TIPO[this.miniatura().tipo]);
  protected readonly tono = computed(() => {
    const m = this.miniatura();
    return m.tipo === 'icono' ? m : null;
  });
}
