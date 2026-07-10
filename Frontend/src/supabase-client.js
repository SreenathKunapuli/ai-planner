import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_KEY — copy Frontend/.env.example to Frontend/.env and fill it in."
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
