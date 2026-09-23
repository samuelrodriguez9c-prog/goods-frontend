import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type EstadoAlerta = 'cargando' | 'success' | 'error' | 'info' | 'warning';

/** Sólidos del panel (`styles.css`). Sobre blanco. */
const CLARO: Record<EstadoAlerta | 'track', string> = {
  cargando: '#8c8c8c',
  success: '#087b5d',
  error: '#d82c0d',
  info: '#0284c7',
  warning: '#b07400',
  track: '#dcdcdc',
};

/**
 * Sobre el velo oscuro los sólidos del panel caen a ~2:1 contra el fondo.
 * Misma familia, subida en luminosidad — usada solo por `tema="oscuro"`.
 */
const OSCURO: Record<EstadoAlerta | 'track', string> = {
  cargando: '#bdbdbd',
  success: '#5fe39b',
  error: '#ff8f7a',
  info: '#7dd3fc',
  warning: '#ffd24a',
  track: 'rgba(255,255,255,0.18)',
};

/**
 * El ícono de estado del panel: un anillo que gira mientras la operación
 * está en vuelo y se **cierra** en el glifo del resultado.
 *
 * No es decorativo — es el mismo componente a 16px en una fila de tabla, a
 * 20px en la alerta en línea, a 60px en el modal y a 76px sobre el velo, así
 * que el resultado se reconoce antes de leerlo. Todo el movimiento es CSS
 * (transición de `stroke-dasharray` + `stroke-dashoffset`), no Angular
 * Animations: el elemento nunca se agrega/saca del DOM, solo cambia de
 * estado, que es justo lo que hace que la transición se vea.
 */
@Component({
  selector: 'app-estado-icono',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './estado-icono.component.html',
})
export class EstadoIconoComponent {
  readonly estado = input<EstadoAlerta>('cargando');
  readonly tema = input<'claro' | 'oscuro'>('claro');
  readonly px = input<number>(44);
  readonly grosor = input<number>(3);

  protected readonly cargando = computed(() => this.estado() === 'cargando');
  protected readonly paleta = computed(() => (this.tema() === 'oscuro' ? OSCURO : CLARO));
  protected readonly color = computed(() => this.paleta()[this.estado()]);

  /** El arco gira mientras carga y se cierra en anillo completo al resolver. */
  protected readonly arco = computed(() => (this.cargando() ? '26 200' : '113.1 0.1'));
  protected readonly animacion = computed(() =>
    this.cargando() ? 'girar .85s linear infinite' : 'none',
  );

  /**
   * Los cuatro glifos viven siempre en el DOM; solo cambian
   * `stroke-dashoffset` (1 → 0 = el trazo se dibuja) y `opacity`. Por eso el
   * cambio de un estado a otro es un morfismo y no un reemplazo.
   *
   * El punto de la interrogación y del signo de admiración es un segmento de
   * 0.1px con `stroke-linecap="round"` — un círculo aparte no se podría
   * dibujar con el mismo `dashoffset`.
   */
  protected readonly glifos = computed(() => {
    const activo = this.estado();
    const p = this.paleta();
    return [
      { id: 'success', d: 'M14.5 22.4 L19.6 27.5 L29.5 17.2', color: p.success, unir: 'round' },
      { id: 'error', d: 'M16.6 16.6 L27.4 27.4 M27.4 16.6 L16.6 27.4', color: p.error, unir: 'miter' },
      { id: 'info', d: 'M18.1 18.6 A4 4 0 1 1 22 23.6 V25.4 M22 29 L22 29.1', color: p.info, unir: 'round' },
      { id: 'warning', d: 'M22 14.8 L22 24.2 M22 29 L22 29.1', color: p.warning, unir: 'miter' },
    ].map((g) => ({ ...g, visible: g.id === activo }));
  });
}
