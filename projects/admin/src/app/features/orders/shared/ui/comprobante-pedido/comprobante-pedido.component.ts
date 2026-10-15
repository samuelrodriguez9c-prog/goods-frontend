import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, output, viewChild } from '@angular/core';
import { AuthService } from '../../../../../core/auth/auth.service';
import { cop, fecha, num, pl } from '../../../../products/shared/formato';
import { IcComponent } from '../../../../products/shared/ui/ic/ic.component';
import { completa, pnum, tel } from '../../ventas.formato';
import { CANAL, PAGO, Pedido, SELLO, muerto } from '../../ventas.modelos';

/** Borde dentado inferior: 28 dientes de 10 px (igual que el tiquete de Compras). */
const DIENTES = 'polygon(0 0, 100% 0, 100% calc(100% - 10px), ' +
  Array.from({ length: 28 }, (_, i) => `${(100 - ((i + 1) * 100) / 28).toFixed(2)}% calc(100% - ${i % 2 === 0 ? '0px' : '10px'})`).join(', ') + ')';

/**
 * Comprobante de pedido (columna derecha de la pestaña Productos).
 *
 * - Bandeja #f2f1ee radio 18 con ranura de impresora (12 px, gradiente #2a2a2a→#151515).
 * - El papel sale de la ranura con `imprime` 1 s; las líneas entran con `mov-in` escalonado (380 ms + 70 ms × i).
 * - Tiquete térmico en IBM Plex Mono, borde dentado, sombra `drop-shadow(0 1px 0 #e7e3da) drop-shadow(0 18px 22px rgba(0,0,0,.14))`.
 * - Sello circular SVG rotado −10°, opacidad .2, multiply: Pagado / Por cobrar / Reembolsado / Anulado / Devuelto.
 * - Código de barras determinístico por número de pedido.
 * - Pie de la bandeja: Imprimir y Enviar por WhatsApp (separados del papel por una línea #e7e5df).
 */
