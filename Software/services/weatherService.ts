
import { CityWeatherData } from '../types';

const OPEN_METEO_API_URL = 'https://api.open-meteo.com/v1/forecast';

// WMO Weather interpretation codes
// Reference: https://open-meteo.com/en/docs
const getWeatherDescriptionFromCode = (code: number): string => {
  const descriptions: Record<number, string> = {
    0: 'Céu limpo',
    1: 'Predominantemente limpo',
    2: 'Parcialmente nublado',
    3: 'Nublado',
    45: 'Nevoeiro',
    48: 'Nevoeiro depositando cristais de gelo',
    51: 'Garoa leve',
    53: 'Garoa moderada',
    55: 'Garoa densa',
    56: 'Garoa congelante leve',
    57: 'Garoa congelante densa',
    61: 'Chuva fraca',
    63: 'Chuva moderada',
    65: 'Chuva forte',
    66: 'Chuva congelante leve',
    67: 'Chuva congelante pesada',
    71: 'Neve fraca',
    73: 'Neve moderada',
    75: 'Neve forte',
    77: 'Grãos de neve',
    80: 'Aguaceiros fracos',
    81: 'Aguaceiros moderados',
    82: 'Aguaceiros violentos',
    85: 'Aguaceiros de neve fracos',
    86: 'Aguaceiros de neve fortes',
    95: 'Trovoada leve ou moderada',
    96: 'Trovoada com granizo leve',
    99: 'Trovoada com granizo forte',
  };
  return descriptions[code] || 'Condição desconhecida';
};

interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  current_weather: {
    temperature: number;
    weathercode: number;
    windspeed: number;
    time: string;
  };
  daily: {
    time: string[]; // Array of dates
    weathercode: number[]; // Array of weather codes for each day
    temperature_2m_max: number[]; // Array of max temperatures for each day
    temperature_2m_min: number[]; // Array of min temperatures for each day
  };
}

export const getCityWeather = async (latitude: string, longitude: string): Promise<CityWeatherData | null> => {
  const queryParams = new URLSearchParams({
    latitude: latitude,
    longitude: longitude,
    current_weather: 'true',
    daily: 'weathercode,temperature_2m_max,temperature_2m_min',
    timezone: 'auto', // Automatically determine timezone based on coordinates
    forecast_days: '1', // We only need data for the current day
  });

  try {
    const response = await fetch(`${OPEN_METEO_API_URL}?${queryParams.toString()}`);
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Falha ao buscar dados da Open-Meteo:', response.status, errorData?.reason || response.statusText);
      return null;
    }

    const data: OpenMeteoResponse = await response.json();

    if (!data.current_weather || !data.daily || !data.daily.weathercode || data.daily.weathercode.length === 0) {
      console.error('Resposta da Open-Meteo incompleta:', data);
      return null;
    }
    
    return {
      avgTemp: Math.round(data.current_weather.temperature),
      maxTemp: Math.round(data.daily.temperature_2m_max[0]),
      minTemp: Math.round(data.daily.temperature_2m_min[0]),
      description: getWeatherDescriptionFromCode(data.current_weather.weathercode),
    };

  } catch (error) {
    console.error('Erro ao conectar com a API Open-Meteo:', error);
    return null;
  }
};
