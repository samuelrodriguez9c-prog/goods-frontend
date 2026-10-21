import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IconArrowDown,
  IconArrowUp,
  IconCalendar,
  IconCheck,
  IconForms,
  IconHash,
  IconList,
  IconPencil,
  IconPlus,
  IconToggleLeft,
  IconTrash,
  IconTypography,
  IconX,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { AuthService } from '../../../../core/auth/auth.service';
import {
  CampoPersonalizado,
  ENTIDADES,
  EntidadCampo,
  TIPOS,
  TOPE_CAMPOS,
  TipoCampo,
} from '../../../../core/campos/campo-personalizado.model';
import { CampoPersonalizadoService } from '../../../../core/campos/campo-personalizado.service';
import { mensajeDeError } from '../../../../core/solicitudes/solicitudes.service';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { AutofocoDirective } from '../../../../shared/ui/autofoco.directive';

interface Editor {
  /** `null` = campo nuevo. */
  campo: CampoPersonalizado | null;
  etiqueta: string;
  tipo: TipoCampo;
  opciones: string[];
  obligatorio: boolean;
}

/**
 * Settings → Campos propios: la Empresa define los datos extra de sus
 * productos, clientes, pedidos y proveedores (hasta 15 activos por
 * sección). Los formularios de cada módulo los muestran solos.
 *
 * @remarks
 * El tipo no cambia después de crear (los valores guardados dependen de
 * él). Borrar solo se puede si ningún registro tiene datos en el campo; si
 * no, se desactiva: deja de verse y los datos quedan.
 */
