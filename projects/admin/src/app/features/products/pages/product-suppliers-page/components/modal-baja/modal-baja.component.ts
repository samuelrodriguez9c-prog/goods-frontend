import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { CatalogoStore } from '../../../../shared/catalogo.store';
import { pl } from '../../../../shared/formato';
import { productosProveedor, statProveedor } from '../../../../shared/proveedores.util';
import { icono } from '../../../../shared/ui/iconos';
import { MarcoModalComponent } from '../marco-modal/marco-modal.component';

type Tono = 'neutro' | 'aviso' | 'peligro';
const TONO: Record<Tono, string> = {
  neutro: 'bg-[#f4f4f4] text-[#303030]',
  aviso: 'bg-[#fff6d1] text-[#8a5a00]',
  peligro: 'bg-[#ffe6e5] text-[#b42318]',
};

/**
 * Baja de un proveedor: sin compras se puede eliminar; con historial solo se
 * desactiva. Muestra qué se conserva y qué productos se quedan sin proveedor habitual.
 */
@Component({
  selector: 'app-modal-baja',
  standalone: true,
  imports: [TablerIconComponent, MarcoModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    @if (baja(); as b) {
      <app-marco-modal (cerrar)="cerrar.emit()">
        <div class="px-6 pt-5.5 pb-1.5">
          <div class="pr-7.5 font-[Archivo] text-[20px] font-semibold tracking-[-0.01em] text-[#111827]">
            {{ b.eliminable ? '¿Eliminar «' + b.proveedor.nombre + '»?' : '«' + b.proveedor.nombre + '» tiene historial' }}
          </div>
          <p class="mt-1.5 text-[13px] leading-[19px] text-pretty text-[#6b7280]">
            {{ b.eliminable
              ? 'No tiene compras registradas, así que se puede eliminar sin perder nada.'
              : 'No se puede eliminar porque tiene compras. Desactívalo: deja de aparecer al crear compras y su historial se conserva.' }}
          </p>
        </div>
        <div class="flex flex-col gap-2 px-6 pt-3 pb-4">
          @for (x of b.impacto; track x.icono) {
            <div class="flex animate-[mov-in_340ms_cubic-bezier(.2,.8,.2,1)_both] items-center gap-3 rounded-[14px] bg-white px-3 py-[11px] shadow-[0_0_0_1px_#efefef]">
              <span class="flex size-8 shrink-0 items-center justify-center rounded-[10px]" [class]="tono[x.tono]">
                <tabler-icon [icon]="icono(x.icono)" [size]="16" />
              </span>
              <span class="flex min-w-0 flex-col gap-[1px]">
                <span class="text-[13px] font-semibold text-[#111827]">{{ x.titulo }}</span>
                <span class="text-[12px] text-[#6b7280]">{{ x.detalle }}</span>
              </span>
            </div>
          }
        </div>
        <div class="flex justify-end gap-2 border-t border-t-[#f1f1f1] px-6 py-3.5">
          <button type="button" (click)="cerrar.emit()"
            class="cursor-pointer rounded-lg bg-[#e3e3e3] px-3.5 py-2 text-[13px] font-medium text-[#303030] hover:bg-[#d4d4d4]!">Cancelar</button>
          @if (b.eliminable) {
            <button type="button" (click)="eliminar.emit()"
              class="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#d82c0d] px-3.5 py-2 text-[13px] font-medium text-white hover:opacity-90!">
              <tabler-icon [icon]="icono('trash')" [size]="14" />Eliminar
            </button>
          } @else {
            <button type="button" (click)="desactivar.emit()"
              class="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#303030] px-3.5 py-2 text-[13px] font-medium text-white shadow-[inset_0_-1px_0_#000] hover:opacity-90!"
              [class.opacity-45]="!b.proveedor.activo">
              <tabler-icon [icon]="icono('player-pause')" [size]="14" />Desactivar
            </button>
          }
        </div>
      </app-marco-modal>
    }
  `,
})
export class ModalBajaComponent {
  private readonly catalogo = inject(CatalogoStore);
  readonly proveedorId = input.required<number>();
  readonly desactivar = output<void>();
  readonly eliminar = output<void>();
  readonly cerrar = output<void>();

  protected readonly icono = icono;
  protected readonly tono = TONO;

  protected readonly baja = computed(() => {
    const id = this.proveedorId(), proveedor = this.catalogo.proveedor(id);
    if (!proveedor) return null;
    const stat = statProveedor(this.catalogo, id), pendientes = stat.pendientes.length;
    // Productos cuya última compra (no cancelada) fue a este proveedor.
    const huerfanos = productosProveedor(this.catalogo, id).filter((x) => {
      const ultima = this.catalogo.compras()
        .filter((c) => c.estado !== 'cancelada' && c.items.some((it) => it.productoId === x.p.id))
        .sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
      return ultima?.proveedorId === id;
    });
    const nombres = huerfanos.slice(0, 3).map((x) => x.p.nombre).join(', ') + (huerfanos.length > 3 ? ' y ' + (huerfanos.length - 3) + ' más' : '');
    return {
      proveedor,
      eliminable: stat.compras.length === 0,
      impacto: [
        {
          icono: 'file-invoice', tono: 'neutro' as Tono,
          titulo: pl(stat.compras.length, 'compra registrada', 'compras registradas'),
          detalle: stat.compras.length ? 'Se conservan en el historial' : 'Nada que conservar',
        },
        {
          icono: 'truck', tono: (pendientes ? 'aviso' : 'neutro') as Tono,
          titulo: pl(pendientes, 'compra pendiente', 'compras pendientes'),
          detalle: pendientes ? 'Podrás recibirlas aunque esté inactivo' : 'Nada en camino',
        },
        {
          icono: 'packages', tono: (huerfanos.length ? 'peligro' : 'neutro') as Tono,
          titulo: pl(huerfanos.length, 'producto queda', 'productos quedan') + ' sin proveedor habitual',
          detalle: huerfanos.length ? nombres : 'Ninguno depende de él',
        },
      ],
    };
  });
}
