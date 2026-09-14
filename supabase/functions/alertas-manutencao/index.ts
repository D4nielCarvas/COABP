// supabase/functions/alertas-manutencao/index.ts
// ═══════════════════════════════════════════════════════════════════
// Edge Function: Alertas de Manutenção por E-mail
// Disparo: Invoke via cron (pg_cron) ou chamada HTTP agendada
//
// Regras de negócio:
//   ≥ 7 dias aberta  → e-mail de ATENÇÃO ao responsável
//   ≥ 14 dias aberta → e-mail de ATRASO ao responsável
//
// Variáveis de ambiente necessárias no Supabase:
//   SUPABASE_URL          (automático na Edge Function)
//   SUPABASE_SERVICE_KEY  (chave service_role — configurar em Secrets)
//   RESEND_API_KEY        (chave da API Resend para envio de e-mail)
//   EMAIL_FROM            (ex: "COA Manutenções <noreply@seudominio.com>")
// ═══════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_KEY') ?? '';
const RESEND_API_KEY   = Deno.env.get('RESEND_API_KEY')!;
const EMAIL_FROM       = Deno.env.get('EMAIL_FROM') ?? 'COA Manutenções <noreply@coa.com.br>';

// ── Tipos ─────────────────────────────────────────────────────────
interface Manutencao {
  id: string;
  titulo: string;
  status: string;
  categoria: string;
  fazenda?: string;
  frota?: string;
  equipamento?: string;
  solicitante_nome?: string;
  responsavel_nome?: string;
  responsavel_id?: string;
  data_solicitacao: string;
  created_at: string;
}

// ── Busca manutenções abertas há ≥ minDays ────────────────────────
async function fetchManutencoes(minDays: number, maxDays?: number): Promise<Manutencao[]> {
  const minDate = new Date();
  minDate.setDate(minDate.getDate() - minDays);

  let filter = `status=in.(Na Fila,Em Andamento,Aguardando Terceiro)&data_solicitacao=lte.${minDate.toISOString()}`;

  if (maxDays !== undefined) {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() - maxDays);
    // Entre maxDays e minDays → janela exata para não duplicar alertas
    filter += `&data_solicitacao=gte.${maxDate.toISOString()}`;
  }

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/manutencoes?${filter}&select=*`,
    {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase query error: ${text}`);
  }
  return res.json();
}

// ── Busca e-mail do usuário por ID ────────────────────────────────
async function fetchUserEmail(userId: string): Promise<string | null> {
  if (!userId) return null;
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users/${userId}`,
    {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.email ?? null;
}

// ── Envia e-mail via Resend API ───────────────────────────────────
async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`Erro ao enviar e-mail para ${to}: ${text}`);
  } else {
    console.log(`✅ E-mail enviado para ${to} — ${subject}`);
  }
}

// ── Templates de e-mail ───────────────────────────────────────────
function emailAtencao(m: Manutencao, diasAberta: number): { subject: string; html: string } {
  const subject = `⚠️ Atenção: Manutenção "${m.titulo}" aberta há ${diasAberta} dias`;
  const html = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0c120e; color: #f1f5f9; border-radius: 12px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #f97316, #10b981); padding: 24px 28px;">
        <h1 style="margin: 0; font-size: 20px; color: #fff;">🚜 COA — Sistema de Manutenções</h1>
        <p style="margin: 4px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">Alerta Automático</p>
      </div>
      <div style="padding: 28px; background: #121b15;">
        <div style="background: rgba(249,115,22,0.12); border: 1px solid rgba(249,115,22,0.4); border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 4px; font-size: 16px; color: #fb923c;">⚠️ Manutenção em Atenção</h2>
          <p style="margin: 0; font-size: 13px; color: #94a3b8;">Esta manutenção está aberta há <strong style="color: #fb923c;">${diasAberta} dias</strong> sem conclusão.</p>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr><td style="padding: 8px 0; color: #64748b; width: 140px;">Título</td><td style="color: #f1f5f9; font-weight: 600;">${m.titulo}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Status</td><td><span style="background: rgba(249,115,22,0.2); color: #fb923c; padding: 2px 10px; border-radius: 20px; font-size: 12px;">${m.status}</span></td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Fazenda</td><td style="color: #f1f5f9;">${m.fazenda ?? '—'}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Frota</td><td style="color: #f1f5f9;">${m.frota ?? '—'}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Equipamento</td><td style="color: #f1f5f9;">${m.equipamento ?? '—'}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Solicitante</td><td style="color: #f1f5f9;">${m.solicitante_nome ?? '—'}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Abertura</td><td style="color: #f1f5f9;">${new Date(m.data_solicitacao).toLocaleString('pt-BR')}</td></tr>
        </table>
        <div style="margin-top: 28px; text-align: center;">
          <p style="color: #64748b; font-size: 12px; margin: 0;">Por favor, atualize o status ou conclua esta manutenção no sistema COA.</p>
        </div>
      </div>
    </div>
  `;
  return { subject, html };
}