@Component({
  selector: 'app-settings-campos-page',
  standalone: true,
  imports: [TablerIconComponent, AutofocoDirective, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-campos-page.component.html',
})
export class SettingsCamposPageComponent {
  private readonly svc = inject(CampoPersonalizadoService);
  private readonly auth = inject(AuthService);
  private readonly alertas = inject(AlertaService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  protected readonly i = {
    nuevo: IconPlus, campos: IconForms, editar: IconPencil, borrar: IconTrash, arriba: IconArrowUp, abajo: IconArrowDown,
    x: IconX, check: IconCheck,
  };
  protected readonly iconoTipo: Record<TipoCampo, typeof IconTypography> = {
    texto: IconTypography, numero: IconHash, fecha: IconCalendar, lista: IconList, si_no: IconToggleLeft,
  };
  protected readonly entidades = ENTIDADES;
  protected readonly tipos = TIPOS;
  protected readonly tope = TOPE_CAMPOS;
  protected readonly nombreTipo = Object.fromEntries(TIPOS.map((t) => [t.k, t.t])) as Record<TipoCampo, string>;

  private readonly query = toSignal(this.ruta.queryParamMap, { initialValue: this.ruta.snapshot.queryParamMap });
  protected readonly entidad = computed<EntidadCampo>(() => {
    const e = this.query().get('entidad');
    return ENTIDADES.some((x) => x.k === e) ? (e as EntidadCampo) : 'producto';
  });
  protected readonly indiceEntidad = computed(() => ENTIDADES.findIndex((e) => e.k === this.entidad()));
  protected readonly campos = computed(() => this.svc.todos(this.entidad()));
  protected readonly activos = computed(() => this.campos().filter((c) => c.activo).length);
  protected readonly puedeGestionar = computed(() => !!this.auth.currentUser()?.permisos.includes('campos.gestionar'));

  protected readonly cargando = signal(true);
  protected readonly editor = signal<Editor | null>(null);
  protected readonly nuevaOpcion = signal('');
  protected readonly errorEditor = signal('');
  protected readonly guardando = signal(false);
  /** Campo con la confirmación de borrado abierta, y por qué no se pudo si falló. */
  protected readonly borrando = signal<{ id: number; error: string } | null>(null);

  constructor() {
    for (const e of ENTIDADES) {
      this.svc.recargar(e.k).subscribe({
        next: () => e.k === this.entidad() && this.cargando.set(false),
        error: () => e.k === this.entidad() && this.cargando.set(false),
      });
    }
  }

  protected cuenta(e: EntidadCampo): number {
    return this.svc.activos(e).length;
  }

  protected irA(e: EntidadCampo): void {
    this.editor.set(null);
    this.borrando.set(null);
    void this.router.navigate([], { queryParams: { entidad: e }, replaceUrl: true });
  }

  // ── Editor ─────────────────────────────────────────────────────────

  protected nuevo(): void {
    this.borrando.set(null);
    this.abrirEditor({ campo: null, etiqueta: '', tipo: 'texto', opciones: [], obligatorio: false });
  }

  protected editar(c: CampoPersonalizado): void {
    this.borrando.set(null);
    this.abrirEditor({ campo: c, etiqueta: c.etiqueta, tipo: c.tipo, opciones: [...(c.opciones ?? [])], obligatorio: c.obligatorio });
  }

  private abrirEditor(e: Editor): void {
    this.editor.set(e);
    this.nuevaOpcion.set('');
    this.errorEditor.set('');
  }

  protected parche(p: Partial<Editor>): void {
    this.editor.update((e) => (e ? { ...e, ...p } : e));
    this.errorEditor.set('');
  }

  protected agregarOpcion(): void {
    const e = this.editor();
    const o = this.nuevaOpcion().trim();
    if (!e || !o) return;
    if (e.opciones.some((x) => x.toLowerCase() === o.toLowerCase())) {
      this.errorEditor.set(`«${o}» ya está en la lista.`);
      return;
    }
    this.parche({ opciones: [...e.opciones, o] });
    this.nuevaOpcion.set('');
  }

  protected quitarOpcion(o: string): void {
    const e = this.editor();
    if (e) this.parche({ opciones: e.opciones.filter((x) => x !== o) });
  }

  /** Enter agrega la opción; Backspace en vacío quita la última. */
  protected teclaOpcion(ev: KeyboardEvent): void {
    if (ev.key === 'Enter' || ev.key === ',') {
      ev.preventDefault();
      this.agregarOpcion();
    } else if (ev.key === 'Backspace' && !this.nuevaOpcion()) {
      const e = this.editor();
      if (e?.opciones.length) this.quitarOpcion(e.opciones[e.opciones.length - 1]);
    }
  }

  protected guardar(): void {
    const e = this.editor();
    if (!e || this.guardando()) return;
    if (this.nuevaOpcion().trim()) this.agregarOpcion();
    const ed = this.editor()!;
    const etiqueta = ed.etiqueta.trim();
    if (!etiqueta) return this.errorEditor.set('Ponle un nombre al campo.');
    if (ed.tipo === 'lista' && !ed.opciones.length) return this.errorEditor.set('Agrega al menos una opción a la lista.');

    this.guardando.set(true);
    const req = ed.campo
      ? this.svc.actualizar(ed.campo, { etiqueta, obligatorio: ed.obligatorio, ...(ed.tipo === 'lista' ? { opciones: ed.opciones } : {}) })
      : this.svc.crear({ entidad: this.entidad(), etiqueta, tipo: ed.tipo, obligatorio: ed.obligatorio, ...(ed.tipo === 'lista' ? { opciones: ed.opciones } : {}) });
    req.subscribe({
      next: (c) => {
        this.guardando.set(false);
        this.editor.set(null);
        this.alertas.mostrar({ estado: 'success', titulo: ed.campo ? 'Campo actualizado' : 'Campo creado', texto: c.etiqueta });
      },
      error: (err) => {
        this.guardando.set(false);
        this.errorEditor.set(mensajeDeError(err, 'No se pudo guardar el campo.'));
      },
    });
  }

  // ── Acciones por fila ──────────────────────────────────────────────

  protected alternarActivo(c: CampoPersonalizado): void {
    this.alertas
      .seguir(this.svc.actualizar(c, { activo: !c.activo }), {
        titulo: c.activo ? 'Desactivando' : 'Activando', texto: c.etiqueta,
        exito: { titulo: c.activo ? 'Campo desactivado' : 'Campo activado', texto: c.activo ? 'Ya no se ve en los formularios; sus datos quedan guardados.' : c.etiqueta },
        error: { titulo: 'No se pudo cambiar', texto: c.activo ? 'Intenta de nuevo.' : `Puedes tener hasta ${TOPE_CAMPOS} activos por sección.` },
      })
      .subscribe({ error: () => undefined });
  }

  /** Sube o baja el campo: el orden es el de los formularios. */
  protected mover(c: CampoPersonalizado, d: -1 | 1): void {
    const xs = this.campos().map((x) => x.id);
    const i = xs.indexOf(c.id), j = i + d;
    if (j < 0 || j >= xs.length) return;
    [xs[i], xs[j]] = [xs[j], xs[i]];
    this.svc.ordenar(this.entidad(), xs).subscribe({
      error: () => this.alertas.mostrar({ estado: 'error', titulo: 'No se pudo cambiar el orden', texto: 'Intenta de nuevo.' }),
    });
  }

  protected pedirBorrar(c: CampoPersonalizado): void {
    this.editor.set(null);
    this.borrando.set({ id: c.id, error: '' });
  }

  protected borrar(c: CampoPersonalizado): void {
    this.svc.eliminar(c).subscribe({
      next: () => {
        this.borrando.set(null);
        this.alertas.mostrar({ estado: 'success', titulo: 'Campo borrado', texto: c.etiqueta });
      },
      error: (err) => this.borrando.set({ id: c.id, error: mensajeDeError(err, 'No se pudo borrar el campo.') }),
    });
  }

  protected resumen(c: CampoPersonalizado): string {
    if (c.tipo !== 'lista') return TIPOS.find((t) => t.k === c.tipo)!.d;
    const xs = c.opciones ?? [];
    return xs.slice(0, 5).join(' · ') + (xs.length > 5 ? ` y ${xs.length - 5} más` : '');
  }
}
