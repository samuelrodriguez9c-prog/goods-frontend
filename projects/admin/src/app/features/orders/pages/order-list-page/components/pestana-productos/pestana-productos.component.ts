import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CatalogoStore } from '../../../../../products/shared/catalogo.store';
import { cop, num } from '../../../../../products/shared/formato';
import { IcComponent } from '../../../../../products/shared/ui/ic/ic.component';
import { EST, Pedido } from '../../../../shared/ventas.modelos';
import { VentasStore } from '../../../../shared/ventas.store';

/**
 * Pestaña Productos (lectura), tarjeta «Alistamiento»:
 * - barra de 3 px «N de M listos» que se pone verde al completarse;
 * - filas tocables (check, miniatura de 44, nombre, SKU, stock y «×cant»):
 *   pendiente o confirmado → al tocarla se marca empacada; enviado o
 *   entregado → todo empacado; cerrado → solo lectura.
 * Debajo, la nota del pedido y «Editar productos o cantidades» (solo pendientes).
 */
@Component({
  selector: 'app-pestana-productos',
  standalone: true,
  imports: [IcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3.5' },
  template: `
    @let p = pedido();
    @let al = vista();
    <div class="flex animate-[fade-in-up_.22s_ease-out] flex-col overflow-hidden rounded-[18px] border border-[#ebebeb] bg-white shadow-[0_1px_2px_rgba(0,0,0,.03),0_12px_28px_-22px_rgba(0,0,0,.25)]">
      <div class="flex flex-col gap-3 px-4 pt-3.5">
        <div class="flex items-start justify-between gap-3">
          <span class="flex min-w-0 items-start gap-3">
            <span class="flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[#f4f4f4] text-[#303030]"><app-ic nombre="package" [size]="17" /></span>
            <span class="flex min-w-0 flex-col gap-0.5">
              <span class="text-[15px] font-semibold tracking-[-.005em] text-gray-900">{{ al.titulo }}</span>
              <span class="text-xs leading-[17px] text-[#8a8a8a]">{{ al.sub }}</span>
            </span>
          </span>
          @if (!al.cerrado) {
            <span class="shrink-0 rounded-full bg-[#f4f4f4] px-2.5 text-xs leading-6 font-semibold whitespace-nowrap tabular-nums" [style.color]="al.color">{{ al.texto }}</span>
          }
        </div>
        <span class="-mx-4 block h-[3px] bg-[#f1f1f1]">
          <span class="block h-full transition-[width,background-color] duration-[450ms] ease-[cubic-bezier(.2,.8,.2,1)]" [style.width.%]="al.pct" [style.background-color]="al.color"></span>
        </span>
      </div>
      @for (r of al.filas; track r.it.id) {
        <button type="button" (click)="al.activo && v.alternarAlistado(p.id, r.it.productoId)"
          class="grid w-full grid-cols-[24px_44px_minmax(0,1fr)_auto] items-center gap-3 border-b border-[#f4f4f4] px-4 py-[11px] text-left transition-colors duration-200 last:border-b-0 hover:bg-[#fafafa]"
          [class]="al.activo ? 'cursor-pointer' : 'cursor-default'" [style.animation]="'mov-in 360ms cubic-bezier(.2,.8,.2,1) ' + r.retraso + 'ms both'">
          <span class="flex size-[22px] items-center justify-center rounded-full transition-[background-color,color,box-shadow] duration-[250ms]" [class.invisible]="al.cerrado"
            [style.background-color]="r.on ? '#29845a' : 'rgba(255,255,255,.92)'" [style.color]="r.on ? '#fff' : '#9ca3af'" [style.box-shadow]="r.on ? 'none' : 'inset 0 0 0 1.5px #d4d4d4'">
            <app-ic nombre="check" [size]="13" [stroke]="2.2" />
          </span>
          <span class="flex size-11 items-center justify-center overflow-hidden rounded-[11px] shadow-[inset_0_0_0_1px_rgba(0,0,0,.04)] transition-opacity duration-300"
            [style.opacity]="r.on ? 0.5 : 1" [style.background-color]="r.mini.fondo" [style.color]="r.mini.tinta">
            @if (r.mini.url) {
              <img [src]="r.mini.url" alt="" class="size-full object-cover" />
            } @else {
              <app-ic [nombre]="r.mini.icono" [size]="19" />
            }
          </span>
          <span class="flex min-w-0 flex-col gap-[3px]">
            <span class="truncate text-[13.5px] font-semibold transition-colors duration-[250ms]" [style.color]="r.on ? '#9ca3af' : '#111827'" [class.line-through]="r.on">{{ r.it.productoNombre }}</span>
            <span class="flex flex-wrap gap-x-2 text-[11.5px] text-[#8a8a8a]">
              <span class="font-['IBM_Plex_Mono'] text-[11px]">{{ r.sku }}</span>
              @if (r.stock) {
                <span class="flex items-center gap-1" [style.color]="r.stockC"><app-ic nombre="box" [size]="12" />{{ r.stock }}</span>
              }
            </span>
          </span>
          <span class="flex flex-col items-end gap-px">
            <span class="font-['IBM_Plex_Mono'] text-[15px] font-semibold text-gray-900">×{{ num(r.it.cantidad) }}</span>
            <span class="text-[10.5px] text-gray-400">{{ cop(r.it.precioUnitario) }} c/u</span>
          </span>
        </button>
      }
    </div>
    @if (p.notas) {
      <div class="flex gap-2.5 rounded-[14px] bg-[#fff6d1] px-3.5 py-3">
        <app-ic nombre="message-2" [size]="16" class="mt-px text-[#8a5a00]" />
        <span class="flex flex-col gap-0.5">
          <span class="text-[11.5px] font-semibold text-[#8a5a00]">{{ p.canal === 'tienda' ? 'Nota del cliente' : 'Nota del pedido' }}</span>
          <span class="text-[13px] leading-[19px] whitespace-pre-wrap text-[#5c3d00]">{{ p.notas }}</span>
        </span>
      </div>
    }
    @if (p.estado === 'pendiente') {
      <button type="button" class="gp-btn self-start" (click)="editar.emit()"><app-ic nombre="pencil" [size]="14" />Editar productos o cantidades</button>
    } @else {
      <p class="m-0 flex items-center gap-1.5 text-xs text-gray-400">
        <app-ic nombre="lock" [size]="13" />Ya no se puede editar: el pedido está {{ estadoTexto() }}. Solo se editan los pedidos pendientes.
      </p>
    }
  `,
})
export class PestanaProductosComponent {
  protected readonly v = inject(VentasStore);
  private readonly cat = inject(CatalogoStore);
  readonly pedido = input.required<Pedido>();
  readonly editar = output<void>();
  protected readonly cop = cop;
  protected readonly num = num;
  protected readonly estadoTexto = computed(() => EST[this.pedido().estado].t.toLowerCase());

  protected readonly vista = computed(() => {
    const p = this.pedido();
    const activo = p.estado === 'pendiente' || p.estado === 'confirmado', todo = p.estado === 'enviado' || p.estado === 'entregado';
    const marc = this.v.alistados()[p.id] ?? [];
    const filas = p.items.map((it, i) => {
      const pr = this.cat.producto(it.productoId), on = todo || marc.includes(it.productoId), disp = this.v.disponible(it.productoId);
      const [fondo, tinta, icono] = this.cat.tono(this.cat.raiz(this.cat.categoria(pr?.categoriaId ?? null))?.id);
      // Pendiente sin apartar: muestra lo que hay. Si ya apartó, el disponible ya lo descuenta.
      const alcanza = p.stockReservado || disp >= it.cantidad;
      return {
        it, on, sku: it.sku ?? pr?.sku ?? 'Sin SKU',
        mini: { fondo, tinta, icono, url: it.imagenUrl ?? pr?.imagenes[0]?.url ?? null },
        stock: p.estado === 'pendiente' && !p.stockReservado ? (alcanza ? 'Hay ' + num(disp) : 'Quedan ' + num(Math.max(0, disp))) : '',
        stockC: alcanza ? '#6b7280' : '#b42318',
        retraso: i * 30,
      };
    });
    const n = filas.filter((x) => x.on).length;
    return {
      activo, filas, cerrado: !activo && !todo,
      titulo: activo ? 'Alistamiento' : 'Productos',
      sub: activo ? 'Toca cada producto cuando lo tengas empacado' : todo ? 'Este pedido ya salió de la tienda' : 'Pedido cerrado sin despacho',
      texto: todo ? 'Todo empacado' : `${n} de ${filas.length} listos`,
      pct: filas.length ? (n / filas.length) * 100 : 0,
      color: n === filas.length ? '#29845a' : '#303030',
    };
  });
}
