import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { IconChevronDown, IconDeviceMobile, IconPlugConnectedX, TablerIconComponent } from '@tabler/icons-angular';

/**
 * Botón con el número conectado (cabecera del módulo). Abre un menú con el
 * nombre del negocio y "Desconectar número" (el segundo toque confirma).
 */
@Component({
  selector: 'app-menu-numero',
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative', '(document:click)': 'cerrar()', '(document:keydown.escape)': 'cerrar()' },
  template: `
    <button type="button" (click)="alternar($event)"
      class="flex cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-[#e3e3e3] px-3 py-[7px] text-[13px] font-medium text-[#303030] transition-[background] duration-200 hover:bg-[#d4d4d4]">
      <tabler-icon [icon]="i.celular" [size]="15" [stroke]="2" /><span class="tabular-nums">{{ numero() }}</span>
      <tabler-icon [icon]="i.chevron" [size]="13" [stroke]="2" />
    </button>
    @if (abierto()) {
      <div (click)="$event.stopPropagation()"
        class="absolute top-[calc(100%+6px)] right-0 z-30 w-65 animate-[wa-entra_.2s_ease-out] rounded-xl bg-white p-1.5 shadow-[0_0_0_1px_rgba(0,0,0,.06),0_16px_32px_-12px_rgba(0,0,0,.3)]">
        <div class="border-b border-b-[#f3f4f6] px-2.5 pt-2 pb-2.5">
          <p class="m-0 text-[13px] font-semibold text-[#111827]">{{ negocio() }}</p>
          <p class="mt-0.5 mb-0 text-[12px] text-[#6b7280]">Conectado con Meta · también lo usas en el celular</p>
        </div>
        @if (puedeDesconectar()) {
          <button type="button" (click)="tocarDesconectar()"
            class="mt-1 flex w-full cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-2.5 py-2 text-left text-[13px] text-[#b42318] hover:bg-[#fef3f2]">
            <tabler-icon [icon]="i.desconectar" [size]="16" [stroke]="2" />{{ confirmando() ? 'Toca otra vez para desconectar' : 'Desconectar número' }}
          </button>
        }
      </div>
    }
  `,
})
export class MenuNumeroComponent {
  readonly numero = input.required<string>();
  readonly negocio = input<string>('');
  readonly puedeDesconectar = input(false);
  readonly desconectar = output<void>();

  protected readonly i = { celular: IconDeviceMobile, chevron: IconChevronDown, desconectar: IconPlugConnectedX };
  protected readonly abierto = signal(false);
  protected readonly confirmando = signal(false);

  protected alternar(e: Event): void {
    e.stopPropagation();
    this.abierto.update((v) => !v);
    this.confirmando.set(false);
  }

  protected tocarDesconectar(): void {
    if (!this.confirmando()) return this.confirmando.set(true);
    this.cerrar();
    this.desconectar.emit();
  }

  protected cerrar(): void {
    this.abierto.set(false);
    this.confirmando.set(false);
  }
}
