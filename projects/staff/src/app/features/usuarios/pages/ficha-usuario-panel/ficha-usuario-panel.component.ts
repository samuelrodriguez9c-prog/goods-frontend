import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { IconArrowRight, IconBan, IconPencil, IconX, TablerIconComponent, type TablerIcon } from '@tabler/icons-angular';
import { Rol } from '../../../../core/roles/models/rol.model';
import { UsuarioGoods } from '../../../../core/usuarios/models/usuario.model';
import { UsuarioService } from '../../../../core/usuarios/usuario.service';
import type { Acceso, EstadoAcceso } from '../usuarios-page/usuarios-page.component';
import { ESTADO_UI, PUNTO_ROL, etiquetaRolTexto } from '../usuarios-page/usuarios-page.component';

type TabPanel = 'permisos' | 'actividad' | 'datos';
const MS_DIA = 86_400_000;

interface MatrizFila {
  modulo: string;
  icono: TablerIcon;
  texto: string;
  tinta: string;
  tachado: boolean;
  nuevo: string;
  tintaNuevo: string;
  cambia: boolean;
  s1: string;
  s2: string;
  s3: string;
}

/**
 * Ficha de una persona ya existente — componente aparte, sibling de
 * `usuarios-page` en `pages/`, mismo patrón que el resto de los paneles
 * de la app.
 *
 * A diferencia de los paneles que cargan sus propios datos por id
 * (`EmpresaDetallePanelComponent`, `AccionDetallePanelComponent`), este
 * recibe `[usuario]`/`[roles]`/`[acceso]` ya resueltos por la página —
 * recalcularlos acá significaría repetir el `forkJoin` de 500 acciones de
 * auditoría que ya hizo `UsuariosPageComponent.cargar()` solo para abrir
 * una ficha.
 *
 * Tampoco calcula `matrizPanel`/`textoCambioRol` por su cuenta: la
 * necesitan `nivelDe()` + `MODULOS`, que viven en la página porque la fila
 * de esta misma persona en la matriz (a la izquierda, fuera de este
 * panel) tiene que mostrar el mismo diff de rol mientras hay un cambio en
 * preview — por eso `rolPreview` tampoco es estado interno del panel: lo
 * recibe como `[rolPreviewId]` y lo cambia emitiendo
 * `(rolPreviewSeleccionado)`, para que la página lo aplique a la fila y al
 * panel a la vez. Es la misma clase de excepción que `[mrrTotal]` en
 * `GestionarSuscripcionPanelComponent` o `[acciones]` en
 * `AccionDetallePanelComponent`.
 *
 * El resto (pestaña activa, buffer de edición de "Datos", las llamadas a
 * `UsuarioService` de cambiar rol / actualizar / quitar acceso) es
 * enteramente interno: el panel hace sus propias mutaciones y le avisa a
 * la página el resultado por output, la misma forma en que
 * `GestionarSuscripcionPanelComponent` gestiona sus propias acciones.
 *
 * El `effect` del constructor reinicia pestaña y el buffer de "Datos"
 * solo cuando cambia la PERSONA (`usuario().id`), no cada vez que
 * `[usuario]` recibe una referencia nueva — que pasa cada vez que se
 * guarda algo, porque la página reemplaza el objeto en su lista. Si
 * reiniciara con cualquier cambio de referencia, guardar datos estando en
 * la pestaña "Datos" te mandaría de vuelta a "Permisos" cada vez.
 */
