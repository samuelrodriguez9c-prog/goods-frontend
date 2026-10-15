import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CatalogoStore } from '../../../../../products/shared/catalogo.store';
import { cop, num, pl } from '../../../../../products/shared/formato';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import { VentasStore } from '../../../../../orders/shared/ventas.store';
import { MESES, pnum, relativo } from '../../../../../orders/shared/ventas.formato';
import { InsigniaEstadoComponent } from '../../../../../orders/shared/ui/insignia-estado/insignia-estado.component';
import { CANAL, Cliente, EST, Pedido, muerto } from '../../../../../orders/shared/ventas.modelos';

/**
 * Pestaña «Pedidos» del cliente (handoff-pedidos-clientes, `cliente-pedidos`).
 * 1. Tarjeta «Huella de compras»: total gastado (Archivo 24/700), # compras, ticket y ritmo («Compra cada ~N días»).
 *    Barras: últimos 14 pedidos, alto ∝ total (mín. 8 %), color por estado; suben con `barra-sube` escalonado 40 ms; clic abre el pedido.
 *    «Lo que más pide»: top 4 productos por unidades (pedidos no cancelados).
 * 2. Línea de tiempo por mes (12 últimos): punto de color, miniaturas superpuestas (3 + «+N»), #, estado, canal, fecha, total y «Repetir».
 */
