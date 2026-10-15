import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BorradorCliente } from '../../../../../orders/shared/ventas.modelos';

/** Cliente nuevo o edición de sus datos, en la misma hoja. El servidor avisa si el celular o el correo ya son de otro cliente. */
@Component({
  selector: 'app-formulario-cliente',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex animate-[fade-in-up_.22s_ease-out] flex-col gap-3' },
  template: `
    @let d = borrador();
    <div class="grid grid-cols-2 gap-2.5">
      <label class="col-span-2"><span class="gp-label">Nombre o razón social *</span>
        <input [class]="!!error() && !d.nombre.trim() ? 'gp-input !border-[#d82c0d]' : 'gp-input'" [ngModel]="d.nombre" (ngModelChange)="poner('nombre', $event)" /></label>
      <label><span class="gp-label">Celular</span>
        <input class="gp-input" inputmode="numeric" placeholder="300 123 4567" [ngModel]="d.telefono" (ngModelChange)="poner('telefono', $event)" /></label>
      <label><span class="gp-label">Correo</span><input class="gp-input" type="email" [ngModel]="d.correo" (ngModelChange)="poner('correo', $event)" /></label>
      <label><span class="gp-label">Cédula o NIT</span><input class="gp-input" [ngModel]="d.documento" (ngModelChange)="poner('documento', $event)" /></label>
      <label><span class="gp-label">Ciudad</span><input class="gp-input" [ngModel]="d.ciudad" (ngModelChange)="poner('ciudad', $event)" /></label>
      <label class="col-span-2"><span class="gp-label">Dirección</span><input class="gp-input" [ngModel]="d.direccion" (ngModelChange)="poner('direccion', $event)" /></label>
      <label class="col-span-2"><span class="gp-label">Referencia</span><input class="gp-input" [ngModel]="d.referencia" (ngModelChange)="poner('referencia', $event)" /></label>
    </div>
    @if (error()) {
      <p class="m-0 rounded-xl bg-[#fff1f0] px-3 py-2.5 text-[12.5px] text-[#7a1d10]">{{ error() }}</p>
    }
    <div class="flex justify-end gap-2">
      <button type="button" class="gp-btn" (click)="descartar.emit()">Descartar</button>
      <button type="button" class="gp-btn-primario" [disabled]="guardando()" (click)="guardar.emit()">{{ guardando() ? 'Guardando…' : nuevo() ? 'Crear cliente' : 'Guardar cambios' }}</button>
    </div>
  `,
})
export class FormularioClienteComponent {
  readonly borrador = model.required<BorradorCliente>();
  readonly nuevo = input(false);
  readonly error = input('');
  readonly guardando = input(false);
  readonly guardar = output<void>();
  readonly descartar = output<void>();

  protected poner<K extends keyof BorradorCliente>(k: K, val: BorradorCliente[K]): void {
    this.borrador.update((d) => ({ ...d, [k]: val }));
  }
}
