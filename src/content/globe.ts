export interface GlobePlace {
  id: string;
  name: string;
  note: string;
  lat: number;
  lon: number;
}

export const places: GlobePlace[] = [
  {
    id: "kathmandu",
    name: "Kathmandu",
    note: "Home",
    lat: 27.7172,
    lon: 85.324,
  },
  {
    id: "kualalumpur",
    name: "Kuala Lumpur",
    note: "Asia e University",
    lat: 3.139,
    lon: 101.6869,
  },
  {
    id: "sydney",
    name: "Sydney",
    note: "Australia",
    lat: -33.8688,
    lon: 151.2093,
  },
  {
    id: "newyork",
    name: "New York",
    note: "United States",
    lat: 40.7128,
    lon: -74.006,
  },
  {
    id: "london",
    name: "London",
    note: "United Kingdom",
    lat: 51.5074,
    lon: -0.1278,
  },
  {
    id: "berlin",
    name: "Berlin",
    note: "Germany",
    lat: 52.52,
    lon: 13.405,
  },
  {
    id: "paris",
    name: "Paris",
    note: "France",
    lat: 48.8566,
    lon: 2.3522,
  },
];

export const KATHMANDU = places[0];

/**
 * Haversine formula to compute great-circle distance in kilometers
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}
