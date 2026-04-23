import { Component } from '@angular/core';
import { MapComponent } from './components/map/map';
import { LocationListComponent } from './components/location-list/location-list';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [MapComponent, LocationListComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {}
