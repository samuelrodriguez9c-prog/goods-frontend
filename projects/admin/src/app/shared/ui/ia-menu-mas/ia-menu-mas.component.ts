import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, input, output, signal } from '@angular/core';
import {
  IconArrowsDiagonal,
  IconBooks,
  IconChevronLeft,
  IconChevronRight,
  IconFilePlus,
  IconFileText,
  IconPaperclip,
  IconPlus,
  IconReceipt2,
  TablerIconComponent,
} from '@tabler/icons-angular';

type Clave = 'subir' | 'docs' | 'compra' | 'nuevoDoc';

/**
 * Botón "+" del composer y su menú oscuro (v3).
 *
 *   Subir archivos
 *   Documentos  ›   ← submenú: "Preguntar sobre" + docs + Agregar documento
 *   ───────────
 *   Registrar compra
 *   Agregar documento
 *
 * `variante="completa"` (pantalla completa): en hover aparece a la derecha
 * una píldora clara con la descripción, y "Documentos" abre el
 * submenú al costado.
 * `variante="mini"` (mini chat): no hay espacio al costado, así que el
 * submenú reemplaza la lista dentro del mismo menú (con "‹" para volver), y
 * las acciones que abren la pantalla completa llevan el ícono ⤢.
 */
@Component({
  selector: 'app-ia-menu-mas',
  standalone: true,
  imports: [NgTemplateOutlet, TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ia-menu-mas.component.html',
})
export class IaMenuMasComponent {
  readonly variante = input<'completa' | 'mini'>('completa');
  /** Títulos de los documentos internos (se muestran los 5 primeros). */
  readonly documentos = input<{ id: number; titulo: string }[]>([]);

  readonly subirArchivos = output<void>();
  readonly registrarCompra = output<void>();
  readonly agregarDocumento = output<void>();
  readonly preguntarDocumento = output<string>();

  protected readonly i = {
    mas: IconPlus, clip: IconPaperclip, libros: IconBooks, compra: IconReceipt2, nuevoDoc: IconFilePlus,
    doc: IconFileText, sub: IconChevronRight, volver: IconChevronLeft, externo: IconArrowsDiagonal,
  };

  protected readonly abierto = signal(false);
  protected readonly hover = signal<Clave | null>(null);
  /** Solo en `mini`: qué lista se ve dentro del menú. */
  protected readonly vista = signal<'raiz' | 'docs'>('raiz');

  protected readonly grupo1: { k: Clave; icono: typeof IconPlus; texto: string; tip: string; sub?: boolean }[] = [
    { k: 'subir', icono: IconPaperclip, texto: 'Subir archivos', tip: 'PDF, imágenes, Excel, Word y más' },
    { k: 'docs', icono: IconBooks, texto: 'Documentos', tip: '', sub: true },
  ];
  protected readonly grupo2: { k: Clave; icono: typeof IconPlus; texto: string; tip: string; sub?: boolean }[] = [
    { k: 'compra', icono: IconReceipt2, texto: 'Registrar compra', tip: 'Desde la factura del proveedor; la IA completa los datos' },
    { k: 'nuevoDoc', icono: IconFilePlus, texto: 'Agregar documento', tip: 'Políticas y manuales que el asistente consulta' },
  ];

  @HostListener('document:keydown.escape')
  protected onEsc(): void {
    this.cerrar();
  }

  protected toggle(): void {
    this.abierto() ? this.cerrar() : this.abierto.set(true);
  }

  protected cerrar(): void {
    this.abierto.set(false);
    this.hover.set(null);
    this.vista.set('raiz');
  }

  protected elegir(k: Clave): void {
    if (k === 'docs') {
      if (this.variante() === 'mini') this.vista.set('docs');
      else this.hover.set('docs');
      return;
    }
    this.cerrar();
    if (k === 'subir') this.subirArchivos.emit();
    if (k === 'compra') this.registrarCompra.emit();
    if (k === 'nuevoDoc') this.agregarDocumento.emit();
  }

  protected preguntar(titulo: string): void {
    this.cerrar();
    this.preguntarDocumento.emit(titulo);
  }

  protected nuevoDoc(): void {
    this.cerrar();
    this.agregarDocumento.emit();
  }

  /** En `mini`, la compra y el documento nuevo continúan en pantalla completa. */
  protected externo(k: Clave): boolean {
    return this.variante() === 'mini' && (k === 'compra' || k === 'nuevoDoc');
  }
}
