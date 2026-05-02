export function useAuth() {
  return {
    user: null,
    session: null,
    isLoading: false,
    signIn: async (_email: string, _password: string) => {
      /* TODO (Phase 1.5): wire to Supabase Auth — supabase.auth.signInWithPassword({ email, password }) */
    },
    signUp: async (_email: string, _password: string) => {
      /* TODO (Phase 1.5): wire to Supabase Auth — supabase.auth.signUp({ email, password }) */
    },
    signOut: async () => {
      /* TODO (Phase 1.5): wire to Supabase Auth — supabase.auth.signOut() */
    },
  };
}
