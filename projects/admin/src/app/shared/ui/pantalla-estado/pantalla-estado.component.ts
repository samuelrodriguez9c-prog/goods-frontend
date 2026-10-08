import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { EstadoIconoComponent } from '../estado-icono/estado-icono.component';

/**
 * Envoltorio de estado para una pantalla entera. Tres estados, un solo lugar
 * donde viven la carga y el error de un módulo:
 *
 *   <app-pantalla-estado
 *     [estado]="estado()" modulo="Auditoría"
 *     [detalle]="detalleError()" (reintentar)="cargar()">
 *     <div esqueleto>…skeleton con la forma de ESTA pantalla…</div>
 *     …contenido real…
 *   </app-pantalla-estado>
 *
 * El esqueleto es **de la página**, no del componente, a propósito: un
 * spinner centrado sobre la nada no dice nada, y un esqueleto genérico
 * miente sobre lo que viene. Cada pantalla proyecta la forma que va a tener
 * (métricas, filas, columnas) para que al llegar los datos nada se mueva.
 */
@Component({
  selector: 'app-pantalla-estado',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EstadoIconoComponent],
  templateUrl: './pantalla-estado.component.html',
})
export class PantallaEstadoComponent {
  readonly estado = input.required<'cargando' | 'error' | 'listo'>();
  /** Nombre del módulo: "Cargando Auditoría…", "No pudimos cargar Auditoría". */
  readonly modulo = input.required<string>();
  readonly mensaje = input<string>(
    'El servidor no respondió a tiempo. No se perdió nada — nadie estaba escribiendo en esta pantalla.',
  );
  /** Pie técnico: "GET /api/auditoria — 504". Vacío = no se muestra. */
  readonly detalle = input<string>('');
  readonly intento = input<string>('');

  readonly reintentar = output<void>();
  readonly volver = output<void>();
}
