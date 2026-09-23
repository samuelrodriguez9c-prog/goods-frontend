import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  IconCalendarClock,
  IconCheck,
  IconChevronRight,
  IconListDetails,
  IconPhone,
  IconPhoneOff,
  IconSend,
  IconUserPlus,
  TablerIconComponent,
} from '@tabler/icons-angular';
import { forkJoin } from 'rxjs';
import { EmpresaService } from '../../../../core/catalog/empresa.service';
import { PlanService } from '../../../../core/catalog/plan.service';
import { SuscripcionService } from '../../../../core/catalog/suscripcion.service';
import { construirMapaPlanPorEmpresa } from '../../../../core/catalog/plan-lookup.util';
import { Empresa } from '../../../../core/catalog/models/empresa.model';
import { PantallaEstadoComponent } from '../../../../shared/ui/pantalla-estado/pantalla-estado.component';
import {
  CabeceraModuloComponent,
  MetricaCabecera,
} from '../../../../shared/ui/cabecera-modulo/cabecera-modulo.component';
import { ActivarEmpresaWizardComponent } from '../activar-empresa-wizard/activar-empresa-wizard.component';

/** Días de espera desde los que una alta pasa a estar "pasada de rosca".
 * Mismo umbral ya confirmado con el cliente para `EmpresasPageComponent`
 * (embudo de alta, rediseño 2026-09-17) — es el mismo concepto de "días
 * esperando en `pendiente`", así que se reutiliza el valor, no se
 * vuelve a preguntar. */
const UMBRAL_URGENTE = 10;

/** Días desde la llamada tras los cuales conviene insistirle al cliente que
 * todavía no confirmó (aparece "Reenviar el enlace" en la lista de espera).
 * Suposición de diseño nueva de este handoff — ajustala al proceso real. */
const DIAS_REINTENTO = 3;

/** Cuántas de las vencidas se resaltan con el fondo cálido. Con cola
 * acumulada, pintar TODAS las vencidas hace que el color deje de
 * significar algo — ver la nota de diseño del rediseño 2026-09-17. */
const MAX_DESTACADAS = 3;

interface FilaLlamada extends Empresa {
  planNombre: string | null;
  /** Posición en la hoja, ya formateada ("01", "02"…). */
  orden: string;
  diasEspera: number;
  unidadEspera: string;
  urgente: boolean;
  destacada: boolean;
  /** `true` en la primera fila que ya está en tiempo, para dibujar el corte
   * tipográfico que separa lo vencido del resto. */
  corte: boolean;
  dueno: string;
  /** Teléfono si lo dejó, correo si no — es lo que el staff necesita para
   * contactarlo, no los dos datos siempre. */
  contacto: string;
  contexto: string;
  /** Llamada agendada — viene de `Empresa.llamadaProgramadaPara` (ver ese
   * campo en `empresa.model.ts`), ya persistida por el backend. */
  agendadaEn: Date | null;
}

interface FilaEsperando extends Empresa {
  planNombre: string | null;
  contexto: string;
  textoEspera: string;
  insistir: boolean;
}

/**
 * Cola de altas pendientes (§7.2, PIVOTE_SAAS_MULTITENANT.md; §11 Paso 3,
 * PROPUESTA_FLUJO_ALTA_ASISTIDA.md) — rediseño del 2026-09-17 ("hoja del
 * día"), tercer handoff integrado componente por componente.
 *
 * Deja de ser una tabla de seis columnas (`p-table`/`DataTableComponent`,
 * que sigue en uso en el resto del panel) y pasa a ser una hoja de ruta
 * de llamadas, partida en las dos únicas cosas que el staff distingue al
 * trabajar: lo que depende de él (`pendiente` → hay que llamar) y lo que
 * depende del cliente (`informacion_corroborada` → ya se llamó, falta que
 * confirme desde el enlace). Antes las dos convivían en la misma tabla
 * separadas solo por un badge ámbar.
 *
 * Decisiones que vale la pena no perder al tocar esto:
 *
 * 1. **Orden fijo por antigüedad.** No hay selector de orden: no existe otro
 *    criterio razonable para una cola de trabajo.
 * 2. **La espera es la cifra protagonista**, no la fecha de solicitud.
 * 3. **Falta de teléfono = bloqueo**, no un guión: sin número no se puede
 *    llamar, así que se marca en la fila y el asistente deshabilita
 *    "Llamar ahora" (ver `ActivarEmpresaWizardComponent`).
 * 4. **Rubro y plan bajan a un renglón de contexto**: nunca decidieron nada,
 *    no merecían una columna cada uno.
 *
 * `agendadaEn` (el "Programar llamada" del asistente) sale directo de
 * `Empresa.llamadaProgramadaPara` — hasta el 2026-09-22 esta pantalla lo
 * llevaba solo en memoria propia (un `Record<empresaId, Date>` que nunca
 * llegó a poblarse desde ningún lado: bug real reportado por el cliente,
 * la etiqueta "Agendada …" nunca se mostraba). El backend ya lo persistía
 * en `GestionAlta.llamadaProgramadaPara`, solo faltaba que `GET /empresas`
 * lo devolviera (ver el comentario en `EmpresaService.findAll` del
 * backend) — arreglado ahí, no acá.
 */
