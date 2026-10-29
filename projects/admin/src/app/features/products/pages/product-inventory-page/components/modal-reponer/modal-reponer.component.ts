import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { CatalogoStore } from '../../../../shared/catalogo.store';
import { cop } from '../../../../shared/formato';
import { icono } from '../../../../shared/ui/iconos';
import { PlanReponer, miniaturaDe } from '../../inventario.modelo';
import { MiniaturaProductoComponent } from '../miniatura-producto/miniatura-producto.component';

const URGENCIA = {
  agotado: { texto: 'Agotado', tinta: '#b42318' },
  urgente: { texto: 'Se acaba antes', tinta: '#d82c0d' },
  pronto: { texto: 'Pronto', tinta: '#8a5a00' },
} as const;

/** Modal "Reponer stock": muestra el plan (una compra pendiente por proveedor) antes de crearlo. */
@Component({
  selector: 'app-modal-reponer',
  standalone: true,
  imports: [TablerIconComponent, MiniaturaProductoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'fixed inset-0 z-[80] flex animate-[fade_.18s_ease-out] items-center justify-center bg-[rgba(10,10,10,.45)] p-6 text-[13px] text-[#111827] [zoom:calc(1_/_var(--escala-contenido,_1))]',
    '(click)': 'cerrar.emit()',
  },
  template: `
    <div (click)="$event.stopPropagation()"
      class="flex max-h-[calc(100vh_-_48px)] w-155 max-w-full animate-[gp-entra_.22s_cubic-bezier(.2,.8,.2,1)] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_30px_60px_-20px_rgba(0,0,0,.45)]">
      <div class="flex items-start gap-2.5 pt-4 pr-3.5 pb-2.5 pl-4.5">
        <span class="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span class="font-[Archivo] text-[16px] font-semibold">Reponer stock</span>
          <span class="text-[12.5px] leading-[1.45] text-[#6b7280]">{{ explicacion() }}</span>
          @if (plan().tendencia; as t) {
            <span class="mt-1 flex items-center gap-1.5 text-[12px] font-medium" [style.color]="t.sube ? '#087b5d' : '#8a5a00'">
              <tabler-icon [icon]="icono(t.sube ? 'trending-up' : 'trending-down')" [size]="14" [stroke]="2" />{{ t.texto }}
            </span>
          }
        </span>
        <button type="button" (click)="cerrar.emit()" class="flex cursor-pointer rounded-[7px] p-[5px] text-[#6b7280] hover:bg-[#f1f1f1]!">
          <tabler-icon [icon]="icono('x')" [size]="16" [stroke]="2" />
        </button>
      </div>
      <div class="flex flex-col gap-3 overflow-y-auto px-4.5 pt-1 pb-4">
        <div class="flex flex-col gap-3">
          @for (g of grupos(); track g.proveedorId) {
            <div class="overflow-hidden rounded-xl border border-[#ececec]">
              <div class="flex items-center gap-2 border-b border-b-[#f0f0f0] bg-[#fafafa] px-3 py-[9px]">
                <tabler-icon [icon]="icono('truck')" [size]="15" [stroke]="2" />
                <span class="flex-1 font-semibold">{{ g.proveedor }}</span>
                @if (g.inactivo) {
                  <span class="flex h-4.5 items-center rounded-full bg-[#ffeb79] px-1.5 text-[10.5px] font-medium text-[#8a5a00]">Proveedor inactivo</span>
                }
                <span class="font-semibold tabular-nums">{{ g.total }}</span>
              </div>
              @if (g.entrega) {
                <div class="border-b border-b-[#f5f5f5] px-3 py-1.5 text-[11.5px] text-[#6b7280]">{{ g.entrega }}</div>
              }
              @for (l of g.lineas; track l.id) {
                <div class="grid grid-cols-[28px_minmax(0,1fr)_84px_52px_90px] items-center gap-2.5 border-b border-b-[#f5f5f5] px-3 py-[7px]">
                  <app-miniatura-producto [miniatura]="l.miniatura" tamano="modal" />
                  <span class="flex min-w-0 flex-col">
                    <span class="truncate">{{ l.nombre }}</span>
                    @if (l.motivo) {
                      <span class="truncate text-[11.5px] text-[#6b7280]" [title]="l.motivo">{{ l.motivo }}</span>
                    }
                  </span>
                  <span class="text-right text-[12px]" [style.color]="l.tinta">{{ l.etiqueta }}</span>
                  <span class="text-right font-semibold text-[#087b5d]">+{{ l.cantidad }}</span>
                  <span class="text-right tabular-nums">{{ l.subtotal }}</span>
                </div>
              }
            </div>
          } @empty {
            <div class="rounded-xl border border-dashed border-[#e5e5e5] p-5 text-center text-[#6b7280]">No hay nada para reponer con proveedor conocido.</div>
          }
          @if (plan().enCamino.length) {
            <div class="flex gap-2 rounded-[10px] bg-[#e0f2fe] px-3 py-2.5 text-[12.5px] text-[#0369a1]">
              <tabler-icon [icon]="icono('truck-delivery')" [size]="16" [stroke]="2" />
              <span>Ya vienen en compras pendientes: {{ enCamino() }}</span>
            </div>
          }
          @if (plan().sinProveedor.length) {
            <div class="flex gap-2 rounded-[10px] bg-[#f5f5f5] px-3 py-2.5 text-[12.5px] text-[#4b5563]">
              <tabler-icon [icon]="icono('tools-kitchen-2')" [size]="16" [stroke]="2" />
              <span>Sin proveedor (producción propia o nunca comprados), no entran: {{ sinProveedor() }}</span>
            </div>
          }
        </div>
      </div>
      <div class="flex justify-end gap-2 border-t border-t-[#f0f0f0] bg-[#fcfcfc] px-4.5 py-3">
        <button type="button" (click)="cerrar.emit()"
          class="h-8 cursor-pointer rounded-[9px] border border-[#e5e5e5] bg-white px-3 text-[13px] font-medium text-[#303030]">Cancelar</button>
        <button type="button" (click)="confirmar.emit()"
          class="h-8 cursor-pointer rounded-[9px] bg-[#303030] px-3 text-[13px] font-medium text-white">{{ textoConfirmar() }}</button>
      </div>
    </div>
  `,
})
export class ModalReponerComponent {
  private readonly catalogo = inject(CatalogoStore);

