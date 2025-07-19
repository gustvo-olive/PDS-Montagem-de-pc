/**
 * @file Serviço de Dados Climáticos.
 * @module services/weatherService
 * @description Este módulo é responsável por buscar dados climáticos históricos
 * de uma localização específica, utilizando a API Open-Meteo.
 */

import { CityWeatherData } from '../types';

const OPEN_METEO_ARCHIVE_API_URL = 'https://archive-api.open-meteo.com/v1/archive';

/**
 * @interface OpenMeteoArchiveResponse
 * @description Interface para a estrutura da resposta da API Open-Meteo.
 * @private
 */
interface OpenMeteoArchiveResponse {
  latitude: number;
  longitude: number;
  daily: {
    time: string[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
    temperature_2m_mean: (number | null)[];
  };
}

/**
 * Gera o intervalo de datas para o último ano a partir da data atual.
 * @returns Um objeto com as datas de início e fim no formato "YYYY-MM-DD".
 * @private
 */
const getPastYearDateRange = (): { startDate: string; endDate: string } => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);

    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    return {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
    };
};

/**
 * Busca os dados climáticos históricos de uma cidade com base em suas coordenadas.
 * Utiliza a API Open-Meteo para obter as temperaturas média, máxima e mínima do último ano,
 * que são usadas para otimizar as recomendações de refrigeração da IA.
 * @param {string} latitude - A latitude da cidade.
 * @param {string} longitude - A longitude da cidade.
 * @returns {Promise<CityWeatherData | null>} Um objeto CityWeatherData ou nulo em caso de erro.
 * @example
 * ```ts
 * const weatherData = await getCityWeather("-23.55", "-46.63");
 * if (weatherData) {
 *   console.log(`Temp. média anual: ${weatherData.avgTemp}°C`);
 * }
 * ```
 */
export const getCityWeather = async (latitude: string, longitude: string): Promise<CityWeatherData | null> => {
  const { startDate, endDate } = getPastYearDateRange();
  
  const queryParams = new URLSearchParams({
    latitude: latitude,
    longitude: longitude,
    start_date: startDate,
    end_date: endDate,
    daily: 'temperature_2m_max,temperature_2m_min,temperature_2m_mean',
    timezone: 'auto',
  });

  try {
    const response = await fetch(`${OPEN_METEO_ARCHIVE_API_URL}?${queryParams.toString()}`);
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Falha ao buscar dados da Open-Meteo Archive API:', response.status, errorData?.reason || response.statusText);
      return null;
    }

    const data: OpenMeteoArchiveResponse = await response.json();

    if (!data.daily || !data.daily.time || data.daily.time.length === 0) {
      console.error('Resposta da Open-Meteo Archive API incompleta:', data);
      return null;
    }
    
    const validMeans = data.daily.temperature_2m_mean.filter((t): t is number => t !== null);
    const validMaxs = data.daily.temperature_2m_max.filter((t): t is number => t !== null);
    const validMins = data.daily.temperature_2m_min.filter((t): t is number => t !== null);

    if (validMeans.length === 0 || validMaxs.length === 0 || validMins.length === 0) {
        console.error('Dados de temperatura anuais insuficientes.');
        return null;
    }
    
    const avgTemp = validMeans.reduce((sum, temp) => sum + temp, 0) / validMeans.length;
    const maxTemp = Math.max(...validMaxs);
    const minTemp = Math.min(...validMins);

    return {
      avgTemp: Math.round(avgTemp),
      maxTemp: Math.round(maxTemp),
      minTemp: Math.round(minTemp),
    };

  } catch (error) {
    console.error('Erro ao conectar com a API Open-Meteo:', error);
    return null;
  }
};
