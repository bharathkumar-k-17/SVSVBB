import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials are not set in the environment variables. Please provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY inside a .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
