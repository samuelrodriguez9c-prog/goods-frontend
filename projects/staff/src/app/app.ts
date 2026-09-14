import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Igual que `admin`: el layout real vive en `ShellComponent`
 * (layout/shell/), acá solo el outlet raíz — el placeholder que probaba
 * que el proyecto arrancaba ya cumplió su función (§8 paso 5 ya está en
 * marcha, ver app.routes.ts).
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
