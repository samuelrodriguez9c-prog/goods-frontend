import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import {
  IconChevronDown,
  IconSearch,
  IconSortDescending,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { AvisoDatosNuevosComponent } from '../aviso-datos-nuevos/aviso-datos-nuevos.component';
import { FilaLista, GrupoLista, Icono } from './lista-hoja.model';

/**
 * Esqueleto "lista + hoja" de Empresas, Altas pendientes, Suscripciones,
 * Facturación y Solicitudes (diseños `* - Lista y ficha v2`, `* - Cola y
 * llamada`, `* - Por empresa`, `* - Pagos y cuenta`, `* - Cola y decisión`).
 *
 * - Izquierda: buscador + orden, contador / filtro / "En vivo", grupos
 *   plegables con encabezado sticky y filas con gauge.
 * - Derecha: la hoja blanca. La página la proyecta con `<div hoja>`.
 * - La fila elegida (o en hover) se "funde" con la hoja: pierde el
 *   margen derecho, queda con radio 12px solo a la izquierda y le salen
 *   dos esquinas cóncavas. La lista tiene `margin-right: -16px` para meterse
 *   debajo del borde de la hoja.
 * - ↑/↓ con la lista enfocada mueven la selección (solo filas visibles).
 *
 * No reordena por realtime: `cambios` muestra la píldora y la página
 * recarga recién en `(actualizar)`.
 */
@Component({
  selector: 'app-lista-hoja',
  standalone: true,
  imports: [TablerIconComponent, AvisoDatosNuevosComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './lista-hoja.component.html',
  host: { class: 'grid min-h-0 flex-1 grid-cols-[minmax(250px,0.78fr)_minmax(0,1.42fr)] gap-0 pb-4' },
})
export class ListaHojaComponent {
  readonly grupos = input.required<GrupoLista[]>();
  readonly seleccionadaId = input<number | null>(null);
  readonly colapsados = input<ReadonlySet<string>>(new Set());
  readonly resaltadas = input<ReadonlySet<number>>(new Set());
  readonly buscar = input('');
  readonly placeholder = input('Buscar');
  readonly resultados = input('');
  readonly filtroTexto = input<string | null>(null);
  readonly cambios = input(0);
  readonly ordenIcono = input<Icono>(IconSortDescending);
  readonly ordenTitulo = input('Cambiar orden');
  readonly vacioTexto = input('No hay resultados que coincidan.');
  readonly etiquetaLista = input('Lista');

  readonly seleccionar = output<number>();
  readonly buscarChange = output<string>();
  readonly alternarOrden = output<void>();
  readonly alternarGrupo = output<string>();
  readonly quitarFiltro = output<void>();
  readonly limpiar = output<void>();
  readonly actualizar = output<void>();
  /** "Cargar más" de un grupo (emite la `clave`). */
  readonly cargarMas = output<string>();

  protected readonly iconBuscar = IconSearch;
  protected readonly iconX = IconX;
  protected readonly iconChevron = IconChevronDown;

  protected readonly hover = signal<number | null>(null);

  protected readonly plano = computed<FilaLista[]>(() =>
    this.grupos().flatMap((g) => (this.colapsados().has(g.clave) ? [] : g.filas)),
  );
  protected readonly vacia = computed(() => this.grupos().every((g) => !g.filas.length));

  protected unida(f: FilaLista): boolean {
    return f.id === this.seleccionadaId() || f.id === this.hover();
  }

  protected teclas(ev: KeyboardEvent): void {
    if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
    ev.preventDefault();
    const filas = this.plano();
    if (!filas.length) return;
    const i = filas.findIndex((f) => f.id === this.seleccionadaId());
    const j = Math.max(0, Math.min(filas.length - 1, i < 0 ? 0 : i + (ev.key === 'ArrowDown' ? 1 : -1)));
    this.seleccionar.emit(filas[j].id);
  }

  /** Para la hoja: "3 de 12" + anterior/siguiente. */
  posicion(): string {
    const filas = this.plano();
    const i = filas.findIndex((f) => f.id === this.seleccionadaId());
    return i < 0 ? '' : `${i + 1} de ${filas.length}`;
  }

  mover(d: 1 | -1): void {
    const filas = this.plano();
    if (!filas.length) return;
    const i = filas.findIndex((f) => f.id === this.seleccionadaId());
    this.seleccionar.emit(filas[Math.max(0, Math.min(filas.length - 1, i < 0 ? 0 : i + d))].id);
  }
}
