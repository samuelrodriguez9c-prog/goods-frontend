import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { IconCopy, IconLock, IconTrash, IconX, TablerIconComponent, type TablerIcon } from '@tabler/icons-angular';
import { Rol } from '../../../../core/roles/models/rol.model';

type TabPanel = 'permisos' | 'datos';
type Preset = 'nada' | 'lectura' | 'total';

interface AccionPanel {
  codigo: string;
  descripcion: string;
  activa: boolean;
  indice: number;
  destructiva: boolean;
}

interface ModuloPanel {
  id: string;
  nombre: string;
  resumen: string;
  etiquetaTodo: string;
  nivelTotal: number;
  acciones: AccionPanel[];
}

interface BaseOpcion {
  rol: Rol | null;
  etiqueta: string;
  conteo: string;
  elegida: boolean;
}

/**
 * Panel lateral de "Roles y permisos": ficha, edición y alta en un solo
 * componente (cambia de modo con `creando()`) para no duplicar la lista de
 * permisos ni los preajustes.
 *
 * @remarks
 * Todo llega armado por inputs y las acciones salen como outputs: el estado
 * de edición (`niveles`/`edits`) vive en `RolesPageComponent` porque la
 * matriz de afuera también pinta los cambios de todos los roles tocados.
 */
@Component({
  selector: 'app-rol-panel',
  standalone: true,
  imports: [TablerIconComponent],
  templateUrl: './rol-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolPanelComponent {
  protected readonly iconCerrar = IconX;
  protected readonly iconLock = IconLock;
  protected readonly iconCopy = IconCopy;
  protected readonly iconTrash = IconTrash;

  readonly creando = input.required<boolean>();
  readonly rol = input<Rol | null>(null);
  readonly chip = input.required<{ texto: string; icono: TablerIcon; clase: string }>();
  /** Nombre legible para el título (pasado por `etiquetaRolTexto()`). */
  readonly nombrePanel = input.required<string>();
  /**
   * Nombre crudo para el campo editable: si mostrara la versión legible,
   * cada tecla movería el cursor y se guardaría algo distinto a lo escrito.
   */
  readonly nombreEdicion = input.required<string>();
  readonly descripcionPanel = input.required<string>();
  readonly subtitulo = input.required<string>();
  readonly metricas = input.required<{ valor: string; etiqueta: string }[]>();
  readonly modulosPanel = input.required<ModuloPanel[]>();
  readonly bases = input.required<BaseOpcion[]>();
  readonly metadatos = input.required<{ clave: string; valor: string }[]>();
  readonly textoPie = input.required<string>();
  readonly puedeConfirmar = input.required<boolean>();
  readonly guardando = input.required<boolean>();

  readonly cerrar = output<void>();
  readonly confirmar = output<void>();
  readonly eliminar = output<void>();
  readonly duplicar = output<void>();
  readonly aplicarPreset = output<Preset>();
  readonly fijar = output<{ modulo: string; nivel: number }>();
  readonly elegirBase = output<Rol | null>();
  readonly actualizarTexto = output<{ campo: 'nombre' | 'descripcion'; valor: string }>();

  protected readonly pestana = signal<TabPanel>('permisos');

  private readonly rolId = computed(() => this.rol()?.id ?? null);

  constructor() {
    // Reinicia la pestaña solo si cambia el modo o el id del rol, no la
    // referencia: la página reemplaza el objeto al guardar y te sacaría de "Datos".
    effect(() => {
      const creando = this.creando();
      this.rolId();
      this.pestana.set(creando ? 'datos' : 'permisos');
    });
  }

  protected esPropio(rol: Rol): boolean {
    return !rol.esRolSistema;
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cerrar.emit();
    }
  }

  protected onDuplicar(): void {
    this.duplicar.emit();
  }
}
