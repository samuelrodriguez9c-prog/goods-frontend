import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { CatalogoStore } from '../../../shared/catalogo.store';
import { codigoCompra, num } from '../../../shared/formato';
import { CompraV5 } from '../../../shared/modelos';
import { icono } from '../../../shared/ui/iconos';
import { miniaturaDe } from '../compras.modelo';
import { MarcoModalComponent } from './marco-modal.component';
import { MiniaturaProductoComponent } from './miniatura-producto.component';

/** Confirmar "Marcar como recibida": cómo queda el stock de cada línea. */
@Component({
  selector: 'app-modal-recibir',
  standalone: true,
  imports: [TablerIconComponent, MarcoModalComponent, MiniaturaProductoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-marco-modal [titulo]="'Marcar ' + codigo() + ' como recibida'" subtitulo="El stock sube una sola vez y la compra queda en solo lectura."
      [ancho]="520" textoConfirmar="Marcar como recibida" (cerrar)="cerrar.emit()" (confirmar)="confirmar.emit()">
      <div class="overflow-hidden rounded-xl border border-[#ececec]">
        @for (l of lineas(); track $index) {
          <div class="grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-b-[#f5f5f5] px-3 py-[9px]">
            <app-miniatura-producto [miniatura]="l.miniatura" tamano="modal" />
            <span class="flex min-w-0 flex-col"><span class="truncate font-medium">{{ l.nombre }}</span><span class="text-[12px] text-[#087b5d]">{{ l.suma }}</span></span>
            <span class="flex items-center gap-2 font-[Archivo] text-[15px] font-semibold">
              <span class="text-[#9ca3af]">{{ l.desde }}</span>
              <tabler-icon [icon]="icono('arrow-right')" [size]="14" [stroke]="2" class="text-[#9ca3af]" />
              <span>{{ l.hasta }}</span>
            </span>
          </div>
        }
      </div>
    </app-marco-modal>
  `,
})
export class ModalRecibirComponent {
  private readonly catalogo = inject(CatalogoStore);
  readonly compra = input.required<CompraV5>();
  readonly cerrar = output<void>();
  readonly confirmar = output<void>();

  protected readonly icono = icono;
  protected readonly codigo = computed(() => codigoCompra(this.compra().id));
  protected readonly lineas = computed(() =>
    this.compra().items.map((it) => {
      const st = this.catalogo.stockDe(it.productoId), p = this.catalogo.producto(it.productoId);
      return {
        nombre: p?.nombre ?? '?',
        miniatura: miniaturaDe(p, this.catalogo),
        desde: num(st.disponible),
        hasta: num(st.disponible + it.cantidad),
        suma: '+' + num(it.cantidad),
      };
    }),
  );
}
