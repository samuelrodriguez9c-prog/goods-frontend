import { Injectable, computed, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { EstadoAlerta } from '../../shared/ui/estado-icono/estado-icono.component';

export interface AlertaEnLinea {
  id: number;
  estado: EstadoAlerta;
  titulo: string;
  /** Va en la misma línea: "Título · texto". Completo al expandir. */
  texto?: string;
  /** Botón opcional; no se muestra mientras `estado === 'cargando'`. */
  accion?: { label: string; ejecutar: () => void };
  /** ms hasta el auto-cierre. `null` = queda hasta que la cierren. */
  autoCierre: number | null;
  /** Cuerpo expandido. El error abre expandido. */
  abierta: boolean;
  /** Sube en cada `resolver()`: el componente reinicia la barra de tiempo. */
  vuelta: number;
  /** Animando su salida (300 ms) antes de salir del array. */
  saliendo: boolean;
}

export interface AlertaOverlay {
  estado: EstadoAlerta;
  /** `tarjeta` = modal blanco con acciones. `velo` = ícono+texto sobre el velo. */
  variante: 'tarjeta' | 'velo';
  titulo: string;
  dato?: string;
  paso?: string;
  primario?: { label: string; ejecutar: () => void };
  secundario?: { label: string; ejecutar: () => void };
}

type Parcial = Partial<Omit<AlertaOverlay, 'variante'>>;

const SALIDA_MS = 300;

/**
 * Único dueño de las alertas del panel (LEEME §12, v2 "Pila oscura").
 *
 * - **en línea** (`enLinea()`): pila abajo al centro. La más nueva al frente;
 *   las demás esperan detrás. **Solo corre el tiempo de la del frente** — las
 *   de atrás no se cierran sin que nadie las lea. La operación en curso y su
 *   resultado siguen siendo la misma alerta: `mostrar()` → `resolver(id, …)`.
 * - **overlay** (`overlay()`): sin cambios.
 *
 * API pública igual que antes (`mostrar`, `resolver`, `cerrar`, `seguir`):
 * ninguna página tiene que cambiar.
 */
@Injectable({ providedIn: 'root' })
export class AlertaService {
  private secuencia = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private claveFrente = '';

  readonly enLinea = signal<AlertaEnLinea[]>([]);
  readonly overlay = signal<AlertaOverlay | null>(null);
  readonly pausada = signal(false);
  /** Alto real de la alerta del frente (lo escribe `AlertaPilaComponent`). */
  readonly altoFrente = signal(44);

  readonly activas = computed(() => this.enLinea().filter((a) => !a.saliendo));
  readonly frente = computed(() => this.activas().at(-1) ?? null);
  /** Alto total ocupado por la pila (frente + bordes asomando), para que la Pista suba. */
  readonly altoPila = computed(() => {
    const n = this.activas().length;
    return n ? this.altoFrente() + 9 * Math.min(n - 1, 2) : 0;
  });

  // ── En línea ──────────────────────────────────────────────────────────

  mostrar(alerta: Omit<AlertaEnLinea, 'id' | 'estado' | 'autoCierre' | 'abierta' | 'vuelta' | 'saliendo'> & {
    estado?: EstadoAlerta;
    autoCierre?: number | null;
  }): number {
    const id = ++this.secuencia;
    const estado = alerta.estado ?? 'cargando';
    this.enLinea.update((xs) => [
      ...xs,
      {
        ...alerta,
        id,
        estado,
        autoCierre: alerta.autoCierre ?? this.autoCierrePorDefecto(estado),
        abierta: estado === 'error',
        vuelta: 0,
        saliendo: false,
      },
    ]);
    this.sincronizarFrente();
    return id;
  }

  resolver(
    id: number,
    cambio: Partial<Omit<AlertaEnLinea, 'id' | 'vuelta' | 'saliendo'>> & { estado: EstadoAlerta },
  ): void {
    this.enLinea.update((xs) =>
      xs.map((a) =>
        a.id === id
          ? {
              ...a,
              ...cambio,
              autoCierre: cambio.autoCierre ?? this.autoCierrePorDefecto(cambio.estado),
              abierta: cambio.estado === 'error' ? true : (cambio.abierta ?? a.abierta),
              vuelta: a.vuelta + 1,
            }
          : a,
      ),
    );
    this.sincronizarFrente();
  }

  alternar(id: number): void {
    this.enLinea.update((xs) => xs.map((a) => (a.id === id ? { ...a, abierta: !a.abierta } : a)));
  }

  cerrar(id: number): void {
    this.enLinea.update((xs) => xs.map((a) => (a.id === id ? { ...a, saliendo: true } : a)));
    this.sincronizarFrente();
    setTimeout(() => this.enLinea.update((xs) => xs.filter((a) => a.id !== id)), SALIDA_MS);
  }

  /** Cierra todas menos las que están cargando (no hay nada que descartar). */
  cerrarTodas(): void {
    this.activas()
      .filter((a) => a.estado !== 'cargando')
      .forEach((a) => this.cerrar(a.id));
  }

  pausar(): void {
    this.pausada.set(true);
    clearTimeout(this.timer);
  }

  /** Al salir el mouse, la del frente se va 2 s después (no reinicia completo). */
  reanudar(): void {
    this.pausada.set(false);
    const f = this.frente();
    if (f?.autoCierre != null) this.programar(f.id, 2000);
  }

  /**
   *   this.alertas.seguir(this.rolService.asignarPermisos(id, ids), {
   *     titulo: 'Guardando permisos', texto: 'Rol “Soporte”',
   *     exito: { titulo: 'Permisos guardados' },
   *     error: { titulo: 'No se pudo guardar', texto: 'El servidor rechazó el cambio.' },
   *   }).subscribe();
   *
   * No traga el error: lo vuelve a lanzar para que la página decida.
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

  // ── Overlay (sin cambios) ─────────────────────────────────────────────

  abrirOverlay(cfg: Omit<AlertaOverlay, 'estado'> & { estado?: EstadoAlerta }): void {
    this.overlay.set({ estado: 'cargando', ...cfg });
  }

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

  /** El error no se cierra solo: una alerta que se va sola es una alerta que nadie leyó. */
  private autoCierrePorDefecto(estado: EstadoAlerta): number | null {
    if (estado === 'cargando' || estado === 'error') return null;
    return estado === 'success' ? 6000 : 9000;
  }

  /** Solo la del frente tiene temporizador. Se reprograma si cambia el frente o su estado. */
  private sincronizarFrente(): void {
    const f = this.frente();
    const clave = f ? `${f.id}:${f.estado}:${f.vuelta}` : '';
    if (clave === this.claveFrente) return;
    this.claveFrente = clave;
    clearTimeout(this.timer);
    if (f?.autoCierre != null && !this.pausada()) this.programar(f.id, f.autoCierre);
  }

  private programar(id: number, ms: number): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.cerrar(id), ms);
  }
}
