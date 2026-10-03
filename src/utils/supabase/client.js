import { createBrowserClient } from "@supabase/ssr";
import { supabaseUrl, supabaseKey, isSupabaseConfigured, stubClient } from "./config";

export const createClient = () => (isSupabaseConfigured ? createBrowserClient(supabaseUrl, supabaseKey) : stubClient);
