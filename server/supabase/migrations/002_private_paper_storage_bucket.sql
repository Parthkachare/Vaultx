INSERT INTO storage.buckets (id, name, public)
VALUES ('vaultx-papers', 'vaultx-papers', false)
ON CONFLICT (id) DO UPDATE
SET public = false;
