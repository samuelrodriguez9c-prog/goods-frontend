import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  AudienciaCampanas,
  Automatizaciones,
  Campana,
  EstadoConexion,
  HorarioSemanal,
  ListaConversaciones,
  Mensaje,
  Mostrador,
  NuevaPlantilla,
  Plantilla,
  RespuestaRapida,
  ResumenWhatsapp,
  TipoVariable,
} from './whatsapp.model';

@Injectable({ providedIn: 'root' })
export class WhatsappService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/whatsapp`;

  conexion() {
    return this.http.get<EstadoConexion>(`${this.base}/conexion`);
  }

  conectar(datos: { code: string; wabaId: string; phoneNumberId: string }) {
    return this.http.post<EstadoConexion>(`${this.base}/conexion`, datos);
  }

  conectarManual(datos: { token: string; phoneNumberId: string; wabaId?: string }) {
    return this.http.post<EstadoConexion>(`${this.base}/conexion/manual`, datos);
  }

  desconectar() {
    return this.http.delete<EstadoConexion>(`${this.base}/conexion`);
  }

  conversaciones(q: { buscar?: string; noLeidas?: boolean; page?: number } = {}) {
    let params = new HttpParams();
    if (q.buscar) params = params.set('buscar', q.buscar);
    if (q.noLeidas) params = params.set('noLeidas', 'true');
    if (q.page) params = params.set('page', q.page);
    return this.http.get<ListaConversaciones>(`${this.base}/conversaciones`, { params });
  }

  mensajes(conversacionId: number, antesDe?: number) {
    const params = antesDe ? new HttpParams().set('antesDe', antesDe) : undefined;
    return this.http.get<{ data: Mensaje[]; hayMas: boolean }>(`${this.base}/conversaciones/${conversacionId}/mensajes`, { params });
  }

  responder(conversacionId: number, texto: string) {
    return this.http.post<Mensaje>(`${this.base}/conversaciones/${conversacionId}/mensajes`, { texto });
  }

  /** El archivo de una foto, audio, video o documento (lo trae el backend desde Meta). */
  adjunto(mensajeId: number) {
    return this.http.get(`${this.base}/mensajes/${mensajeId}/adjunto`, { responseType: 'blob' });
  }

  reintentar(mensajeId: number) {
    return this.http.post<Mensaje>(`${this.base}/mensajes/${mensajeId}/reintentar`, {});
  }

  // ── Fase 3 ──

  plantillas() {
    return this.http.get<Plantilla[]>(`${this.base}/plantillas`);
  }

  crearPlantilla(p: NuevaPlantilla) {
    return this.http.post<Plantilla>(`${this.base}/plantillas`, p);
  }

  sincronizarPlantillas() {
    return this.http.post<Plantilla[]>(`${this.base}/plantillas/sincronizar`, {});
  }

  /** Respuesta que propone la IA al último mensaje del cliente (no envía nada). */
  sugerencia(conversacionId: number) {
    return this.http.post<{ texto: string | null }>(`${this.base}/conversaciones/${conversacionId}/sugerencia`, {});
  }

  /** Sugiere de dónde sale cada variable de un cuerpo (IA, con reglas de respaldo). */
  sugerirVariables(cuerpo: string, ejemplos: string[]) {
    return this.http.post<{ tipos: TipoVariable[]; fuente: 'ia' | 'reglas' }>(`${this.base}/plantillas/sugerir-variables`, { cuerpo, ejemplos });
  }

  guardarTiposVariables(id: number, tipos: TipoVariable[]) {
    return this.http.patch<Plantilla>(`${this.base}/plantillas/${id}/variables`, { tipos });
  }

  borrarPlantilla(id: number) {
    return this.http.delete<void>(`${this.base}/plantillas/${id}`);
  }

  enviarPlantilla(conversacionId: number, plantillaId: number, variables: string[]) {
    return this.http.post<Mensaje>(`${this.base}/conversaciones/${conversacionId}/plantilla`, { plantillaId, variables });
  }

  automatizaciones() {
    return this.http.get<Automatizaciones>(`${this.base}/automatizaciones`);
  }

  guardarBienvenida(datos: { activa: boolean; texto: string }) {
    return this.http.put(`${this.base}/automatizaciones/bienvenida`, datos);
  }

  guardarFueraHorario(datos: { activa: boolean; texto: string; zonaHoraria: string; horario: HorarioSemanal }) {
    return this.http.put(`${this.base}/automatizaciones/fuera-horario`, datos);
  }

  guardarPalabraClave(datos: { palabras: string[]; texto: string; activa?: boolean }, id?: number) {
    return id
      ? this.http.patch(`${this.base}/automatizaciones/palabras-clave/${id}`, datos)
      : this.http.post(`${this.base}/automatizaciones/palabras-clave`, datos);
  }

  borrarPalabraClave(id: number) {
    return this.http.delete<void>(`${this.base}/automatizaciones/palabras-clave/${id}`);
  }

  guardarRespuestaRapida(datos: { atajo: string; texto: string }, id?: number) {
    return id
      ? this.http.patch<RespuestaRapida>(`${this.base}/respuestas-rapidas/${id}`, datos)
      : this.http.post<RespuestaRapida>(`${this.base}/respuestas-rapidas`, datos);
  }

  borrarRespuestaRapida(id: number) {
    return this.http.delete<void>(`${this.base}/respuestas-rapidas/${id}`);
  }

  guardarAsistente(datos: { activa: boolean; instrucciones: string; pasarCuando?: string[] }) {
    return this.http.put(`${this.base}/automatizaciones/asistente`, datos);
  }

  /** Pausar o reactivar el asistente de IA en un chat. */
  pausarAsistente(conversacionId: number, pausado: boolean) {
    return this.http.patch<{ asistentePausadoHasta: string | null }>(`${this.base}/conversaciones/${conversacionId}/asistente`, { pausado });
  }

  /** El cliente le dijo al negocio que sí (o que ya no) quiere promociones. */
  marcarPromociones(conversacionId: number, acepta: boolean) {
    return this.http.patch<{ aceptaPromociones: boolean }>(`${this.base}/conversaciones/${conversacionId}/promociones`, { acepta });
  }

  campanas() {
    return this.http.get<Campana[]>(`${this.base}/campanas`);
  }

  audiencia() {
    return this.http.get<AudienciaCampanas>(`${this.base}/campanas/audiencia`);
  }

  crearCampana(datos: { nombre: string; plantillaId: number; variables: { tipo: 'nombre' | 'texto'; valor: string }[]; programadaPara?: string }) {
    return this.http.post<Campana>(`${this.base}/campanas`, datos);
  }

  cancelarCampana(id: number) {
    return this.http.post<Campana>(`${this.base}/campanas/${id}/cancelar`, {});
  }

  /** Números de la cabecera de cada sección. */
  resumen() {
    return this.http.get<ResumenWhatsapp>(`${this.base}/resumen`);
  }

  /** "Entendido": el equipo vio que la IA le pasó el chat. */
  marcarPasadoVisto(conversacionId: number) {
    return this.http.post<void>(`${this.base}/conversaciones/${conversacionId}/pasado-visto`, {});
  }

  /** Productos del Mostrador para un chat y los que el cliente nombró. */
  mostrador(conversacionId: number) {
    return this.http.get<Mostrador>(`${this.base}/conversaciones/${conversacionId}/mostrador`);
  }

  /** Le muestra un producto al cliente (sale como texto; en el chat queda la tarjeta). */
  enviarProducto(conversacionId: number, productoId: number) {
    return this.http.post<Mensaje>(`${this.base}/conversaciones/${conversacionId}/producto`, { productoId });
  }

  /** Corregir una campaña que todavía no salió. */
  editarCampana(id: number, datos: { nombre?: string; plantillaId?: number; variables?: { tipo: 'nombre' | 'texto'; valor: string }[]; programadaPara?: string }) {
    return this.http.patch<Campana>(`${this.base}/campanas/${id}`, datos);
  }

  marcarLeida(conversacionId: number) {
    return this.http.post<void>(`${this.base}/conversaciones/${conversacionId}/leida`, {});
  }
}
