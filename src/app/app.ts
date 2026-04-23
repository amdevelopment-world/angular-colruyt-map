import { Component, inject, signal } from '@angular/core';
import { MapComponent } from './components/map/map';
import { StyleSwitcherComponent, MapStyleOption } from './components/style-switcher/style-switcher';
import { LocationListComponent } from './components/location-list/location-list';
import { MapService } from './services/map.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [MapComponent, StyleSwitcherComponent, LocationListComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly mapService = inject(MapService);

  readonly mapStyles: MapStyleOption[] = [
    { name: 'Positron (Light)', url: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json' },
    { name: 'Dark Matter', url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' },
    { name: 'Voyager', url: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json' },
  ];

  readonly activeStyle = signal(this.mapStyles[0].url);

  onStyleChanged(styleUrl: string) {
    this.activeStyle.set(styleUrl);
    this.mapService.setStyle(styleUrl);
  }
}
