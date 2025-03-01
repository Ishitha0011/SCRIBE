import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pniabhfwholqiuccypmp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuaWFiaGZ3aG9scWl1Y2N5cG1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA0MTk3NTUsImV4cCI6MjA1NTk5NTc1NX0.tIrQZnGdNvhf-K1z6cSrz8hhaFt3dFdNQZAQLskFDjs';

export const supabase = createClient(supabaseUrl, supabaseAnonKey); 
