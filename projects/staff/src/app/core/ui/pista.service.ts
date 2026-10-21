import { Injectable, signal } from '@angular/core';

export type TipoPista = 'navegar' | 'hecho' | 'atajo' | 'filtro';

export interface Pista {
  /** Cambia en cada `mostrar()`: el componente lo usa para re-animar. */
  id: number;
  tipo: TipoPista;
  prefijo: string;
  texto: string;
  tecla?: string;
  accion?: string;
  fn?: () => void;
  duracion: number;
}

const CORTA = 2_200;
const LARGA = 5_000;

/**
 * Aviso liviano abajo al centro que confirma algo que ya pasó. Una sola a la
 * vez: la nueva reemplaza a la anterior. No es para errores ni para
 * operaciones con el backend que pueden fallar: eso va en `AlertaService`.
 *
 * @example
 * pista.navegar('Settings · Perfil');
 * pista.hecho('5 marcadas como leídas', () => deshacer());
 * pista.atajo('A', 'Asignada a ti');
 * pista.filtro('Solicitudes', () => filtro.set(null));
 */
@Injectable({ providedIn: 'root' })
export class PistaService {
  readonly actual = signal<Pista | null>(null);
  readonly visible = signal(false);
  readonly pausada = signal(false);

  private timer: ReturnType<typeof setTimeout> | undefined;
  private secuencia = 0;

  navegar(destino: string): void {
    this.mostrar({ tipo: 'navegar', prefijo: 'Ir a ', texto: destino });
  }

  /** @param deshacer - Si se pasa, muestra "Deshacer" y la pista dura más. */
  hecho(texto: string, deshacer?: () => void): void {
    this.mostrar({ tipo: 'hecho', prefijo: '', texto, accion: deshacer ? 'Deshacer' : undefined, fn: deshacer });
  }

  atajo(tecla: string, texto: string): void {
    this.mostrar({ tipo: 'atajo', prefijo: '', texto, tecla });
  }

  filtro(nombre: string, quitar: () => void): void {
    this.mostrar({ tipo: 'filtro', prefijo: 'Mostrando solo ', texto: nombre, accion: 'Quitar', fn: quitar });
  }

  /** Botón de acción (Deshacer / Quitar): oculta la pista y corre la acción 120 ms después. */
  ejecutarAccion(): void {
    const fn = this.actual()?.fn;
    this.ocultar();
    if (fn) setTimeout(fn, 120);
  }

  pausar(): void {
    clearTimeout(this.timer);
    this.pausada.set(true);
  }

  /** Al salir el mouse, se cierra 1,2 s después (no reinicia la duración completa). */
  reanudar(): void {
    this.pausada.set(false);
    this.programarCierre(1_200);
  }

  ocultar(): void {
    clearTimeout(this.timer);
    this.visible.set(false);
  }

  private mostrar(p: Omit<Pista, 'id' | 'duracion'>): void {
    const duracion = p.accion ? LARGA : CORTA;
    this.actual.set({ ...p, id: ++this.secuencia, duracion });
    this.pausada.set(false);
    this.visible.set(true);
    this.programarCierre(duracion);
  }

  private programarCierre(ms: number): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.visible.set(false), ms);
  }
}
