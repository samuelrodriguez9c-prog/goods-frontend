import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { icono } from '../../../shared/ui/iconos';

/** Fondo oscuro + tarjeta centrada con el botón de cerrar (clic afuera = cerrar). Esc lo maneja la página. */
@Component({
  selector: 'app-marco-modal',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'fixed inset-0 z-[80] flex animate-[fade-in_.18s_ease-out] items-center justify-center bg-[rgba(17,24,39,.32)] p-6 [backdrop-filter:blur(2px)]',
    '(click)': 'cerrar.emit()',
  },
  template: `
    <div (click)="$event.stopPropagation()"
      class="relative flex max-h-[calc(100vh_-_48px)] w-full animate-[ficha_340ms_cubic-bezier(.2,.8,.2,1)_both] flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_0_0_1px_rgba(0,0,0,.05),0_30px_80px_-24px_rgba(0,0,0,.45)]"
      [class]="ancho() === 'amplio' ? 'max-w-[600px]' : 'max-w-[520px]'">
      <button type="button" (click)="cerrar.emit()" title="Cerrar (Esc)"
        class="absolute top-3 right-3 z-[3] flex cursor-pointer rounded-lg p-1.5 text-[#6b7280] hover:bg-[#f1f1f1]! hover:text-[#111827]!">
        <tabler-icon [icon]="icono('x')" [size]="17" />
      </button>
      <ng-content />
    </div>
  `,
})
export class MarcoModalComponent {
  readonly ancho = input<'normal' | 'amplio'>('normal');
  readonly cerrar = output<void>();
  protected readonly icono = icono;
}
