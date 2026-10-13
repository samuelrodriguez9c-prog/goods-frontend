import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { TablerIconComponent } from '@tabler/icons-angular';
import { icono } from '../../../shared/ui/iconos';

/** Por qué no se puede recibir: hay cambios sin guardar o falta el permiso. */
export type BloqueoRecibir = 'sucio' | 'permiso' | null;

const DURACION_MS = 1300;

/**
 * "Mantén presionado para recibir": hay que sostenerlo 1,3 s (mouse, toque,
 * Enter o espacio). Mientras tanto se llena de izquierda a derecha.
 */
@Component({
  selector: 'app-boton-mantener',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <button type="button" title="Mantén presionado para confirmar"
      (mousedown)="empezar($event)" (mouseup)="soltar()" (mouseleave)="soltar()" (touchstart)="empezar($event)" (touchend)="soltar()"
      (keydown)="tecla($event)" (keyup)="teclaArriba($event)"
      class="relative flex h-10.5 w-full items-center justify-center gap-[7px] overflow-hidden rounded-[10px] bg-[#303030] px-3.5 text-[13px] font-medium text-white shadow-[inset_0_-1px_0_#000] select-none [transition:transform_.2s_cubic-bezier(.2,.8,.2,1),_opacity_.2s]"
      [class]="(bloqueo() ? 'cursor-not-allowed opacity-55' : 'cursor-pointer') + (presionado() ? ' [transform:scale(.985)]' : '')">
      <span class="absolute top-0 bottom-0 left-0 bg-[rgba(255,255,255,.16)]"
        [class]="presionado() ? 'w-full [transition:width_1.3s_linear]' : 'w-0 [transition:width_.25s_ease-out]'"></span>
      <span class="relative flex items-center gap-[7px]">
        <tabler-icon [icon]="icono('package-import')" [size]="15" [stroke]="2" />{{ etiqueta() }}
      </span>
    </button>
  `,
})
export class BotonMantenerComponent {
  /** Compra que se recibe (se devuelve al completar). */
  readonly compraId = input.required<number>();
  readonly bloqueo = input<BloqueoRecibir>(null);
  readonly completar = output<number>();
  /** Se intentó con el botón bloqueado. */
  readonly bloqueado = output<BloqueoRecibir>();

  protected readonly icono = icono;
  protected readonly presionado = signal(false);
  protected readonly etiqueta = computed(() =>
    this.presionado()
      ? 'Sigue presionando…'
      : this.bloqueo() === 'sucio' ? 'Guarda antes de recibir' : this.bloqueo() === 'permiso' ? 'Sin permiso para recibir' : 'Mantén presionado para recibir',
  );
  private temporizador: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.temporizador));
  }

  protected empezar(e: Event): void {
    e.preventDefault();
    if (this.bloqueo()) return this.bloqueado.emit(this.bloqueo());
    clearTimeout(this.temporizador);
    this.presionado.set(true);
    const id = this.compraId();
    this.temporizador = setTimeout(() => {
      if (!this.presionado()) return;
      this.presionado.set(false);
      this.completar.emit(id);
    }, DURACION_MS);
  }
  protected soltar(): void {
    clearTimeout(this.temporizador);
    this.presionado.set(false);
  }
  protected tecla(e: KeyboardEvent): void {
    if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) this.empezar(e);
  }
  protected teclaArriba(e: KeyboardEvent): void {
    if (e.key === 'Enter' || e.key === ' ') this.soltar();
  }
}
