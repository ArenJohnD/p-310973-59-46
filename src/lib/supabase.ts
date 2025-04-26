import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://jwxrtvuyerntqiqyqbsz.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3eHJ0dnV5ZXJudHFpcXlxYnN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM5MzIzNDcsImV4cCI6MjA1OTUwODM0N30.55KgUK0VmWpp_mktAXlM_7hxNf67PdfdR9k1bYvHw08";

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey); 