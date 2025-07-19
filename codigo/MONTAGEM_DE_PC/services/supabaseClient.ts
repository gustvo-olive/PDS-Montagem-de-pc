/**
 * @file Cliente Supabase.
 * @module services/supabaseClient
 * @description
 * Este arquivo é responsável por inicializar e configurar o cliente Supabase.
 * Ele define a URL do projeto, a chave anônima pública e a estrutura completa
 * do banco de dados para fornecer segurança de tipos (type-safety) em todas
 * as interações com o Supabase.
 */

import { createClient } from '@supabase/supabase-js';
import { Json } from '../types';

// Constantes de conexão com o Supabase.
const SUPABASE_URL = 'https://bddvepakaalgvatoimat.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkZHZlcGFrYWFsZ3ZhdG9pbWF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNzk4MDIsImV4cCI6MjA2Nzc1NTgwMn0.GWoHWGK4gUbgb3eHsm5nfhOpbXhjs-mCJwNsIfUCGG8';


/**
 * @interface Database
 * @description Define a estrutura completa do banco de dados do Supabase.
 * Isso habilita a segurança de tipos e o autocompletar do TypeScript para
 * tabelas, views e funções, prevenindo erros em tempo de desenvolvimento.
 */
export interface Database {
  public: {
    Tables: {
      /** Tabela de componentes de hardware. */
      components: {
        Row: { id: string; Categoria: string; Produto: string; Preco: number; LinkCompra: string | null; };
        Insert: { id: string; Categoria: string; Produto: string; Preco: number; LinkCompra?: string | null; };
        Update: { id?: string; Categoria?: string; Produto?: string; Preco?: number; LinkCompra?: string | null; };
      },
      /** Tabela de perfis de usuário, estendendo `auth.users`. */
      profiles: {
        Row: { id: string; nome: string; email: string; updated_at: string; };
        Insert: { id: string; nome: string; email: string; };
        Update: { nome?: string; email?: string; };
      },
      /** Tabela de builds salvas pelos usuários. */
      builds: {
        Row: { id: string; created_at: string; user_id: string; nome: string; orcamento: number; data_criacao: string; requisitos: Json | null; avisos_compatibilidade: string[] | null; };
        Insert: { id?: string; user_id: string; nome: string; orcamento: number; data_criacao: string; requisitos?: Json | null; avisos_compatibilidade?: string[] | null; };
        Update: { id?: string; nome?: string; orcamento?: number; requisitos?: Json | null; avisos_compatibilidade?: string[] | null; };
      },
      /** Tabela de junção entre builds e componentes. */
      build_components: {
        Row: { build_id: string; component_id: string; created_at: string; };
        Insert: { build_id: string; component_id: string; };
        Update: {};
      }
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      /** Função RPC para deletar uma build e seus componentes associados de forma segura. */
      delete_build: { Args: { p_build_id: string; }; Returns: undefined; };
      /** Função RPC para salvar ou atualizar (upsert) uma build e seus componentes de forma atômica. */
      upsert_build_with_components: {
        Args: { p_build_id: string; p_nome: string; p_orcamento: number; p_data_criacao: string; p_requisitos: Json | null; p_avisos_compatibilidade: string[] | null; p_component_ids: string[]; };
        Returns: undefined;
      };
    };
  };
}

const supabaseUrl = SUPABASE_URL;
const supabaseAnonKey = SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey || supabaseAnonKey.startsWith('COLE_SUA_CHAVE')) {
  console.error("Variáveis Supabase ausentes ou inválidas.", { supabaseUrl, supabaseAnonKey });
  throw new Error("A URL e a Chave Anônima (Anon Key) do Supabase são necessárias. Por favor, verifique e insira os valores corretos no arquivo services/supabaseClient.ts");
}


/**
 * A instância do cliente Supabase, tipada com a estrutura do banco de dados.
 * @exports supabase
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);