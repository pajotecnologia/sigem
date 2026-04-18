
-- Enum for user roles
CREATE TYPE public.app_role AS ENUM ('master', 'municipal', 'operacional', 'visualizacao');

-- Enum for case status and risk
CREATE TYPE public.caso_status AS ENUM ('aberto', 'em_acompanhamento', 'encerrado');
CREATE TYPE public.caso_risco AS ENUM ('baixo', 'medio', 'alto', 'critico');
CREATE TYPE public.tipo_atendimento AS ENUM ('social', 'juridico', 'psicologico', 'medico', 'outro');

-- Municípios
CREATE TABLE public.municipios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  uf TEXT NOT NULL DEFAULT 'BR',
  codigo_ibge TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(nome, uf)
);
ALTER TABLE public.municipios ENABLE ROW LEVEL SECURITY;

-- Profiles (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_completo TEXT NOT NULL,
  email TEXT NOT NULL,
  municipio_id UUID REFERENCES public.municipios(id) ON DELETE SET NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles (separate table to avoid privilege escalation)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  municipio_id UUID REFERENCES public.municipios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role, municipio_id)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer helpers
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.is_master(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'master') $$;

CREATE OR REPLACE FUNCTION public.get_user_municipio(_user_id UUID)
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT municipio_id FROM public.profiles WHERE id = _user_id $$;

CREATE OR REPLACE FUNCTION public.can_write(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('master','municipal','operacional')) $$;

-- Mulheres (cadastro)
CREATE TABLE public.mulheres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_id UUID NOT NULL REFERENCES public.municipios(id) ON DELETE RESTRICT,
  nome_completo TEXT NOT NULL,
  cpf TEXT,
  data_nascimento DATE,
  telefone TEXT,
  cep TEXT,
  endereco TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  escolaridade TEXT,
  renda NUMERIC(12,2),
  situacao_social TEXT,
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mulheres_municipio ON public.mulheres(municipio_id);
ALTER TABLE public.mulheres ENABLE ROW LEVEL SECURITY;

-- Casos
CREATE TABLE public.casos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mulher_id UUID NOT NULL REFERENCES public.mulheres(id) ON DELETE CASCADE,
  municipio_id UUID NOT NULL REFERENCES public.municipios(id) ON DELETE RESTRICT,
  tipo_ocorrencia TEXT NOT NULL,
  grau_risco public.caso_risco NOT NULL DEFAULT 'baixo',
  status public.caso_status NOT NULL DEFAULT 'aberto',
  descricao TEXT,
  data_ocorrencia DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_casos_municipio ON public.casos(municipio_id);
CREATE INDEX idx_casos_mulher ON public.casos(mulher_id);
ALTER TABLE public.casos ENABLE ROW LEVEL SECURITY;

-- Atendimentos
CREATE TABLE public.atendimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id UUID REFERENCES public.casos(id) ON DELETE CASCADE,
  mulher_id UUID NOT NULL REFERENCES public.mulheres(id) ON DELETE CASCADE,
  municipio_id UUID NOT NULL REFERENCES public.municipios(id) ON DELETE RESTRICT,
  tipo public.tipo_atendimento NOT NULL,
  profissional_id UUID REFERENCES auth.users(id),
  data_hora TIMESTAMPTZ NOT NULL DEFAULT now(),
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_atendimentos_municipio ON public.atendimentos(municipio_id);
ALTER TABLE public.atendimentos ENABLE ROW LEVEL SECURITY;

-- Programas
CREATE TABLE public.programas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  municipio_id UUID REFERENCES public.municipios(id) ON DELETE CASCADE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.programas ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.programa_participantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programa_id UUID NOT NULL REFERENCES public.programas(id) ON DELETE CASCADE,
  mulher_id UUID NOT NULL REFERENCES public.mulheres(id) ON DELETE CASCADE,
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim DATE,
  status TEXT DEFAULT 'ativo',
  UNIQUE(programa_id, mulher_id)
);
ALTER TABLE public.programa_participantes ENABLE ROW LEVEL SECURITY;

