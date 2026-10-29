import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IconBookmark, IconPencil, IconPlus, IconTrash, TablerIconComponent } from '@tabler/icons-angular';
import { AsistenteRecuerdosService } from '../../../../core/asistente/asistente-recuerdos.service';
import { AsistenteRecuerdo } from '../../../../core/asistente/models/asistente.model';
import { TopbarComponent } from '../../../../layout/topbar/topbar.component';
import { CabeceraModuloComponent } from '../../../../shared/ui/cabecera-modulo/cabecera-modulo.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { PantallaEstadoComponent } from '../../../../shared/ui/pantalla-estado/pantalla-estado.component';
import { AutofocoDirective } from '../../../../shared/ui/autofoco.directive';
import { OpcionSegmentado, SegmentadoComponent } from '../../../../shared/ui/segmentado/segmentado.component';

type Pestana = 'personal' | 'empresa';
const LARGO_MAXIMO = 300;
const ORIGEN: Record<AsistenteRecuerdo['origen'], string> = {
  pedido: 'Lo pediste en el chat',
  sugerido: 'Sugerido por el asistente',
  manual: 'Escrito aquí',
};
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * «Lo que el asistente recuerda» (`/asistente/recuerdos`): lo que el
 * asistente tiene en cuenta en cada conversación, en dos pestañas.
 *
 * - **Míos**: de esta persona; los edita y borra ella.
 * - **De la Empresa**: los ve todo el equipo; solo quien tiene el permiso
 *   `asistente.recuerdos` los escribe, edita o borra (sin él, solo lectura).
 *
 * Se llenan desde el chat («recuerda que…» o la tarjeta «¿Lo recuerdo?») o
 * escribiéndolos aquí.
 */
