import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconHelp,
  IconLock,
  IconLockOff,
  IconRoute,
  IconServerOff,
  IconShieldX,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import type { AccionLeible } from '../auditoria-page/auditoria-page.component';

type TabPanel = 'resumen' | 'datos' | 'tecnico';

/** Los status code traducidos a lo que significan de verdad. */
const RESULTADO: Record<number, { texto: string; icono: typeof IconCircleCheck; caja: string }> = {
  200: { texto: 'Se guardó sin problemas.', icono: IconCircleCheck, caja: 'bg-emerald-50 text-emerald-900' },
  201: { texto: 'Se creó sin problemas.', icono: IconCircleCheck, caja: 'bg-emerald-50 text-emerald-900' },
  401: { texto: 'Credenciales inválidas — no entró.', icono: IconLockOff, caja: 'bg-badge-error-solid/10 text-badge-error-solid' },
  403: { texto: 'Sin permiso para esta acción.', icono: IconShieldX, caja: 'bg-badge-error-solid/10 text-badge-error-solid' },
  409: { texto: 'Conflicto: el registro está en uso y no se puede tocar.', icono: IconAlertTriangle, caja: 'bg-[#fffdf2] text-amber-900' },
  422: { texto: 'Los datos enviados no pasaron la validación.', icono: IconAlertTriangle, caja: 'bg-[#fffdf2] text-amber-900' },
  500: { texto: 'Falló del lado del servidor.', icono: IconServerOff, caja: 'bg-badge-error-solid/10 text-badge-error-solid' },
};

/** Ventana de "misma sesión": ±30 min alrededor de la acción. */
const VENTANA_SESION_MS = 30 * 60 * 1000;

/**
 * Panel de detalle de una acción de auditoría (Resumen / Datos / Técnico).
 *
 * @remarks
 * No carga nada: recibe de `AuditoriaPageComponent` la lista completa ya
 * traducida, porque "En la misma sesión" e "Historia de X" recorren todas las
 * acciones. Cambiar de acción o ver el rastro se le pide a la página por outputs.
 */
@Component({
  selector: 'app-accion-detalle-panel',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './accion-detalle-panel.component.html',
})
export class AccionDetallePanelComponent {
  protected readonly iconCerrar = IconX;
  protected readonly iconRastro = IconRoute;
  protected readonly iconCandado = IconLock;

  readonly accionId = input.required<number>();
  readonly acciones = input.required<AccionLeible[]>();

  readonly cerrar = output<void>();
  /** Pide mostrar otra acción sin cerrar el panel. */
  readonly verAccion = output<number>();
  /** Pide "Ver todo el rastro" de la entidad; la página filtra y cierra el panel. */
  readonly verRastro = output<{ entidad: string; entidadId: string }>();

  protected readonly tab = signal<TabPanel>('resumen');

  protected readonly accionAbierta = computed(
    () => this.acciones().find((a) => a.id === this.accionId()) ?? null,
  );

  protected readonly resultado = computed(() => {
    const a = this.accionAbierta();
    if (!a) {
      return { texto: '', icono: IconHelp, caja: 'bg-canvas-bg text-gray-600' };
    }
    return (
      RESULTADO[a.statusCode] ?? {
        texto: `Terminó con código ${a.statusCode}.`,
        icono: IconHelp,
        caja: 'bg-canvas-bg text-gray-600',
      }
    );
  });

  protected readonly pestanas = computed(() => [
    { clave: 'resumen' as const, texto: 'Resumen', conteo: 0 },
    { clave: 'datos' as const, texto: 'Datos', conteo: this.campos().length },
    { clave: 'tecnico' as const, texto: 'Técnico', conteo: 0 },
  ]);

  protected readonly identidad = computed(() => {
    const a = this.accionAbierta();
    if (!a) {
      return [];
    }
    return [
      {
        etiqueta: 'Quién',
        valor: a.nombreResuelto ?? 'Sin usuario',
        tinta: a.usuarioId ? 'text-gray-900' : 'text-amber-700',
        nota: a.usuarioId ? '' : 'Acción anónima — nadie había iniciado sesión',
      },
      {
        etiqueta: 'Sobre qué',
        valor: a.entidadId ? `${a.entidad} #${a.entidadId}` : (a.entidad ?? '—'),
        tinta: 'text-gray-900',
        nota: '',
      },
      {
        etiqueta: 'Desde qué IP',
        valor: a.ip ?? '—',
        tinta: 'text-gray-900',
        nota: a.ip === '::1' ? 'Es el propio servidor (localhost)' : '',
      },
      {
        etiqueta: 'Con qué',
        valor: a.agenteEtiqueta,
        tinta: a.agenteEsNavegador ? 'text-gray-900' : 'text-amber-700',
        nota: a.agenteEsNavegador ? '' : 'No es un navegador',
      },
    ];
  });

