-- 1. Criação da Tabela de Componentes
-- Armazena todos os componentes de PC disponíveis para a IA recomendar.
CREATE TABLE public.components (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tipo character varying NOT NULL,
    nome character varying NOT NULL,
    brand character varying NOT NULL,
    preco numeric(10, 2) NOT NULL,
    "imageUrl" text NULL,
    especificacao jsonb NOT NULL,
    "compatibilityKey" text NULL,
    "dataLancamento" timestamp with time zone NULL,
    "linkCompra" text NULL,
    CONSTRAINT components_pkey PRIMARY KEY (id)
);
COMMENT ON TABLE public.components IS 'Tabela para armazenar todos os componentes de PC disponíveis.';

-- 2. Tabela de Perfis de Usuário
-- Sincronizada com a tabela auth.users do Supabase.
CREATE TABLE public.profiles (
    id uuid NOT NULL,
    nome character varying NOT NULL,
    email character varying NOT NULL,
    updated_at timestamp with time zone NULL,
    CONSTRAINT profiles_pkey PRIMARY KEY (id),
    CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);
COMMENT ON TABLE public.profiles IS 'Armazena dados públicos de perfis de usuário, sincronizados com auth.users.';

-- 3. Tabela de Builds
-- Armazena as configurações de PC salvas pelos usuários.
CREATE TABLE public.builds (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    nome character varying NOT NULL,
    orcamento numeric(10, 2) NOT NULL,
    data_criacao timestamp with time zone NOT NULL DEFAULT now(),
    requisitos jsonb NULL,
    avisos_compatibilidade text[] NULL,
    CONSTRAINT builds_pkey PRIMARY KEY (id),
    CONSTRAINT builds_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);
COMMENT ON TABLE public.builds IS 'Armazena as montagens de PC salvas pelos usuários.';

-- 4. Tabela de Junção (Builds <-> Componentes)
-- Cria uma relação muitos-para-muitos entre builds e componentes.
CREATE TABLE public.build_components (
    build_id uuid NOT NULL,
    component_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT build_components_pkey PRIMARY KEY (build_id, component_id),
    CONSTRAINT build_components_build_id_fkey FOREIGN KEY (build_id) REFERENCES public.builds(id) ON DELETE CASCADE,
    CONSTRAINT build_components_component_id_fkey FOREIGN KEY (component_id) REFERENCES public.components(id) ON DELETE CASCADE
);
COMMENT ON TABLE public.build_components IS 'Tabela de junção para a relação muitos-para-muitos entre builds e componentes.';


-- 5. Função e Gatilho para Sincronização de Perfis
-- Cria um perfil automaticamente quando um novo usuário se cadastra.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'nome',
    new.email
  );
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 6. Configuração de Políticas de Segurança (Row Level Security - RLS)
-- Garante que os usuários só possam acessar e modificar seus próprios dados.

-- Habilitar RLS para todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.builds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.build_components ENABLE ROW LEVEL SECURITY;

-- Políticas para 'profiles'
CREATE POLICY "Usuários podem ver seus próprios perfis" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Usuários podem atualizar seus próprios perfis" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Políticas para 'components' (qualquer usuário autenticado pode ver)
CREATE POLICY "Usuários autenticados podem ver os componentes" ON public.components FOR SELECT TO authenticated USING (true);

-- Políticas para 'builds'
CREATE POLICY "Usuários podem ver suas próprias builds" ON public.builds FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Usuários podem criar builds para si mesmos" ON public.builds FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuários podem atualizar suas próprias builds" ON public.builds FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Usuários podem deletar suas próprias builds" ON public.builds FOR DELETE USING (auth.uid() = user_id);

-- Políticas para 'build_components'
CREATE POLICY "Usuários podem ver componentes de suas builds" ON public.build_components FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.builds
    WHERE builds.id = build_components.build_id AND builds.user_id = auth.uid()
  )
);
CREATE POLICY "Usuários podem inserir componentes em suas builds" ON public.build_components FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.builds
    WHERE builds.id = build_components.build_id AND builds.user_id = auth.uid()
  )
);
CREATE POLICY "Usuários podem deletar componentes de suas builds" ON public.build_components FOR DELETE USING (
  EXISTS (
    SELECT 1
    FROM public.builds
    WHERE builds.id = build_components.build_id AND builds.user_id = auth.uid()
  )
);

-- 7. Criação do Storage Bucket para Imagens de Componentes
-- Cria um bucket público para armazenar as imagens dos componentes.
INSERT INTO storage.buckets (id, name, public)
VALUES ('component_images', 'component_images', true)
ON CONFLICT (id) DO NOTHING;

