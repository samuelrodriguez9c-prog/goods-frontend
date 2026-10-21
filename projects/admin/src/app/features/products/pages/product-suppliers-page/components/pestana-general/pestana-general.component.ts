import { ChangeDetectionStrategy, Component, computed, input, output, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TablerIconComponent } from '@tabler/icons-angular';
import { CampoPersonalizado, textoValor } from '../../../../../../core/campos/campo-personalizado.model';
import { CamposPropiosComponent } from '../../../../../../shared/ui/campos-propios/campos-propios.component';
import { DIAS } from '../../../../shared/proveedores.util';
import { icono } from '../../../../shared/ui/iconos';
import { BorradorProveedor, CampoTexto } from '../../proveedores.modelo';
import { CampoTextoComponent } from '../campo-texto/campo-texto.component';
import { RelacionProveedorComponent } from '../relacion-proveedor/relacion-proveedor.component';
import { SaludProveedorComponent } from '../salud-proveedor/salud-proveedor.component';
import { SeccionHojaComponent } from '../seccion-hoja/seccion-hoja.component';

/** Filas de la ficha en lectura: [ícono, etiqueta, campo]. */
const FICHA: [string, string, CampoTexto][] = [
  ['id', 'Razón social', 'nombre'], ['hash', 'NIT', 'nit'], ['user', 'Contacto', 'contactoNombre'],
  ['phone', 'Teléfono', 'telefono'], ['mail', 'Correo', 'correo'], ['map-pin', 'Dirección', 'direccion'],
];

/**
 * Pestaña General: relación y salud (si ya existe), la ficha en lectura o el
 * formulario (Identidad · Contacto · Entregas y notas · Estado · Campos propios).
 * Cada cambio sale como `editar` con los campos que cambian.
 */
@Component({
  selector: 'app-pestana-general',
  standalone: true,
  imports: [
    RouterLink, TablerIconComponent, SeccionHojaComponent, CampoTextoComponent, RelacionProveedorComponent, SaludProveedorComponent, CamposPropiosComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pestana-general.component.html',
  host: { class: 'flex animate-[fade-in-up_.22s_ease-out] flex-col gap-3' },
})
export class PestanaGeneralComponent {
  readonly borrador = input.required<BorradorProveedor>();
  readonly nuevo = input(false);
  readonly editando = input(false);
  /** Tiene permiso para editar (o crear, si es nuevo). */
  readonly editable = input(false);
  /** Errores visibles por campo. */
  readonly errores = input<Partial<Record<CampoTexto, string>>>({});
  /** Campos propios activos de la Empresa. */
  readonly campos = input<CampoPersonalizado[]>([]);
  readonly erroresCampos = input<Record<string, string>>({});
  readonly mostrarErroresCampos = input(false);
  /** Tiene `campos.gestionar`: ve el enlace para crear o editar los campos. */
  readonly gestionarCampos = input(false);
  readonly editar = output<Partial<BorradorProveedor>>();
  readonly alternarEdicion = output<void>();
  readonly verCompra = output<number>();

  protected readonly icono = icono;
  protected readonly dias = DIAS;
  private readonly nombre = viewChild<CampoTextoComponent>('nombre');

  protected readonly ficha = computed(() => {
    const d = this.borrador();
    return [
      ...FICHA.map(([icono, etiqueta, campo]) => ({ icono, etiqueta, valor: d[campo].trim() })),
      ...this.campos().map((c) => ({ icono: 'forms', etiqueta: c.etiqueta, valor: textoValor(c, d.atributos[c.clave]) })),
    ];
  });

  enfocarNombre(): void {
    this.nombre()?.enfocar();
  }
  protected alternarDia(n: number): void {
    if (!this.editable()) return;
    const ds = this.borrador().diasEntrega;
    this.editar.emit({ diasEntrega: ds.includes(n) ? ds.filter((x) => x !== n) : [...ds, n].sort() });
  }
  protected ponerActivo(activo: boolean): void {
    if (this.editable()) this.editar.emit({ activo });
  }
  protected editarCampo(clave: string, valor: string): void {
    if (this.editable()) this.editar.emit({ atributos: { ...this.borrador().atributos, [clave]: valor } });
  }
}
