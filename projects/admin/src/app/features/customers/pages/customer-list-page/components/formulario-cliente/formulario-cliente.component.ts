import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TarjetaIconoComponent } from '../../../../../products/shared/ui/tarjeta-icono/tarjeta-icono.component';
import { BorradorCliente } from '../../../../../orders/shared/ventas.modelos';
import { VentasStore } from '../../../../../orders/shared/ventas.store';
import { erroresCampos } from '../../../../../../core/campos/campo-personalizado.model';
import { CamposPropiosComponent } from '../../../../../../shared/ui/campos-propios/campos-propios.component';

/**
 * Cliente nuevo o edición de sus datos, en la misma hoja: tarjetas Contacto y
 * Dirección. El servidor avisa si el celular o el correo ya son de otro
 * cliente. El error y los botones van en el pie fijo de la hoja.
 */
@Component({
  selector: 'app-formulario-cliente',
  standalone: true,
  imports: [FormsModule, TarjetaIconoComponent, CamposPropiosComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex animate-[fade-in-up_.22s_ease-out] flex-col' },
  template: `
    @let d = borrador();
    <div class="grid grid-cols-[repeat(auto-fit,minmax(max(260px,calc((100%_-_12px)_/_2)),1fr))] gap-3">
      <app-tarjeta-icono icono="id" titulo="Contacto" sub="El celular y el correo no se pueden repetir.">
        <label><span class="gp-label">Nombre o razón social *</span>
          <input placeholder="Ej. Ana María Restrepo" [class]="!!error() && !d.nombre.trim() ? 'gp-input !border-[#d82c0d]' : 'gp-input'" [ngModel]="d.nombre" (ngModelChange)="poner('nombre', $event)" /></label>
        <label><span class="gp-label">Celular</span>
          <input class="gp-input" inputmode="numeric" placeholder="300 123 4567" [ngModel]="d.telefono" (ngModelChange)="poner('telefono', $event)" />
          <span class="mt-1 block text-xs text-gray-400">Con este número se vincula a WhatsApp.</span></label>
        <label><span class="gp-label">Correo</span><input class="gp-input" type="email" placeholder="opcional" [ngModel]="d.correo" (ngModelChange)="poner('correo', $event)" /></label>
        <label><span class="gp-label">Cédula o NIT</span><input class="gp-input" placeholder="Para facturar" [ngModel]="d.documento" (ngModelChange)="poner('documento', $event)" /></label>
      </app-tarjeta-icono>
      <app-tarjeta-icono icono="map-pin" titulo="Dirección" sub="Se propone al crearle un pedido.">
        <label><span class="gp-label">Dirección</span><input placeholder="Ej. Cl. 10 # 38-21" [class]="!!error() && !d.direccion.trim() && !!(d.ciudad.trim() || d.referencia.trim()) ? 'gp-input !border-[#d82c0d]' : 'gp-input'" [ngModel]="d.direccion" (ngModelChange)="poner('direccion', $event)" /></label>
        <label><span class="gp-label">Referencia</span><input class="gp-input" placeholder="Portería, local, color de la reja…" [ngModel]="d.referencia" (ngModelChange)="poner('referencia', $event)" /></label>
        <label><span class="gp-label">Ciudad</span><input class="gp-input" [ngModel]="d.ciudad" (ngModelChange)="poner('ciudad', $event)" /></label>
      </app-tarjeta-icono>
      @if (v.camposCliente().length) {
        <div class="col-span-full">
          <app-tarjeta-icono icono="forms" titulo="Campos propios" sub="Los datos que tu negocio guarda de cada cliente.">
            <app-campos-propios [campos]="v.camposCliente()" [valores]="d.atributos" [errores]="erroresAtributos()" [mostrarErrores]="!!error()" (cambio)="ponerAtributo($event.clave, $event.valor)" />
          </app-tarjeta-icono>
        </div>
      }
    </div>
  `,
})
export class FormularioClienteComponent {
  protected readonly v = inject(VentasStore);
  readonly borrador = model.required<BorradorCliente>();
  /** Solo para marcar en rojo los campos que causaron el error. */
  readonly error = input('');

  protected readonly erroresAtributos = computed(() => erroresCampos(this.borrador().atributos, this.v.camposCliente()));

  protected poner<K extends keyof BorradorCliente>(k: K, val: BorradorCliente[K]): void {
    this.borrador.update((d) => ({ ...d, [k]: val }));
  }

  protected ponerAtributo(clave: string, valor: string): void {
    this.borrador.update((d) => ({ ...d, atributos: { ...d.atributos, [clave]: valor } }));
  }
}
