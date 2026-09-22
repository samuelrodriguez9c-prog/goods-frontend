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

/** Ventana de "misma sesión". */
const VENTANA_SESION_MS = 30 * 60 * 1000;

/**
 * Panel de detalle de una acción de auditoría — extraído de
 * `AuditoriaPageComponent` a pedido explícito del cliente (2026-09-21,
 * después de la integración inicial) para mantener la misma estructura de
 * `pages/<panel>/` que ya tenían `EmpresaDetallePanelComponent`
 * (`features/empresas/pages/`), `ActivarEmpresaWizardComponent`
 * (`features/altas-pendientes/pages/`) y
 * `GestionarSuscripcionPanelComponent` (`features/suscripciones/pages/`):
 * un componente por panel, sibling de la página en `pages/`, no un bloque
 * más del template de la página.
 *
 * A diferencia de esos tres, **este panel NO carga sus propios datos por
 * `id` contra el backend** — recibe la lista COMPLETA ya cargada por
 * `AuditoriaPageComponent` vía `[acciones]` (su `leibles()`), además del
 * `[accionId]` a mostrar. Es una excepción deliberada, mismo criterio que
 * `[mrrTotal]` en `GestionarSuscripcionPanelComponent`: "En la misma
 * sesión" y "Historia de X" necesitan recorrer TODAS las acciones (buscar
 * otras de la misma persona/IP en la misma media hora, o de la misma
 * entidad) — cargar eso por su cuenta significaría reimplementar acá
 * adentro las 11 reglas de traducción de ruta de `REGLAS`/`describir()`/
 * `agente()` de la página (no es un mapa chico tipo `ESTADO_UI`) y pegarle
 * una segunda vez a `AuditoriaService.listar()` + `UsuarioService.listar()`
 * — la página ya tiene ese trabajo hecho. `AccionLeible.nombreResuelto`
 * (el nombre de usuario ya resuelto contra el mapa de la página) es lo que
 * permite que este panel no necesite ese mapa ni un servicio de usuarios
 * propio.
 *
 * La navegación DENTRO del panel (botones de "En la misma sesión" /
 * "Historia de X", que cambian qué acción se muestra sin cerrar el panel)
 * no la resuelve el panel solo: emite `(verAccion)` con el nuevo id, y es
 * la página —dueña del id que se está viendo— la que decide, reutilizando
 * el mismo `abrirPanel()` que abre desde la lista. Lo mismo con "Ver todo
 * el rastro": emite `(verRastro)` con la entidad, y la página arma el
 * filtro transversal y cierra el panel — ninguno de los dos es estado de
 * este componente.
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
  /** Pedido de mostrar otra acción sin cerrar el panel (hito de "En la
   * misma sesión" o de "Historia de X") — la página decide, ver el
   * docstring de la clase. */
  readonly verAccion = output<number>();
  /** Pedido de "Ver todo el rastro" — la página arma el filtro y cierra
   * el panel, ver el docstring de la clase. */
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
    // Al cambiar de acción (navegación interna vía "En la misma sesión" /
    // "Historia de X" — misma instancia del componente, `[accionId]`
    // nuevo) siempre se vuelve a la pestaña Resumen, mismo comportamiento
    // que tenía `abrirPanel()` en la página antes de la extracción.
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
