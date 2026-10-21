import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, computed, inject, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconAlertCircle, IconBrandWhatsapp, IconSend, TablerIconComponent } from '@tabler/icons-angular';
import { INDICATIVO } from '../../shared/tienda-config.modelo';
import { TiendaConfigStore } from '../../shared/tienda-config.store';
import { TiendaCabezaComponent } from '../tienda-cabeza/tienda-cabeza.component';
import { TiendaEtiquetaComponent } from '../tienda-etiqueta/tienda-etiqueta.component';

/** Tarjeta · WhatsApp para pedidos: país y número, y a la derecha el chat «Así te llega» con un pedido de ejemplo. */
@Component({
  selector: 'app-tienda-ficha-whatsapp',
  imports: [FormsModule, TablerIconComponent, TiendaCabezaComponent, TiendaEtiquetaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tienda-ficha-whatsapp.component.html',
  host: { class: 'contents' },
})
export class TiendaFichaWhatsappComponent {
  protected readonly s = inject(TiendaConfigStore);
  protected readonly i = { wa: IconBrandWhatsapp, alerta: IconAlertCircle, enviar: IconSend };
  private readonly sec = viewChild.required<ElementRef<HTMLElement>>('sec');

  protected readonly numeroFormateado = computed(() => {
    const { pais, numero } = this.s.f();
    const d = numero.replace(/\D/g, '');
    return pais === 'otro' ? `+${d}` : `+${INDICATIVO[pais]} ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`.trim();
  });
  protected readonly numeroError = computed(() => {
    if (this.s.waOk()) return 'Sin número no se puede publicar la tienda.';
    const p = this.s.f().pais;
    return p === 'CO' ? 'Un celular de Colombia tiene 10 dígitos y empieza por 3.' : p === 'US' ? 'Un número de EE. UU. tiene 10 dígitos.' : 'Escribe el indicativo y el número, entre 8 y 15 dígitos.';
  });
  /** Hasta dos productos visibles, con cantidades 1 y 2, como el mensaje que arma la tienda. */
  protected readonly pedidoEjemplo = computed(() => {
    const ej = this.s.visibles().filter((r) => r.estado === 'visible').slice(0, 2);
    const lineas = ej.map((r, k) => ({ n: k + 1, nombre: r.p.nombre, sub: r.p.precio * (k + 1) }));
    const total = lineas.reduce((t, l) => t + l.sub, 0);
    return [
      { texto: `Hola ${this.s.nombreNegocio()}, quiero hacer este pedido:` }, { texto: '' },
      ...lineas.map((l) => ({ texto: `• ${l.n} × ${l.nombre} — ${this.s.monto(l.sub)}` })),
      { texto: '' }, { texto: `Total: ${this.s.monto(total)}`, negrita: true },
    ] as { texto: string; negrita?: boolean }[];
  });

  constructor() {
    afterNextRender(() => this.s.registrarTarjeta('whatsapp', this.sec().nativeElement));
  }
}
