from flask import Flask, jsonify, send_from_directory
import requests
import os
import time

app = Flask(__name__, static_folder='dist/angular/browser')

# Cache the Overpass API response (Colruyt locations don't change often)
cache = {'data': None, 'timestamp': 0}
CACHE_TTL = 3600  # 1 hour

@app.route('/api/getColruytLocations')
def get_colruyt_locations():
    # Return cached data if still fresh
    if cache['data'] and (time.time() - cache['timestamp']) < CACHE_TTL:
        return jsonify(cache['data'])

    query = '[out:json];area["ISO3166-1"="BE"][admin_level=2]->.searchArea;(node["brand"="Colruyt"](area.searchArea);way["brand"="Colruyt"](area.searchArea);relation["brand"="Colruyt"](area.searchArea););out center;'
    try:
        response = requests.post(
            'https://overpass-api.de/api/interpreter',
            data={'data': query},
            headers={
                'Accept': 'application/json',
                'User-Agent': 'ColruytMap/1.0'
            },
            timeout=30
        )
        response.raise_for_status()
        data = response.json()
        
        features = []
        for el in data.get('elements', []):
            lat = el.get('lat') or (el.get('center') and el['center'].get('lat'))
            lon = el.get('lon') or (el.get('center') and el['center'].get('lon'))
            if not lat or not lon:
                continue
                
            features.append({
                'type': 'Feature',
                'geometry': {
                    'type': 'Point',
                    'coordinates': [lon, lat]
                },
                'properties': {
                    'id': el.get('id'),
                    'name': el.get('tags', {}).get('name', 'Colruyt'),
                    'street': el.get('tags', {}).get('addr:street', ''),
                    'city': el.get('tags', {}).get('addr:city', '')
                }
            })
            
        geojson = {
            'type': 'FeatureCollection',
            'features': features
        }
        
        # Cache the result
        cache['data'] = geojson
        cache['timestamp'] = time.time()
        
        return jsonify(geojson)
    except Exception as e:
        app.logger.error(f"Overpass API error: {e}")
        return jsonify({"error": str(e)}), 500

# Serve Angular static files
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(app.static_folder + '/' + path):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    app.run(use_reloader=True, port=5000, threaded=True)
