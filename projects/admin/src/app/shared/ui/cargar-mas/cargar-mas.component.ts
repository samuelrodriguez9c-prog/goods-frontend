import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

/** Filas que muestra cada grupo de entrada y cuántas suma «Cargar más» (lo mismo que Productos). */
export const PAGINA_GRUPO = 15;

/**
 * Cuántas filas se ven en cada grupo de una lista. Se crea una por página:
 *   `protected readonly pagina = new PaginaPorGrupo();`
 * y en la plantilla:
 *   `@let pg = pagina.ver(g.clave, g.filas, sel());`
 *   `@for (f of pg.filas …)` y al final `<app-cargar-mas [quedan]="pg.quedan" (cargar)="pagina.mas(g.clave)" />`.
 *
 * La fila abierta siempre se ve (aunque quede más abajo del corte), así
 * ↑ ↓ y los enlaces nunca abren una fila escondida.
 */
export class PaginaPorGrupo {
  private readonly mostrados = signal<Record<string, number>>({});

  constructor(private readonly pagina = PAGINA_GRUPO) {}

  /**
   * Las filas a la vista del grupo y cuántas quedan. `abierto`: el id de la
   * fila abierta (se compara con `id(f)`, por defecto `f.id`).
   */
  ver<T>(
    clave: string,
    filas: T[],
    abierto: unknown = null,
    id: (f: T) => unknown = (f) => (f as { id?: unknown }).id,
  ): { filas: T[]; quedan: number } {
    let lim = this.mostrados()[clave] ?? this.pagina;
    if (abierto != null) {
      const i = filas.findIndex((f) => id(f) === abierto);
      if (i >= lim) lim = i + 1;
    }
    return { filas: filas.length > lim ? filas.slice(0, lim) : filas, quedan: Math.max(0, filas.length - lim) };
  }

  mas(clave: string): void {
    this.mostrados.update((m) => ({ ...m, [clave]: (m[clave] ?? this.pagina) + this.pagina }));
  }

  /** Vuelve al primer lote (al cambiar filtros o la agrupación). */
  reiniciar(): void {
    this.mostrados.set({});
  }
}

/** «Cargar 15 más · quedan 116» al final de un grupo (el botón de Productos). */
@Component({
  selector: 'app-cargar-mas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    @if (quedan() > 0) {
      <button
        type="button"
        (click)="$event.stopPropagation(); cargar.emit()"
        class="mr-7 mt-1 cursor-pointer rounded-xl px-3 py-2 text-left text-[12.5px] font-medium text-[#00807a] hover:bg-[#e8e8e8]"
      >
        Cargar {{ lote() }} más · quedan {{ quedan() }}
      </button>
    }
  `,
})
export class CargarMasComponent {
  readonly quedan = input(0);
  readonly pagina = input(PAGINA_GRUPO);
  readonly cargar = output<void>();
  protected readonly lote = computed(() => Math.min(this.quedan(), this.pagina()));
}