-- Audit log
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acao TEXT NOT NULL,
  tabela TEXT,
  registro_id UUID,
  detalhes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_municipios_updated BEFORE UPDATE ON public.municipios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_mulheres_updated BEFORE UPDATE ON public.mulheres FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_casos_updated BEFORE UPDATE ON public.casos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome_completo, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome_completo', NEW.email), NEW.email);
  -- Default role: visualizacao (least privilege)
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'visualizacao');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== RLS POLICIES =====

-- Municipios: master sees all, others see only their own
CREATE POLICY "municipios_select" ON public.municipios FOR SELECT TO authenticated
USING (public.is_master(auth.uid()) OR id = public.get_user_municipio(auth.uid()));
CREATE POLICY "municipios_insert_master" ON public.municipios FOR INSERT TO authenticated
WITH CHECK (public.is_master(auth.uid()));
CREATE POLICY "municipios_update_master" ON public.municipios FOR UPDATE TO authenticated
USING (public.is_master(auth.uid())) WITH CHECK (public.is_master(auth.uid()));
CREATE POLICY "municipios_delete_master" ON public.municipios FOR DELETE TO authenticated
USING (public.is_master(auth.uid()));

-- Profiles
CREATE POLICY "profiles_select_self_or_master" ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR public.is_master(auth.uid()) OR municipio_id = public.get_user_municipio(auth.uid()));
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid() OR public.is_master(auth.uid()))
WITH CHECK (id = auth.uid() OR public.is_master(auth.uid()));
CREATE POLICY "profiles_insert_master" ON public.profiles FOR INSERT TO authenticated
WITH CHECK (public.is_master(auth.uid()) OR id = auth.uid());

-- User roles: only master manages
CREATE POLICY "user_roles_select_self_or_master" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_master(auth.uid()));
CREATE POLICY "user_roles_insert_master" ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.is_master(auth.uid()));
CREATE POLICY "user_roles_update_master" ON public.user_roles FOR UPDATE TO authenticated
USING (public.is_master(auth.uid())) WITH CHECK (public.is_master(auth.uid()));
CREATE POLICY "user_roles_delete_master" ON public.user_roles FOR DELETE TO authenticated
USING (public.is_master(auth.uid()));

-- Mulheres: tenant-scoped
CREATE POLICY "mulheres_select_tenant" ON public.mulheres FOR SELECT TO authenticated
USING (public.is_master(auth.uid()) OR municipio_id = public.get_user_municipio(auth.uid()));
CREATE POLICY "mulheres_insert_tenant" ON public.mulheres FOR INSERT TO authenticated
WITH CHECK (public.can_write(auth.uid()) AND (public.is_master(auth.uid()) OR municipio_id = public.get_user_municipio(auth.uid())));
CREATE POLICY "mulheres_update_tenant" ON public.mulheres FOR UPDATE TO authenticated
USING (public.can_write(auth.uid()) AND (public.is_master(auth.uid()) OR municipio_id = public.get_user_municipio(auth.uid())))
WITH CHECK (public.can_write(auth.uid()) AND (public.is_master(auth.uid()) OR municipio_id = public.get_user_municipio(auth.uid())));
CREATE POLICY "mulheres_delete_master_or_municipal" ON public.mulheres FOR DELETE TO authenticated
USING (public.is_master(auth.uid()) OR (public.has_role(auth.uid(),'municipal') AND municipio_id = public.get_user_municipio(auth.uid())));

-- Casos: tenant-scoped
CREATE POLICY "casos_select_tenant" ON public.casos FOR SELECT TO authenticated
USING (public.is_master(auth.uid()) OR municipio_id = public.get_user_municipio(auth.uid()));
CREATE POLICY "casos_insert_tenant" ON public.casos FOR INSERT TO authenticated
WITH CHECK (public.can_write(auth.uid()) AND (public.is_master(auth.uid()) OR municipio_id = public.get_user_municipio(auth.uid())));
CREATE POLICY "casos_update_tenant" ON public.casos FOR UPDATE TO authenticated
USING (public.can_write(auth.uid()) AND (public.is_master(auth.uid()) OR municipio_id = public.get_user_municipio(auth.uid())))
WITH CHECK (public.can_write(auth.uid()) AND (public.is_master(auth.uid()) OR municipio_id = public.get_user_municipio(auth.uid())));
CREATE POLICY "casos_delete_priv" ON public.casos FOR DELETE TO authenticated
USING (public.is_master(auth.uid()) OR (public.has_role(auth.uid(),'municipal') AND municipio_id = public.get_user_municipio(auth.uid())));

