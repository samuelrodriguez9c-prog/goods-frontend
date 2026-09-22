// projects/staff/src/app/features/roles/pages/rol-panel/rol-panel.component.ts

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
 * Panel único (ficha / edición / alta) de "Roles y permisos" — componente
 * aparte, sibling de `roles-page` en `pages/`, mismo patrón que el resto
 * de los módulos (`EmpresaDetallePanelComponent`, `FichaUsuarioPanelComponent`).
 *
 * A diferencia de Usuarios, acá NO se separó en dos componentes (uno para
 * ver/editar y otro para dar de alta): el LEEME (§10) diseñó a propósito
 * un solo panel que cambia de modo con `creando()`, reusando la misma
 * lista de switches de permisos y los mismos preajustes para ficha y alta
 * — separarlo en dos hubiera significado duplicar ese template entero,
 * exactamente lo que el diseño evitaba. Ver el docstring de
 * `RolesPageComponent` para el resto del razonamiento.
 *
 * Todo lo que necesita el `niveles`/`edits`/`roles` compartido de la
 * página (métricas, la lista de módulos con sus switches, las plantillas
 * de partida, la ficha de metadatos, el texto del pie) llega "ya armado"
 * por `@Input` — mismo criterio que `[matrizPanel]`/`[textoCambioRol]` en
 * `FichaUsuarioPanelComponent`: recalcularlo acá duplicaría `niveles`,
 * que tiene que seguir viviendo en la página porque la matriz (afuera de
 * este panel) también pinta el diff en vivo de TODOS los roles tocados,
 * no solo el que está abierto acá. Este panel no hace ningún llamado a
 * `RolService` por su cuenta tampoco, por la misma razón: guardar toca
 * `niveles`/`edits`/`roles` de la página, así que `confirmar`/`eliminar`/
 * `duplicar` son outputs que la página resuelve, no HTTP directo acá.
 *
 * Lo único genuinamente interno es la pestaña activa (`permisos`/`datos`)
 * — a nadie afuera del panel le importa cuál está abierta. El `effect`
 * del constructor la reinicia solo cuando cambia DE QUÉ se trata el panel
 * (`creando()`, o el id del rol seleccionado) — mismo criterio que
 * `FichaUsuarioPanelComponent`: si reiniciara con cualquier cambio de
 * referencia de `[rol]` (pasa cada vez que se guarda algo, la página
 * reemplaza el objeto en su lista), guardar datos estando en la pestaña
 * "Datos" te mandaría de vuelta a "Permisos" cada vez.
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
  /** Título del panel y valor del campo "Nombre" son dos strings
   * distintos a propósito: `nombrePanel` ya pasó por `etiquetaRolTexto()`
   * (mismo ajuste que en Usuarios — un rol como `admin_goods` se lee
   * "Admin de Goods"), pero el input editable tiene que mostrar y guardar
   * el valor crudo tal cual está en la base, letra por letra mientras se
   * escribe — si mostrara la versión prolija, cada tecla pisaría el
   * cursor y lo que se termina guardando dejaría de ser lo que la
   * persona ve escrito. Ver `nombrePanel`/`nombreEdicion` en
   * `RolesPageComponent`. */
  readonly nombrePanel = input.required<string>();
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
