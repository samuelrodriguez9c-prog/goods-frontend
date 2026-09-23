import { Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { EstadoAlerta } from '../../shared/ui/estado-icono/estado-icono.component';

export interface AlertaEnLinea {
  id: number;
  estado: EstadoAlerta;
  titulo: string;
  texto?: string;
  /** Botón opcional; no se muestra mientras `estado === 'cargando'`. */
  accion?: { label: string; ejecutar: () => void };
  /** ms hasta el auto-cierre. `null` = queda hasta que la cierren. */
  autoCierre: number | null;
}

export interface AlertaOverlay {
  estado: EstadoAlerta;
  /** `tarjeta` = modal blanco con acciones. `velo` = ícono+texto sobre el velo. */
  variante: 'tarjeta' | 'velo';
  titulo: string;
  /** Primera mitad de la línea de contexto — el "qué". */
  dato?: string;
  /** Segunda mitad — el "en qué paso va". Es lo único que cambia al avanzar. */
  paso?: string;
  primario?: { label: string; ejecutar: () => void };
  secundario?: { label: string; ejecutar: () => void };
}

type Parcial = Partial<Omit<AlertaOverlay, 'variante'>>;

/**
 * Único dueño de las alertas del panel. Dos superficies:
 *
 * - **en línea** (`enLinea()`): apiladas arriba a la derecha del contenido.
 *   La operación en curso y su resultado son **la misma alerta**: se llama
 *   `mostrar()` y después `resolver(id, …)`. Nunca desaparece una y aparece
 *   otra — el ícono muta en el lugar y ese movimiento es el que comunica.
 * - **overlay** (`overlay()`): una sola, bloqueante, para operaciones que el
 *   usuario no puede abandonar a medias (activar una Empresa, publicar el
 *   catálogo). Mientras `estado === 'cargando'` el shell no debe cerrarla
 *   con `Esc` ni con clic afuera.
 */
@Injectable({ providedIn: 'root' })
export class AlertaService {
  private secuencia = 0;
  private readonly temporizadores = new Map<number, ReturnType<typeof setTimeout>>();

  readonly enLinea = signal<AlertaEnLinea[]>([]);
  readonly overlay = signal<AlertaOverlay | null>(null);

  // ── En línea ──────────────────────────────────────────────────────────

  /** Abre una alerta (por defecto en curso) y devuelve su id para resolverla. */
  mostrar(alerta: Omit<AlertaEnLinea, 'id' | 'estado' | 'autoCierre'> & {
    estado?: EstadoAlerta;
    autoCierre?: number | null;
  }): number {
    const id = ++this.secuencia;
    const estado = alerta.estado ?? 'cargando';
    const item: AlertaEnLinea = {
      ...alerta,
      id,
      estado,
      autoCierre: alerta.autoCierre ?? this.autoCierrePorDefecto(estado),
    };
    this.enLinea.update((xs) => [...xs, item]);
    this.programarCierre(item);
    return id;
  }

  /** Muta una alerta existente. El ícono transiciona; el texto se reemplaza. */
  resolver(
    id: number,
    cambio: Partial<Omit<AlertaEnLinea, 'id'>> & { estado: EstadoAlerta },
  ): void {
    this.enLinea.update((xs) =>
      xs.map((a) =>
        a.id === id
          ? {
              ...a,
              ...cambio,
              autoCierre: cambio.autoCierre ?? this.autoCierrePorDefecto(cambio.estado),
            }
          : a,
      ),
    );
    const item = this.enLinea().find((a) => a.id === id);
    if (item) {
      this.programarCierre(item);
    }
  }

  cerrar(id: number): void {
    clearTimeout(this.temporizadores.get(id));
    this.temporizadores.delete(id);
    this.enLinea.update((xs) => xs.filter((a) => a.id !== id));
  }

  /**
   * Azúcar para el caso de siempre: una llamada HTTP con su alerta en línea.
   *
   *   this.alertas.seguir(this.rolService.asignarPermisos(id, ids), {
   *     titulo: 'Guardando permisos', texto: 'Rol “Soporte”',
   *     exito: { titulo: 'Permisos guardados' },
   *     error: { titulo: 'No se pudo guardar', texto: 'El servidor rechazó el cambio.' },
   *   }).subscribe();
   *
   * Importante: **no** traga el error — lo vuelve a lanzar para que la página
   * decida (revertir el borrador, reintentar). Solo se ocupa de la alerta.
   */
  seguir<T>(
    origen: Observable<T>,
    cfg: {
      titulo: string;
      texto?: string;
      exito: { titulo: string; texto?: string };
      error: { titulo: string; texto?: string };
    },
  ): Observable<T> {
    const id = this.mostrar({ titulo: cfg.titulo, texto: cfg.texto });
    return origen.pipe(
      tap({
        next: () => this.resolver(id, { estado: 'success', ...cfg.exito }),
        error: () => this.resolver(id, { estado: 'error', ...cfg.error }),
      }),
    );
  }

  // ── Overlay ───────────────────────────────────────────────────────────

  abrirOverlay(cfg: Omit<AlertaOverlay, 'estado'> & { estado?: EstadoAlerta }): void {
    this.overlay.set({ estado: 'cargando', ...cfg });
  }

  /** Avanza el texto del paso sin tocar el estado (sigue girando). */
  avanzarOverlay(paso: string): void {
    this.overlay.update((o) => (o ? { ...o, paso } : o));
  }

  resolverOverlay(estado: EstadoAlerta, cambio: Parcial = {}): void {
    this.overlay.update((o) => (o ? { ...o, ...cambio, estado } : o));
  }

  cerrarOverlay(): void {
    this.overlay.set(null);
  }

  // ── Interno ───────────────────────────────────────────────────────────

  /**
   * El error no se cierra solo: es el único estado que puede exigir una
   * decisión, y una alerta que se va sola es una alerta que nadie leyó.
   */
  private autoCierrePorDefecto(estado: EstadoAlerta): number | null {
    if (estado === 'cargando' || estado === 'error') {
      return null;
    }
    return estado === 'success' ? 6000 : 9000;
  }

  private programarCierre(alerta: AlertaEnLinea): void {
    clearTimeout(this.temporizadores.get(alerta.id));
    if (alerta.autoCierre === null) {
      return;
    }
    this.temporizadores.set(
      alerta.id,
      setTimeout(() => this.cerrar(alerta.id), alerta.autoCierre),
    );
  }
}
