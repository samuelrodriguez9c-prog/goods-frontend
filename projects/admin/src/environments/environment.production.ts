/**
 * Environment de producción. `apiUrl`/`socketUrl` quedan como placeholder
 * hasta que exista un dominio real de despliegue — ver
 * `MODULOS_PENDIENTES.md` > "Preparación para producción". `socketUrl` sin
 * el sufijo `/api` — ver el comentario en `environment.ts`.
 */
export const environment = {
  production: true,
  apiUrl: 'https://api.goods.example.com/api',
  socketUrl: 'https://api.goods.example.com',
};
