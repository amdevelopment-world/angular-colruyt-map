import { Component, input, output } from '@angular/core';

export interface MapStyleOption {
  name: string;
  url: string;
}

@Component({
  selector: 'app-style-switcher',
  standalone: true,
  templateUrl: './style-switcher.html',
  styleUrl: './style-switcher.css'
})
export class StyleSwitcherComponent {
  readonly styles = input.required<MapStyleOption[]>();
  readonly activeStyle = input.required<string>();
  readonly styleChanged = output<string>();

  selectStyle(url: string) {
    this.styleChanged.emit(url);
  }
}