@Component({
  selector: 'app-altas-pendientes-page',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    TablerIconComponent,
    ActivarEmpresaWizardComponent,
    PantallaEstadoComponent,
    CabeceraModuloComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './altas-pendientes-page.component.html',
})
export class AltasPendientesPageComponent {
  private readonly empresaService = inject(EmpresaService);
  private readonly suscripcionService = inject(SuscripcionService);
  private readonly planService = inject(PlanService);
  private readonly router = inject(Router);

  protected readonly hoy = new Date();
  protected readonly umbralUrgente = UMBRAL_URGENTE;
  protected readonly skeletons = [0, 1, 2, 3];

  protected readonly iconAltas = IconUserPlus;
  protected readonly iconLlamar = IconPhone;
  protected readonly iconSinTelefono = IconPhoneOff;
  protected readonly iconAgenda = IconCalendarClock;
  protected readonly iconDatos = IconListDetails;
  protected readonly iconReenviar = IconSend;
  protected readonly iconRetomar = IconChevronRight;
  protected readonly iconListo = IconCheck;

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly empresaSeleccionadaWizard = signal<number | null>(null);

  protected readonly estadoPantalla = computed<'cargando' | 'error' | 'listo'>(() =>
    this.error() ? 'error' : this.cargando() ? 'cargando' : 'listo',
  );

  private readonly pendientes = signal<(Empresa & { planNombre: string | null })[]>([]);
  private readonly corroboradas = signal<(Empresa & { planNombre: string | null })[]>([]);

  protected readonly llamadas = computed<FilaLlamada[]>(() => {
    // Lo más viejo arriba: la espera es el único criterio que importa acá.
    const ordenadas = [...this.pendientes()].sort(
      (a, b) => new Date(a.creadoEn).getTime() - new Date(b.creadoEn).getTime(),
    );

    return ordenadas.map((empresa, i) => {
      const dias = this.diasDesde(empresa.creadoEn);
      const urgente = dias >= UMBRAL_URGENTE;
      // Van ordenadas de más vieja a más nueva, así que las primeras `i` son
      // las peores: alcanza con el índice para saber si entra en el resalte.
      const destacada = urgente && i < MAX_DESTACADAS;
      const anteriorVencida = i > 0 ? this.diasDesde(ordenadas[i - 1].creadoEn) >= UMBRAL_URGENTE : false;

      return {
        ...empresa,
        orden: String(i + 1).padStart(2, '0'),
        diasEspera: dias,
        unidadEspera: dias === 0 ? 'recién entró' : dias === 1 ? 'día esperando' : 'días esperando',
        urgente,
        destacada,
        corte: i > 0 && anteriorVencida && !urgente,
        dueno: this.nombreDueno(empresa),
        contacto: empresa.telefonoContacto ?? empresa.correoContacto,
        contexto: [empresa.rubro ?? 'Sin rubro declarado', empresa.planNombre ? 'Pidió el plan ' + empresa.planNombre : null]
          .filter(Boolean)
          .join(' · '),
        agendadaEn: empresa.llamadaProgramadaPara ? new Date(empresa.llamadaProgramadaPara) : null,
      };
    });
  });

  protected readonly esperando = computed<FilaEsperando[]>(() =>
    this.corroboradas().map((empresa) => {
      // `actualizadoEn` es lo más cercano a "cuándo se hizo la llamada" que
      // hay hoy: la transición a `informacion_corroborada` lo actualiza.
      const dias = this.diasDesde(empresa.actualizadoEn);
      return {
        ...empresa,
        contexto: [this.nombreDueno(empresa), empresa.planNombre ? 'plan ' + empresa.planNombre : null]
          .filter(Boolean)
          .join(' · '),
        textoEspera: dias === 0 ? 'Llamada hoy · sin confirmar' : `Llamada hace ${dias} ${dias === 1 ? 'día' : 'días'} · sin confirmar`,
        insistir: dias >= DIAS_REINTENTO,
      };
    }),
  );

  protected readonly notaLlamar = computed(() =>
    this.llamadas().length ? `${this.llamadas().length} · ordenadas por antigüedad` : 'Nada en esta lista',
  );

  protected readonly notaEsperando = computed(() =>
    this.esperando().length ? 'Se les mandó el enlace para definir la contraseña' : 'Vacío',
  );

