import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { ProveedorV5 } from '../../../shared/modelos';
import { inicialesDe } from '../../../shared/proveedores.util';
import { icono } from '../../../shared/ui/iconos';
import { soloDigitos, tonoAvatar } from '../proveedores.modelo';

/** Avatar de un proveedor nuevo que todavía no tiene nombre. */
const TONO_SIN_NOMBRE: [string, string] = ['#f4f4f4', '#9ca3af'];

/**
 * Tarjeta de contacto de la hoja: avatar con el punto de estado, nombre,
 * persona de contacto, NIT (clic = copiar) y, si ya existe, llamar · WhatsApp ·
 * correo y "Nueva compra". Refleja el borrador mientras se edita.
 */
@Component({
  selector: 'app-tarjeta-contacto',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mt-2 flex animate-[ficha_360ms_cubic-bezier(.2,.8,.2,1)_both] items-center gap-4' },
  template: `
    @let d = borrador();
    <span class="relative flex size-17 shrink-0 items-center justify-center rounded-[20px] font-[Archivo] text-[24px] font-semibold tracking-[-0.02em] transition-[background-color,color] duration-300 ease-[ease]"
      [style.background]="tono()[0]" [style.color]="tono()[1]">
      {{ iniciales() }}
      <span class="absolute -right-0.5 -bottom-0.5 size-4 rounded-full shadow-[0_0_0_3px_#fff] transition-[background-color] duration-300 ease-[ease]"
        [class]="d.activo ? 'bg-[#29845a]' : 'bg-[#9ca3af]'"></span>
    </span>
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <div class="line-clamp-2 font-[Archivo] text-[24px] leading-[30px] font-semibold tracking-[-0.02em] text-[#111827]">{{ titulo() }}</div>
      <div class="flex flex-wrap items-center gap-2">
        <span class="inline-flex items-center gap-[5px] text-[13px]" [class]="d.contactoNombre.trim() ? 'text-[#374151]' : 'text-[#9ca3af]'">
          <tabler-icon [icon]="icono('user')" [size]="14" class="text-[#9ca3af]" />{{ d.contactoNombre.trim() || 'Sin persona de contacto' }}
        </span>
        @if (d.nit.trim()) {
          <button type="button" (click)="copiarNit.emit()" title="Copiar NIT"
            class="inline-flex items-center gap-1.5 rounded-full bg-[#f4f4f4] py-0.5 pr-1.5 pl-[9px] text-[12px] font-medium text-[#374151] tabular-nums [cursor:copy] transition-[background-color] duration-200 ease-[ease] hover:bg-[#ebebeb]!">
            NIT {{ d.nit.trim() }}<tabler-icon [icon]="icono('copy')" [size]="12" class="text-[#8a8a8a]" />
          </button>
        }
      </div>
    </div>
    @if (!nuevo()) {
      <div class="mt-0.5 flex shrink-0 items-center gap-1 self-start">
        @for (c of canales(); track c.icono) {
          <a [attr.href]="c.enlace" [attr.target]="c.icono === 'brand-whatsapp' ? '_blank' : '_self'" [attr.rel]="c.icono === 'brand-whatsapp' ? 'noopener' : null"
            [title]="c.enlace ? c.titulo : c.falta"
            class="flex size-8 items-center justify-center rounded-full bg-[#f4f4f4] text-[#303030] no-underline [transition:background-color_.2s,_transform_.2s_cubic-bezier(.2,.8,.2,1)] hover:bg-[#e9e9e9]! hover:[transform:translateY(-1px)]"
            [class]="c.enlace ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'">
            <tabler-icon [icon]="icono(c.icono)" [size]="16" />
          </a>
        }
        <button type="button" (click)="nuevaCompra.emit()" [title]="puedeComprar() ? '' : 'Necesitas el permiso compras.crear'"
          class="ml-1 flex h-8 items-center gap-1.5 rounded-full bg-[#303030] px-3 text-[12.5px] font-medium whitespace-nowrap text-white shadow-[inset_0_-1px_0_#000] hover:opacity-90!"
          [class]="puedeComprar() ? 'cursor-pointer' : 'cursor-not-allowed opacity-45'">
          <tabler-icon [icon]="icono('file-plus')" [size]="14" />Nueva compra
        </button>
      </div>
    }
  `,
})
export class TarjetaContactoComponent {
  readonly borrador = input.required<ProveedorV5>();
  readonly nuevo = input(false);
  /** Nombre guardado: se muestra mientras el del borrador está vacío. */
  readonly nombreGuardado = input('');
  /** Id con el que se elige el tono del avatar (para uno nuevo, el que tendrá). */
  readonly idTono = input(0);
  /** El correo no tiene error (si lo tiene, no se ofrece escribirle). */
  readonly correoValido = input(true);
  readonly puedeComprar = input(false);
  readonly copiarNit = output<void>();
  readonly nuevaCompra = output<void>();

  protected readonly icono = icono;
  private readonly nombre = computed(() => this.borrador().nombre.trim());
  protected readonly iniciales = computed(() => (this.nombre() ? inicialesDe(this.nombre()) : this.nuevo() ? '+' : inicialesDe(this.nombreGuardado())));
  protected readonly titulo = computed(() => this.nombre() || (this.nuevo() ? 'Nuevo proveedor' : this.nombreGuardado()));
  protected readonly tono = computed(() =>
    this.nuevo() && !this.nombre() ? TONO_SIN_NOMBRE : tonoAvatar(this.idTono(), this.borrador().activo),
  );
  /** Llamar, WhatsApp y correo: sin el dato, el botón queda apagado. */
  protected readonly canales = computed(() => {
    const d = this.borrador(), tel = soloDigitos(d.telefono), wa = tel.length === 10 ? '57' + tel : tel, correo = d.correo.trim();
    const telefono = 'Agrega el teléfono en General';
    return [
      { icono: 'phone', enlace: tel ? 'tel:' + tel : null, titulo: 'Llamar a ' + d.telefono, falta: telefono },
      { icono: 'brand-whatsapp', enlace: wa ? 'https://wa.me/' + wa : null, titulo: 'Escribir por WhatsApp', falta: telefono },
      { icono: 'mail', enlace: correo && this.correoValido() ? 'mailto:' + correo : null, titulo: 'Escribir a ' + d.correo, falta: 'Agrega el correo en General' },
    ];
  });
}
