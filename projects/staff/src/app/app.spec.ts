import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

// El placeholder ("Goods — Staff", sin pantallas reales) ya no existe —
// el layout real ahora vive en ShellComponent (§8 paso 5, ver
// app.routes.ts) y `App` es solo el <router-outlet /> raíz, igual que
// `admin`. Se prueba lo que de verdad importa acá: que arranca.
describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