-- Atendimentos: tenant-scoped
CREATE POLICY "atend_select_tenant" ON public.atendimentos FOR SELECT TO authenticated
USING (public.is_master(auth.uid()) OR municipio_id = public.get_user_municipio(auth.uid()));
CREATE POLICY "atend_insert_tenant" ON public.atendimentos FOR INSERT TO authenticated
WITH CHECK (public.can_write(auth.uid()) AND (public.is_master(auth.uid()) OR municipio_id = public.get_user_municipio(auth.uid())));
CREATE POLICY "atend_update_tenant" ON public.atendimentos FOR UPDATE TO authenticated
USING (public.can_write(auth.uid()) AND (public.is_master(auth.uid()) OR municipio_id = public.get_user_municipio(auth.uid())))
WITH CHECK (public.can_write(auth.uid()) AND (public.is_master(auth.uid()) OR municipio_id = public.get_user_municipio(auth.uid())));
CREATE POLICY "atend_delete_priv" ON public.atendimentos FOR DELETE TO authenticated
USING (public.is_master(auth.uid()) OR (public.has_role(auth.uid(),'municipal') AND municipio_id = public.get_user_municipio(auth.uid())));

-- Programas
CREATE POLICY "prog_select_tenant" ON public.programas FOR SELECT TO authenticated
USING (public.is_master(auth.uid()) OR municipio_id IS NULL OR municipio_id = public.get_user_municipio(auth.uid()));
CREATE POLICY "prog_insert_priv" ON public.programas FOR INSERT TO authenticated
WITH CHECK (public.is_master(auth.uid()) OR (public.has_role(auth.uid(),'municipal') AND municipio_id = public.get_user_municipio(auth.uid())));
CREATE POLICY "prog_update_priv" ON public.programas FOR UPDATE TO authenticated
USING (public.is_master(auth.uid()) OR (public.has_role(auth.uid(),'municipal') AND municipio_id = public.get_user_municipio(auth.uid())))
WITH CHECK (public.is_master(auth.uid()) OR (public.has_role(auth.uid(),'municipal') AND municipio_id = public.get_user_municipio(auth.uid())));
CREATE POLICY "prog_delete_master" ON public.programas FOR DELETE TO authenticated
USING (public.is_master(auth.uid()));

CREATE POLICY "pp_select" ON public.programa_participantes FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.mulheres m WHERE m.id = mulher_id AND (public.is_master(auth.uid()) OR m.municipio_id = public.get_user_municipio(auth.uid()))));
CREATE POLICY "pp_insert" ON public.programa_participantes FOR INSERT TO authenticated
WITH CHECK (public.can_write(auth.uid()) AND EXISTS (SELECT 1 FROM public.mulheres m WHERE m.id = mulher_id AND (public.is_master(auth.uid()) OR m.municipio_id = public.get_user_municipio(auth.uid()))));
CREATE POLICY "pp_update" ON public.programa_participantes FOR UPDATE TO authenticated
USING (public.can_write(auth.uid()) AND EXISTS (SELECT 1 FROM public.mulheres m WHERE m.id = mulher_id AND (public.is_master(auth.uid()) OR m.municipio_id = public.get_user_municipio(auth.uid()))))
WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "pp_delete" ON public.programa_participantes FOR DELETE TO authenticated
USING (public.is_master(auth.uid()) OR public.has_role(auth.uid(),'municipal'));

-- Audit logs: master read, all authenticated insert
CREATE POLICY "audit_select_master" ON public.audit_logs FOR SELECT TO authenticated
USING (public.is_master(auth.uid()));
CREATE POLICY "audit_insert_self" ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
