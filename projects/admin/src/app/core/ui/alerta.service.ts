import { Injectable, computed, signal, untracked } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { EstadoAlerta } from '../../shared/ui/estado-icono/estado-icono.component';

export interface AccionAlerta {
  label: string;
  ejecutar: () => void;
}

export interface AlertaEnLinea {
  id: number;
  estado: EstadoAlerta;
  titulo: string;
  /** Va en la misma línea: "Título · texto". Completo al expandir. */
  texto?: string;
  /** Botón principal (turquesa). No se muestra mientras `estado === 'cargando'`. */
  accion?: AccionAlerta;
  /** NUEVO (Productos v5): botón secundario oscuro, ej. "Descartar". */
  accion2?: AccionAlerta;
  /** ms hasta el auto-cierre. `null` = queda hasta que la cierren. */
  autoCierre: number | null;
  abierta: boolean;
  vuelta: number;
  saliendo: boolean;
  /** NUEVO: alerta fija de "Cambios sin guardar". No tiene X ni tiempo; va siempre al fondo. */
  fija?: boolean;
}

export interface AlertaOverlay {
  estado: EstadoAlerta;
  variante: 'tarjeta' | 'velo';
  titulo: string;
  dato?: string;
  paso?: string;
  primario?: AccionAlerta;
  secundario?: AccionAlerta;
}

export interface CambiosSinGuardar {
  titulo: string;
  texto: string;
  /** 'warning' normal · 'error' si el borrador no es válido (ej. "Ajuste no válido"). */
  estado?: 'warning' | 'error';
  guardar: () => void;
  descartar: () => void;
}

type Parcial = Partial<Omit<AlertaOverlay, 'variante'>>;

const SALIDA_MS = 300;
const ID_CAMBIOS = -1;

/**
 * Único dueño de las alertas del panel (LEEME §12, v2 "Pila oscura").
 * API anterior intacta (`mostrar`, `resolver`, `cerrar`, `seguir`, overlay).
 *
 * Agregado para Productos v5:
 * - `actualizar(id, cambio)` muta una alerta sin reiniciar su tiempo (progreso "Subiendo 42 %").
 * - `fijarCambios(cfg)` / `soltarCambios()`: alerta fija "Cambios sin guardar" con
 *   Guardar / Descartar. Mientras haya otra alerta al frente, la fija espera detrás.
 *   Al aparecer sola se abre 420 ms después (para que se lea la animación de entrada).
 * - `sacudir()`: sacude la pila (420 ms) cuando el usuario intenta salir con cambios.
 * - `desplazamiento`: px extra sobre el borde inferior (la barra de selección masiva usa 54).
 * - `accion2` en cualquier alerta.
 */
@Injectable({ providedIn: 'root' })
export class AlertaService {
  private secuencia = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private timerCambios: ReturnType<typeof setTimeout> | undefined;
  private claveFrente = '';
  /** El usuario abrió/cerró a mano la fija: ya no la abrimos solos. */
  private cambiosTocada = false;

  private readonly alertas = signal<AlertaEnLinea[]>([]);
  private readonly cambios = signal<AlertaEnLinea | null>(null);

  /** La fija va primero (fondo de la pila), las normales encima. */
  readonly enLinea = computed(() => {
    const c = this.cambios();
    return c ? [c, ...this.alertas()] : this.alertas();
  });
  readonly overlay = signal<AlertaOverlay | null>(null);
  readonly pausada = signal(false);
  readonly altoFrente = signal(44);
  readonly desplazamiento = signal(0);
  /** Cambia en cada `sacudir()`: el componente alterna sacudeA / sacudeB. */
  readonly sacudida = signal(0);

  readonly activas = computed(() => this.enLinea().filter((a) => !a.saliendo));
  readonly frente = computed(() => this.activas().at(-1) ?? null);
  readonly altoPila = computed(() => {
    const n = this.activas().length;
    return n ? this.altoFrente() + 9 * Math.min(n - 1, 2) : 0;
  });

  // ── En línea ──────────────────────────────────────────────────────────

