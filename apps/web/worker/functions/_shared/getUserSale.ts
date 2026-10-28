import { type User } from "@supabase/supabase-js";
import { supabaseAdmin } from "./supabaseAdmin";

/**
 * Get the sale associated to the provided user.
 */
export const getUserSale = async (user: User) => {
  return (
    await supabaseAdmin
      .from("sales")
      .select("*")
      .eq("user_id", user.id)
      .single()
  )?.data;
};
