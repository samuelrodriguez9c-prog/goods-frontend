import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { AuthService } from '../../../../../core/auth/auth.service';
import { CatalogoStore } from '../../../shared/catalogo.store';
import { cop, fecha, num } from '../../../shared/formato';
import { CompraV5 } from '../../../shared/modelos';
import { Borrador, soloDigitos } from '../compras.modelo';
import { MarcoModalComponent } from './marco-modal.component';

/**
 * "Ver factura": la imagen o el PDF adjunto; sin archivo, una factura de muestra
 * con los datos de la compra. En el formulario manda el borrador (puede ser un
 * archivo recién elegido, todavía sin subir).
 */
@Component({
  selector: 'app-modal-factura',
  standalone: true,
  imports: [MarcoModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let fa = factura();
    <app-marco-modal [titulo]="fa.titulo" [ancho]="640" textoCerrar="Cerrar" (cerrar)="cerrar.emit()">
      <div class="flex justify-center rounded-xl bg-[#f1f1f1] p-4.5">
        @switch (fa.tipo) {
          @case ('imagen') {
            <span class="block h-[70vh] w-full max-w-full rounded-md bg-contain bg-center bg-no-repeat shadow-[0_10px_24px_-14px_rgba(0,0,0,.3)]"
              [style.background-image]="'url(' + fa.url + ')'"></span>
          }
          @case ('pdf') {
            <iframe [src]="fa.pdf" title="Factura" class="h-[70vh] w-full rounded-md bg-white shadow-[0_10px_24px_-14px_rgba(0,0,0,.3)]"></iframe>
          }
          @default {
            <div class="flex w-full max-w-130 flex-col gap-3.5 rounded-md bg-white px-6.5 py-6 text-[12px] text-[#374151] shadow-[0_10px_24px_-14px_rgba(0,0,0,.3)]">
              <div class="flex justify-between gap-3">
                <span class="flex flex-col gap-0.5">
                  <span class="text-[15px] font-bold text-[#111827]">{{ fa.proveedor }}</span>
                  <span>{{ fa.nit }}</span>
                  <span class="text-[#6b7280]">{{ fa.direccion }}</span>
                </span>
                <span class="flex flex-col items-end gap-0.5">
                  <span class="text-[11px] tracking-[.06em] text-[#9ca3af] uppercase">Factura de venta</span>
                  <span class="font-bold text-[#111827]">{{ fa.numero }}</span>
                  <span>{{ fa.fecha }}</span>
                </span>
              </div>
              @if (fa.cliente) {
                <div class="text-[11.5px] text-[#6b7280]">Cliente: {{ fa.cliente }}</div>
              }
              <div class="border-t-[1.5px] border-t-[#111827]">
                @for (r of fa.filas; track $index) {
                  <div class="grid grid-cols-[minmax(0,1fr)_40px_80px_90px] gap-2 border-b border-b-[#ececec] py-1.5">
                    <span>{{ r.nombre }}</span><span class="text-right">{{ r.cantidad }}</span><span class="text-right">{{ r.precio }}</span><span class="text-right">{{ r.subtotal }}</span>
                  </div>
                }
              </div>
              <div class="flex justify-end gap-4 text-[14px]"><span class="text-[#6b7280]">Total</span><span class="font-bold text-[#111827]">{{ fa.total }}</span></div>
            </div>
          }
        }
      </div>
    </app-marco-modal>
  `,
})
export class ModalFacturaComponent {
  private readonly catalogo = inject(CatalogoStore);
  private readonly auth = inject(AuthService);
  private readonly sanitizer = inject(DomSanitizer);

  /** La compra guardada (null: compra nueva). */
  readonly compra = input<CompraV5 | null>(null);
  /** El borrador, si la hoja está en modo formulario. */
  readonly borrador = input<Borrador | null>(null);
  readonly cerrar = output<void>();

  protected readonly factura = computed(() => {
    const c = this.compra(), d = this.borrador();
    const proveedorId = c ? c.proveedorId : d?.proveedorId;
    const p = proveedorId ? this.catalogo.proveedor(proveedorId) : undefined;
    const items = c
      ? c.items.map((it) => ({ nombre: this.catalogo.producto(it.productoId)?.nombre ?? '?', cantidad: it.cantidad, precio: it.precioUnitario }))
      : d ? d.items.map((it) => ({ nombre: it.busqueda || it.textoFactura || '—', cantidad: +it.cantidad || 0, precio: +soloDigitos(it.precioUnitario) || 0 })) : [];
    const url = d ? d.archivo?.url ?? null : c?.archivoUrl ?? null;
    const titulo = d ? d.archivo?.name ?? 'Factura' : c?.archivoNombre ?? 'Factura';
    const pdf = !!url && (/\.pdf($|[?#])/i.test(url) || (/^blob:/.test(url) && /\.pdf$/i.test(titulo)));
    return {
      titulo,
      tipo: !url ? 'muestra' : pdf ? 'pdf' : 'imagen',
      url: url ?? '',
      pdf: pdf ? this.sanitizer.bypassSecurityTrustResourceUrl(url!) : null,
      proveedor: p ? p.nombre : 'Proveedor',
      nit: p?.nit ? 'NIT ' + p.nit : '',
      direccion: p?.direccion ?? '',
      numero: (c ? c.numeroFactura : d?.numeroFactura) ?? '',
      fecha: fecha(c ? c.fecha : d ? d.fecha : this.catalogo.hoy()),
      cliente: this.auth.currentUser()?.empresa?.nombre ?? '',
      filas: items.map((it) => ({ nombre: it.nombre, cantidad: num(it.cantidad), precio: cop(it.precio), subtotal: cop(it.cantidad * it.precio) })),
      total: cop(items.reduce((a, it) => a + it.cantidad * it.precio, 0)),
    };
  });
}
