import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconClockPause, TablerIconComponent } from '@tabler/icons-angular';
import { Plantilla, piePromociones, variablesDe } from '../../../../../../core/whatsapp/whatsapp.model';
import { COSTO_PLANTILLA, cop } from '../../../../shared/secciones';
import { DatosPlantilla, VARIABLES, llenarVariables, tipoVariable } from '../../../../shared/variables';

/**
 * Ventana de 24 h cerrada: en lugar del compositor, las plantillas aprobadas
 * (tipo y costo de cada una). Al elegir una se llenan sus variables según de
 * dónde sale cada una (nombre, pedido, producto…), se ve cómo le llega y se
 * envía. Una de
 * promoción queda bloqueada si el cliente no acepta promociones.
 */
@Component({
  selector: 'app-plantillas-ventana',
  imports: [TablerIconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './plantillas-ventana.component.html',
  host: { class: 'flex flex-col gap-2.5' },
})
export class PlantillasVentanaComponent {
  /** null = cargando. */
  readonly aprobadas = input<Plantilla[] | null>(null);
  readonly aceptaPromociones = input(false);
  readonly cliente = input('');
  /** Nombre, último pedido y producto del chat: llenan las variables según su tipo. */
  readonly datos = input<DatosPlantilla>({ nombre: '' });
  readonly enviando = input(false);
  readonly puedeConfigurar = input(false);

  readonly enviar = output<{ plantilla: Plantilla; variables: string[] }>();

  protected readonly i = { reloj: IconClockPause };

  protected readonly elegidaId = signal<number | null>(null);
  protected readonly variables = signal<string[]>([]);

  protected readonly tarjetas = computed(() =>
    [...(this.aprobadas() ?? [])]
      // Primero las de servicio (las más baratas), como en el diseño.
      .sort((a, b) => Number(a.categoria === 'MARKETING') - Number(b.categoria === 'MARKETING') || a.id - b.id)
      .map((p) => {
      const promo = p.categoria === 'MARKETING';
      return {
        p,
        tipo: promo ? (this.aceptaPromociones() ? 'Promoción' : 'Promoción · no aceptó promociones') : 'Servicio',
        costo: `≈ ${cop(COSTO_PLANTILLA[p.categoria] ?? 4)}`,
        promo,
        on: this.elegidaId() === p.id,
      };
    }),
  );

  protected readonly elegida = computed(() => this.aprobadas()?.find((p) => p.id === this.elegidaId()) ?? null);
  protected readonly indices = computed(() => Array.from({ length: variablesDe(this.elegida()?.cuerpo ?? '') }, (_, k) => k));
  protected readonly bloqueada = computed(() => this.elegida()?.categoria === 'MARKETING' && !this.aceptaPromociones());
  protected readonly lista = computed(() => !!this.elegida() && this.indices().every((k) => !!this.variables()[k]?.trim()));

  /** Partes del cuerpo: texto fijo y variables (resaltadas). */
  protected readonly vista = computed(() => {
    const p = this.elegida();
    if (!p) return null;
    const vars = this.variables();
    const partes = p.cuerpo
      .split(/(\{\{\d+\}\})/)
      .filter(Boolean)
      .map((t) => {
        const m = /^\{\{(\d+)\}\}$/.exec(t);
        if (!m) return { t, vacia: false };
        const v = vars[Number(m[1]) - 1]?.trim();
        return v ? { t: v, vacia: false } : { t: `Variable ${m[1]}`, vacia: true };
      });
    return { partes, pie: p.categoria === 'MARKETING' ? piePromociones(p.idioma) : null };
  });

  protected readonly costoEnvio = computed(() => {
    const p = this.elegida();
    if (!p) return '';
    return this.bloqueada() ? 'no aceptó promociones' : `≈ ${cop(COSTO_PLANTILLA[p.categoria] ?? 4)}`;
  });

  protected elegir(p: Plantilla): void {
    this.elegidaId.set(p.id);
    // Cada variable se propone según de dónde sale (nombre, pedido, producto…).
    this.variables.set(llenarVariables(p.tiposVariables, variablesDe(p.cuerpo), { ...this.datos(), nombre: this.datos().nombre || this.cliente() }));
  }

  /** Etiqueta y ayuda de la variable `k` de la plantilla elegida. */
  protected etiqueta(k: number): { label: string; placeholder: string } {
    const p = this.elegida();
    const t = tipoVariable(p?.tiposVariables, k);
    return t === 'texto'
      ? { label: `Variable ${k + 1}`, placeholder: p?.ejemplos[k] ? `Ej.: ${p.ejemplos[k]}` : 'Lo escribes al enviar' }
      : { label: VARIABLES[t].label, placeholder: t === 'nombre' ? 'Ana' : 'Sin dato en este chat: escríbelo' };
  }

  protected cambiarVariable(k: number, valor: string): void {
    this.variables.update((v) => {
      const n = [...v];
      n[k] = valor;
      return n;
    });
  }

  protected mandar(): void {
    const p = this.elegida();
    if (!p || !this.lista() || this.bloqueada() || this.enviando()) return;
    this.enviar.emit({ plantilla: p, variables: this.indices().map((k) => this.variables()[k].trim()) });
  }
}
