import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { CatalogoStore } from '../../../../shared/catalogo.store';
import { fecha, norm } from '../../../../shared/formato';
import { ProveedorV5 } from '../../../../shared/modelos';
import { icono } from '../../../../shared/ui/iconos';
import { FichaCompra } from '../../compras.modelo';
import { ChipAsistenteComponent } from '../asistente/asistente.component';
import { FacturaPapelComponent } from '../factura-papel/factura-papel.component';
import { SeccionDatosComponent } from '../seccion-datos/seccion-datos.component';

/** Cambio en un campo del encabezado de la compra. */
export type CambioCampo =
  | { campo: 'fecha'; valor: string }
  | { campo: 'numeroFactura'; valor: string }
  | { campo: 'notas'; valor: string };

/**
 * Pestaña "Datos": proveedor, documento (fecha, número y archivo) y notas, en
 * lectura o como formulario; a la derecha, la factura de papel.
 */
@Component({
  selector: 'app-pestana-datos',
  standalone: true,
  imports: [TablerIconComponent, SeccionDatosComponent, ChipAsistenteComponent, FacturaPapelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pestana-datos.component.html',
  host: { class: 'grid animate-[fade-in-up_.22s_ease-out] grid-cols-[minmax(0,1fr)_minmax(230px,290px)] items-start gap-5' },
})
export class PestanaDatosComponent {
  private readonly catalogo = inject(CatalogoStore);

  readonly ficha = input.required<FichaCompra>();
  readonly editable = input(false);
  /** Ya se intentó guardar sin proveedor. */
  readonly faltaProveedor = input(false);
  readonly cambiarCampo = output<CambioCampo>();
  readonly buscarProveedor = output<string>();
  readonly elegirProveedor = output<ProveedorV5>();
  /** Crear un proveedor con el nombre escrito (ya comprobado el permiso). */
  readonly crearProveedor = output<string>();
  readonly adjuntar = output<File>();
  readonly quitarArchivo = output<void>();
  readonly verFactura = output<void>();

  protected readonly icono = icono;
  /** Buscador de proveedor abierto. */
  protected readonly buscando = signal(false);

  /** Campos de lectura, por sección. */
  protected readonly secciones = computed(() => {
    const { compra: c, proveedor: p, formulario } = this.ficha();
    if (formulario || !c) return [];
    const campo = (etiqueta: string, valor: string, vacio = false) => ({ etiqueta, valor, vacio });
    return [
      {
        icono: 'truck', titulo: 'Proveedor', detalle: 'Quién emitió la factura.',
        campos: [campo('Nombre', p ? p.nombre : '—', !p), campo('NIT', p?.nit || 'Sin NIT', !p?.nit)],
      },
      {
        icono: 'file-invoice', titulo: 'Documento', detalle: 'Fecha, número y archivo de la factura.',
        campos: [
          campo('Fecha de la compra', fecha(c.fecha)),
          campo('N° de factura', c.numeroFactura || 'Sin número', !c.numeroFactura),
          campo('Recibida', c.recibidaEn ? fecha(c.recibidaEn) : 'Aún no', !c.recibidaEn),
          campo('Archivo', c.archivoNombre || 'Sin archivo', !c.archivoNombre),
        ],
      },
    ];
  });

  /** Proveedores activos que coinciden con lo escrito, y si se puede crear uno nuevo con ese nombre. */
  protected readonly proveedores = computed(() => {
    const d = this.ficha().borrador;
    if (!d) return { opciones: [], crear: false };
    const q = norm(d.busquedaProveedor.trim());
    return {
      opciones: this.catalogo.proveedores().filter((p) => p.activo && (!q || norm(p.nombre).includes(q))).slice(0, 6),
      crear: !!q && !this.catalogo.proveedores().some((p) => norm(p.nombre) === q),
    };
  });

  protected buscar(texto: string): void {
    this.buscando.set(true);
    this.buscarProveedor.emit(texto);
  }
  protected elegir(p: ProveedorV5, e: Event): void {
    e.preventDefault();
    this.buscando.set(false);
    this.elegirProveedor.emit(p);
  }
  protected crear(e: Event): void {
    e.preventDefault();
    const nombre = this.ficha().borrador?.busquedaProveedor.trim();
    if (!nombre || this.catalogo.niega('proveedores.crear')) return;
    this.buscando.set(false);
    this.crearProveedor.emit(nombre);
  }
  /** Deja terminar el mousedown de una opción antes de cerrar. */
  protected cerrarBuscador(): void {
    setTimeout(() => this.buscando.set(false), 150);
  }
  protected elegirArchivo(campo: HTMLInputElement): void {
    const archivo = campo.files?.[0];
    campo.value = '';
    if (archivo) this.adjuntar.emit(archivo);
  }
}
