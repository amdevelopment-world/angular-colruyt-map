import { Component, OnInit, OnDestroy, ElementRef, viewChild, inject } from '@angular/core';
import { MapService } from '../../services/map.service';
import { Map } from 'maplibre-gl';

@Component({
  selector: 'app-map',
  standalone: true,
  templateUrl: './map.html',
  styleUrl: './map.css'
})
export class MapComponent implements OnInit, OnDestroy {
  private readonly mapService = inject(MapService);
  private readonly mapContainer = viewChild.required<ElementRef>('mapContainer');
  private map!: Map;

  ngOnInit() {
    this.map = new Map({
      container: this.mapContainer().nativeElement,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: this.mapService.center(),
      zoom: this.mapService.zoom()
    });

    this.map.on('load', () => {
      this.mapService.setMap(this.map);
    });
  }

  ngOnDestroy() {
    this.map.remove();
  }
}
