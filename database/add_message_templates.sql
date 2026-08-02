ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS chanda_confirmation_template TEXT,
ADD COLUMN IF NOT EXISTS chanda_pending_template TEXT,
ADD COLUMN IF NOT EXISTS pooja_confirmation_template TEXT,
ADD COLUMN IF NOT EXISTS pooja_reminder_template TEXT,
ADD COLUMN IF NOT EXISTS festival_greeting_template TEXT;