  mostrar(alerta: Omit<AlertaEnLinea, 'id' | 'estado' | 'autoCierre' | 'abierta' | 'vuelta' | 'saliendo'> & {
    estado?: EstadoAlerta;
    autoCierre?: number | null;
    abierta?: boolean;
  }): number {
    const id = ++this.secuencia;
    const estado = alerta.estado ?? 'cargando';
    this.alertas.update((xs) => [
      ...xs,
      {
        ...alerta,
        id,
        estado,
        autoCierre: alerta.autoCierre ?? this.autoCierrePorDefecto(estado),
        // Abre sola si es error o si trae acción + texto (ej. "Imagen subida · Deshacer").
        abierta: alerta.abierta ?? (estado === 'error' || (!!alerta.accion && !!alerta.texto)),
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
    this.alertas.update((xs) =>
      xs.map((a) =>
        a.id === id
          ? {
              ...a,
              accion: undefined,
              accion2: undefined,
              ...cambio,
              autoCierre: cambio.autoCierre ?? this.autoCierrePorDefecto(cambio.estado),
              abierta:
                cambio.estado === 'error' || (!!cambio.accion && !!(cambio.texto ?? a.texto))
                  ? true
                  : (cambio.abierta ?? a.abierta),
              vuelta: a.vuelta + 1,
            }
          : a,
      ),
    );
    this.sincronizarFrente();
  }

  /** Muta texto/título sin reiniciar el tiempo (no sube `vuelta`). */
  actualizar(id: number, cambio: Partial<Pick<AlertaEnLinea, 'titulo' | 'texto'>>): void {
    this.alertas.update((xs) => xs.map((a) => (a.id === id ? { ...a, ...cambio } : a)));
  }

  alternar(id: number): void {
    if (id === ID_CAMBIOS) {
      this.cambiosTocada = true;
      clearTimeout(this.timerCambios);
      this.cambios.update((c) => (c ? { ...c, abierta: !c.abierta } : c));
      return;
    }
    this.alertas.update((xs) => xs.map((a) => (a.id === id ? { ...a, abierta: !a.abierta } : a)));
  }

  cerrar(id: number): void {
    if (id === ID_CAMBIOS) return;
    this.alertas.update((xs) => xs.map((a) => (a.id === id ? { ...a, saliendo: true } : a)));
    this.sincronizarFrente();
    setTimeout(() => this.alertas.update((xs) => xs.filter((a) => a.id !== id)), SALIDA_MS);
  }

  cerrarTodas(): void {
    this.activas()
      .filter((a) => a.estado !== 'cargando' && !a.fija)
      .forEach((a) => this.cerrar(a.id));
  }

  pausar(): void {
    this.pausada.set(true);
    clearTimeout(this.timer);
  }

  reanudar(): void {
    this.pausada.set(false);
    const f = this.frente();
    if (f?.autoCierre != null) this.programar(f.id, 2000);
  }

  seguir<T>(
    origen: Observable<T>,
    cfg: {
      titulo: string;
      texto?: string;
      exito: { titulo: string; texto?: string; accion?: AccionAlerta };
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

  // ── Cambios sin guardar (fija) ────────────────────────────────────────

  /** Llamar desde un `effect` de la página cada vez que cambie el borrador. `null` = soltar. */
  fijarCambios(cfg: CambiosSinGuardar | null): void {
    // Se llama desde un effect() que mira el borrador: sin untracked, leer
    // `cambios`/`alertas` acá suscribe el effect a lo que este mismo método
    // escribe y queda en un bucle infinito (la página se congela al primer cambio).
    untracked(() => this.fijarCambiosAhora(cfg));
  }

  private fijarCambiosAhora(cfg: CambiosSinGuardar | null): void {
    if (!cfg) return this.soltarCambios();
    const previa = this.cambios();
    const solo = !this.alertas().some((a) => !a.saliendo);
    this.cambios.set({
      id: ID_CAMBIOS,
      fija: true,
      estado: cfg.estado ?? 'warning',
      titulo: cfg.titulo,
      texto: cfg.texto,
      accion: { label: 'Guardar', ejecutar: cfg.guardar },
      accion2: { label: 'Descartar', ejecutar: cfg.descartar },
      autoCierre: null,
      abierta: previa?.abierta ?? false,
      vuelta: 0,
      saliendo: false,
    });
    if (!previa && solo && !this.cambiosTocada) {
      clearTimeout(this.timerCambios);
      this.timerCambios = setTimeout(() => this.cambios.update((c) => (c ? { ...c, abierta: true } : c)), 420);
    }
  }

  soltarCambios(): void {
    clearTimeout(this.timerCambios);
    this.cambiosTocada = false;
    this.cambios.set(null);
  }

  sacudir(): void {
    if (!this.cambios()) return;
    this.sacudida.update((n) => n + 1);
    this.cambios.update((c) => (c ? { ...c, abierta: true } : c));
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

  private autoCierrePorDefecto(estado: EstadoAlerta): number | null {
    if (estado === 'cargando' || estado === 'error') return null;
    return estado === 'success' ? 6000 : 9000;
  }

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
