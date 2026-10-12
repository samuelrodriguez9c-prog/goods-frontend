import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { icono } from '../../../shared/ui/iconos';
import { Miniatura } from '../inventario.modelo';

type Tamano = 'fila' | 'hoja' | 'modal';

const TAMANO: Record<Tamano, { clases: string; icono: number }> = {
  fila: { clases: 'size-8.5 rounded-[9px] font-[Archivo] font-semibold', icono: 16 },
  hoja: { clases: 'size-13 rounded-[14px] font-[Archivo] font-semibold', icono: 24 },
  modal: { clases: 'size-7 rounded-[7px] text-[11px] font-semibold', icono: 14 },
};
const TIPO: Record<Miniatura['tipo'], string> = {
  imagen: 'border-solid border-[#eeeeee] bg-[#f1f1f1] text-white',
  icono: 'border-solid border-transparent',
  inicial: 'border-dashed border-[#d4d4d4] bg-[#fafafa] text-[#9ca3af]',
};

/** Miniatura cuadrada del producto (lista, hoja y modal Reponer). */
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
      <tabler-icon [icon]="icono(m.icono)" [size]="tamanoIcono()" [stroke]="2" />
    } @else {
      <span>{{ m.letra }}</span>
    }
  `,
})
export class MiniaturaProductoComponent {
  readonly miniatura = input.required<Miniatura>();
  readonly tamano = input<Tamano>('fila');

  protected readonly icono = icono;
  protected readonly clases = computed(() => TAMANO[this.tamano()].clases + ' ' + TIPO[this.miniatura().tipo]);
  protected readonly tamanoIcono = computed(() => TAMANO[this.tamano()].icono);
  protected readonly tono = computed(() => {
    const m = this.miniatura();
    return m.tipo === 'icono' ? m : null;
  });
}
