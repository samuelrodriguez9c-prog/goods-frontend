import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { fecha } from '../../../../../products/shared/formato';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import { EST, EstadoPedido, ORDEN_FLUJO, Pedido, muerto } from '../../../../shared/ventas.modelos';

type Paso = { t: string; sub: string; c: string; ic: string };

/**
 * Pendiente → Confirmado → Enviado → Entregado, con círculos de 22 px y
 * conectores. Cancelado o devuelto muestran hasta donde llegó más el paso
 * de salida. Cada paso entra con `mov-in` cada 90 ms. Debajo, el aviso de
 * los pedidos de la tienda que todavía no apartan stock.
 */
@Component({
  selector: 'app-progreso-pedido',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="mt-[18px] flex items-start">
      @for (s of pasos(); track s.t) {
        <div class="flex min-w-[88px] flex-col gap-1.5" [class.flex-1]="!s.ultimo" [style.animation]="'mov-in 360ms cubic-bezier(.2,.8,.2,1) ' + s.retraso + 'ms both'">
          <span class="flex items-center">
            <span class="flex size-[22px] shrink-0 items-center justify-center rounded-full text-white transition-[background-color,box-shadow] duration-300"
              [style.background-color]="s.futuro ? '#fff' : s.c" [style.box-shadow]="'inset 0 0 0 1.5px ' + (s.futuro ? '#e3e3e3' : s.c)">
              @if (s.ic && !s.futuro) {
                <app-ic [nombre]="s.ic" [size]="12" [stroke]="2.2" />
              }
            </span>
            @if (!s.ultimo) {
              <span class="mx-1.5 h-0.5 min-w-2 flex-1 rounded-sm transition-colors duration-300" [style.background-color]="s.conector"></span>
            }
          </span>
          <span class="flex min-w-0 flex-col gap-px pr-1.5">
            <span class="whitespace-nowrap text-[12.5px] font-semibold" [style.color]="s.futuro ? '#9ca3af' : '#111827'">{{ s.t }}</span>
            <span class="text-[11px] leading-[14px] text-pretty text-gray-400">{{ s.sub }}</span>
          </span>
        </div>
      }
    </div>
    @if (sinReserva()) {
      <p class="m-0 mt-2.5 flex animate-[fade-in-up_.25s_ease-out] items-center gap-1.5 text-xs text-[#8a5a00]">
        <app-ic nombre="lock-open" [size]="13" />Llegó por la tienda y aún no aparta stock: se descuenta al confirmar.
      </p>
    }
  `,
})
export class ProgresoPedidoComponent {
  /** null = pedido nuevo sin guardar. */
  readonly pedido = input<Pedido | null>(null);

  protected readonly sinReserva = computed(() => { const p = this.pedido(); return !!p && !p.stockReservado && p.estado === 'pendiente'; });

  protected readonly pasos = computed(() => {
    const p = this.pedido();
    const ev = (st: EstadoPedido) => p && [...p.eventos].reverse().find((e) => e.tipo === 'estado' && e.estado === st);
    const fechaDe = (st: EstadoPedido) => { const e = ev(st); return e ? fecha(e.en) : ''; };
    let pasos: Paso[];
    if (p && muerto(p)) {
      const salida: Paso = p.estado === 'cancelado'
        ? { t: 'Cancelado', sub: p.canceladoEn ? fecha(p.canceladoEn) : '', c: '#9ca3af', ic: 'x' }
        : { t: 'Devuelto', sub: fechaDe('devuelto'), c: '#d82c0d', ic: 'undo' };
      const ult = p.eventos.filter((e) => e.tipo === 'estado' && e.estado && ORDEN_FLUJO.includes(e.estado)).pop();
      const llego = p.estado === 'devuelto' ? 3 : Math.max(0, ORDEN_FLUJO.indexOf(ult?.estado ?? 'pendiente'));
      pasos = ORDEN_FLUJO.slice(0, llego + 1)
        .map((st, i) => ({ t: EST[st].t, sub: i === 0 ? fecha(p.creadoEn) : fechaDe(st), c: '#303030', ic: 'check' }))
        .concat([salida]);
    } else {
      const nuevo = !p, ix = nuevo ? 0 : ORDEN_FLUJO.indexOf(p.estado);
      pasos = ORDEN_FLUJO.map((st, i) => {
        const hecho = i < ix || (i === ix && st === 'entregado'), ahora = i === ix && st !== 'entregado';
        const sub = i === 0 ? (nuevo ? 'sin guardar' : fecha(p.creadoEn)) : fechaDe(st) || (st === 'confirmado' ? 'descuenta el stock' : '');
        const c = nuevo ? (i === 0 ? '#d4d4d4' : '#ececec') : hecho ? (st === 'entregado' ? '#29845a' : '#303030') : ahora ? EST[st].bar : '#ececec';
        return { t: EST[st].t, sub, c, ic: hecho ? 'check' : ahora ? (st === 'pendiente' ? 'clock' : st === 'confirmado' ? 'package' : 'truck-delivery') : '' };
      });
    }
    const futuro = (c: string) => c === '#ececec' || c === '#d4d4d4';
    return pasos.map((x, i, a) => ({ ...x, futuro: futuro(x.c), ultimo: i === a.length - 1, conector: i < a.length - 1 && !futuro(a[i + 1].c) ? '#9a9a9a' : '#dedede', retraso: i * 90 }));
  });
}
