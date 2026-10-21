import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { AuthService } from '../../../../../../core/auth/auth.service';
import { CatalogoStore } from '../../../../shared/catalogo.store';
import { codigoCompra, cop, fecha, num } from '../../../../shared/formato';
import { EstadoCompra } from '../../../../shared/modelos';
import { FichaCompra } from '../../compras.modelo';
import { GlifoAsistenteComponent } from '../asistente/asistente.component';

const SELLO: Record<EstadoCompra, { texto: string; tinta: string }> = {
  pendiente: { texto: 'PENDIENTE', tinta: 'text-[#b7791f]' },
  recibida: { texto: 'RECIBIDA', tinta: 'text-[#087b5d]' },
  cancelada: { texto: 'CANCELADA', tinta: 'text-[#9ca3af]' },
};
/** Anchos (px) de las barras del código de barras. */
const BARRAS = [1, 2, 1, 3, 1, 1, 2, 1, 1, 2, 1, 3, 1, 1, 2, 1, 1, 2, 1, 3, 1, 1, 2, 1, 1, 2, 1, 3, 1, 1, 2, 1, 1, 2, 1, 3, 1, 1];
/** Borde inferior dentado del papel: zigzag de 28 puntos y 10 px de alto. */
const RECORTE = (() => {
  const puntos = ['0 0', '100% 0', '100% calc(100% - 10px)'];
  for (let i = 27; i >= 0; i--) puntos.push(((i * 100) / 28).toFixed(2) + '% calc(100% - ' + (i % 2 ? 10 : 0) + 'px)');
  return 'polygon(' + puntos.join(', ') + ')';
})();

/** La compra como una factura de papel térmico, con el sello del estado encima. */
@Component({
  selector: 'app-factura-papel',
  standalone: true,
  imports: [GlifoAsistenteComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'sticky top-0 flex animate-[ficha_420ms_cubic-bezier(.2,.8,.2,1)_both] flex-col gap-2.5' },
  template: `
    @let pa = papel();
    <div class="flex items-center justify-center gap-2">
      @if (pa.leidaPorIa) {
        <span class="inline-flex items-center gap-1.5 rounded-full bg-white py-0.5 pr-2.5 pl-0.5 text-[11px] font-medium text-[#303030] shadow-[0_0_0_1px_#ececec]">
          <span class="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-[#0a0a0a]"><app-glifo-asistente [tamano]="9" /></span>
          Leída por el Asistente
        </span>
      }
    </div>
    <div class="relative">
      <div class="[filter:drop-shadow(0_1px_0_#e7e3da)_drop-shadow(0_18px_22px_rgba(0,0,0,.14))]">
        <div [style.clip-path]="recorte"
          class="flex flex-col items-stretch bg-[#fffefb] px-5 pt-6 pb-8.5 [font-family:'IBM_Plex_Mono',ui-monospace,monospace] text-[#1c1c1c]">
          <div class="flex flex-col items-center gap-[3px] text-center">
            <span class="font-[Archivo] text-[14px] leading-[1.25] font-medium tracking-[.04em] text-balance uppercase"
              [class]="pa.conProveedor ? 'text-[#111827]' : 'text-[#b5b5b5]'">{{ pa.proveedor }}</span>
            <span class="text-[10.5px] text-[#4b4b4b]">{{ pa.nit }}</span>
            @if (pa.direccion) {
              <span class="text-[10px] text-[#6b6b6b]">{{ pa.direccion }}</span>
            }
            @if (pa.telefono) {
              <span class="text-[10px] text-[#6b6b6b]">{{ pa.telefono }}</span>
            }
          </div>
          <div class="mt-3.5 mb-2.5 flex flex-col items-center gap-0.5 border-t border-b border-dashed border-t-[#1c1c1c] border-b-[#1c1c1c] py-2">
            <span class="text-[10px] font-semibold tracking-[.24em]">FACTURA DE VENTA</span>
            <span class="text-[11px] tabular-nums">N.º {{ pa.numero }}</span>
          </div>
          <div class="flex flex-col gap-[3px] text-[10px]">
            <div class="flex justify-between gap-2"><span class="text-[#6b6b6b]">FECHA</span><span>{{ pa.fecha }}</span></div>
            <div class="flex justify-between gap-2"><span class="text-[#6b6b6b]">CLIENTE</span><span class="text-right">{{ pa.cliente }}</span></div>
            <div class="flex justify-between gap-2"><span class="text-[#6b6b6b]">REF. GOODS</span><span>{{ pa.codigo }}</span></div>
            <div class="flex justify-between gap-2"><span class="text-[#6b6b6b]">RECIBIDA</span><span>{{ pa.recibida }}</span></div>
          </div>
          <div class="mt-3 grid grid-cols-[34px_minmax(0,1fr)_auto] gap-1.5 border-b border-b-[#1c1c1c] pb-1.5 text-[9.5px] tracking-[.08em] text-[#6b6b6b]">
            <span>CANT</span><span>DESCRIPCIÓN</span><span class="text-right">VALOR</span>
          </div>
          @if (pa.filas.length) {
            <div class="flex flex-col">
              @for (x of pa.filas; track $index) {
                <div class="grid grid-cols-[34px_minmax(0,1fr)_auto] gap-x-1.5 gap-y-[1px] border-b border-dashed border-b-[#dcd8ce] py-1.5 text-[10.5px] tabular-nums">
                  <span>{{ x.cantidad }}</span>
                  <span class="flex min-w-0 flex-col"><span class="truncate uppercase">{{ x.nombre }}</span><span class="text-[#6b6b6b]">&#64; {{ x.precio }}</span></span>
                  <span class="text-right font-semibold">{{ x.subtotal }}</span>
                </div>
              }
            </div>
          } @else {
            <span class="py-3 text-center text-[10.5px] text-[#9a978f]">— sin líneas —</span>
          }
          <div class="mt-2.5 flex justify-between text-[10px] text-[#4b4b4b]"><span>LÍNEAS / UNIDADES</span><span>{{ pa.filas.length }} / {{ pa.unidades }}</span></div>
          <div class="mt-2 flex items-baseline justify-between border-t border-b border-dashed border-t-[#1c1c1c] border-b-[#1c1c1c] py-2">
            <span class="text-[11px] font-semibold tracking-[.14em]">TOTAL</span>
            <span class="text-[17px] font-semibold tabular-nums">{{ pa.total }}</span>
          </div>
          @if (pa.notas.trim()) {
            <p class="mt-2.5 text-center text-[10px] leading-[15px] whitespace-pre-wrap text-[#4b4b4b]">{{ pa.notas }}</p>
          }
          <div class="mt-4 flex flex-col items-center gap-1.5">
            <span class="flex h-7 items-stretch gap-[1.5px]">
              @for (b of barras; track $index) {
                <span class="bg-[#1c1c1c]" [style.width.px]="b"></span>
              }
            </span>
            <span class="text-[9px] tracking-[.14em] text-[#6b6b6b]">{{ pa.codigo }}</span>
            <span class="text-[9px] tracking-[.1em] text-[#9a978f]">*** GRACIAS POR SU COMPRA ***</span>
          </div>
        </div>
      </div>
      <!-- Sello -->
      <div class="pointer-events-none absolute top-[18%] right-[8%] left-[8%] z-[2] [transform:rotate(-10deg)] opacity-20 [mix-blend-mode:multiply]"
        [class]="pa.sello.tinta">
        <svg viewBox="0 0 200 200" class="block h-auto w-full overflow-visible">
          <defs>
            <path id="stTop" d="M 22 100 A 78 78 0 0 1 178 100" />
            <path id="stBot" d="M 22 100 A 78 78 0 0 0 178 100" />
          </defs>
          <circle cx="100" cy="100" r="96" fill="none" stroke="currentColor" stroke-width="3.5" />
          <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" stroke-width="1" />
          <circle cx="100" cy="100" r="66" fill="none" stroke="currentColor" stroke-width="1.5" />
          <text fill="currentColor" dominant-baseline="central" class="font-[Archivo] text-[9px] font-bold tracking-[.2em]"><textPath href="#stTop" startOffset="50%" text-anchor="middle">GOODS · CONTROL DE COMPRAS</textPath></text>
          <text fill="currentColor" dominant-baseline="central" class="font-['IBM_Plex_Mono'] text-[8px] font-semibold tracking-[.14em]"><textPath href="#stBot" startOffset="50%" text-anchor="middle">{{ pa.arco }}</textPath></text>
          <text x="22" y="100" fill="currentColor" text-anchor="middle" dominant-baseline="central" class="font-[Archivo] text-[9px] font-normal">★</text>
          <text x="178" y="100" fill="currentColor" text-anchor="middle" dominant-baseline="central" class="font-[Archivo] text-[9px] font-normal">★</text>
          <line x1="42" y1="80" x2="158" y2="80" stroke="currentColor" stroke-width="1" />
          <line x1="42" y1="120" x2="158" y2="120" stroke="currentColor" stroke-width="1" />
          <text x="100" y="101" fill="currentColor" text-anchor="middle" dominant-baseline="central" class="font-[Archivo] text-[18px] font-[800] tracking-[.04em]">{{ pa.sello.texto }}</text>
          <text x="100" y="136" fill="currentColor" text-anchor="middle" dominant-baseline="central" class="font-['IBM_Plex_Mono'] text-[7px] font-semibold tracking-[.12em]">N.º {{ pa.numero }}</text>
        </svg>
      </div>
    </div>
  `,
})
export class FacturaPapelComponent {
  private readonly auth = inject(AuthService);
  private readonly catalogo = inject(CatalogoStore);
  readonly ficha = input.required<FichaCompra>();