@Component({
  selector: 'app-ficha-usuario-panel',
  standalone: true,
  imports: [FormsModule, RouterLink, TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ficha-usuario-panel.component.html',
})
export class FichaUsuarioPanelComponent {
  private readonly usuarioService = inject(UsuarioService);

  protected readonly iconCerrar = IconX;
  protected readonly iconFlecha = IconArrowRight;
  protected readonly iconEditar = IconPencil;
  protected readonly iconQuitar = IconBan;

  readonly usuario = input.required<UsuarioGoods>();
  readonly roles = input.required<Rol[]>();
  readonly acceso = input<Acceso | undefined>();
  /** Ver `EventoPresenciaCambio`/`enLineaIds` en `usuarios-page.component.ts`
   * — la página ya resuelve si esta persona está conectada ahora mismo, acá
   * solo se refleja en `fichaEstado`. */
  readonly enLinea = input(false);
  readonly rolPreviewId = input<number | null>(null);
  readonly matrizPanel = input.required<MatrizFila[]>();
  readonly textoCambioRol = input.required<string>();

  readonly cerrar = output<void>();
  readonly rolPreviewSeleccionado = output<number | null>();
  readonly usuarioActualizado = output<UsuarioGoods>();
  readonly accesoQuitado = output<number>();
  readonly avisoTexto = output<string>();
  readonly errorTexto = output<string>();

  protected readonly pestana = signal<TabPanel>('permisos');
  protected readonly datos = signal({ nombres: '', apellidos: '', telefono: '' });
  protected readonly guardando = signal(false);

  private readonly usuarioId = computed(() => this.usuario().id);

  protected readonly hayCambioRol = computed(() => {
    const id = this.rolPreviewId();
    return id !== null && id !== this.usuario().rolId;
  });

  protected readonly fichaEstado = computed(() => {
    const u = this.usuario();
    const enLinea = u.activo && this.enLinea();
    const estado = this.estadoDe(u, this.acceso());
    return {
      iniciales: `${u.nombres[0] ?? ''}${u.apellidos[0] ?? ''}`.toUpperCase(),
      nombre: `${u.nombres} ${u.apellidos}`.trim(),
      texto: ESTADO_UI[estado].texto,
      punto: ESTADO_UI[estado].punto,
      tinta: ESTADO_UI[estado].tinta,
      enLinea,
      nota: this.textoUltimo(u, this.acceso(), enLinea),
      avatar: estado === 'activo' ? 'bg-[#e6f4ef] text-badge-success-solid' : 'bg-gray-100 text-gray-500',
    };
  });

  protected readonly actividad = computed(() => {
    const u = this.usuario();
    const acceso = this.acceso();
    return [
      { valor: `${acceso?.accesos30 ?? 0}`, etiqueta: 'accesos 30 d' },
      { valor: `${acceso?.fallidos ?? 0}`, etiqueta: 'fallidos' },
      { valor: new Date(u.creadoEn).toLocaleDateString('es', { day: 'numeric', month: 'short' }), etiqueta: 'alta' },
    ];
  });

  constructor() {
    effect(() => {
      this.usuarioId();
      const u = this.usuario();
      this.pestana.set('permisos');
      this.datos.set({ nombres: u.nombres, apellidos: u.apellidos, telefono: u.telefono ?? '' });
    });
  }

  protected grupoPunto(rol: Rol): string {
    return PUNTO_ROL[rol.nombre] ?? '#c6cad1';
  }

  protected etiquetaRol(rol: Rol): string {
    return etiquetaRolTexto(rol.nombre);
  }

  /** Mismo criterio que `ultimoMsEfectivo` en `usuarios-page.component.ts`
   * (duplicado a propósito, ver el docstring de la clase sobre qué se
   * importa de la página y qué no): combina `Usuario.ultimoAcceso` (campo
   * propio, real desde el fix de "nunca entró para todos") con
   * `acceso.ultimoMs` (reconstruido desde auditoría) en vez de reemplazar
   * uno por el otro. */
  private ultimoMsEfectivo(u: UsuarioGoods, acceso: Acceso | undefined): number | null {
    const desdeUsuario = u.ultimoAcceso ? new Date(u.ultimoAcceso).getTime() : null;
    const desdeAuditoria = acceso?.ultimoMs ?? null;
    if (desdeUsuario === null) {
      return desdeAuditoria;
    }
    if (desdeAuditoria === null) {
      return desdeUsuario;
    }
    return Math.max(desdeUsuario, desdeAuditoria);
  }

  private estadoDe(u: UsuarioGoods, acceso: Acceso | undefined): EstadoAcceso {
    if (!u.activo) {
      return 'desactivado';
    }
    const ms = this.ultimoMsEfectivo(u, acceso);
    if (ms === null) {
      return 'sin_estrenar';
    }
    return this.diasDesde(ms) >= 90 ? 'dormido' : 'activo';
  }

  private diasDesde(ms: number): number {
    return Math.floor((Date.now() - ms) / MS_DIA);
  }

  private textoUltimo(u: UsuarioGoods, acceso: Acceso | undefined, enLinea: boolean): string {
    if (!u.activo) {
      return 'cuenta desactivada';
    }
    if (enLinea) {
      return 'en línea ahora';
    }
    const ms = this.ultimoMsEfectivo(u, acceso);
    if (ms === null) {
      return 'nunca entró';
    }
    const d = this.diasDesde(ms);
    if (d === 0) {
      const h = Math.floor((Date.now() - ms) / 3_600_000);
      return h < 1 ? 'hace minutos' : `hace ${h} h`;
    }
    return d === 1 ? 'ayer' : `hace ${d} días`;
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cerrar.emit();
    }
  }

  protected elegirRolPreview(rol: Rol): void {
    const u = this.usuario();
    this.rolPreviewSeleccionado.emit(rol.id === u.rolId ? null : rol.id);
  }

  protected descartarCambioRol(): void {
    this.rolPreviewSeleccionado.emit(null);
  }

  protected aplicarCambioRol(): void {
    const u = this.usuario();
    const rolId = this.rolPreviewId();
    if (rolId === null || this.guardando()) {
      return;
    }
    this.guardando.set(true);
    this.usuarioService.cambiarRol(u.id, rolId).subscribe({
      next: (actualizado) => {
        this.guardando.set(false);
        this.usuarioActualizado.emit(actualizado);
        const rol = this.roles().find((r) => r.id === rolId);
        this.avisoTexto.emit(`${u.nombres} ahora es ${rol ? this.etiquetaRol(rol) : 'otro rol'}`);
      },
      error: () => {
        this.guardando.set(false);
        this.errorTexto.emit('No se pudo cambiar el rol. Intenta de nuevo.');
      },
    });
  }

  protected guardarDatos(): void {
    const u = this.usuario();
    if (this.guardando()) {
      return;
    }
    const d = this.datos();
    this.guardando.set(true);
    this.usuarioService
      .actualizar(u.id, { nombres: d.nombres, apellidos: d.apellidos, telefono: d.telefono || undefined })
      .subscribe({
        next: (actualizado) => {
          this.guardando.set(false);
          this.usuarioActualizado.emit(actualizado);
          this.avisoTexto.emit('Datos guardados');
        },
        error: () => {
          this.guardando.set(false);
          this.errorTexto.emit('No se pudieron guardar los datos.');
        },
      });
  }

  protected quitarAcceso(): void {
    const u = this.usuario();
    if (this.guardando()) {
      return;
    }
    this.guardando.set(true);
    this.usuarioService.eliminar(u.id).subscribe({
      next: () => {
        this.guardando.set(false);
        this.accesoQuitado.emit(u.id);
        this.avisoTexto.emit(`Se quitó el acceso a ${u.nombres}`);
      },
      error: (err: unknown) => {
        this.guardando.set(false);
        this.errorTexto.emit(this.mensajeDeError(err));
      },
    });
  }

  protected actualizarDato(campo: 'nombres' | 'apellidos' | 'telefono', valor: string): void {
    this.datos.update((actual) => ({ ...actual, [campo]: valor }));
  }

  private mensajeDeError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const mensaje = (err.error as { message?: string } | null)?.message;
      if (mensaje) {
        return Array.isArray(mensaje) ? mensaje.join(' ') : mensaje;
      }
    }
    return 'No se pudo quitar el acceso.';
  }
}
