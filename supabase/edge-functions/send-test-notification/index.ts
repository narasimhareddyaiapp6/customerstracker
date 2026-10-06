import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { Expo } from 'npm:expo-server-sdk';

const expo = new Expo({ accessToken: Deno.env.get("EXPO_ACCESS_TOKEN") });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let payload: any = {};
    try {
      const rawBody = await req.text();
      payload = rawBody ? JSON.parse(rawBody) : {};
    } catch (_) {
      payload = {};
    }

    const { push_token, title, message } = payload;

    if (!push_token) {
      return new Response(
        JSON.stringify({ error: "Missing 'push_token' in request body" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Handle Web user tokens
    if (typeof push_token === "string" && push_token.startsWith("web_")) {
      return new Response(
        JSON.stringify({
          success: true,
          type: "web",
          message: "Web notification acknowledged successfully.",
          title: title || "Test Notification",
          body: message || "This is a test notification from the app.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Validate Expo Push Token
    if (!Expo.isExpoPushToken(push_token)) {
      return new Response(
        JSON.stringify({ error: `Push token ${push_token} is not a valid Expo push token` }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    const messages = [
      {
        to: push_token,
        sound: "default",
        channelId: "default",
        title: title || "Test Notification",
        body: message || "This is a test notification from the app.",
        data: { test: true },
      },
    ];

    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];
    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error("Error sending push notifications via Expo:", error);
        return new Response(
          JSON.stringify({ error: "Error sending push notifications", details: String(error) }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
          }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: true, tickets }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: String(err?.message ?? err) }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
