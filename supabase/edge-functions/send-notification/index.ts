import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight for Option A direct invocation from app
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { record, table } = await req.json();
    if (!record || !table) {
      return new Response(
        JSON.stringify({
          error: "Missing 'record' or 'table' in payload",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
      Deno.env.get("SUPABASE_ANON_KEY") ??
      "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    let notificationMessage = "";
    let areaId = record.area_id ?? null;
    let customerId = record.customer_id ?? record.id ?? null;
    let creatorUserId = record.user_id ?? null;

    // Determine event type and extract relevant data
    if (table === "customers") {
      const customerName = record.name || "Customer";
      areaId = record.area_id;
      customerId = record.id;
      creatorUserId = record.user_id;
      notificationMessage = `New customer '${customerName}' added.`;
    } else if (table === "bank_transactions" || table === "transactions") {
      const amount = record.amount;
      customerId = record.customer_id;
      creatorUserId = record.user_id;
      areaId = record.area_id;

      // If area_id is missing from transaction record, lookup from customer
      if (!areaId && customerId) {
        const { data: customerData } = await supabase
          .from("customers")
          .select("area_id")
          .eq("id", customerId)
          .maybeSingle();
        if (customerData && customerData.area_id) {
          areaId = customerData.area_id;
        }
      }

      notificationMessage = `New transaction of ₹${amount} recorded.`;
    } else if (table === "user_expenses") {
      const amount = record.amount;
      const description =
        record.remarks || record.expense_type || record.description || "Expense";
      areaId = record.area_id;
      creatorUserId = record.user_id;
      notificationMessage = `New expense of ₹${amount} for '${description}' recorded.`;
    } else {
      return new Response(
        JSON.stringify({
          error: `Unsupported table type: ${table}`,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    console.log(`[send-notification] Event on table '${table}', areaId: ${areaId}, customerId: ${customerId}`);

    if (!areaId) {
      console.warn("[send-notification] No area_id found for record, skipping notification dispatch.");
      return new Response(
        JSON.stringify({
          message: "No area_id associated with this record. Notification skipped.",
          record,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // =========================================================================
    // TARGET USERS: Only send message to Area group Email users
    // =========================================================================

    // 1. Fetch group IDs associated with this area (both group_areas and groups table)
    let groupIds: any[] = [];

    const { data: groupAreas, error: groupAreasError } = await supabase
      .from("group_areas")
      .select("group_id")
      .eq("area_id", areaId);

    if (groupAreasError) {
      console.error("[send-notification] Error fetching group_areas:", groupAreasError);
    } else if (groupAreas && groupAreas.length > 0) {
      groupIds.push(...groupAreas.map((ga: any) => ga.group_id));
    }

    const { data: directGroups, error: directGroupsError } = await supabase
      .from("groups")
      .select("id")
      .eq("area_id", areaId);

    if (directGroupsError) {
      console.error("[send-notification] Error fetching groups by area_id:", directGroupsError);
    } else if (directGroups && directGroups.length > 0) {
      groupIds.push(...directGroups.map((g: any) => g.id));
    }

    groupIds = [...new Set(groupIds.filter(Boolean))];

    if (groupIds.length === 0) {
      console.log(`[send-notification] No groups found for areaId ${areaId}`);
      return new Response(
        JSON.stringify({
          message: `No groups linked to area ${areaId}. No notifications sent.`,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // 2. Fetch users assigned to these groups
    const { data: userGroups, error: userGroupsError } = await supabase
      .from("user_groups")
      .select("user_id")
      .in("group_id", groupIds);

    if (userGroupsError) {
      console.error("[send-notification] Error fetching user_groups:", userGroupsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch user groups" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    const rawUserIds = [...new Set((userGroups || []).map((ug: any) => ug.user_id).filter(Boolean))];

    if (rawUserIds.length === 0) {
      console.log(`[send-notification] No users assigned to groups:`, groupIds);
      return new Response(
        JSON.stringify({
          message: "No users assigned to area groups.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // 3. Filter for valid users with an email address ("Area group Email users")
    const { data: emailUsers, error: emailUsersError } = await supabase
      .from("users")
      .select("id, email")
      .in("id", rawUserIds);

    if (emailUsersError) {
      console.error("[send-notification] Error querying users table:", emailUsersError);
    }

    const validEmailUsers = (emailUsers || []).filter(
      (u: any) => u.email && typeof u.email === "string" && u.email.trim().length > 0
    );

    const targetUserIds = [...new Set(validEmailUsers.map((u: any) => u.id))];

    console.log(
      `[send-notification] Area ${areaId} group email users (${targetUserIds.length}):`,
      validEmailUsers.map((u: any) => u.email)
    );

    if (targetUserIds.length === 0) {
      return new Response(
        JSON.stringify({
          message: "No registered email users found in this Area's group.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // 4. Fetch push tokens for target users
    const { data: pushTokens, error: pushTokensError } = await supabase
      .from("user_push_tokens")
      .select("push_token, user_id")
      .in("user_id", targetUserIds);

    if (pushTokensError) {
      console.error("[send-notification] Error fetching push tokens:", pushTokensError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch push tokens" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    const uniqueTokens = [...new Set((pushTokens || []).map((pt: any) => pt.push_token).filter(Boolean))];

    if (uniqueTokens.length === 0) {
      console.log("[send-notification] No push tokens registered for area group email users.");
      return new Response(
        JSON.stringify({
          message: "No push tokens found for Area group Email users",
          targetUsersCount: targetUserIds.length,
          areaGroupEmailUsers: validEmailUsers.map((u: any) => u.email),
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // 5. Send push notifications to tokens (Supports Expo, Web & FCM fallback)
    const webTokens = uniqueTokens.filter((token: string) => token.startsWith("web_"));
    const expoTokens = uniqueTokens.filter((token: string) =>
      token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[")
    );
    const fcmTokens = uniqueTokens.filter(
      (token: string) =>
        !token.startsWith("ExponentPushToken[") &&
        !token.startsWith("ExpoPushToken[") &&
        !token.startsWith("web_")
    );

    const results: any[] = [];

    if (webTokens.length > 0) {
      results.push({ type: "web", count: webTokens.length, message: "Web users recorded for notification" });
    }

    // Send Expo push notifications
    if (expoTokens.length > 0) {
      try {
        const expoMessages = expoTokens.map((token: string) => ({
          to: token,
          sound: "default",
          channelId: "default",
          title: "New Activity Alert",
          body: notificationMessage,
          data: {
            table,
            recordId: record.id,
            areaId,
            customerId,
          },
        }));

        const expoResponse = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(expoMessages),
        });
        const expoResult = await expoResponse.json();
        results.push({ type: "expo", result: expoResult });
        console.log("[send-notification] Expo send result:", expoResult);
      } catch (err: any) {
        console.error("[send-notification] Error sending Expo push:", err);
        results.push({ type: "expo", error: err.message });
      }
    }

    // Send FCM push notifications
    if (fcmTokens.length > 0) {
      const fcmServerKey = Deno.env.get("FCM_SERVER_KEY");
      if (!fcmServerKey || fcmServerKey === "YOUR_FCM_SERVER_KEY_HERE") {
        console.warn("[send-notification] FCM_SERVER_KEY is not configured in Supabase secrets.");
        results.push({
          type: "fcm",
          warning: "FCM_SERVER_KEY is not set. Native FCM device push skipped.",
        });
      } else {
        const notificationUrl = "https://fcm.googleapis.com/fcm/send";
        for (const token of fcmTokens) {
          try {
            const fcmMessage = {
              to: token,
              notification: {
                title: "New Activity Alert",
                body: notificationMessage,
              },
              data: {
                table,
                recordId: String(record.id ?? ""),
                areaId: String(areaId ?? ""),
                customerId: String(customerId ?? ""),
              },
            };

            const fcmResponse = await fetch(notificationUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `key=${fcmServerKey}`,
              },
              body: JSON.stringify(fcmMessage),
            });
            const fcmResult = await fcmResponse.json();
            results.push({ type: "fcm", token, result: fcmResult });
            console.log("[send-notification] FCM send result:", fcmResult);
          } catch (err: any) {
            console.error("[send-notification] FCM send error:", err);
            results.push({ type: "fcm", token, error: err.message });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: "Notifications dispatched to Area group Email users",
        notificationMessage,
        areaId,
        targetEmailUsers: validEmailUsers.map((u: any) => u.email),
        targetUsersCount: targetUserIds.length,
        tokensCount: uniqueTokens.length,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("[send-notification] Edge Function error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
