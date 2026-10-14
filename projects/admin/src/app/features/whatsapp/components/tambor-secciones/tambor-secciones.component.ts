import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { IconChevronDown, IconMouse, TablerIconComponent } from '@tabler/icons-angular';
import { ClaveSeccion, SECCIONES } from '../../shared/secciones';

/** Lo que muestra cada sección en la lista del tambor: número, qué es y si está "viva". */
export interface EstadoSeccion {
  num: string;
  numK: string;
  numColor: string;
  vivo: boolean;
}

/**
 * La palabra de la sección en el título "WhatsApp / Bandeja": un tambor que
 * gira a la siguiente sección con la rueda del mouse (o G + letra, que
 * maneja la cabecera) y abre la lista de secciones con su número y estado.
 */
@Component({
  selector: 'app-tambor-secciones',
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tambor-secciones.component.html',
  host: { class: 'relative', '(document:click)': 'abierto.set(false)', '(document:keydown.escape)': 'abierto.set(false)' },
})
export class TamborSeccionesComponent {
  readonly actual = input.required<ClaveSeccion>();
  readonly estados = input.required<Record<ClaveSeccion, EstadoSeccion>>();
  readonly ir = output<ClaveSeccion>();

  protected readonly i = { chevron: IconChevronDown, mouse: IconMouse };
  protected readonly secciones = SECCIONES;
  readonly abierto = signal(false);

  protected readonly idx = computed(() => Math.max(0, SECCIONES.findIndex((s) => s.k === this.actual())));

  /** Ancho de cada palabra (se mide una vez, ya con Archivo cargada). */
  private readonly palabras = viewChildren<ElementRef<HTMLElement>>('palabra');
  private readonly anchos = signal<number[]>([]);
  protected readonly ancho = computed(() => {
    const w = this.anchos()[this.idx()];
    return w ? `${w}px` : 'auto';
  });

  private ultimaRueda = 0;

  constructor() {
    afterNextRender(() => {
      const medir = () => this.anchos.set(this.palabras().map((p) => Math.ceil(p.nativeElement.scrollWidth)));
      medir();
      document.fonts?.ready.then(medir);
    });
    inject(DestroyRef);
  }

  protected alternar(e: Event): void {
    e.stopPropagation();
    this.abierto.update((v) => !v);
  }

  protected rueda(e: WheelEvent): void {
    const ahora = Date.now();
    if (ahora - this.ultimaRueda < 380 || Math.abs(e.deltaY) < 4) return;
    e.preventDefault();
    this.ultimaRueda = ahora;
    const n = (this.idx() + (e.deltaY > 0 ? 1 : -1) + SECCIONES.length) % SECCIONES.length;
    this.ir.emit(SECCIONES[n].k);
  }

  protected elegir(k: ClaveSeccion): void {
    this.abierto.set(false);
    this.ir.emit(k);
  }
}
