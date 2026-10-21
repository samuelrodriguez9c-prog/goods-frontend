import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IconBuildingStore, IconExternalLink, TablerIconComponent } from '@tabler/icons-angular';
import { TiendaEstadoComponent } from '../../components/tienda-estado/tienda-estado.component';
import { TiendaFichaCatalogoComponent } from '../../components/tienda-ficha-catalogo/tienda-ficha-catalogo.component';
import { TiendaFichaDireccionComponent } from '../../components/tienda-ficha-direccion/tienda-ficha-direccion.component';
import { TiendaFichaMarcaComponent } from '../../components/tienda-ficha-marca/tienda-ficha-marca.component';
import { TiendaFichaLocalComponent } from '../../components/tienda-ficha-local/tienda-ficha-local.component';
import { TiendaFichaRedesComponent } from '../../components/tienda-ficha-redes/tienda-ficha-redes.component';
import { TiendaFichaWhatsappComponent } from '../../components/tienda-ficha-whatsapp/tienda-ficha-whatsapp.component';
import { TiendaVistaPreviaComponent } from '../../components/tienda-vista-previa/tienda-vista-previa.component';
import { TiendaConfigStore } from '../../shared/tienda-config.store';

/**
 * Configuración de la tienda en línea.
 *
 * @remarks
 * - Izquierda: Dirección · WhatsApp (con chat de ejemplo) · Presentación ·
 *   Ubicación y horario · Redes · Catálogo.
 * - Derecha (sticky): estado Publicada/Pausada con requisitos y compartir, y
 *   la vista previa del celular (pestañas Tienda / Chat / Estado).
 * - Pasar el mouse por una tarjeta la marca en la vista previa; un clic en la
 *   vista previa lleva a editarla.
 * - El estado vive en `TiendaConfigStore` (uno por visita); cada tarjeta es su
 *   propio componente.
 */
@Component({
  selector: 'app-tienda-page',
  imports: [
    TablerIconComponent, TiendaFichaDireccionComponent, TiendaFichaWhatsappComponent, TiendaFichaMarcaComponent, TiendaFichaLocalComponent, TiendaFichaRedesComponent,
    TiendaFichaCatalogoComponent, TiendaEstadoComponent, TiendaVistaPreviaComponent,
  ],
  providers: [TiendaConfigStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tienda-page.component.html',
  host: { '(document:keydown)': 'atajo($event)' },
})
export class TiendaPageComponent {
  protected readonly s = inject(TiendaConfigStore);
  protected readonly i = { tienda: IconBuildingStore, abrir: IconExternalLink };

  protected atajo(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); this.s.guardar(); }
  }
}