@Component({
  selector: 'app-comprobante-pedido',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col' },
  template: `
    @let p = pedido();
    <div class="flex flex-col rounded-[18px] bg-[#f2f1ee] px-2.5 pb-1">
      <div class="relative z-[2] -mx-1 h-3 rounded-b-[10px] bg-[linear-gradient(#2a2a2a,#151515)] shadow-[0_3px_6px_-2px_rgba(0,0,0,.35)]"></div>
      <div class="mx-1 -mt-[5px] overflow-hidden px-1.5 pb-5">
        <!-- @key fuerza la animación de impresión al cambiar de pedido -->
        @for (k of [p.id]; track k) {
          <div class="animate-[imprime_1s_cubic-bezier(.2,.8,.2,1)_both]">
            <div class="relative">
              <div #papel class="[filter:drop-shadow(0_1px_0_#e7e3da)_drop-shadow(0_18px_22px_rgba(0,0,0,.14))]">
                <div class="flex flex-col bg-[#fffefb] px-5 pb-[34px] pt-6 font-['IBM_Plex_Mono',ui-monospace,monospace] text-[#1c1c1c]" [style.clip-path]="dientes">
                  <div class="flex flex-col items-center gap-[3px] text-center">
                    <span class="font-[Archivo] text-sm font-medium uppercase leading-tight tracking-[.04em] text-balance">{{ nombreNegocio() }}</span>
                    @if (ciudad()) {
                      <span class="text-[10px] text-[#6b6b6b]">{{ ciudad() }}</span>
                    }
                  </div>
                  <div class="mb-2.5 mt-3.5 flex flex-col items-center gap-0.5 border-y border-dashed border-[#1c1c1c] py-2">
                    <span class="text-[10px] font-semibold tracking-[.24em]">COMPROBANTE DE PEDIDO</span>
                    <span class="text-[11px] tabular-nums">N.º {{ f.pnum(p.numero) }}</span>
                  </div>
                  <div class="flex flex-col gap-[3px] text-[10px]">
                    @for (r of filas(); track r[0]) {
                      <div class="flex justify-between gap-3"><span class="shrink-0 text-[#6b6b6b]">{{ r[0] }}</span><span class="min-w-0 text-right [overflow-wrap:anywhere]">{{ r[1] }}</span></div>
                    }
                  </div>
                  <div class="mt-3 grid grid-cols-[34px_minmax(0,1fr)_auto] gap-1.5 border-b border-[#1c1c1c] pb-1.5 text-[9.5px] tracking-[.08em] text-[#6b6b6b]"><span>CANT</span><span>DESCRIPCIÓN</span><span class="text-right">VALOR</span></div>
                  @for (it of p.items; track it.id; let i = $index) {
                    <div class="grid grid-cols-[34px_minmax(0,1fr)_auto] gap-x-1.5 gap-y-px border-b border-dashed border-[#dcd8ce] py-1.5 text-[10.5px] tabular-nums" [style.animation]="'mov-in 380ms cubic-bezier(.2,.8,.2,1) ' + (380 + i * 70) + 'ms both'">
                      <span>{{ f.num(it.cantidad) }}</span>
                      <span class="flex min-w-0 flex-col"><span class="truncate uppercase">{{ it.productoNombre }}</span><span class="text-[#6b6b6b]">&#64; {{ f.cop(it.precioUnitario) }}</span></span>
                      <span class="text-right font-semibold">{{ f.cop(it.subtotal) }}</span>
                    </div>
                  }
                  <div class="mt-2.5 flex justify-between text-[10px] text-[#4b4b4b]"><span>LÍNEAS / UNIDADES</span><span>{{ p.items.length }} / {{ f.num(unidades()) }}</span></div>
                  <div class="mt-2 flex flex-col gap-[3px] text-[10px]">
                    @for (t of totales(); track t[0]) {
                      <div class="flex justify-between gap-2.5"><span class="uppercase text-[#6b6b6b]">{{ t[0] }}</span><span>{{ t[1] }}</span></div>
                    }
                  </div>
                  <div class="mt-2 flex items-baseline justify-between border-y border-dashed border-[#1c1c1c] py-2">
                    <span class="text-[11px] font-semibold tracking-[.14em]">TOTAL</span>
                    <span class="text-[17px] font-semibold tabular-nums" [class.line-through]="muerto()">{{ f.cop(p.total) }}</span>
                  </div>
                  <div class="mt-2 flex flex-col gap-[3px] text-[10px]">
                    <div class="flex justify-between gap-2.5"><span class="text-[#6b6b6b]">MEDIO DE PAGO</span><span>{{ metodo() }}</span></div>
                    <div class="flex justify-between gap-2.5"><span class="text-[#6b6b6b]">ESTADO</span><span>{{ PAGO[p.estadoPago].t.toUpperCase() }}</span></div>
                  </div>
                  @if (p.notas) { <p class="m-0 mt-3 whitespace-pre-wrap text-center text-[10px] leading-[15px] text-[#4b4b4b]">“{{ p.notas }}”</p> }
                  <div class="mt-4 flex flex-col items-center gap-1.5">
                    <span class="h-7 max-w-full" [style.width.px]="barras().ancho" [style.background]="barras().fondo"></span>
                    <span class="text-[9.5px] tracking-[.2em] text-[#4b4b4b]">{{ referencia() }}</span>
                    <span class="mt-1.5 text-center text-[10px] uppercase tracking-[.06em]">{{ gracias() }}</span>
                  </div>
                </div>
              </div>
              <!-- Sello -->
              <div class="pointer-events-none absolute inset-x-[12%] top-[26%] z-[2] rotate-[-10deg] opacity-20 mix-blend-multiply" [style.color]="sello()[1]">
                <svg viewBox="0 0 200 200" class="block h-auto w-full overflow-visible">
                  <defs>
                    <path [attr.id]="'pdTop' + p.id" d="M 22 100 A 78 78 0 0 1 178 100" />
                    <path [attr.id]="'pdBot' + p.id" d="M 22 100 A 78 78 0 0 0 178 100" />
                  </defs>
                  <circle cx="100" cy="100" r="96" fill="none" stroke="currentColor" stroke-width="3.5" />
                  <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" stroke-width="1" />
                  <circle cx="100" cy="100" r="66" fill="none" stroke="currentColor" stroke-width="1.5" />
                  <text fill="currentColor" dominant-baseline="central" style="font: 700 9px Archivo, sans-serif; letter-spacing: .2em"><textPath [attr.href]="'#pdTop' + p.id" startOffset="50%" text-anchor="middle">{{ selloArriba() }}</textPath></text>
                  <text fill="currentColor" dominant-baseline="central" style="font: 600 8px 'IBM Plex Mono', monospace; letter-spacing: .14em"><textPath [attr.href]="'#pdBot' + p.id" startOffset="50%" text-anchor="middle">{{ selloAbajo() }}</textPath></text>
                  <text x="22" y="100" fill="currentColor" text-anchor="middle" dominant-baseline="central" style="font-size: 9px">★</text>
                  <text x="178" y="100" fill="currentColor" text-anchor="middle" dominant-baseline="central" style="font-size: 9px">★</text>
                  <line x1="42" y1="80" x2="158" y2="80" stroke="currentColor" stroke-width="1" />
                  <line x1="42" y1="120" x2="158" y2="120" stroke="currentColor" stroke-width="1" />
                  <text x="100" y="101" fill="currentColor" text-anchor="middle" dominant-baseline="central" [style.font]="'800 ' + (sello()[0].length > 9 ? 15 : 18) + 'px Archivo, sans-serif'" style="letter-spacing: .04em">{{ sello()[0].toUpperCase() }}</text>
                  <text x="100" y="136" fill="currentColor" text-anchor="middle" dominant-baseline="central" style="font: 600 7px 'IBM Plex Mono', monospace; letter-spacing: .12em">{{ metodo() }}</text>
                </svg>
              </div>
            </div>
          </div>
        }
      </div>
      <div class="mt-1 flex gap-1.5 border-t border-[#e7e5df] px-1 pb-2.5 pt-3">
        <button type="button" (click)="imprimirPapel()" class="flex h-[34px] flex-1 items-center justify-center gap-[7px] whitespace-nowrap rounded-[10px] bg-white px-3 text-[12.5px] font-medium text-[#303030] shadow-[0_1px_2px_rgba(0,0,0,.06),inset_0_0_0_1px_#e7e5df] transition-[box-shadow,transform] duration-200 hover:shadow-[0_4px_10px_-4px_rgba(0,0,0,.18),inset_0_0_0_1px_#d6d3cb] active:scale-[.98]">
          <app-ic nombre="printer" [size]="15" />Imprimir
        </button>
        @if (p.cliente.telefono) {
          <button type="button" (click)="enviar.emit()" class="flex h-[34px] flex-1 items-center justify-center gap-[7px] whitespace-nowrap rounded-[10px] bg-white px-3 text-[12.5px] font-medium text-[#303030] shadow-[0_1px_2px_rgba(0,0,0,.06),inset_0_0_0_1px_#e7e5df] transition-[box-shadow,transform] duration-200 hover:shadow-[0_4px_10px_-4px_rgba(0,0,0,.18),inset_0_0_0_1px_#d6d3cb] active:scale-[.98]">
            <app-ic nombre="whatsapp" [size]="15" class="text-[#25a35a]" />Enviar por WhatsApp
          </button>
        }
      </div>
    </div>
  `,
})
export class ComprobantePedidoComponent {
  readonly pedido = input.required<Pedido>();
  private readonly auth = inject(AuthService);
  /** Nombre del negocio en sesión (se puede pisar). */
  readonly negocio = input<string>('');
  readonly ciudad = input('');
  readonly enviar = output<void>();

