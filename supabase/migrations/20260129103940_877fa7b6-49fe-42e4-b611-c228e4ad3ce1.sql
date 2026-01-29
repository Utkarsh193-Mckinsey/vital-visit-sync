-- Create the signatures bucket for consent signatures
INSERT INTO storage.buckets (id, name, public)
VALUES ('signatures', 'signatures', true)
ON CONFLICT (id) DO NOTHING;

-- Add RLS policies for the signatures bucket
CREATE POLICY "Allow authenticated users to upload consent signatures"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'signatures');

CREATE POLICY "Allow public read access to consent signatures"
ON storage.objects FOR SELECT
USING (bucket_id = 'signatures');

CREATE POLICY "Allow authenticated users to update consent signatures"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'signatures');