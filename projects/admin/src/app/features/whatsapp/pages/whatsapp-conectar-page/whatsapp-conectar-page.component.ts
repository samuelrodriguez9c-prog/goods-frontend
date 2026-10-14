import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { IconAlertTriangle, IconBrandFacebook, IconBrandWhatsapp, IconClock, IconLock, IconPlugConnectedX, TablerIconComponent } from '@tabler/icons-angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { mensajeDeError } from '../../../../core/solicitudes/solicitudes.service';
import { AlertaService } from '../../../../core/ui/alerta.service';
import { abrirRegistroIntegrado } from '../../../../core/whatsapp/registro-integrado';
import { EstadoConexion, formatearNumero } from '../../../../core/whatsapp/whatsapp.model';
import { WhatsappService } from '../../../../core/whatsapp/whatsapp.service';
import { WhatsappModuloStore } from '../../shared/whatsapp-modulo.store';
import { ConexionManualComponent, DatosConexionManual } from './components/conexion-manual/conexion-manual.component';
import { CostosConexionComponent } from './components/costos-conexion/costos-conexion.component';
import { PasosConexionComponent } from './components/pasos-conexion/pasos-conexion.component';

const TEXTO_PASO = ['Abriendo Facebook…', 'Confirmando el número…', 'Trayendo tus chats…'];

/**
 * Conectar el número (handoff-whatsapp, pantalla "Conectar"): se ve cuando el
 * negocio no tiene número o lo desconectó. Registro integrado de Meta y, como
 * respaldo, la conexión a mano con el número de prueba. Casos: WhatsApp aún no
 * habilitado en Goods, sin permiso para conectar (solo el dueño), número
 * desconectado con los chats guardados y registro integrado sin configurar.
 */
@Component({
  selector: 'app-whatsapp-conectar-page',
  imports: [TablerIconComponent, PasosConexionComponent, CostosConexionComponent, ConexionManualComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './whatsapp-conectar-page.component.html',
  host: { class: 'block leading-[normal]' },
})
export class WhatsappConectarPageComponent {
  protected readonly store = inject(WhatsappModuloStore);
  private readonly whatsapp = inject(WhatsappService);
  private readonly auth = inject(AuthService);
  private readonly alertas = inject(AlertaService);
  private readonly manualRef = viewChild(ConexionManualComponent);

  protected readonly i = {
    wa: IconBrandWhatsapp,
    fb: IconBrandFacebook,
    error: IconAlertTriangle,
    desconectado: IconPlugConnectedX,
    espera: IconClock,
    candado: IconLock,
  };

  protected readonly puedeConfigurar = computed(() => (this.auth.currentUser()?.permisos ?? []).includes('whatsapp.configurar'));
  protected readonly conexion = this.store.conexion;
  /** Tuvo un número y lo desconectó: los chats siguen guardados. */
  protected readonly desconectado = computed(() => !!this.conexion()?.cuenta);
  protected readonly numeroAnterior = computed(() => {
    const n = this.conexion()?.cuenta?.numero;
    return n ? formatearNumero(n.replace(/\D/g, '')) : null;
  });

  protected readonly conectando = signal<'meta' | 'manual' | null>(null);
  /** Paso del registro integrado en curso (0 Facebook, 1 número, 2 chats). */
  protected readonly paso = signal<number | null>(null);
  protected readonly textoBoton = computed(() => (this.conectando() === 'meta' ? TEXTO_PASO[this.paso() ?? 0] : 'Conectar con WhatsApp'));
  protected readonly errorConexion = signal<string | null>(null);
  /** Sin registro integrado, la conexión a mano es la única salida: abre sola. */
  protected readonly modoPrueba = signal(!this.store.conexion()?.registroIntegrado);

  protected async conectarConMeta(): Promise<void> {
    const ri = this.conexion()?.registroIntegrado;
    if (!ri || this.conectando()) return;
    this.conectando.set('meta');
    this.paso.set(0);
    this.errorConexion.set(null);
    try {
      const r = await abrirRegistroIntegrado(ri);
      this.paso.set(1);
      this.whatsapp.conectar(r).subscribe({
        next: (c) => this.listo(c),
        error: (e) => this.fallo(mensajeDeError(e)),
      });
    } catch (e) {
      this.fallo(e instanceof Error ? e.message : 'No se pudo conectar.');
    }
  }

  protected conectarManual(datos: DatosConexionManual): void {
    if (this.conectando()) return;
    this.conectando.set('manual');
    this.errorConexion.set(null);
    this.whatsapp.conectarManual(datos).subscribe({ next: (c) => this.listo(c), error: (e) => this.fallo(mensajeDeError(e)) });
  }

  private listo(c: EstadoConexion): void {
    this.paso.set(3);
    this.conectando.set(null);
    this.manualRef()?.limpiarToken();
    this.alertas.mostrar({ estado: 'success', titulo: 'Número conectado. Ya puedes responder desde Goods.' });
    this.store.conexion.set(c);
    this.store.cargarResumen();
  }

  private fallo(mensaje: string): void {
    this.conectando.set(null);
    this.paso.set(null);
    this.errorConexion.set(mensaje);
  }
}
