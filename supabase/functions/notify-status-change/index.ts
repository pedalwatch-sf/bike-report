import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Called only by a pg_net trigger on suggestions (AFTER UPDATE OF status),
// authenticated by a shared secret stored in Vault (not a user JWT -- hence
// verify_jwt: false on this function). Never invoke this directly from the
// client.

const RESEND_API_URL = "https://api.resend.com/emails";
const FROM_ADDRESS = "Project PedalWatch <onboarding@resend.dev>";
const SITE_URL = "https://bike-report-omega.vercel.app";

Deno.serve(async (req: Request) => {
  try {
    const providedSecret = req.headers.get("x-webhook-secret");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: secrets, error: secretsError } = await supabase.rpc("get_notification_secrets");

    if (secretsError) {
      return new Response(`Could not load secrets: ${secretsError.message}`, { status: 500 });
    }

    const expectedSecret = secrets?.find((s: { name: string }) => s.name === "webhook_shared_secret")?.value;
    const resendApiKey = secrets?.find((s: { name: string }) => s.name === "resend_api_key")?.value;

    if (!expectedSecret || providedSecret !== expectedSecret) {
      return new Response("Unauthorized", { status: 401 });
    }
    if (!resendApiKey) {
      return new Response("Missing Resend API key", { status: 500 });
    }

    const { suggestion_id, old_status, new_status, title } = await req.json();
    if (!suggestion_id || !new_status || old_status === new_status) {
      return new Response("Nothing to do", { status: 200 });
    }

    const { data: subs, error: subsError } = await supabase
      .from("subscriber_identities")
      .select("user_id, email")
      .eq("suggestion_id", suggestion_id);

    if (subsError) {
      return new Response(`Could not load subscribers: ${subsError.message}`, { status: 500 });
    }

    const recipients = new Set<string>();
    for (const sub of subs || []) {
      if (sub.email) {
        recipients.add(sub.email);
      } else if (sub.user_id) {
        const { data: userData } = await supabase.auth.admin.getUserById(sub.user_id);
        if (userData?.user?.email) recipients.add(userData.user.email);
      }
    }

    if (recipients.size === 0) {
      return new Response("No subscribers to notify", { status: 200 });
    }

    const reportUrl = `${SITE_URL}/report/${suggestion_id}`;
    const subject = `"${title}" is now ${new_status}`;
    const text = `A report you're following on Project PedalWatch changed status.\n\n"${title}" is now ${new_status} (was ${old_status}).\n\nView it: ${reportUrl}`;

    // Sent one at a time, to each recipient's own "to" field, so
    // subscribers never see each other's email addresses.
    const results = await Promise.all(
      [...recipients].map((to) =>
        fetch(RESEND_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, text }),
        })
      )
    );

    const failures = results.filter((r) => !r.ok).length;
    return new Response(
      JSON.stringify({ sent: results.length - failures, failed: failures }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(`Error: ${err}`, { status: 500 });
  }
});