  protected readonly resumenDia = computed(() => {
    const llamadas = this.llamadas();
    const partes: string[] = [];

    if (llamadas.length) {
      partes.push(`${llamadas.length} ${llamadas.length === 1 ? 'llamada por hacer' : 'llamadas por hacer'}`);
      const peor = Math.max(...llamadas.map((f) => f.diasEspera));
      partes.push(`la más vieja espera hace ${peor} ${peor === 1 ? 'día' : 'días'}`);
      const sinTelefono = llamadas.filter((f) => !f.telefonoContacto).length;
      if (sinTelefono) {
        partes.push(
          `${sinTelefono} ${sinTelefono === 1 ? 'no dejó teléfono' : 'no dejaron teléfono'} — hay que escribirles`,
        );
      }
    }
    if (this.esperando().length) {
      partes.push(`${this.esperando().length} esperando que el cliente confirme`);
    }

    return partes.length ? partes.join(' · ') + '.' : 'Ninguna alta esperando. La cola quedó vacía.';
  });

  /** Cabecera compartida (LEEME.md §14). "Reintentos" sale de `insistir`
   *  en `esperando()` — la LEEME asumía un campo `reintento` de una señal
   *  `agenda()` que ya no existe en esta página (era código muerto, ver
   *  el comentario de la clase). Sin período propio a filtrar: los tiles
   *  son solo lectura, la cola ya está ordenada por antigüedad. */
  protected readonly metricasCabecera = computed<MetricaCabecera[]>(() => {
    const llamadas = this.llamadas();
    const esperando = this.esperando();
    const reintentos = esperando.filter((f) => f.insistir).length;
    const metricas: MetricaCabecera[] = [
      { id: 'llamar', etiqueta: 'Te toca llamar', valor: llamadas.length, tono: llamadas.length ? 'aviso' : 'exito' },
      {
        id: 'reintentos',
        etiqueta: 'Reintentos',
        valor: reintentos,
        tono: reintentos ? 'aviso' : 'neutro',
      },
      { id: 'esperando', etiqueta: 'Esperando contraseña', valor: esperando.length, tono: 'info' },
    ];
    if (llamadas.length) {
      const peor = llamadas[0];
      metricas.push({
        id: 'espera',
        etiqueta: 'Espera máxima',
        valor: `${peor.diasEspera} ${peor.diasEspera === 1 ? 'día' : 'días'}`,
        tono: peor.urgente ? 'peligro' : 'neutro',
        delta: peor.urgente ? `supera ${this.umbralUrgente} días` : null,
        deltaTono: 'peligro',
      });
    }
    return metricas;
  });

  protected readonly textoVacio = computed(() => {
    const n = this.esperando().length;
    return n
      ? `Quedan ${n} ${n === 1 ? 'alta' : 'altas'} en manos del cliente, abajo. No dependen de vos.`
      : 'No hay altas en ningún estado intermedio. Cuando entre un registro nuevo aparece acá.';
  });

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    forkJoin({
      pendientes: this.empresaService.listar({ estado: 'pendiente' }),
      esperandoConfirmacion: this.empresaService.listar({ estado: 'informacion_corroborada' }),
      suscripcionesPendientes: this.suscripcionService.listar('pendiente'),
      planes: this.planService.listarTodos(),
    }).subscribe({
      next: ({ pendientes, esperandoConfirmacion, suscripcionesPendientes, planes }) => {
        const mapaPlan = construirMapaPlanPorEmpresa(suscripcionesPendientes.data, planes.data);
        const conPlan = (empresa: Empresa) => ({ ...empresa, planNombre: mapaPlan.get(empresa.id) ?? null });
        this.pendientes.set(pendientes.data.map(conPlan));
        this.corroboradas.set(esperandoConfirmacion.data.map(conPlan));
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar la cola de altas pendientes. Intenta de nuevo.');
        this.cargando.set(false);
      },
    });
  }

  protected abrirWizard(fila: Empresa): void {
    this.empresaSeleccionadaWizard.set(fila.id);
  }

  /** El ícono de la fila abre el mismo asistente — el detalle completo de la
   * Empresa está a un clic de ahí (`EmpresaDetallePanelComponent`). */
  protected verDatos(fila: Empresa): void {
    this.empresaSeleccionadaWizard.set(fila.id);
  }

  /** Atajo de la lista de espera: abre el asistente, que arranca directo en
   * el paso 2 porque la Empresa ya está `informacion_corroborada`. */
  protected reenviarEnlace(fila: Empresa): void {
    this.empresaSeleccionadaWizard.set(fila.id);
  }

  protected cerrarWizard(): void {
    this.empresaSeleccionadaWizard.set(null);
  }

  protected onWizardActualizada(): void {
    this.cargar();
  }

  /** `(volver)` de `app-pantalla-estado` en el error de carga — mismo
   * criterio que `EmpresasPageComponent.volver()`: recarga la propia
   * pantalla, no hay un "inicio" distinto al que volver acá. */
  protected volver(): void {
    this.router.navigateByUrl('/altas-pendientes');
  }

  private diasDesde(fechaIso: string): number {
    const ms = this.hoy.getTime() - new Date(fechaIso).getTime();
    return Math.max(0, Math.round(ms / 86_400_000));
  }

  private nombreDueno(empresa: Empresa): string {
    return [empresa.duenoNombres, empresa.duenoApellidos].filter(Boolean).join(' ').trim() || 'Sin datos del registro';
  }
}
