/**
 * @file Serviço de Geolocalização.
 * @module services/geoService
 * @description Este módulo fornece funcionalidades para obter a geolocalização
 * do usuário com base no seu endereço IP, utilizando uma API externa.
 */

/**
 * @interface GeoLocation
 * @description Define a estrutura dos dados retornados pela API GeoJS.
 */
export interface GeoLocation {
  ip: string;
  city: string;
  region: string;
  country: string;
  /** Código de 3 letras do país (ex: "BRA"). */
  country_code3: string;
  /** A API retorna coordenadas como strings. */
  latitude: string;
  longitude: string;
  timezone: string;
  organization_name?: string;
  asn?: string;
  organization?: string;
  continent_code?: string;
  accuracy?: number;
}

/**
 * Obtém a geolocalização do usuário com base em seu endereço IP.
 * Utiliza a API pública e gratuita GeoJS.
 * @returns {Promise<GeoLocation | null>} Um objeto GeoLocation com os dados do usuário ou nulo em caso de erro.
 * @example
 * ```ts
 * const location = await getUserLocation();
 * if (location) {
 *   console.log(`Usuário localizado em: ${location.city}`);
 * }
 * ```
 */
export const getUserLocation = async (): Promise<GeoLocation | null> => {
  try {
    const response = await fetch('https://get.geojs.io/v1/ip/geo.json');
    
    if (!response.ok) {
      console.error('GeoJS API request failed:', response.status, response.statusText);
      return null;
    }
    
    const data: GeoLocation = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching user location from GeoJS:', error);
    return null;
  }
};
