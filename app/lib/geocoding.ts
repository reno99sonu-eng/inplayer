export interface GeocodeResult {
  latitude: number;
  longitude: number;
  display_name: string;
}

export async function geocodePincode(pincode: string): Promise<GeocodeResult | null> {
  try {
    // We use Nominatim (OpenStreetMap) as a free geocoding fallback.
    // Important: Nominatim requires a User-Agent header identifying the app.
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(pincode)}&country=India&format=json&limit=1`,
      {
        headers: {
          "User-Agent": "InPlayer-Hammart-App/1.0",
        },
      }
    );
    
    if (!response.ok) {
      console.error("Geocoding failed:", response.statusText);
      return null;
    }
    
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
        display_name: data[0].display_name,
      };
    }
    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

// Haversine formula to calculate distance in km between two lat/lng coordinates
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}
