import { User } from "@supabase/supabase-js";
import { Profile } from "@workspace/db";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      profile?: Profile;
    }
  }
}
