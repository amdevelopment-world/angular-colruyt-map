from flask import Flask, jsonify, send_from_directory
import requests
import os

app = Flask(__name__, static_folder='dist/angular/browser')

@app.route('/api/getColruytLocations')
def get_colruyt_locations():
    query = """
        [out:json];
        area["ISO3166-1"="BE"][admin_level=2]->.searchArea;
        (
          node["brand"="Colruyt"](area.searchArea);
          way["brand"="Colruyt"](area.searchArea);
          relation["brand"="Colruyt"](area.searchArea);
        );
        out center;
    """
    try:
        response = requests.post('https://overpass-api.de/api/interpreter', data=query)
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
            
        return jsonify({
            'type': 'FeatureCollection',
            'features': features
        })
    except Exception as e:
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