@Component({
  selector: 'app-recuerdos-page',
  standalone: true,
  imports: [FormsModule, TablerIconComponent, TopbarComponent, CabeceraModuloComponent, PantallaEstadoComponent, ModalComponent, SegmentadoComponent, AutofocoDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recuerdos-page.component.html',
})
export class RecuerdosPageComponent implements OnInit {
  private readonly api = inject(AsistenteRecuerdosService);
  private readonly router = inject(Router);

  protected readonly i = { modulo: IconBookmark, nuevo: IconPlus, editar: IconPencil, eliminar: IconTrash };
  protected readonly largoMaximo = LARGO_MAXIMO;
  protected readonly skeletons = [1, 2, 3];

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly personales = signal<AsistenteRecuerdo[]>([]);
  protected readonly empresa = signal<AsistenteRecuerdo[]>([]);
  protected readonly puedeEditarEmpresa = signal(false);
  protected readonly pestana = signal<Pestana>('personal');

  protected readonly estadoPantalla = computed<'cargando' | 'error' | 'listo'>(() =>
    this.error() ? 'error' : this.cargando() ? 'cargando' : 'listo',
  );
  protected readonly opciones = computed<OpcionSegmentado<Pestana>[]>(() => [
    { k: 'personal', label: 'Míos', n: this.personales().length },
    { k: 'empresa', label: 'De la Empresa', n: this.empresa().length },
  ]);
  protected readonly lista = computed(() => (this.pestana() === 'personal' ? this.personales() : this.empresa()));
  /** En la pestaña de la Empresa, sin el permiso todo es de solo lectura. */
  protected readonly editable = computed(() => this.pestana() === 'personal' || this.puedeEditarEmpresa());
  protected readonly total = computed(() => this.personales().length + this.empresa().length);

  protected readonly lectura = computed(() => {
    if (this.pestana() === 'empresa') {
      const n = this.empresa().length;
      const base = n
        ? `El asistente tiene en cuenta estos ${n === 1 ? 'dato' : `${n} datos`} con todas las personas del equipo.`
        : 'Todavía no recuerda nada de la Empresa: reglas del negocio, costumbres de proveedores o clientes, nombres internos.';
      return this.puedeEditarEmpresa() ? base : `${base} Solo quien tiene el permiso del asistente en su rol puede cambiarlos.`;
    }
    const n = this.personales().length;
    return n
      ? `Solo los usa contigo: ${n === 1 ? 'un dato' : `${n} datos`} sobre cómo trabajas y cómo prefieres que te responda.`
      : 'Todavía no recuerda nada tuyo. Dile «recuerda que…» en el chat o escríbelo aquí.';
  });

  // Nuevo / editar (inline)
  protected readonly creando = signal(false);
  protected readonly borrador = signal('');
  protected readonly editandoId = signal<number | null>(null);
  protected readonly edicion = signal('');
  protected readonly guardando = signal(false);
  protected readonly errorForm = signal<string | null>(null);

  // Borrar
  protected readonly aBorrar = signal<AsistenteRecuerdo | null>(null);
  protected readonly borrando = signal(false);

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.api.listar().subscribe({
      next: (l) => {
        this.personales.set(l.personales);
        this.empresa.set(l.empresa);
        this.puedeEditarEmpresa.set(l.puedeEditarEmpresa);
        this.cargando.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.error.set(e.status === 403 ? 'El plan de tu Empresa no incluye el asistente de IA.' : 'No se pudo cargar lo que recuerda el asistente.');
        this.cargando.set(false);
      },
    });
  }

  protected volver(): void {
    this.router.navigateByUrl('/asistente');
  }

  protected cambiarPestana(p: Pestana): void {
    this.pestana.set(p);
    this.cancelar();
  }

  protected origen(r: AsistenteRecuerdo): string {
    const quien = r.alcance === 'empresa' && r.creadoPor ? ` · ${r.creadoPor}` : '';
    return `${ORIGEN[r.origen]}${quien} · ${this.fecha(r.actualizadoEn)}`;
  }

  protected nuevo(): void {
    this.editandoId.set(null);
    this.borrador.set('');
    this.errorForm.set(null);
    this.creando.set(true);
  }

  protected editar(r: AsistenteRecuerdo): void {
    this.creando.set(false);
    this.edicion.set(r.texto);
    this.errorForm.set(null);
    this.editandoId.set(r.id);
  }

  protected cancelar(): void {
    if (this.guardando()) return;
    this.creando.set(false);
    this.editandoId.set(null);
    this.errorForm.set(null);
  }

  protected guardarNuevo(): void {
    const texto = this.borrador().trim();
    if (texto.length < 3) return;
    this.enviar(this.api.crear(texto, this.pestana()), (r) => {
      this.listaDe(r.alcance).update((l) => [r, ...l.filter((x) => x.id !== r.id)]);
      this.creando.set(false);
    });
  }

  protected guardarEdicion(r: AsistenteRecuerdo): void {
    const texto = this.edicion().trim();
    if (texto.length < 3 || texto === r.texto) return this.cancelar();
    this.enviar(this.api.editar(r.id, texto), (nuevo) => {
      this.listaDe(r.alcance).update((l) => [nuevo, ...l.filter((x) => x.id !== r.id)]);
      this.editandoId.set(null);
    });
  }

  protected confirmarBorrado(): void {
    const r = this.aBorrar();
    if (!r) return;
    this.borrando.set(true);
    this.api.eliminar(r.id).subscribe({
      next: () => {
        this.listaDe(r.alcance).update((l) => l.filter((x) => x.id !== r.id));
        this.borrando.set(false);
        this.aBorrar.set(null);
      },
      error: () => {
        // Ya no estaba (otra pestaña) o no se pudo: se recarga para mostrar lo real.
        this.borrando.set(false);
        this.aBorrar.set(null);
        this.cargar();
      },
    });
  }

  private enviar(peticion: ReturnType<AsistenteRecuerdosService['crear']>, alGuardar: (r: AsistenteRecuerdo) => void): void {
    this.guardando.set(true);
    this.errorForm.set(null);
    peticion.subscribe({
      next: (r) => {
        this.guardando.set(false);
        alGuardar(r);
      },
      error: (e: HttpErrorResponse) => {
        this.guardando.set(false);
        const msg = e.error?.message;
        this.errorForm.set(
          e.status === 403
            ? 'Tu rol no puede cambiar lo que el asistente recuerda de la Empresa.'
            : (Array.isArray(msg) ? msg[0] : msg) ?? 'No se pudo guardar. Intenta de nuevo.',
        );
      },
    });
  }

  private listaDe(alcance: AsistenteRecuerdo['alcance']) {
    return alcance === 'empresa' ? this.empresa : this.personales;
  }

  private fecha(iso: string): string {
    const d = new Date(iso);
    const hoy = new Date();
    const mismoDia = d.toDateString() === hoy.toDateString();
    if (mismoDia) return 'hoy';
    return `${d.getDate()} ${MESES[d.getMonth()]}${d.getFullYear() === hoy.getFullYear() ? '' : ` ${d.getFullYear()}`}`;
  }
}
