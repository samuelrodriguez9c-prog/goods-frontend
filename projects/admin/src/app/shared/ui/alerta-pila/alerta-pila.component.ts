import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  viewChildren,
} from '@angular/core';
import { IconChevronUp, IconX, TablerIconComponent } from '@tabler/icons-angular';
import { AlertaEnLinea, AlertaService } from '../../../core/ui/alerta.service';
import { EstadoIconoComponent } from '../estado-icono/estado-icono.component';

const PASO = 9;
const ALTO_FILA = 44;

/**
 * Pila oscura de alertas en línea: incluye la fija de cambios sin guardar
 * (Guardar / Descartar), la acción en la fila cuando está plegada, la
 * sacudida y el desplazamiento sobre la barra de selección masiva. Va una
 * sola vez en el shell.
 */
@Component({
  selector: 'app-alerta-pila',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EstadoIconoComponent, TablerIconComponent],
  templateUrl: './alerta-pila.component.html',
})
export class AlertaPilaComponent {
  protected readonly servicio = inject(AlertaService);
  protected readonly ic = { chevron: IconChevronUp, cerrar: IconX };

  protected readonly alertas = this.servicio.enLinea;
  protected readonly activas = this.servicio.activas;

  private readonly posiciones = computed(() => {
    const act = this.activas();
    const m = new Map<number, number>();
    act.forEach((a, idx) => m.set(a.id, act.length - 1 - idx));
    return m;
  });

  protected readonly cerrables = computed(
    () => this.activas().filter((a) => a.estado !== 'cargando' && !a.fija).length,
  );
  protected readonly cerrarTodasAbajo = computed(() => this.servicio.altoPila() + 10);
  protected readonly abajo = computed(() => 24 + this.servicio.desplazamiento());
  protected readonly sacudida = computed(() => {
    const n = this.servicio.sacudida();
    return n ? `${n % 2 ? 'sacudeA' : 'sacudeB'} .42s ease-in-out` : 'none';
  });

  private readonly capas = viewChildren<ElementRef<HTMLElement>>('capa');
  private readonly ro = new ResizeObserver(() => this.medirFrente());

  constructor() {
    afterRenderEffect(() => {
      this.ro.disconnect();
      this.capas().forEach((c) => this.ro.observe(c.nativeElement));
      this.medirFrente();
    });
    inject(DestroyRef).onDestroy(() => this.ro.disconnect());
  }

  protected pos(a: AlertaEnLinea): number {
    return a.saliendo ? -1 : (this.posiciones().get(a.id) ?? -1);
  }

  /** Se puede expandir si hay texto y además acción, error o más de 38 caracteres. */
  protected expandible(a: AlertaEnLinea): boolean {
    return !!a.texto && (!!a.accion || a.estado === 'error' || a.texto.length > 38);
  }

  protected transformar(a: AlertaEnLinea, i: number): string {
    if (a.saliendo) return 'translateY(14px) scale(0.97)';
    if (i === 0) return 'translateY(0) scale(1)';
    const k = Math.min(i, 3);
    return `translateY(${-(this.servicio.altoFrente() - ALTO_FILA) - PASO * k}px) scale(${1 - 0.05 * k})`;
  }

  protected opacidad(a: AlertaEnLinea, i: number): number {
    return a.saliendo || i > 2 ? 0 : 1 - 0.2 * i;
  }

  protected alternar(a: AlertaEnLinea, i: number): void {
    if (i === 0 && this.expandible(a)) this.servicio.alternar(a.id);
  }

  protected cerrar(e: Event, id: number): void {
    e.stopPropagation();
    this.servicio.cerrar(id);
  }

  protected ejecutar(e: Event, a: AlertaEnLinea, cual: 1 | 2 = 1): void {
    e.stopPropagation();
    const acc = cual === 1 ? a.accion : a.accion2;
    if (!a.fija) this.servicio.cerrar(a.id);
    acc?.ejecutar();
  }

  private medirFrente(): void {
    const el = this.capas().find((c) => c.nativeElement.dataset['frente'] === 'true')?.nativeElement;
    const h = el?.offsetHeight;
    if (h && h !== this.servicio.altoFrente()) this.servicio.altoFrente.set(h);
  }
}
