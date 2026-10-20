import { supabase } from "@/integrations/supabase/client";

export interface PinCheckResult {
  ok: boolean;
  /** Message to show the user when the PIN was not accepted. */
  error?: string;
  /** Who approved it, for the confirmation message. */
  managerName?: string | null;
}

/**
 * Check a manager PIN before a cancellation, refund, void or discount.
 *
 * The check happens on the server on purpose. Managers' PINs must never be sent
 * to a till, so the browser only ever learns yes or no. Repeated wrong guesses
 * are blocked server-side, because a 4-digit PIN has only 10,000 combinations.
 */
export const verifyManagerPin = async (
  pin: string,
  branchId: string | null,
): Promise<PinCheckResult> => {
  if (!/^[0-9]{4}$/.test(pin)) {
    return { ok: false, error: "Enter the 4-digit manager PIN" };
  }
  if (!branchId) {
    return { ok: false, error: "No branch selected. Start a shift first." };
  }

  const { data, error } = await supabase.functions.invoke("verify-manager-pin", {
    body: { pin, branch_id: branchId },
  });

  if (error) {
    return { ok: false, error: "Could not check the PIN. Please try again." };
  }
  if (!data?.ok) {
    return { ok: false, error: data?.error || "That PIN is not valid for this branch" };
  }
  return { ok: true, managerName: data.manager_name ?? null };
};
