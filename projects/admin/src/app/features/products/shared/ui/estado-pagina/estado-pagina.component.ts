import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TablerIconComponent, type TablerIcon } from '@tabler/icons-angular';

/**
 * Pantalla completa de "no se pudo cargar" (tono error) o "todavía no hay nada"
 * (tono vacío) de los módulos lista + hoja, en la tarjeta blanca. Con
 * `accion` muestra un botón; para otras acciones, proyectarlas como contenido.
 */
@Component({
  selector: 'app-estado-pagina',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex min-h-0 animate-[gp-entra_.36s_cubic-bezier(.2,.8,.2,1)] flex-col items-center justify-center rounded-2xl bg-white p-10 text-center shadow-[0_1px_2px_rgba(0,0,0,.04),0_18px_40px_-24px_rgba(0,0,0,.22)]',
  },
  template: `
    <div class="flex flex-col items-center gap-2.5" [class]="tono() === 'error' ? 'max-w-90' : 'max-w-95'" [style.max-width.px]="ancho()">
      <span class="flex items-center justify-center rounded-full"
        [class]="tono() === 'error' ? 'size-11 bg-[#ffe6e5] text-[#d82c0d]' : 'size-12 bg-[#e0f7f5] text-[#00605b]'">
        <tabler-icon [icon]="icono()" [size]="tono() === 'error' ? 20 : 22" [stroke]="2" />
      </span>
      <div class="font-[Archivo] text-[18px] font-semibold">{{ titulo() }}</div>
      <div class="text-[13px] leading-[20px] text-[#6b7280]">{{ texto() }}</div>
      @if (accion()) {
        <button type="button" (click)="accionar.emit()"
          class="mt-1 cursor-pointer rounded-lg bg-[#303030] px-3 py-[7px] text-[13px] font-medium text-white shadow-[inset_0_-1px_0_#000]">{{ accion() }}</button>
      }
      <!-- Acciones propias (en lugar de \`accion\`, p. ej. dos botones). -->
      <ng-content />
    </div>
  `,
})
export class EstadoPaginaComponent {
  readonly tono = input<'error' | 'vacio'>('vacio');
  readonly icono = input.required<TablerIcon>();
  readonly titulo = input.required<string>();
  readonly texto = input('');
  readonly accion = input('');
  /** Ancho máximo del texto en px. */
  readonly ancho = input<number | null>(null);
  readonly accionar = output<void>();
}
