/**
 * Environment de producción. `apiUrl`/`socketUrl` quedan como placeholder
 * hasta que exista un dominio real de despliegue — mismo criterio que
 * `admin/src/environments/environment.production.ts`. `socketUrl` sin el
 * sufijo `/api` — ver el comentario en `environment.ts`.
 */
export const environment = {
  production: true,
  apiUrl: 'https://api.goods.example.com/api',
  socketUrl: 'https://api.goods.example.com',
};
