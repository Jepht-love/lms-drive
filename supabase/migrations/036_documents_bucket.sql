-- Migration 036 — Bucket Storage manquant pour la bibliothèque documentaire
-- Exécuter dans : Supabase Dashboard > SQL Editor
--
-- La table `documents` existe depuis la migration 013, mais le bucket Storage
-- qu'utilise lib/actions/documents.ts (uploadDocument) n'a jamais été créé —
-- contrairement à vehicle-photos / client-documents / contracts-pdf /
-- vehicle-reference, posés dans 002_rls_policies.sql. D'où "Upload échoué :
-- Bucket not found" à chaque tentative d'ajout de document.
-- Privé (comme les autres buckets) : l'app sert les fichiers via getPublicUrl
-- seulement après vérification des droits côté DocumentsClient (catégories
-- sensibles filtrées par rôle).

INSERT INTO storage.buckets (id, name, public) VALUES
  ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "auth_documents" ON storage.objects FOR ALL
  USING (bucket_id = 'documents' AND auth.uid() IS NOT NULL);
