ALTER TABLE subscribers
  ADD COLUMN IF NOT EXISTS unsubscribe_token uuid DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  ADD COLUMN IF NOT EXISTS alerts_enabled boolean DEFAULT true NOT NULL;
