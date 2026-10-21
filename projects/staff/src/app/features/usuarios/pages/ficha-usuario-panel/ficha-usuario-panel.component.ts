import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IconArrowRight, IconBan, IconPencil, IconX, TablerIconComponent, type TablerIcon } from '@tabler/icons-angular';
import { Rol } from '../../../../core/roles/models/rol.model';
import { UsuarioGoods } from '../../../../core/usuarios/models/usuario.model';
import { UsuarioService } from '../../../../core/usuarios/usuario.service';
import { AlertaService } from '../../../../core/ui/alerta.service';
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
 * Panel con la ficha de una persona: permisos de su rol, actividad y datos.
 *
 * Recibe `[usuario]`, `[roles]` y `[acceso]` ya resueltos por la página para
 * no repetir la carga de auditoría al abrir una ficha. `matrizPanel` y
 * `textoCambioRol` también llegan armados, y el rol en vista previa vive en
 * la página (`[rolPreviewId]` / `(rolPreviewSeleccionado)`) porque la fila
 * de la matriz tiene que mostrar el mismo diff.
 *
 * Los cambios (rol, datos, quitar acceso) los hace el propio panel, con su
 * aviso vía `AlertaService.seguir()`, y avisa el resultado por los outputs.
 * Al cambiar de persona vuelve a «Permisos»; el borrador de «Datos» se
 * actualiza con cada versión nueva de `[usuario]`.
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
  private readonly alertas = inject(AlertaService);

  protected readonly iconCerrar = IconX;
  protected readonly iconFlecha = IconArrowRight;
  protected readonly iconEditar = IconPencil;
  protected readonly iconQuitar = IconBan;

  readonly usuario = input.required<UsuarioGoods>();
  readonly roles = input.required<Rol[]>();
  readonly acceso = input<Acceso | undefined>();
  /** Si la persona está conectada ahora; lo resuelve la página
   * (`enLineaIds`). */
  readonly enLinea = input(false);
  readonly rolPreviewId = input<number | null>(null);
  readonly matrizPanel = input.required<MatrizFila[]>();
  readonly textoCambioRol = input.required<string>();

  readonly cerrar = output<void>();
  readonly rolPreviewSeleccionado = output<number | null>();
  readonly usuarioActualizado = output<UsuarioGoods>();
  readonly accesoQuitado = output<number>();

  protected readonly pestana = signal<TabPanel>('permisos');
  protected readonly datos = signal({ nombres: '', apellidos: '', telefono: '' });
  /** Id y datos de la última versión recibida de `[usuario]`, para saber si cambió la persona o si el borrador tiene cambios. */
  private idCargado: number | null = null;
  private datosBase = { nombres: '', apellidos: '', telefono: '' };
  protected readonly guardando = signal(false);

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
    // Con otra persona vuelve a «Permisos» y carga sus datos. Con una versión nueva de la
    // misma persona (al guardar, o un cambio en vivo) no cambia de pestaña y solo
    // actualiza el borrador de «Datos» si no lo estás editando.
    effect(() => {
      const u = this.usuario();
      const nuevos = { nombres: u.nombres, apellidos: u.apellidos, telefono: u.telefono ?? '' };
      untracked(() => {
        const otraPersona = u.id !== this.idCargado;
        const d = this.datos(), sinEditar = d.nombres === this.datosBase.nombres && d.apellidos === this.datosBase.apellidos && d.telefono === this.datosBase.telefono;
        if (otraPersona) this.pestana.set('permisos');
        if (otraPersona || sinEditar) this.datos.set(nuevos);
        this.idCargado = u.id;
        this.datosBase = nuevos;
      });
    });
  }

  protected grupoPunto(rol: Rol): string {
    return PUNTO_ROL[rol.nombre] ?? '#c6cad1';
  }

  protected etiquetaRol(rol: Rol): string {
    return etiquetaRolTexto(rol.nombre);
  }

  /** Copia de `ultimoMsEfectivo` de `usuarios-page.component.ts`: el más
   * reciente entre `Usuario.ultimoAcceso` y `acceso.ultimoMs` (auditoría). */
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
    const rol = this.roles().find((r) => r.id === rolId);
    this.guardando.set(true);
    this.alertas
      .seguir(this.usuarioService.cambiarRol(u.id, rolId), {
        titulo: 'Cambiando el rol',
        texto: u.nombres,
        exito: { titulo: `${u.nombres} ahora es ${rol ? this.etiquetaRol(rol) : 'otro rol'}` },
        error: { titulo: 'No se pudo cambiar el rol', texto: 'Intenta de nuevo.' },
      })
      .subscribe({
        next: (actualizado) => {
          this.guardando.set(false);
          this.usuarioActualizado.emit(actualizado);
        },
        error: () => {
          this.guardando.set(false);
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
    this.alertas
      .seguir(
        this.usuarioService.actualizar(u.id, {
          nombres: d.nombres,
          apellidos: d.apellidos,
          telefono: d.telefono || undefined,
        }),
        {
          titulo: 'Guardando los datos',
          texto: u.nombres,
          exito: { titulo: 'Datos guardados' },
          error: { titulo: 'No se pudieron guardar los datos', texto: 'Intenta de nuevo.' },
        },
      )
      .subscribe({
        next: (actualizado) => {
          this.guardando.set(false);
          this.usuarioActualizado.emit(actualizado);
        },
        error: () => {
          this.guardando.set(false);
        },
      });
  }

  protected quitarAcceso(): void {
    const u = this.usuario();
    if (this.guardando()) {
      return;
    }
    this.guardando.set(true);
    this.alertas
      .seguir(this.usuarioService.eliminar(u.id), {
        titulo: 'Quitando el acceso',
        texto: u.nombres,
        exito: { titulo: `Se quitó el acceso a ${u.nombres}` },
        error: { titulo: 'No se pudo quitar el acceso', texto: 'Intenta de nuevo.' },
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.accesoQuitado.emit(u.id);
        },
        error: () => {
          this.guardando.set(false);
        },
      });
  }

  protected actualizarDato(campo: 'nombres' | 'apellidos' | 'telefono', valor: string): void {
    this.datos.update((actual) => ({ ...actual, [campo]: valor }));
  }
}
