-- ==============================================================================
-- SCRIPT DE ESTRUTURAÇÃO DO SUPABASE - CENTRAL FINANCEIRA MBR
-- Single-App + Single-Database + Múltiplos Usuários + Isolamento RLS por Usuário
-- ==============================================================================

-- 1. EXTENSÃO PARA UUID (Garantir suporte a uuid_generate_v4 caso necessário)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABELA DE PERFIS (PROFILES)
-- Conecta-se à tabela nativa auth.users do Supabase
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'USER')) DEFAULT 'USER',
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE')) DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- Habilitar RLS em Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para Profiles:
-- a) Qualquer usuário autenticado pode ver seu próprio perfil.
CREATE POLICY "Usuários podem ver seu próprio perfil" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = id);

-- b) Administradores (role ADMIN) podem ver todos os perfis.
CREATE POLICY "Administradores podem ver todos os perfis" 
  ON public.profiles FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- c) Usuários podem atualizar seu próprio nome e email.
CREATE POLICY "Usuários podem atualizar seu próprio perfil" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- d) Administradores podem atualizar qualquer perfil (status, role, name, email).
CREATE POLICY "Administradores podem atualizar qualquer perfil" 
  ON public.profiles FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- e) Administradores podem inserir novos perfis (durante cadastro pelo painel).
CREATE POLICY "Administradores podem inserir perfis" 
  ON public.profiles FOR INSERT 
  WITH CHECK (
    auth.uid() = id OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );


-- 3. TABELA DE TRANSAÇÕES (TRANSACTIONS)
CREATE TABLE IF NOT EXISTS public.transactions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  category TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
  module TEXT NOT NULL CHECK (module IN ('HOME', 'PERSONAL', 'BUSINESS')),
  is_fixed BOOLEAN DEFAULT FALSE,
  due_day INTEGER,
  paid BOOLEAN DEFAULT FALSE,
  payment_date TIMESTAMPTZ,
  installments JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para Transactions:
-- Usuários comuns acessam/modificam SOMENTE suas próprias transações.
-- O ADMIN NÃO POSSUI POLÍTICA DE LEITURA/ESCRITA, portanto o banco nega qualquer acesso a dados financeiros pelo Admin.

CREATE POLICY "Usuário lê apenas suas próprias transações" 
  ON public.transactions FOR SELECT 
  USING (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'USER' AND status = 'ACTIVE'
  ));

CREATE POLICY "Usuário insere apenas para si mesmo" 
  ON public.transactions FOR INSERT 
  WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'USER' AND status = 'ACTIVE'
  ));

CREATE POLICY "Usuário atualiza apenas suas próprias transações" 
  ON public.transactions FOR UPDATE 
  USING (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'USER' AND status = 'ACTIVE'
  ))
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuário deleta apenas suas próprias transações" 
  ON public.transactions FOR DELETE 
  USING (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'USER' AND status = 'ACTIVE'
  ));


-- 4. TABELA DE CATEGORIAS (CATEGORIES)
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('PERSONAL', 'BUSINESS')),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, scope, name)
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário gerencia suas próprias categorias (SELECT)" 
  ON public.categories FOR SELECT 
  USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'USER'));

CREATE POLICY "Usuário gerencia suas próprias categorias (INSERT)" 
  ON public.categories FOR INSERT 
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'USER'));

CREATE POLICY "Usuário gerencia suas próprias categorias (UPDATE)" 
  ON public.categories FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuário gerencia suas próprias categorias (DELETE)" 
  ON public.categories FOR DELETE 
  USING (auth.uid() = user_id);


-- 5. TABELA DE EMPRESAS (COMPANIES)
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário gerencia suas próprias empresas (SELECT)" 
  ON public.companies FOR SELECT 
  USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'USER'));

CREATE POLICY "Usuário gerencia suas próprias empresas (INSERT)" 
  ON public.companies FOR INSERT 
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'USER'));

CREATE POLICY "Usuário gerencia suas próprias empresas (UPDATE)" 
  ON public.companies FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuário gerencia suas próprias empresas (DELETE)" 
  ON public.companies FOR DELETE 
  USING (auth.uid() = user_id);


-- 6. TABELA DE CONFIGURAÇÕES DO USUÁRIO (USER_SETTINGS)
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  enabled_modules JSONB DEFAULT '{"personal": true, "business": true}'::jsonb,
  deleted_fixed_single JSONB DEFAULT '[]'::jsonb,
  canceled_fixed_series JSONB DEFAULT '[]'::jsonb,
  canceled_installment_series JSONB DEFAULT '[]'::jsonb,
  deleted_installment_slots JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário gerencia suas próprias configurações (SELECT)" 
  ON public.user_settings FOR SELECT 
  USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'USER'));

CREATE POLICY "Usuário gerencia suas próprias configurações (INSERT/UPDATE)" 
  ON public.user_settings FOR ALL 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- 7. TABELA DE DIAGNÓSTICOS DA IA (AI_DIAGNOSTICS)
CREATE TABLE IF NOT EXISTS public.ai_diagnostics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  period_type TEXT NOT NULL,
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ai_diagnostics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário gerencia seus diagnósticos (SELECT)" 
  ON public.ai_diagnostics FOR SELECT 
  USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'USER'));

CREATE POLICY "Usuário insere seus diagnósticos (INSERT)" 
  ON public.ai_diagnostics FOR INSERT 
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'USER'));


-- 8. TRIGGER DE BANCO DE DADOS: CRIAR PERFIL AUTOMÁTICO NA CRIAÇÃO DO AUTH USER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, status, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'USER'),
    'ACTIVE',
    NOW()
  );
  
  -- Criar linha padrão de user_settings
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ativar Trigger para novos cadastros
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
