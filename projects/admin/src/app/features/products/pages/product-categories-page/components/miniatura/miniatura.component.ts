import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { icono } from '../../../../shared/ui/iconos';
import { Miniatura } from '../../categorias.util';

/**
 * Miniatura de categoría o producto. El tamaño y el redondeo van como clases en
 * el elemento: `<app-miniatura class="size-8 rounded-[9px]" [miniatura]="m" />`.
 */
@Component({
  selector: 'app-miniatura',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex shrink-0 items-center justify-center overflow-hidden font-[Archivo] text-[12px] font-semibold',
    '[class]': 'clases[miniatura().tipo]',
    '[style.background]': 'tono()?.fondo',
    '[style.color]': 'tono()?.tinta',
  },
  template: `
    @let m = miniatura();
    @switch (m.tipo) {
      @case ('imagen') {
        <span class="block size-full bg-cover bg-center" [style.background-image]="'url(' + m.url + ')'"></span>
      }
      @case ('icono') {
        <tabler-icon [icon]="icono(m.icono)" [size]="tamanoIcono()" [stroke]="2" />
      }
      @case ('inicial') {
        <span>{{ m.letra }}</span>
      }
    }
  `,
})
export class MiniaturaComponent {
  readonly miniatura = input.required<Miniatura>();
  readonly tamanoIcono = input(16);

  protected readonly icono = icono;
  protected readonly clases: Record<Miniatura['tipo'], string> = {
    imagen: 'bg-[#f1f1f1] text-white shadow-[inset_0_0_0_1px_#eeeeee]',
    icono: '',
    inicial: 'bg-[#fafafa] text-[#9ca3af] shadow-[inset_0_0_0_1px_#d4d4d4]',
  };
  /** Colores del tono (solo para el ícono). */
  protected readonly tono = computed(() => {
    const m = this.miniatura();
    return m.tipo === 'icono' ? m : null;
  });
}
