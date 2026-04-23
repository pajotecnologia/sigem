
-- Templates de mensagens
CREATE TYPE public.mensagem_categoria AS ENUM ('boas_vindas','acompanhamento','lembrete','aniversario','outro');
CREATE TYPE public.mensagem_status AS ENUM ('pendente','enviada','falhou','lida','agendada');

CREATE TABLE public.mensagens_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_id uuid REFERENCES public.municipios(id) ON DELETE CASCADE,
  nome text NOT NULL,
  categoria public.mensagem_categoria NOT NULL DEFAULT 'outro',
  conteudo text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mensagens_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY tpl_select ON public.mensagens_templates FOR SELECT TO authenticated
USING (is_master(auth.uid()) OR municipio_id IS NULL OR municipio_id = get_user_municipio(auth.uid()));

CREATE POLICY tpl_insert ON public.mensagens_templates FOR INSERT TO authenticated
WITH CHECK (is_master(auth.uid()) OR (has_role(auth.uid(),'municipal') AND municipio_id = get_user_municipio(auth.uid())));

CREATE POLICY tpl_update ON public.mensagens_templates FOR UPDATE TO authenticated
USING (is_master(auth.uid()) OR (has_role(auth.uid(),'municipal') AND municipio_id = get_user_municipio(auth.uid())))
WITH CHECK (is_master(auth.uid()) OR (has_role(auth.uid(),'municipal') AND municipio_id = get_user_municipio(auth.uid())));

CREATE POLICY tpl_delete ON public.mensagens_templates FOR DELETE TO authenticated
USING (is_master(auth.uid()) OR (has_role(auth.uid(),'municipal') AND municipio_id = get_user_municipio(auth.uid())));

CREATE TRIGGER trg_tpl_updated BEFORE UPDATE ON public.mensagens_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Mensagens enviadas/agendadas
CREATE TABLE public.mensagens_enviadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mulher_id uuid NOT NULL REFERENCES public.mulheres(id) ON DELETE CASCADE,
  municipio_id uuid NOT NULL REFERENCES public.municipios(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.mensagens_templates(id) ON DELETE SET NULL,
  categoria public.mensagem_categoria NOT NULL DEFAULT 'outro',
  conteudo text NOT NULL,
  status public.mensagem_status NOT NULL DEFAULT 'pendente',
  agendada_para timestamptz,
  enviada_em timestamptz,
  erro text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mensagens_enviadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY msg_select ON public.mensagens_enviadas FOR SELECT TO authenticated
USING (is_master(auth.uid()) OR municipio_id = get_user_municipio(auth.uid()));

CREATE POLICY msg_insert ON public.mensagens_enviadas FOR INSERT TO authenticated
WITH CHECK (can_write(auth.uid()) AND (is_master(auth.uid()) OR municipio_id = get_user_municipio(auth.uid())));

CREATE POLICY msg_update ON public.mensagens_enviadas FOR UPDATE TO authenticated
USING (can_write(auth.uid()) AND (is_master(auth.uid()) OR municipio_id = get_user_municipio(auth.uid())))
WITH CHECK (can_write(auth.uid()) AND (is_master(auth.uid()) OR municipio_id = get_user_municipio(auth.uid())));

CREATE POLICY msg_delete ON public.mensagens_enviadas FOR DELETE TO authenticated
USING (is_master(auth.uid()) OR (has_role(auth.uid(),'municipal') AND municipio_id = get_user_municipio(auth.uid())));

CREATE INDEX idx_msg_municipio_data ON public.mensagens_enviadas(municipio_id, created_at DESC);
CREATE INDEX idx_msg_mulher ON public.mensagens_enviadas(mulher_id);

-- Evolution API config (uma config por municipio)
CREATE TABLE public.evolution_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_id uuid NOT NULL UNIQUE REFERENCES public.municipios(id) ON DELETE CASCADE,
  api_url text NOT NULL,
  api_token text NOT NULL,
  instance_name text NOT NULL,
  webhook_url text,
  ativo boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.evolution_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY evo_select ON public.evolution_config FOR SELECT TO authenticated
USING (is_master(auth.uid()) OR (has_role(auth.uid(),'municipal') AND municipio_id = get_user_municipio(auth.uid())));

CREATE POLICY evo_insert ON public.evolution_config FOR INSERT TO authenticated
WITH CHECK (is_master(auth.uid()) OR (has_role(auth.uid(),'municipal') AND municipio_id = get_user_municipio(auth.uid())));

CREATE POLICY evo_update ON public.evolution_config FOR UPDATE TO authenticated
USING (is_master(auth.uid()) OR (has_role(auth.uid(),'municipal') AND municipio_id = get_user_municipio(auth.uid())))
WITH CHECK (is_master(auth.uid()) OR (has_role(auth.uid(),'municipal') AND municipio_id = get_user_municipio(auth.uid())));

CREATE POLICY evo_delete ON public.evolution_config FOR DELETE TO authenticated
USING (is_master(auth.uid()));

CREATE TRIGGER trg_evo_updated BEFORE UPDATE ON public.evolution_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