  protected readonly campos = computed(() => {
    const a = this.accionAbierta();
    if (!a?.cuerpo) {
      return [];
    }
    return Object.entries(a.cuerpo).map(([clave, valor]) => {
      const oculto = valor === '[oculto]';
      return {
        clave,
        valor: oculto ? 'No se guarda' : Array.isArray(valor) ? valor.join(' · ') : String(valor),
        oculto,
      };
    });
  });

  /** Lo que la misma persona (o la misma IP, si fue anónima) hizo alrededor
   * de esta acción — convierte un registro suelto en una historia. */
  protected readonly sesion = computed(() => {
    const a = this.accionAbierta();
    if (!a) {
      return [];
    }
    const mismos = this.acciones()
      .filter((o) => (a.usuarioId ? o.usuarioId === a.usuarioId : o.usuarioId === null && o.ip === a.ip))
      .filter((o) => Math.abs(o.fechaMs - a.fechaMs) <= VENTANA_SESION_MS)
      .slice(0, 6);

    return mismos.map((o, i) => {
      const esEsta = o.id === a.id;
      return {
        id: o.id,
        hora: this.horaCorta(o.creadoEn),
        frase: o.frase,
        esEsta,
        // El riel vive dentro de cada fila, así no hay offsets a mano.
        rielTop: i === 0 ? '50%' : '0',
        rielBottom: i === mismos.length - 1 ? '50%' : '0',
        punto: esEsta
          ? 'border-primary-button bg-primary-button'
          : o.exitoso
            ? 'border-gray-300 bg-card-bg'
            : 'border-badge-error-solid bg-card-bg',
        tinta: esEsta
          ? 'font-semibold text-gray-900'
          : o.exitoso
            ? 'text-gray-600'
            : 'text-badge-error-solid',
      };
    });
  });

  protected readonly notaSesion = computed(() => {
    const a = this.accionAbierta();
    const n = this.sesion().length;
    if (!a || n <= 1) {
      return 'Es la única acción de esa media hora.';
    }
    const quien = a.nombreResuelto ?? 'Esa IP';
    return `${quien} hizo ${n} ${n === 1 ? 'acción' : 'acciones'} en esa media hora.`;
  });

  protected readonly rastroPanel = computed(() => {
    const a = this.accionAbierta();
    if (!a?.entidadId) {
      return [];
    }
    const hoy = new Date().toDateString();
    return this.acciones()
      .filter((o) => o.entidad === a.entidad && o.entidadId === a.entidadId)
      .map((o) => ({
        id: o.id,
        cuando:
          new Date(o.creadoEn).toDateString() === hoy
            ? `Hoy ${this.horaCorta(o.creadoEn)}`
            : `${this.fechaCorta(o.creadoEn).slice(0, 6)} ${this.horaCorta(o.creadoEn)}`,
        frase: o.frase,
        quien: o.nombreResuelto ? o.nombreResuelto.split(' ')[0] : 'Anónimo',
        esEsta: o.id === a.id,
        tinta: o.id === a.id ? 'font-semibold text-gray-900' : 'text-gray-600',
      }));
  });

  protected readonly tecnico = computed(() => {
    const a = this.accionAbierta();
    if (!a) {
      return [];
    }
    return [
      { etiqueta: 'Método', valor: a.metodo, pequeno: false },
      { etiqueta: 'Ruta', valor: a.ruta, pequeno: false },
      { etiqueta: 'Estado', valor: `${a.statusCode}${a.exitoso ? ' — ok' : ' — error'}`, pequeno: false },
      { etiqueta: 'Entidad', valor: a.entidadId ? `${a.entidad} / ${a.entidadId}` : (a.entidad ?? '—'), pequeno: false },
      { etiqueta: 'IP', valor: a.ip ?? '—', pequeno: false },
      { etiqueta: 'Agente', valor: a.userAgent ?? '—', pequeno: true },
      { etiqueta: 'Registro', valor: `#${a.id} · ${a.creadoEn}`, pequeno: true },
    ];
  });

  constructor() {
    // Al cambiar de acción con el panel abierto se vuelve siempre a Resumen.
    effect(() => {
      this.accionId();
      this.tab.set('resumen');
    });
  }

  protected verOtraAccion(id: number): void {
    this.verAccion.emit(id);
  }

  protected solicitarRastroCompleto(): void {
    const a = this.accionAbierta();
    if (!a?.entidadId) {
      return;
    }
    this.verRastro.emit({ entidad: a.entidad ?? '', entidadId: a.entidadId });
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cerrar.emit();
    }
  }

  private fechaCorta(iso: string): string {
    return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  private horaCorta(iso: string): string {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}
