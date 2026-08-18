import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hoyowraugefllhzlmyzg.supabase.co';
import fs from 'fs';
const envFile = fs.readFileSync('.env', 'utf-8');
const keyMatch = envFile.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/);
const supabaseKey = keyMatch[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const token = 'd15548c1-7b20-41ba-8b03-61415d2e4f8e';
    const { data, error } = await supabase.from('devotees').select('receipt_no').eq('id', token).single();
    console.log("Data:", data, "Error:", error);
}

check();
