// Web Push sender. Deploy with verify_jwt off: pg_cron calls it with a shared secret, and the app calls
// {action: 'config'} to fetch the public VAPID key, which is safe to hand out.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const sb = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

async function secret(name: string): Promise<string | null> {
  const { data } = await sb.from('app_secrets').select('value').eq('name', name).maybeSingle();
  return data?.value ?? null;
}

// Keys are generated on first use and kept in the database, so no secret ever has to be pasted anywhere.
async function vapidKeys() {
  let pub = await secret('vapid_public');
  let priv = await secret('vapid_private');
  if (!pub || !priv) {
    const k = webpush.generateVAPIDKeys();
    await sb.from('app_secrets').upsert(
      [{ name: 'vapid_public', value: k.publicKey }, { name: 'vapid_private', value: k.privateKey }],
      { onConflict: 'name', ignoreDuplicates: true },
    );
    // Re-read: if two requests raced, both must use whichever pair landed first.
    pub = await secret('vapid_public');
    priv = await secret('vapid_private');
  }
  return { pub: pub!, priv: priv! };
}

// A reminder that's more than 30 minutes late is noise, not help.
const STALE_MS = 30 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const body = await req.json().catch(() => ({}));
  const { pub, priv } = await vapidKeys();
  if (body.action === 'config') return json({ vapidPublic: pub });

  const cron = await secret('cron_secret');
  if (!cron || req.headers.get('x-cron-secret') !== cron) return json({ error: 'forbidden' }, 403);

  webpush.setVapidDetails((await secret('site_url')) || SUPABASE_URL, pub, priv);

  // Claiming rows with a single UPDATE means two overlapping cron runs can never send the same reminder twice.
  // A claim older than five minutes belongs to a run that died, so it is taken back instead of being stuck forever.
  const now = new Date();
  const { data: due, error } = await sb.from('notifications').update({ error: 'sending', claimed_at: now.toISOString() })
    .is('sent_at', null).lte('send_at', now.toISOString())
    .or(`error.is.null,and(error.eq.sending,claimed_at.lt.${new Date(now.getTime() - 5 * 60 * 1000).toISOString()})`)
    .select('*');
  if (error) return json({ error: error.message }, 500);

  let sent = 0, stale = 0, failed = 0;
  const subsByUser = new Map<string, { endpoint: string; keys: { p256dh: string; auth: string } }[]>();

  for (const n of due ?? []) {
    try {
      if (Date.now() - new Date(n.send_at).getTime() > STALE_MS) {
        await sb.from('notifications').update({ error: 'stale' }).eq('id', n.id);
        stale++;
        continue;
      }
      if (!subsByUser.has(n.user_id)) {
        const { data } = await sb.from('push_subscriptions').select('endpoint, keys').eq('user_id', n.user_id);
        subsByUser.set(n.user_id, data ?? []);
      }
      const subs = subsByUser.get(n.user_id)!;
      if (!subs.length) {
        await sb.from('notifications').update({ error: 'no device' }).eq('id', n.id);
        failed++;
        continue;
      }
      const payload = JSON.stringify({ title: n.title, body: n.body ?? '', url: n.url ?? './#today', tag: n.block_id ? `${n.day}:${n.block_id}` : undefined });
      let delivered = false;
      for (const s of subs) {
        try {
          // A push service that never answers would otherwise hold every reminder behind it until the function is killed.
          await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: 1800, urgency: 'high', timeout: 10000 });
          delivered = true;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          // 404/410 mean the browser dropped this subscription for good.
          if (code === 404 || code === 410) await sb.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
        }
      }
      await sb.from('notifications').update(delivered ? { sent_at: new Date().toISOString(), error: null } : { error: 'push failed' }).eq('id', n.id);
      delivered ? sent++ : failed++;
    } catch (e) {
      await sb.from('notifications').update({ error: `failed: ${(e as Error).message}`.slice(0, 200) }).eq('id', n.id);
      failed++;
    }
  }

  return json({ sent, stale, failed });
});
