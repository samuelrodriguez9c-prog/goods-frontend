import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { icono } from '../../../shared/ui/iconos';
import { Miniatura } from '../proveedores.modelo';

const TIPO: Record<Miniatura['tipo'], string> = {
  imagen: 'border-solid border-[#eeeeee] bg-[#f1f1f1] text-white',
  icono: 'border-solid border-transparent',
  inicial: 'border-dashed border-[#d4d4d4] bg-[#fafafa] text-[#9ca3af]',
};

/** Miniatura cuadrada (36 px) de un producto: pestaña Productos y compra rápida. */
@Component({
  selector: 'app-miniatura-producto',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex size-9 items-center justify-center overflow-hidden rounded-[9px] border font-[Archivo] font-semibold',
    '[class]': 'tipo()',
    '[style.background-color]': 'tono()?.fondo',
    '[style.color]': 'tono()?.tinta',
  },
  template: `
    @let m = miniatura();
    @if (m.tipo === 'imagen') {
      <span class="block size-full bg-cover bg-center" [style.background-image]="'url(' + m.url + ')'"></span>
    } @else if (m.tipo === 'icono') {
      <tabler-icon [icon]="icono(m.icono)" [size]="16" />
    } @else {
      <span>{{ m.letra }}</span>
    }
  `,
})
export class MiniaturaProductoComponent {
  readonly miniatura = input.required<Miniatura>();

  protected readonly icono = icono;
  protected readonly tipo = computed(() => TIPO[this.miniatura().tipo]);
  protected readonly tono = computed(() => {
    const m = this.miniatura();
    return m.tipo === 'icono' ? m : null;
  });
}
