import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { IconCreditCard, IconReceipt, TablerIconComponent } from '@tabler/icons-angular';
import { PagoEnLineaService } from '../../core/pago-en-linea/pago-en-linea.service';
import { ModalComponent } from '../../shared/ui/modal/modal.component';

/**
 * Botón «Pagar» de los avisos de cobro. Si el dueño ya salió a pagar y
 * Goods no tiene el resultado (descargó el comprobante y volvió escribiendo
 * la URL, o el aviso de Wompi no llegó), muestra «Confirmar mi pago» para
 * pegar el número de transacción del comprobante, y «Pagar de nuevo» por si
 * no lo completó.
 *
 * `bloque`: a lo ancho, para la pantalla de cuenta bloqueada.
 */
@Component({
  selector: 'app-boton-pago',
  standalone: true,
  imports: [TablerIconComponent, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    @if (pagos.enCurso()) {
      <div class="flex shrink-0 items-center gap-2 self-center" [class]="bloque() ? 'mt-5 w-full flex-col' : ''">
        <button
          type="button"
          (click)="abrir()"
          class="flex items-center justify-center gap-1.5 rounded-lg bg-[#0a0a0a] font-medium text-white transition-[background-color,transform] duration-200 hover:bg-[#262626] active:scale-[0.97]"
          [class]="bloque() ? 'w-full px-3.5 py-2.5 text-sm' : 'px-3 py-1.5 text-[12.5px]'"
        >
          <tabler-icon [icon]="iconoRecibo" [size]="bloque() ? 16 : 14" [stroke]="2" />
          Ya pagué · confirmar
        </button>
        <button
          type="button"
          (click)="pagarDeNuevo()"
          [disabled]="pagos.abriendo()"
          class="rounded-lg font-medium underline-offset-2 hover:underline disabled:opacity-60"
          [class]="bloque() ? 'py-1 text-xs text-gray-500' : 'px-1.5 py-1.5 text-[12px] opacity-80'"
        >
          Pagar de nuevo
        </button>
      </div>
    } @else {
      <button
        type="button"
        (click)="pagos.pagar()"
        [disabled]="pagos.abriendo()"
        class="flex shrink-0 items-center justify-center gap-1.5 self-center rounded-lg bg-[#0a0a0a] font-medium text-white transition-[background-color,transform] duration-200 hover:bg-[#262626] active:scale-[0.97] disabled:opacity-60"
        [class]="bloque() ? 'mt-5 w-full px-3.5 py-2.5 text-sm' : 'px-3 py-1.5 text-[12.5px]'"
      >
        <tabler-icon [icon]="iconoPagar" [size]="bloque() ? 16 : 14" [stroke]="2" />
        Pagar {{ texto(monto()) }}{{ bloque() ? ' y volver a entrar' : '' }}
      </button>
    }

    @if (modal()) {
      <app-modal titulo="Confirmar mi pago" (cerrar)="modal.set(false)">
        <p class="text-[13px] leading-5 text-gray-600">
          Si ya pagaste y no se reflejó, escribe el <strong class="font-semibold text-gray-900">número de transacción</strong> que aparece
          en el comprobante de Wompi (por ejemplo <span class="font-mono text-[12px]">12345-1690000000-12345</span>).
        </p>
        <input
          #campo
          type="text"
          [value]="numero()"
          (input)="numero.set(campo.value)"
          (keydown.enter)="confirmar()"
          placeholder="Número de transacción"
          autocomplete="off"
          class="mt-4 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 font-mono text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-200"
        />
        <div class="mt-5 flex items-center justify-end gap-2">
          <button type="button" (click)="modal.set(false)" class="rounded-lg px-3 py-2 text-[13px] font-medium text-gray-600 hover:bg-gray-100">Cancelar</button>
          <button
            type="button"
            (click)="confirmar()"
            [disabled]="!numero().trim() || pagos.confirmando()"
            class="rounded-lg bg-[#0a0a0a] px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[#262626] disabled:opacity-50"
          >
            {{ pagos.confirmando() ? 'Confirmando…' : 'Confirmar' }}
          </button>
        </div>
      </app-modal>
    }
  `,
})
export class BotonPagoComponent {
  readonly monto = input.required<number>();
  readonly bloque = input(false);

  protected readonly pagos = inject(PagoEnLineaService);
  protected readonly modal = signal(false);
  protected readonly numero = signal('');
  protected readonly iconoPagar = IconCreditCard;
  protected readonly iconoRecibo = IconReceipt;

  protected texto(valor: number): string {
    return `$${Math.round(valor).toLocaleString('es-CO')}`;
  }

  protected abrir(): void {
    this.numero.set('');
    this.modal.set(true);
  }

  protected async confirmar(): Promise<void> {
    if (await this.pagos.confirmarConNumero(this.numero())) this.modal.set(false);
  }

  protected pagarDeNuevo(): void {
    this.pagos.olvidar();
    this.pagos.pagar();
  }
}
