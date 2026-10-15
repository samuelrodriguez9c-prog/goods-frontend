import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import { MiTienda } from '../../../../../../core/tienda/tienda.service';

/**
 * El cartel de la puerta: cuelga de dos cuerdas y se balancea. Tocarlo (o
 * el interruptor) publica o pausa la tienda, y el cartel gira para mostrar
 * «Abierto» o «Cerrado». Debajo, el enlace con Copiar, Ver tienda y
 * Compartir por WhatsApp.
 */
@Component({
  selector: 'app-cartel-tienda',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,.04),0_18px_40px_-28px_rgba(0,0,0,.25)]' },
  template: `
    @let t = tienda();
    <!-- Cartel colgante -->
    <div class="relative flex flex-col items-center pt-1 [perspective:900px]">
      <span class="size-2.5 rounded-full bg-[#303030] shadow-[inset_0_-1px_0_#000]"></span>
      <div class="flex origin-top flex-col items-center animate-[cartel-mece_4.5s_ease-in-out_infinite]">
        <svg width="150" height="30" viewBox="0 0 150 30" class="-mt-[5px] block text-[#a3a3a3]" aria-hidden="true">
          <path d="M75 0 L14 28 M75 0 L136 28" stroke="currentColor" stroke-width="1.5" fill="none" />
        </svg>
        <button type="button" (click)="alternar()" [disabled]="guardando()" [title]="t.activa ? 'Pausar la tienda' : 'Publicar la tienda'"
          class="relative -mt-1 h-[86px] w-[200px] cursor-pointer [transform-style:preserve-3d] transition-transform duration-[700ms] ease-[cubic-bezier(.3,1.4,.5,1)] disabled:cursor-wait"
          [style.transform]="'rotateY(' + (t.activa ? 0 : 180) + 'deg)'">
          <!-- Abierto -->
          <span class="absolute inset-0 flex flex-col items-center justify-center gap-0.5 rounded-[18px] bg-[#1c1c1c] [backface-visibility:hidden] shadow-[inset_0_0_0_3px_#2b2b2b,inset_0_0_0_4px_#3a3a3a,0_14px_24px_-12px_rgba(0,0,0,.55)]">
            <span class="absolute top-2 left-[14px] size-1.5 rounded-full bg-[#4a4a4a]"></span>
            <span class="absolute top-2 right-[14px] size-1.5 rounded-full bg-[#4a4a4a]"></span>
            <span class="font-[Archivo] text-[28px] leading-none font-bold tracking-[.14em] text-[#2be0d5] [text-shadow:0_0_6px_rgba(43,224,213,.75),0_0_18px_rgba(43,224,213,.45)] animate-[neon_3.2s_ease-in-out_infinite]">ABIERTO</span>
            <span class="text-[10.5px] font-medium tracking-[.18em] text-[#8a8a8a] uppercase">Recibiendo pedidos</span>
          </span>
          <!-- Cerrado -->
          <span class="absolute inset-0 flex flex-col items-center justify-center gap-0.5 rounded-[18px] bg-[#f4f4f2] [backface-visibility:hidden] [transform:rotateY(180deg)] shadow-[inset_0_0_0_3px_#e7e5df,0_14px_24px_-14px_rgba(0,0,0,.35)]">
            <span class="absolute top-2 left-[14px] size-1.5 rounded-full bg-[#d4d2cb]"></span>
            <span class="absolute top-2 right-[14px] size-1.5 rounded-full bg-[#d4d2cb]"></span>
            <span class="font-[Archivo] text-[28px] leading-none font-bold tracking-[.14em] text-[#9a9890]">CERRADO</span>
            <span class="text-[10.5px] font-medium tracking-[.18em] text-[#a8a59c] uppercase">{{ t.guardada ? 'Vuelve pronto' : 'Aún sin abrir' }}</span>
          </span>
        </button>
      </div>
    </div>

    <!-- Estado + interruptor -->
    <div class="mt-5 flex items-center gap-3 rounded-[14px] bg-[#f7f7f5] px-3.5 py-3">
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="text-[13.5px] font-semibold text-[#111827]">{{ t.activa ? 'Tu tienda está abierta' : t.guardada ? 'Tu tienda está pausada' : 'Tu tienda aún no está publicada' }}</span>
        <span class="text-[12px] leading-[17px] text-[#8a8a8a]">
          @if (t.activa) {
            Cualquiera con el enlace ve tu catálogo y te pide.
          } @else if (!puedePublicar()) {
            Te falta {{ falta() }} para abrirla.
          } @else {
            Toca el cartel o el interruptor para abrirla.
          }
        </span>
      </span>
      <button type="button" role="switch" [attr.aria-checked]="t.activa" aria-label="Tienda publicada" (click)="alternar()" [disabled]="guardando()"
        class="relative h-[24px] w-[42px] shrink-0 cursor-pointer rounded-full transition-colors duration-200 disabled:cursor-wait"
        [class]="t.activa ? 'bg-[#29845a]' : 'bg-[#d4d4d4]'">
        <span class="absolute top-[3px] left-[3px] size-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.25)] transition-transform duration-200"
          [style.transform]="t.activa ? 'translateX(18px)' : 'none'"></span>
      </button>
    </div>
    @if (aviso()) {
      <p class="m-0 mt-2 animate-[fade-in-up_.2s_ease-out] text-[12px] text-[#b45309]">{{ aviso() }}</p>
    }

    <!-- Enlace -->
    <div class="mt-4 flex items-center gap-2 rounded-[12px] bg-white py-1.5 pr-1.5 pl-3 shadow-[inset_0_0_0_1px_#e7e5df]" [class.opacity-60]="!t.activa">
      <app-ic nombre="world" [size]="15" class="text-[#8a8a8a]" />
      <span class="min-w-0 flex-1 truncate text-[12.5px] text-[#303030]">{{ urlCorta() }}</span>
      <button type="button" (click)="copiar.emit()" class="flex h-7 cursor-pointer items-center gap-1 rounded-lg bg-[#f1f1f1] px-2.5 text-[12px] font-medium text-[#303030] hover:bg-[#e6e6e6]">
        <app-ic [nombre]="copiado() ? 'check' : 'copy'" [size]="13" />{{ copiado() ? 'Copiado' : 'Copiar' }}
      </button>
    </div>
    <div class="mt-2 grid grid-cols-2 gap-2">
      <a [href]="t.url" target="_blank" rel="noopener" [class.pointer-events-none]="!t.activa" [class.opacity-45]="!t.activa"
        class="flex items-center justify-center gap-1.5 rounded-lg bg-[#e3e3e3] px-3 py-[7px] text-[13px] font-medium text-[#303030] transition-[background] duration-200 hover:bg-[#d4d4d4]">
        <app-ic nombre="external-link" [size]="14" />Ver tienda
      </a>
      <a [href]="compartir()" target="_blank" rel="noopener" [class.pointer-events-none]="!t.activa" [class.opacity-45]="!t.activa"
        class="flex items-center justify-center gap-1.5 rounded-lg bg-[#303030] px-3 py-[7px] text-[13px] font-medium text-white shadow-[inset_0_-1px_0_#000] transition-[opacity] duration-200 hover:opacity-90">
        <app-ic nombre="whatsapp" [size]="14" />Compartir
      </a>
    </div>
  `,
})
export class CartelTiendaComponent {
  readonly tienda = input.required<MiTienda>();
  readonly puedePublicar = input(false);
  /** Qué falta para poder publicar («tu WhatsApp», «una dirección válida»). */
  readonly falta = input('');
  readonly guardando = input(false);
  readonly copiado = input(false);
  readonly publicar = output<boolean>();
  readonly copiar = output<void>();

  protected readonly aviso = signal('');
  protected readonly urlCorta = computed(() => this.tienda().url.replace(/^https?:\/\//, ''));
  protected readonly compartir = computed(
    () => `https://wa.me/?text=${encodeURIComponent(`Mira nuestro catálogo y haz tu pedido aquí: ${this.tienda().url}`)}`,
  );

  protected alternar(): void {
    const abrir = !this.tienda().activa;
    if (abrir && !this.puedePublicar()) {
      this.aviso.set(`Para abrirla te falta ${this.falta()}.`);
      setTimeout(() => this.aviso.set(''), 3500);
      return;
    }
    this.publicar.emit(abrir);
  }
}