  protected readonly barras = BARRAS;
  protected readonly recorte = RECORTE;
  protected readonly papel = computed(() => {
    const f = this.ficha(), p = f.proveedor, d = f.borrador;
    const codigo = f.esNueva ? 'Borrador' : codigoCompra(f.compra!.id);
    return {
      proveedor: p ? p.nombre : 'Proveedor sin elegir',
      conProveedor: !!p,
      nit: p?.nit ? 'NIT ' + p.nit : 'Sin NIT',
      direccion: p?.direccion ?? '',
      telefono: p?.telefono ? 'Tel. ' + p.telefono : '',
      numero: f.numero || 'Sin número',
      fecha: fecha(f.fecha),
      codigo,
      cliente: this.auth.currentUser()?.empresa?.nombre ?? '—',
      recibida: !f.esNueva && f.compra!.recibidaEn ? fecha(f.compra!.recibidaEn) : '—',
      filas: f.items.map((it) => ({
        nombre: this.catalogo.producto(it.productoId)?.nombre ?? '?',
        cantidad: num(it.cantidad),
        precio: cop(it.precioUnitario),
        subtotal: cop(it.cantidad * it.precioUnitario),
      })),
      // En el formulario cuentan también las líneas que aún no tienen producto.
      unidades: num((f.formulario ? d!.items : f.compra!.items).reduce((a, it) => a + (+it.cantidad || 0), 0)),
      total: cop(f.total),
      notas: f.notas,
      sello: SELLO[f.estado],
      arco: fecha(f.fecha) + ' · ' + codigo,
      leidaPorIa: f.formulario && !!(d!.ia.proveedor || d!.ia.numeroFactura || d!.ia.fecha),
    };
  });
}
