import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, computed, inject, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconClock, IconMapPin, IconPlus, IconTrash, TablerIconComponent } from '@tabler/icons-angular';
import { FilaHorarioEdit, MAX_HORARIO, SUGERENCIAS_HORARIO, filaValida } from '../../shared/tienda-config.modelo';
import { TiendaConfigStore } from '../../shared/tienda-config.store';
import { TiendaCabezaComponent } from '../tienda-cabeza/tienda-cabeza.component';
import { TiendaEtiquetaComponent } from '../tienda-etiqueta/tienda-etiqueta.component';

/**
 * Tarjeta · Ubicación y horario: ciudad (bajo el hero), dirección
 * del local («Recoger en tienda» y el pie) y el horario en filas de texto
 * «días · horas» o «cerrado». Todo opcional: lo que quede vacío no se muestra.
 */
@Component({
  selector: 'app-tienda-ficha-local',
  imports: [FormsModule, TablerIconComponent, TiendaCabezaComponent, TiendaEtiquetaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tienda-ficha-local.component.html',
  host: { class: 'contents' },
})
export class TiendaFichaLocalComponent {
  protected readonly s = inject(TiendaConfigStore);
  protected readonly i = { pin: IconMapPin, reloj: IconClock, plus: IconPlus, quitar: IconTrash };
  protected readonly max = MAX_HORARIO;
  protected readonly valida = filaValida;
  /** Sugerencias de filas cuyos días todavía no están en el horario. */
  protected readonly sugerencias = computed(() => {
    const dias = new Set(this.s.f().horario.map((h) => h.dias.trim().toLowerCase()));
    return SUGERENCIAS_HORARIO.filter((h) => !dias.has(h.dias.toLowerCase()));
  });
  private readonly sec = viewChild.required<ElementRef<HTMLElement>>('sec');

  constructor() {
    afterNextRender(() => this.s.registrarTarjeta('local', this.sec().nativeElement));
  }

  protected agregar(fila: FilaHorarioEdit = { dias: '', horas: '', cerrado: false }): void {
    const h = this.s.f().horario;
    if (h.length >= MAX_HORARIO) return;
    this.s.set('horario', [...h, { ...fila }]);
    if (!fila.dias) setTimeout(() => this.sec().nativeElement.querySelector<HTMLInputElement>('[data-fila]:last-of-type input')?.focus(), 30);
  }
  protected cambiar(k: number, cambio: Partial<FilaHorarioEdit>): void {
    this.s.set('horario', this.s.f().horario.map((h, j) => (j === k ? { ...h, ...cambio } : h)));
  }
  protected quitar(k: number): void {
    this.s.set('horario', this.s.f().horario.filter((_, j) => j !== k));
  }
  /** «Sábados · 8:00 a. m. – 1:00 p. m.» / «Domingos · Cerrado». */
  protected textoSugerencia(h: FilaHorarioEdit): string { return `${h.dias} · ${h.cerrado ? 'Cerrado' : h.horas}`; }
}
