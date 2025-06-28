import { createClient } from '@supabase/supabase-js';
import { Build, Componente, PreferenciaUsuarioInput } from '../types';

// -----------------------------------------------------------------------------
// AÇÃO NECESSÁRIA: CONFIGURE SUA CHAVE ANÔNIMA (ANON KEY)
// -----------------------------------------------------------------------------
// Usei a URL que você forneceu para preencher o SUPABASE_URL.
// Agora, você PRECISA substituir 'YOUR_SUPABASE_ANON_KEY' pela sua chave real.
//
// 1. Vá para o painel do seu projeto Supabase: https://supabase.com/dashboard/project/gvyuakhhfqjngyyssdss
// 2. No menu, vá para Configurações (o ícone de engrenagem) > API.
// 3. Em "Project API keys", encontre a chave "anon" "pública".
// 4. Copie essa chave e cole no lugar de 'YOUR_SUPABASE_ANON_KEY' abaixo.
//
const SUPABASE_URL = 'https://gvyuakhhfqjngyyssdss.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2eXVha2hoZnFqbmd5eXNzZHNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwMDc1OTgsImV4cCI6MjA2NjU4MzU5OH0.LgpMYW34GqkRF64GjDsmc_q8jK3WoZMELwRktc197k4'; // <-- SUBSTITUA ESTA CHAVE!
// -----------------------------------------------------------------------------


// Define a type for your database schema.
// This provides type safety and autocompletion for Supabase queries.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          nome: string
          email: string
          updated_at: string
        }
        Insert: {
          id: string
          nome: string
          email: string
        }
        Update: {
          nome?: string
          email?: string
        }
      }
      components: {
        Row: Componente
        Insert: Omit<Componente, 'id'> & { id?: string }
        Update: Partial<Componente>
      }
      builds: {
        Row: {
          id: string
          created_at: string
          user_id: string
          nome: string
          orcamento: number
          data_criacao: string
          requisitos: Json | null
          avisos_compatibilidade: string[] | null
        }
        Insert: {
          id?: string
          user_id: string
          nome: string
          orcamento: number
          data_criacao: string
          requisitos?: Json | null
          avisos_compatibilidade?: string[] | null
        }
        Update: {
          id?: string
          nome?: string
          orcamento?: number
          requisitos?: Json | null
          avisos_compatibilidade?: string[] | null
        }
      }
      build_components: {
        Row: {
          build_id: string
          component_id: string
          created_at: string
        }
        Insert: {
          build_id: string
          component_id: string
        }
        Update: never
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
  }
}

// Use the variables defined above instead of process.env
const supabaseUrl = SUPABASE_URL;
const supabaseAnonKey = SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('YOUR_PROJECT_ID')) {
  throw new Error("Supabase URL and Anon Key are required. Please update them in `services/supabaseClient.ts`.");
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);