function emailAtraso(m: Manutencao, diasAberta: number): { subject: string; html: string } {
  const subject = `🚨 Atraso Crítico: Manutenção "${m.titulo}" aberta há ${diasAberta} dias`;
  const html = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0c120e; color: #f1f5f9; border-radius: 12px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #dc2626, #f97316); padding: 24px 28px;">
        <h1 style="margin: 0; font-size: 20px; color: #fff;">🚜 COA — Sistema de Manutenções</h1>
        <p style="margin: 4px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">⚠️ Alerta Crítico de Atraso</p>
      </div>
      <div style="padding: 28px; background: #121b15;">
        <div style="background: rgba(220,38,38,0.12); border: 1px solid rgba(220,38,38,0.5); border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 4px; font-size: 16px; color: #f87171;">🚨 Manutenção em Atraso</h2>
          <p style="margin: 0; font-size: 13px; color: #94a3b8;">Esta manutenção está aberta há <strong style="color: #f87171;">${diasAberta} dias</strong> e está em <strong style="color: #f87171;">ATRASO CRÍTICO</strong>. Ação imediata necessária.</p>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr><td style="padding: 8px 0; color: #64748b; width: 140px;">Título</td><td style="color: #f1f5f9; font-weight: 600;">${m.titulo}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Status</td><td><span style="background: rgba(220,38,38,0.2); color: #f87171; padding: 2px 10px; border-radius: 20px; font-size: 12px;">${m.status}</span></td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Fazenda</td><td style="color: #f1f5f9;">${m.fazenda ?? '—'}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Frota</td><td style="color: #f1f5f9;">${m.frota ?? '—'}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Equipamento</td><td style="color: #f1f5f9;">${m.equipamento ?? '—'}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Solicitante</td><td style="color: #f1f5f9;">${m.solicitante_nome ?? '—'}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Abertura</td><td style="color: #f1f5f9;">${new Date(m.data_solicitacao).toLocaleString('pt-BR')}</td></tr>
        </table>
        <div style="margin-top: 28px; padding: 16px; background: rgba(220,38,38,0.08); border-radius: 8px; text-align: center;">
          <p style="color: #f87171; font-size: 13px; font-weight: 600; margin: 0;">⚡ Ação imediata requerida — acesse o sistema COA e resolva esta manutenção.</p>
        </div>
      </div>
    </div>
  `;
  return { subject, html };
}

// ── Handler principal ─────────────────────────────────────────────
serve(async (req) => {
  // Aceitar GET (cron) e POST (manual)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const log: string[] = [];
  let emailsEnviados = 0;
  let erros = 0;

  try {
    // Manutenções em ATRASO: ≥ 14 dias (sem limite superior — notifica todo dia)
    const emAtraso = await fetchManutencoes(14);
    log.push(`Manutenções em atraso (≥14 dias): ${emAtraso.length}`);

    for (const m of emAtraso) {
      const diasAberta = Math.floor((Date.now() - new Date(m.data_solicitacao).getTime()) / 86_400_000);
      if (!m.responsavel_id) {
        log.push(`  SKIP [${m.id}] sem responsavel_id`);
        continue;
      }
      const email = await fetchUserEmail(m.responsavel_id);
      if (!email) {
        log.push(`  SKIP [${m.id}] e-mail não encontrado`);
        continue;
      }
      const { subject, html } = emailAtraso(m, diasAberta);
      try {
        await sendEmail(email, subject, html);
        emailsEnviados++;
        log.push(`  ✅ Atraso → ${email} (${diasAberta} dias) — "${m.titulo}"`);
      } catch {
        erros++;
        log.push(`  ❌ Falha ao enviar para ${email}`);
      }
    }

    // Manutenções de ATENÇÃO: entre 7 e 13 dias (janela para não duplicar com atraso)
    const emAtencao = await fetchManutencoes(7, 14);
    log.push(`Manutenções em atenção (7–13 dias): ${emAtencao.length}`);

    for (const m of emAtencao) {
      const diasAberta = Math.floor((Date.now() - new Date(m.data_solicitacao).getTime()) / 86_400_000);
      if (!m.responsavel_id) {
        log.push(`  SKIP [${m.id}] sem responsavel_id`);
        continue;
      }
      const email = await fetchUserEmail(m.responsavel_id);
      if (!email) {
        log.push(`  SKIP [${m.id}] e-mail não encontrado`);
        continue;
      }
      const { subject, html } = emailAtencao(m, diasAberta);
      try {
        await sendEmail(email, subject, html);
        emailsEnviados++;
        log.push(`  ✅ Atenção → ${email} (${diasAberta} dias) — "${m.titulo}"`);
      } catch {
        erros++;
        log.push(`  ❌ Falha ao enviar para ${email}`);
      }
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ ok: false, error: msg, log }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({ ok: true, emailsEnviados, erros, log }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});