  protected readonly f = { cop, num, pnum };
  protected readonly PAGO = PAGO;
  protected readonly dientes = DIENTES;

  protected readonly nombreNegocio = computed(() => this.negocio() || this.auth.currentUser()?.empresa?.nombre || 'Tu negocio');
  protected readonly metodo = computed(() => (this.pedido().metodoPago || 'Sin definir').toUpperCase());
  protected readonly muerto = computed(() => muerto(this.pedido()));
  protected readonly sello = computed(() => SELLO(this.pedido()));
  protected readonly unidades = computed(() => this.pedido().items.reduce((a, it) => a + it.cantidad, 0));
  protected readonly filas = computed(() => {
    const p = this.pedido(), d = p.direccionEnvio;
    const r: [string, string][] = [['FECHA', completa(p.creadoEn)], ['CLIENTE', p.cliente.nombre]];
    if (p.cliente.telefono) r.push(['CELULAR', tel(p.cliente.telefono)]);
    r.push(['CANAL', CANAL[p.canal].t], ['ATENDIÓ', p.creadoPor ? p.creadoPor.split(' ')[0] : p.canal === 'tienda' ? 'Tienda en línea' : '—'], ['ENTREGA', d ? d.direccion + (d.ciudad ? ', ' + d.ciudad : '') : 'Recoge en la tienda']);
    return r;
  });
  protected readonly totales = computed(() => {
    const p = this.pedido();
    const t: [string, string][] = [['Subtotal', cop(p.subtotal)], ['Envío', p.costoEnvio ? cop(p.costoEnvio) : 'Sin costo']];
    if (p.descuento) t.push(['Descuento' + (p.codigoDescuento ? ' · ' + p.codigoDescuento : ''), '−' + cop(p.descuento)]);
    return t;
  });
  protected readonly gracias = computed(() => (this.muerto() ? 'Este comprobante no tiene validez' : `¡Gracias por tu compra, ${this.pedido().cliente.nombre.split(' ')[0]}!`));
  protected readonly selloArriba = computed(() => this.nombreNegocio().toUpperCase().slice(0, 22) + ' · CONTROL DE PEDIDOS');
  protected readonly selloAbajo = computed(() => `${fecha(this.pedido().creadoEn).toUpperCase()} · ${pnum(this.pedido().numero)}`);
  protected readonly referencia = computed(() => { const n = this.pedido().numero; return `GP-${String(n).padStart(5, '0')}-${String((n * 2654435761) % 9973).padStart(4, '0')}`; });
  /** 46 barras de 1–3 px con espacios de 1–2 px, sembradas con el número del pedido. */
  protected readonly barras = computed(() => {
    let seed = this.pedido().numero * 7919 + 13, x = 0;
    const st: string[] = [];
    for (let b = 0; b < 46; b++) {
      seed = (seed * 16807) % 2147483647;
      const w = 1 + (seed % 3), g = 1 + ((seed >> 3) % 2);
      st.push(`#1a1a1a ${x}px ${x + w}px`, `transparent ${x + w}px ${x + w + g}px`);
      x += w + g;
    }
    return { fondo: `linear-gradient(90deg,${st.join(',')})`, ancho: x };
  });
  protected readonly pl = pl;
  private readonly papel = viewChild<ElementRef<HTMLElement>>('papel');

  /**
   * Imprime solo el tiquete: lo copia a una ventana con los mismos estilos
   * (sin animaciones) y abre el diálogo de impresión del navegador.
   */
  protected imprimirPapel(): void {
    const el = this.papel()?.nativeElement;
    const w = el && window.open('', '_blank', 'width=420,height=720');
    if (!el || !w) return;
    const estilos = [...document.querySelectorAll('link[rel="stylesheet"], style')].map((n) => n.outerHTML).join('');
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>Pedido ${pnum(this.pedido().numero)}</title>${estilos}` +
        `<style>*{animation:none!important}body{margin:0;padding:16px;background:#fff}@page{margin:8mm}</style></head>` +
        `<body><div style="max-width:340px;margin:0 auto">${el.outerHTML}</div></body></html>`,
    );
    w.document.close();
    // Deja que carguen las hojas de estilo y las fuentes antes del diálogo.
    setTimeout(() => { w.focus(); w.print(); }, 450);
  }
}
