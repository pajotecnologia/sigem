-- Storage bucket for documents (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('mulheres-docs', 'mulheres-docs', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies on storage.objects for mulheres-docs bucket
-- Path convention: {municipio_id}/{mulher_id}/{filename}

CREATE POLICY "mulheres_docs_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'mulheres-docs' AND (
    public.is_master(auth.uid())
    OR (storage.foldername(name))[1] = public.get_user_municipio(auth.uid())::text
  )
);

CREATE POLICY "mulheres_docs_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'mulheres-docs'
  AND public.can_write(auth.uid())
  AND (
    public.is_master(auth.uid())
    OR (storage.foldername(name))[1] = public.get_user_municipio(auth.uid())::text
  )
);

CREATE POLICY "mulheres_docs_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'mulheres-docs'
  AND public.can_write(auth.uid())
  AND (
    public.is_master(auth.uid())
    OR (storage.foldername(name))[1] = public.get_user_municipio(auth.uid())::text
  )
);

CREATE POLICY "mulheres_docs_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'mulheres-docs'
  AND (
    public.is_master(auth.uid())
    OR (public.has_role(auth.uid(), 'municipal'::app_role)
        AND (storage.foldername(name))[1] = public.get_user_municipio(auth.uid())::text)
  )
);

-- Trigger to keep mulheres.updated_at fresh
DROP TRIGGER IF EXISTS trg_mulheres_updated_at ON public.mulheres;
CREATE TRIGGER trg_mulheres_updated_at
BEFORE UPDATE ON public.mulheres
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();