import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Expo } from 'npm:expo-server-sdk';

const expo = new Expo({ accessToken: Deno.env.get("EXPO_ACCESS_TOKEN") });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    );

    const { record: newTransaction } = await req.json();

    if (!newTransaction || !newTransaction.area_id) {
      return new Response(JSON.stringify({ message: "No area_id found, skipping notification." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const { data: areaData, error: areaError } = await supabaseClient
      .from('group_areas')
      .select('group_id')
      .eq('area_id', newTransaction.area_id);

    if (areaError) {
      console.error('Error fetching group_areas:', areaError);
      return new Response(JSON.stringify({ error: areaError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const groupIds = (areaData || []).map((area: any) => area.group_id);

    if (groupIds.length === 0) {
      return new Response(JSON.stringify({ message: "No groups found for area" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const { data: userData, error: userError } = await supabaseClient
      .from('user_groups')
      .select('user_id')
      .in('group_id', groupIds);

    if (userError) {
      console.error('Error fetching user_groups:', userError);
      return new Response(JSON.stringify({ error: userError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const userIds = (userData || []).map((user: any) => user.user_id);

    if (userIds.length === 0) {
      return new Response(JSON.stringify({ message: "No users in groups" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('user_push_tokens')
      .select('push_token')
      .in('user_id', userIds);

    if (tokenError) {
      console.error('Error fetching user_push_tokens:', tokenError);
      return new Response(JSON.stringify({ error: tokenError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const pushTokens = (tokenData || []).map((token: any) => token.push_token);

    const messages = [];
    for (const pushToken of pushTokens) {
      if (!Expo.isExpoPushToken(pushToken)) {
        console.warn(`Push token ${pushToken} is not a valid Expo push token`);
        continue;
      }

      messages.push({
        to: pushToken,
        sound: 'default',
        channelId: 'default',
        title: 'New Transaction',
        body: `A new transaction of ₹${newTransaction.amount} has been added in area ${newTransaction.area_id}`,
        data: { transactionId: newTransaction.id },
      });
    }

    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];
    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('Error sending push notifications:', error);
      }
    }

    return new Response(JSON.stringify({ success: true, tickets }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
