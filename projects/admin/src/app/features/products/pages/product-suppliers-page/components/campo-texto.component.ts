import { ChangeDetectionStrategy, Component, booleanAttribute, ElementRef, input, output, viewChild } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { icono as tabler } from '../../../shared/ui/iconos';

/**
 * Campo de texto de la ficha del proveedor: etiqueta (con "Requerido"), ayuda,
 * ícono a la izquierda y el error debajo (borde rojo).
 */
@Component({
  selector: 'app-campo-texto',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="flex flex-col gap-2">
      <span class="flex flex-col gap-0.5">
        <span class="flex items-center gap-2 text-[13px] font-semibold text-[#303030]">
          {{ etiqueta() }}
          @if (requerido()) {
            <span class="rounded-md bg-[#ffe6e5] px-[7px] py-[1px] text-[11px] leading-[17px] font-medium text-[#c4320a]">Requerido</span>
          }
        </span>
        @if (ayuda()) {
          <span class="text-[12px] leading-[16px] text-[#8a8a8a]">{{ ayuda() }}</span>
        }
      </span>
      <span class="relative flex items-center">
        @if (icono(); as i) {
          <tabler-icon [icon]="tabler(i)" [size]="15" class="pointer-events-none absolute left-[11px] text-[#9ca3af]" />
        }
        <input #campo [value]="valor()" (input)="cambiar.emit($any($event.target).value)" [disabled]="soloLectura()"
          [attr.type]="tipo()" [attr.inputmode]="modo()" [placeholder]="placeholder()"
          class="w-full rounded-[10px] bg-[#fafafa] py-[9px] pr-3 text-[13px] outline-none transition-[box-shadow,background-color] duration-200 ease-[ease] focus:bg-white! focus:shadow-[0_0_0_1px_#303030,_0_0_0_4px_rgba(48,_48,_48,_.08)]! disabled:cursor-not-allowed"
          [class]="(icono() ? 'pl-8.5' : 'pl-3') + (error() ? ' shadow-[0_0_0_1px_#d82c0d]' : ' shadow-[0_0_0_1px_#e5e5e5]')" />
      </span>
      @if (error()) {
        <span class="flex animate-[fade-in-up_.2s_ease-out] items-center gap-[5px] text-[12px] text-[#b42318]">
          <tabler-icon [icon]="tabler('alert-circle')" [size]="13" />{{ error() }}
        </span>
      }
    </label>
  `,
})
export class CampoTextoComponent {
  readonly etiqueta = input.required<string>();
  readonly ayuda = input('');
  readonly requerido = input(false, { transform: booleanAttribute });
  readonly icono = input<string | null>(null);
  readonly valor = input('');
  /** Error visible ('' = sin error). */
  readonly error = input('');
  readonly soloLectura = input(false);
  readonly placeholder = input('');
  readonly tipo = input<string | null>(null);
  readonly modo = input<string | null>(null);
  readonly cambiar = output<string>();

  protected readonly tabler = tabler;
  private readonly campo = viewChild.required<ElementRef<HTMLInputElement>>('campo');

  enfocar(): void {
    this.campo().nativeElement.focus();
  }
}
