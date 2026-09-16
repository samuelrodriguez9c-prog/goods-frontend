/**
 * Conversión entre el string `'YYYY-MM-DD'` que ya usan los filtros de
 * fecha del staff (formato que `<input type="date">` producía nativo, y
 * que los servicios (`EmpresaService.listar`, `AuditoriaService.listar`)
 * ya mandan tal cual como query param `desde`/`hasta`) y el `Date` que
 * pide `p-datepicker` — así el cambio de `<input type="date">` a
 * `p-datepicker` (ver `SearchToolbarComponent`/ADMIN_DISENO.md > "Barra
 * de búsqueda y filtros") no obliga a tocar el contrato con el backend.
 *
 * Construye/lee el `Date` en hora LOCAL a propósito (no
 * `new Date('YYYY-MM-DD')`, que Date interpreta como UTC medianoche y
 * puede mostrar el día anterior según la zona horaria del navegador, ni
 * `date.toISOString()`, que tiene el mismo problema al revés) — un solo
 * día de diferencia acá rompe el filtro silenciosamente.
 */
export function parseDateInput(value: string): Date | null {
  if (!value) {
    return null;
  }
  const [anio, mes, dia] = value.split('-').map(Number);
  if (!anio || !mes || !dia) {
    return null;
  }
  return new Date(anio, mes - 1, dia);
}

export function formatDateInput(fecha: Date | null): string {
  if (!fecha) {
    return '';
  }
  const anio = fecha.getFullYear();
  const mes = `${fecha.getMonth() + 1}`.padStart(2, '0');
  const dia = `${fecha.getDate()}`.padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}
