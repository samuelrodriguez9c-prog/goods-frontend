import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { AccionProveedor } from '../../../shared/proveedores.util';
import { icono } from '../../../shared/ui/iconos';
import { TONO_ACCION_FILA, TONO_ACCION_HOJA } from '../proveedores.modelo';

const VARIANTE = {
  fila: 'inline-flex gap-[5px] px-[9px] py-0.5 text-[11.5px] whitespace-nowrap transition-[filter] duration-200 ease-[ease] hover:[filter:brightness(.96)]',
  hoja: 'flex h-7.5 gap-1.5 px-[11px] text-[12.5px] hover:[filter:brightness(.97)]',
};

/**
 * Etiqueta "próxima acción" (Recibir C-00xx · Reponer N · Sin compras · Al día).
 * Si se puede resolver, el clic no llega a la fila y emite `ejecutar`.
 * Sin acción (proveedor nuevo) muestra "Sin guardar".
 */
@Component({
  selector: 'app-accion-proveedor',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'items-center rounded-full font-semibold',
    '[class]': 'clases()',
    '(click)': 'clic($event)',
  },
  template: `<tabler-icon [icon]="icono(accion()?.icono ?? 'pencil')" [size]="variante() === 'fila' ? 12 : 14" />{{ accion()?.texto ?? 'Sin guardar' }}`,
})
export class AccionProveedorComponent {
  readonly accion = input.required<AccionProveedor | null>();
  readonly variante = input<'fila' | 'hoja'>('fila');
  readonly ejecutar = output<AccionProveedor>();

  protected readonly icono = icono;
  protected readonly clases = computed(() => {
    const a = this.accion(), fila = this.variante() === 'fila';
    const tono = !a ? 'bg-[#f1f1f1] text-[#4b5563]' : (fila ? TONO_ACCION_FILA : TONO_ACCION_HOJA)[a.k];
    return VARIANTE[this.variante()] + ' ' + tono + (a?.activa ? ' cursor-pointer' : ' cursor-default');
  });

  protected clic(e: Event): void {
    const a = this.accion();
    if (!a?.activa) return;
    e.stopPropagation();
    this.ejecutar.emit(a);
  }
}
