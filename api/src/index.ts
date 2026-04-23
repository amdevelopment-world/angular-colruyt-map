import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

export async function getColruytLocations(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);

    // Overpass API query for Colruyt shops and distribution centers in Belgium
    const query = `
        [out:json];
        area["ISO3166-1"="BE"][admin_level=2]->.searchArea;
        (
          node["brand"="Colruyt"](area.searchArea);
          way["brand"="Colruyt"](area.searchArea);
          relation["brand"="Colruyt"](area.searchArea);
        );
        out center;
    `;

    try {
        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: query
        });

        if (!response.ok) {
            throw new Error(`Overpass API responded with status: ${response.status}`);
        }

        const data = await response.json();

        // Convert OpenStreetMap data to GeoJSON
        const features = data.elements.map((el: any) => {
            const lat = el.lat || el.center?.lat;
            const lon = el.lon || el.center?.lon;
            
            if (!lat || !lon) return null;

            return {
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [lon, lat]
                },
                properties: {
                    id: el.id,
                    name: el.tags?.name || 'Colruyt',
                    amenity: el.tags?.amenity,
                    shop: el.tags?.shop,
                    city: el.tags?.['addr:city'],
                    street: el.tags?.['addr:street']
                }
            };
        }).filter((f: any) => f !== null);

        const geoJson = {
            type: 'FeatureCollection',
            features: features
        };

        return { 
            jsonBody: geoJson 
        };
    } catch (error) {
        context.log.error("Error fetching data from Overpass API:", error);
        return {
            status: 500,
            body: "Failed to fetch locations"
        };
    }
}

app.http('getColruytLocations', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: getColruytLocations
});