@Component({
  selector: 'app-pestana-pedidos',
  standalone: true,
  imports: [IcComponent, InsigniaEstadoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3.5 animate-[fade-in-up_.22s_ease-out]' },
  template: `
    @if (todos().length) {
      <div class="flex flex-col gap-3.5 rounded-[18px] border border-[#ebebeb] bg-white px-4 pb-3.5 pt-4 shadow-[0_1px_2px_rgba(0,0,0,.03),0_12px_28px_-22px_rgba(0,0,0,.25)]">
        <div class="flex flex-wrap items-end justify-between gap-x-4 gap-y-2.5">
          <span class="flex flex-col gap-[3px]">
            <span class="text-[10.5px] font-semibold tracking-[.12em] text-gray-400">HUELLA DE COMPRAS</span>
            <span class="flex items-baseline gap-2"><span class="font-[Archivo] text-2xl font-bold tracking-[-.02em] tabular-nums text-gray-900">{{ f.cop(stats().total) }}</span><span class="text-xs text-[#8a8a8a]">en {{ f.pl(vivos().length, 'compra', 'compras') }}</span></span>
          </span>
          <span class="flex flex-wrap gap-1.5">
            <span class="flex items-center gap-1.5 rounded-full bg-[#f4f4f2] px-2.5 text-xs leading-[26px] text-gray-600"><app-ic nombre="receipt" [size]="13" />Ticket {{ stats().ticket ? f.cop(stats().ticket) : '—' }}</span>
            @if (ritmo()) { <span class="flex items-center gap-1.5 rounded-full bg-[#e0f7f5] px-2.5 text-xs font-medium leading-[26px] text-[#00605b]"><app-ic nombre="repeat" [size]="13" />{{ ritmo() }}</span> }
          </span>
        </div>
        @if (barras().length > 1) {
          <div class="flex h-16 items-end gap-[5px] border-b border-dashed border-[#e5e5e5] pb-px">
            @for (b of barras(); track b.p.id; let i = $index) {
              <button type="button" (click)="abrirPedido.emit(b.p.id)" [title]="b.tip" class="max-w-[34px] flex-1 origin-bottom rounded-[6px_6px_2px_2px] p-0 transition-[filter] duration-200 hover:brightness-125" [style.height.%]="b.h" [style.background-color]="b.c" [style.animation]="'barra-sube 520ms cubic-bezier(.2,.8,.2,1) ' + i * 40 + 'ms both'"></button>
            }
          </div>
        }
        @if (favoritos().length) {
          <div class="flex flex-col gap-2">
            <span class="text-xs font-semibold text-[#303030]">Lo que más pide</span>
            <div class="flex flex-wrap gap-1.5">
              @for (x of favoritos(); track x.id) {
                <span class="flex max-w-full items-center gap-2 rounded-full bg-[#fafafa] py-[3px] pl-[3px] pr-2.5 shadow-[inset_0_0_0_1px_#efefef]">
                  <span class="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-[7px] shadow-[0_0_0_2px_#fff]" [style.background-color]="x.mini[0]" [style.color]="x.mini[1]">@if (x.url) { <img [src]="x.url" alt="" class="size-full object-cover" /> } @else { <app-ic [nombre]="x.mini[2]" [size]="12" /> }</span>
                  <span class="min-w-0 truncate text-[12.5px] font-medium text-[#303030]">{{ x.nombre }}</span>
                  <span class="font-['IBM_Plex_Mono'] text-[11.5px] font-semibold text-[#8a8a8a]">×{{ f.num(x.q) }}</span>
                </span>
              }
            </div>
          </div>
        }
      </div>

      <div class="flex flex-col gap-4">
        @for (g of meses(); track g.etiqueta) {
          <div class="flex flex-col gap-2">
            <div class="flex items-baseline justify-between gap-2.5 px-1"><span class="font-[Archivo] text-[13px] font-semibold text-gray-900">{{ g.etiqueta }}</span><span class="text-xs tabular-nums text-[#8a8a8a]">{{ g.suma ? f.cop(g.suma) : '' }}</span></div>
            <div class="relative flex flex-col gap-1.5 pl-[22px]">
              <span class="absolute bottom-2.5 left-[7px] top-2.5 w-0.5 rounded-sm bg-[#f1f1f1]"></span>
              @for (o of g.pedidos; track o.p.id) {
                <div class="relative" [style.animation]="'mov-in 360ms cubic-bezier(.2,.8,.2,1) ' + o.retraso + 'ms both'">
                  <span class="absolute -left-5 top-1/2 -mt-1.5 size-3 rounded-full shadow-[0_0_0_3px_#fff]" [style.background-color]="o.punto"></span>
                  <div (click)="abrirPedido.emit(o.p.id)" [title]="o.productos" class="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[14px] bg-white py-2.5 pl-3 pr-2.5 shadow-[0_0_0_1px_#efefef] transition-[box-shadow,transform] duration-200 hover:translate-x-0.5 hover:shadow-[0_0_0_1px_#e0e0e0,0_10px_24px_-16px_rgba(0,0,0,.3)]">
                    <span class="flex items-center pl-0.5">
                      @for (m of o.minis; track $index) {
                        <span class="-ml-1.5 flex size-8 items-center justify-center overflow-hidden rounded-[9px] shadow-[0_0_0_2px_#fff]" [style.background-color]="m.fondo" [style.color]="m.tinta">@if (m.url) { <img [src]="m.url" alt="" class="size-full object-cover" /> } @else { <app-ic [nombre]="m.icono" [size]="14" /> }</span>
                      }
                      @if (o.mas) { <span class="-ml-1.5 flex size-8 items-center justify-center rounded-[9px] bg-[#f1f1f1] text-[11px] font-semibold text-gray-600 shadow-[0_0_0_2px_#fff]">+{{ o.mas }}</span> }
                    </span>
                    <span class="flex min-w-0 flex-col gap-[3px]">
                      <span class="flex min-w-0 items-center gap-2"><span class="font-['IBM_Plex_Mono'] text-[12.5px] font-medium text-gray-900">{{ f.pnum(o.p.numero) }}</span><app-insignia-estado [estado]="o.p.estado" /></span>
                      <span class="flex items-center gap-[5px] truncate text-[11.5px] text-[#8a8a8a]"><app-ic [nombre]="CANAL[o.p.canal].ic" [size]="12" />{{ f.rel(o.p.creadoEn) }}</span>
                    </span>
                    <span class="flex items-center gap-1.5">
                      <span class="text-[13px] font-semibold tabular-nums" [style.color]="o.muerto ? '#9ca3af' : '#111827'" [class.line-through]="o.p.estado === 'cancelado'">{{ f.cop(o.p.total) }}</span>
                      <button type="button" title="Repetir este pedido" (click)="$event.stopPropagation(); repetir.emit(o.p)" class="flex size-[30px] items-center justify-center rounded-[9px] bg-[#f4f4f2] text-[#303030] transition-colors duration-200 hover:bg-[#303030] hover:text-white"><app-ic nombre="repeat" [size]="14" /></button>
                    </span>
                  </div>
                </div>
              }
            </div>
          </div>
        }
      </div>
      <button type="button" class="gp-btn self-start" (click)="verTodos.emit()">{{ todos().length > 12 ? 'Ver los ' + todos().length + ' pedidos' : 'Ver en Pedidos' }}<app-ic nombre="arrow-right" [size]="13" /></button>
    } @else {
      <div class="flex flex-col items-center gap-2.5 rounded-2xl border border-dashed border-[#e0e0e0] p-7 text-center text-[13px] text-gray-500">
        <app-ic nombre="receipt" [size]="20" class="text-gray-400" />Todavía no le has vendido nada.
        <button type="button" class="gp-btn-primario" (click)="nuevoPedido.emit()">Crearle un pedido</button>
      </div>
    }
  `,
})
export class PestanaPedidosComponent {
  private readonly v = inject(VentasStore);
  private readonly cat = inject(CatalogoStore);
  readonly cliente = input.required<Cliente>();
  readonly abrirPedido = output<number>();
  readonly repetir = output<Pedido>();
  readonly verTodos = output<void>();
  readonly nuevoPedido = output<void>();

  protected readonly EST = EST;
  protected readonly CANAL = CANAL;
  protected readonly f = { cop, num, pnum, pl, rel: (iso: string) => relativo(iso, this.v.hoy()) };

  protected readonly todos = computed(() => this.v.pedidosDe(this.cliente().id));
  protected readonly vivos = computed(() => this.todos().filter((p) => !muerto(p)));
  protected readonly stats = computed(() => this.v.stats(this.cliente().id));
  private color = (p: Pedido) => (muerto(p) ? '#dedede' : p.estado === 'entregado' ? '#303030' : EST[p.estado].bar);
  private mini(pid: number) {
    const pr = this.cat.producto(pid);
    const [fondo, tinta, icono] = this.cat.tono(this.cat.raiz(this.cat.categoria(pr?.categoriaId ?? null))?.id);
    return { fondo, tinta, icono, url: pr?.imagenes[0]?.url ?? null };
  }

  protected readonly barras = computed(() => {
    const xs = this.todos().slice(0, 14).reverse(), mx = Math.max(1, ...xs.map((p) => p.total));
    return xs.map((p) => ({ p, h: Math.max(8, Math.round((p.total / mx) * 100)), c: this.color(p), tip: `${pnum(p.numero)} · ${cop(p.total)} · ${EST[p.estado].t}` }));
  });
  protected readonly ritmo = computed(() => {
    const v = this.vivos();
    if (v.length >= 2) { const g = Math.max(1, Math.round((new Date(v[0].creadoEn).getTime() - new Date(v[v.length - 1].creadoEn).getTime()) / 864e5 / (v.length - 1))); return 'Compra cada ~' + pl(g, 'día', 'días'); }
    return v.length === 1 ? 'Una sola compra hasta ahora' : '';
  });
  protected readonly favoritos = computed(() => {
    const cnt = new Map<number, { q: number; nombre: string }>();
    this.vivos().forEach((p) => p.items.forEach((it) => { const x = cnt.get(it.productoId); cnt.set(it.productoId, { q: (x?.q ?? 0) + it.cantidad, nombre: it.productoNombre }); }));
    return [...cnt.entries()].sort((a, b) => b[1].q - a[1].q).slice(0, 4).map(([id, x]) => { const m = this.mini(id); return { id, q: x.q, nombre: this.cat.producto(id)?.nombre ?? x.nombre, mini: [m.fondo, m.tinta, m.icono] as [string, string, string], url: m.url }; });
  });
  protected readonly meses = computed(() => {
    const gs: { etiqueta: string; suma: number; pedidos: { p: Pedido; punto: string; muerto: boolean; minis: ReturnType<PestanaPedidosComponent['mini']>[]; mas: number; productos: string; retraso: number }[] }[] = [];
    this.todos().slice(0, 12).forEach((p, k) => {
      const d = new Date(p.creadoEn), et = `${MESES[d.getMonth()]} ${d.getFullYear()}`;
      let g = gs[gs.length - 1];
      if (!g || g.etiqueta !== et) { g = { etiqueta: et, suma: 0, pedidos: [] }; gs.push(g); }
      if (!muerto(p)) g.suma += p.total;
      g.pedidos.push({ p, punto: this.color(p), muerto: muerto(p), minis: p.items.slice(0, 3).map((it) => this.mini(it.productoId)), mas: Math.max(0, p.items.length - 3), productos: p.items.map((it) => it.productoNombre).join(', '), retraso: k * 40 });
    });
    return gs;
  });
}
