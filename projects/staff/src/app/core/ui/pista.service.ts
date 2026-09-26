// projects/staff/src/app/core/ui/pista.service.ts
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
 * Aviso liviano abajo al centro (LEEME §18). Confirma algo que YA pasó.
 * Una sola a la vez: la nueva reemplaza a la anterior. Nunca para errores
 * ni para operaciones que llaman al backend y pueden fallar — eso es
 * `AlertaService` (§12).
 *
 *   pista.navegar('Settings · Perfil');
 *   pista.hecho('Código de referido copiado');
 *   pista.hecho('5 marcadas como leídas', () => deshacer());
 *   pista.atajo('A', 'Asignada a vos');
 *   pista.filtro('Solicitudes', () => filtro.set(null));
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

  hecho(texto: string, deshacer?: () => void): void {
    this.mostrar({ tipo: 'hecho', prefijo: '', texto, accion: deshacer ? 'Deshacer' : undefined, fn: deshacer });
  }

  atajo(tecla: string, texto: string): void {
    this.mostrar({ tipo: 'atajo', prefijo: '', texto, tecla });
  }

  filtro(nombre: string, quitar: () => void): void {
    this.mostrar({ tipo: 'filtro', prefijo: 'Mostrando solo ', texto: nombre, accion: 'Quitar', fn: quitar });
  }

  /** Botón de acción (Deshacer / Quitar). */
  ejecutarAccion(): void {
    const fn = this.actual()?.fn;
    this.ocultar();
    if (fn) setTimeout(fn, 120);
  }

  pausar(): void {
    clearTimeout(this.timer);
    this.pausada.set(true);
  }

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
