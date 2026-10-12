import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { icono } from '../../../shared/ui/iconos';

/**
 * Modal del módulo: fondo oscuro (clic afuera cierra), título, subtítulo, el
 * contenido proyectado y el pie con "Cancelar/Cerrar" y la acción principal.
 */
@Component({
  selector: 'app-marco-modal',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'fixed inset-0 z-[80] flex animate-[fade_.18s_ease-out] items-center justify-center bg-[rgba(10,10,10,.45)] p-6 [zoom:calc(1_/_var(--escala-contenido,_1))]',
    '(click)': 'cerrar.emit()',
  },
  template: `
    <div (click)="$event.stopPropagation()" [style.width.px]="ancho()"
      class="flex max-h-[calc(100vh_-_48px)] max-w-full animate-[gp-entra_.22s_cubic-bezier(.2,.8,.2,1)] flex-col overflow-hidden rounded-2xl bg-white text-[13px] text-[#111827] shadow-[0_30px_60px_-20px_rgba(0,0,0,.45)]">
      <div class="flex items-start gap-2.5 pt-4 pr-3.5 pb-2.5 pl-4.5">
        <span class="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span class="font-[Archivo] text-[16px] font-semibold">{{ titulo() }}</span>
          @if (subtitulo()) {
            <span class="text-[12.5px] leading-[1.45] text-[#6b7280]">{{ subtitulo() }}</span>
          }
        </span>
        <button type="button" (click)="cerrar.emit()" class="flex cursor-pointer rounded-[7px] p-[5px] text-[#6b7280] hover:bg-[#f1f1f1]! hover:text-[#111827]!">
          <tabler-icon [icon]="icono('x')" [size]="16" [stroke]="2" />
        </button>
      </div>
      <div class="flex flex-col gap-3 overflow-y-auto px-4.5 pt-1 pb-4"><ng-content /></div>
      <div class="flex justify-end gap-2 border-t border-t-[#f0f0f0] bg-[#fcfcfc] px-4.5 py-3">
        <button type="button" (click)="cerrar.emit()"
          class="h-8 cursor-pointer rounded-[9px] border border-[#e5e5e5] bg-white px-3 text-[13px] font-medium text-[#303030]">{{ textoCerrar() }}</button>
        @if (textoConfirmar()) {
          <button type="button" (click)="confirmar.emit()" class="h-8 cursor-pointer rounded-[9px] px-3 text-[13px] font-medium text-white"
            [class]="peligro() ? 'bg-[#d82c0d]' : 'bg-[#303030]'">{{ textoConfirmar() }}</button>
        }
      </div>
    </div>
  `,
})
export class MarcoModalComponent {
  readonly titulo = input.required<string>();
  readonly subtitulo = input('');
  /** Ancho en px. */
  readonly ancho = input(520);
  readonly textoCerrar = input('Cancelar');
  /** Sin texto no hay acción principal. */
  readonly textoConfirmar = input('');
  /** Acción destructiva (botón rojo). */
  readonly peligro = input(false);
  readonly cerrar = output<void>();
  readonly confirmar = output<void>();

  protected readonly icono = icono;
}
