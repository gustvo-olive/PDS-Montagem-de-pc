/**
 * @file Serviço de Componentes de Hardware.
 * @module services/componentService
 * @description Este módulo é responsável por buscar a lista de todos os componentes
 * de hardware disponíveis no banco de dados Supabase. Ele implementa uma estratégia
 * de cache em memória para otimizar o desempenho, evitando múltiplas chamadas ao
 * banco durante a mesma sessão.
 */

import { supabase } from './supabaseClient';
import { Componente } from '../types';

/**
 * Variável para armazenar os componentes em cache na memória.
 * @type {Componente[] | null}
 * @private
 */
let componentCache: Componente[] | null = null;

/**
 * Lista de marcas conhecidas para inferir a marca a partir do nome do produto.
 * @private
 */
const knownBrands = ["Kingston", "Corsair", "XPG", "Gigabyte", "ASUS", "MSI", "ASRock", "WD", "Western Digital", "Seagate", "XFX", "Sapphire", "Galax", "Palit", "PCYes", "PowerColor", "Rise Mode", "Noctua", "Deepcool", "Lian Li", "NZXT", "Cooler Master", "Aerocool", "Fortrek", "Redragon", "EVGA", "Zotac", "Inno3D", "Hikvision", "Lexar", "Crucial", "ADATA", "Patriot", "Intel", "AMD", "Dell", "Toshiba", "Samsung", "PNY", "G.Skill"];

/**
 * Busca a lista de todos os componentes de hardware disponíveis.
 * Primeiro, verifica se os componentes já estão em cache. Se não estiverem,
 * busca os dados da tabela 'components' no Supabase, processa-os (inferindo a marca)
 * e os armazena em cache para futuras requisições.
 * @returns {Promise<Componente[]>} Uma promessa que resolve para um array de objetos `Componente`.
 * @throws {Error} Se houver um erro na comunicação com o Supabase, especialmente erros de autenticação.
 * @example
 * ```ts
 * try {
 *   const components = await getComponents();
 *   console.log(`Foram encontrados ${components.length} componentes.`);
 * } catch (error) {
 *   console.error("Falha ao carregar componentes:", error);
 * }
 * ```
 */
export const getComponents = async (): Promise<Componente[]> => {
    if (componentCache) {
        return componentCache;
    }

    const { data, error } = await supabase
        .from('components')
        .select('*');

    if (error) {
        console.error("Erro ao buscar componentes do Supabase:", error.message || error);
        if (error.message.includes('JWT') || error.message.includes('token') || error.message.includes('API key')) {
            throw new Error("Falha na autenticação com o Supabase. Verifique se a sua Chave Anônima (Anon Key) está correta em services/supabaseClient.ts.");
        }
        throw error;
    }

    if (!data) {
        console.warn("Nenhum dado de componente retornado do Supabase.");
        return [];
    }

    const components: Componente[] = data.map((item: any) => {
        const produto = item.Produto || '';
        const brand = knownBrands.find(b => produto.toLowerCase().includes(b.toLowerCase()));
        
        return {
            id: String(item.id),
            Categoria: item.Categoria,
            Produto: produto,
            Preco: Number(item.Preco),
            LinkCompra: item.LinkCompra || undefined,
            brand: brand,
        };
    });

    componentCache = components;
    console.log(`Carregados ${componentCache.length} componentes do Supabase.`);
    return componentCache;
};
