export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

const notConfigured = () => Promise.reject(new Error("Google sign-in isn't configured on this deployment. Use the demo account."));

/** Inert client so the app keeps working when Supabase env vars are absent. */
export const stubClient = {
  auth: {
    getUser: async () => ({ data: { user: null }, error: null }),
    exchangeCodeForSession: async () => ({ error: new Error("Supabase is not configured") }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signInWithOAuth: notConfigured,
    signOut: async () => ({ error: null }),
  },
};