  readonly plan = input.required<PlanReponer>();
  readonly cerrar = output<void>();
  /** Crear las compras (o cerrar, si no hay nada que pedir). */
  readonly confirmar = output<void>();

  protected readonly icono = icono;
  protected readonly grupos = computed(() =>
    this.plan().grupos.map((g) => ({
      proveedorId: g.proveedorId,
      proveedor: g.proveedor?.nombre ?? '—',
      inactivo: !!g.proveedor && !g.proveedor.activo,
      total: cop(g.lineas.reduce((a, l) => a + l.cantidad * l.precio, 0)),
      entrega: this.plan().entregas?.[g.proveedorId] ?? null,
      lineas: g.lineas.map((l) => ({
        id: l.producto.id,
        nombre: l.producto.nombre,
        miniatura: miniaturaDe(l.producto, this.catalogo),
        motivo: l.motivo ?? null,
        // Con el plan del backend, la urgencia; si no, el stock frente al mínimo.
        etiqueta: l.urgencia ? URGENCIA[l.urgencia].texto : l.stock.disponible + ' / mín ' + l.stock.minimo,
        tinta: l.urgencia ? URGENCIA[l.urgencia].tinta : '#d82c0d',
        cantidad: l.cantidad,
        subtotal: cop(l.cantidad * l.precio),
      })),
    })),
  );
  protected readonly enCamino = computed(() => this.plan().enCamino.map((x) => x.producto.nombre + ' · ' + x.compras.join(', ')).join(', '));
  protected readonly explicacion = computed(() =>
    this.plan().entregas
      ? 'Una compra pendiente por proveedor. Cantidad sugerida: lo que se vende mientras llega el pedido y una semana más, sumando el mínimo y restando lo que ya viene en camino.'
      : 'Armamos una compra pendiente por proveedor con lo que está bajo el mínimo. Cantidad sugerida: hasta el doble del mínimo.',
  );
  protected readonly sinProveedor = computed(() => this.plan().sinProveedor.map((p) => p.nombre).join(', '));
  protected readonly textoConfirmar = computed(() => {
    const n = this.plan().grupos.length;
    return n ? 'Crear ' + n + (n === 1 ? ' compra pendiente' : ' compras pendientes') : 'Cerrar';
  });
}
