import { ChangeDetectionStrategy, Component, computed, inject, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { norm } from '../../../products/shared/formato';
import { SegmentoComponent } from '../../../products/shared/ui/segmento/segmento.component';
import { iniCliente, tel } from '../../shared/ventas.formato';
import { BorradorPedido, Cliente, tonoCliente } from '../../shared/ventas.modelos';
import { VentasStore } from '../../shared/ventas.store';

/**
 * Cliente del pedido: uno existente (buscado por nombre o celular) o uno
 * nuevo cargado en línea. Al elegir uno existente se precarga su dirección.
 * Editando un pedido solo se puede cambiar por otro cliente existente.
 */
@Component({
  selector: 'app-selector-cliente',
  standalone: true,
  imports: [SegmentoComponent, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-2.5' },
  template: `
    @let d = borrador();
    @if (!editando()) {
      <app-segmento [opciones]="[['existente', 'Cliente existente'], ['nuevo', 'Cliente nuevo']]" [valor]="d.cliMode" (elegir)="poner({ cliMode: $any($event) })" />
    }
    @if (d.cliMode === 'existente') {
      @if (elegido(); as cl) {
        <div class="flex items-center gap-2.5 rounded-xl bg-white px-3 py-2.5 shadow-[0_0_0_1px_#efefef]">
          <span class="flex size-8 items-center justify-center rounded-[9px] text-xs font-semibold" [style.background-color]="tono(cl.id)[0]" [style.color]="tono(cl.id)[1]">{{ ini(cl.nombre) }}</span>
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="truncate text-[13px] font-semibold">{{ cl.nombre }}</span>
            <span class="text-xs text-gray-500">{{ tel(cl.telefono) || 'Sin celular' }}</span>
          </span>
          <button type="button" class="gp-btn" (click)="poner({ clienteId: null })">Cambiar</button>
        </div>
      } @else {
        <input class="gp-input" placeholder="Busca por nombre o celular" [ngModel]="q()" (ngModelChange)="q.set($event)"
          [class]="intento() ? 'gp-input !border-[#d82c0d]' : 'gp-input'" />
        <div class="flex flex-col">
          @for (cl of resultados(); track cl.id) {
            <button type="button" (click)="elegir(cl)" class="flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-[#f7f7f7]">
              <span class="flex size-7 items-center justify-center rounded-lg text-[11px] font-semibold" [style.background-color]="tono(cl.id)[0]" [style.color]="tono(cl.id)[1]">{{ ini(cl.nombre) }}</span>
              <span class="flex flex-col">
                <span class="text-[13px] font-medium">{{ cl.nombre }}</span>
                <span class="text-[11.5px] text-gray-500">{{ tel(cl.telefono) || 'Sin celular' }}</span>
              </span>
            </button>
          } @empty {
            <p class="m-0 px-1 text-[12.5px] text-gray-400">Ningún cliente coincide. Créalo con «Cliente nuevo».</p>
          }
        </div>
      }
    } @else {
      <div class="grid grid-cols-2 gap-2.5">
        <label class="col-span-2"><span class="gp-label">Nombre *</span>
          <input [class]="intento() && !d.nuevo.nombre.trim() ? 'gp-input !border-[#d82c0d]' : 'gp-input'" [ngModel]="d.nuevo.nombre" (ngModelChange)="poner({ nuevo: { ...d.nuevo, nombre: $event } })" /></label>
        <label><span class="gp-label">Celular</span>
          <input class="gp-input" inputmode="numeric" placeholder="300 123 4567" [ngModel]="d.nuevo.telefono" (ngModelChange)="poner({ nuevo: { ...d.nuevo, telefono: $event } })" /></label>
        <label><span class="gp-label">Correo</span>
          <input class="gp-input" [ngModel]="d.nuevo.correo" (ngModelChange)="poner({ nuevo: { ...d.nuevo, correo: $event } })" /></label>
      </div>
    }
  `,
})
export class SelectorClienteComponent {
  private readonly v = inject(VentasStore);
  readonly borrador = model.required<BorradorPedido>();
  readonly intento = input(false);
  readonly editando = input(false);
  protected readonly q = signal('');
  protected readonly tel = tel;
  protected readonly ini = iniCliente;
  protected readonly tono = tonoCliente;

  protected readonly elegido = computed(() => { const id = this.borrador().clienteId; return id ? this.v.cliente(id) : undefined; });
  protected readonly resultados = computed(() => {
    const qq = norm(this.q()).replace(/\s/g, '');
    return this.v.clientes().filter((c) => !c.archivadoEn && (!qq || norm(c.nombre + c.telefono).replace(/\s/g, '').includes(qq))).slice(0, 5);
  });

  protected poner(cambio: Partial<BorradorPedido>): void {
    this.borrador.update((d) => ({ ...d, ...cambio }));
  }

  protected elegir(c: Cliente): void {
    this.borrador.update((d) => ({
      ...d, clienteId: c.id, cliMode: 'existente',
      direccion: d.direccion || c.direccion.direccion, referencia: d.referencia || c.direccion.referencia, ciudad: d.ciudad || c.direccion.ciudad,
    }));
    this.q.set('');
  }
}
