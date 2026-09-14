/**
 * Pluggable LLM client. Provider/endpoint/key come entirely from env vars so the
 * internal company LLM can be wired in later without touching call sites.
 */

const NOT_CONFIGURED_MESSAGE = '챗봇 기능은 아직 사내 LLM 연동이 설정되지 않았습니다. 관리자에게 문의해 주세요.';

async function askAnthropic({ system, messages }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.LLM_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || 'claude-sonnet-5',
      max_tokens: 1024,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Anthropic API 오류 (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.content?.map((c) => c.text).join('') || '';
}

/** OpenAI-compatible chat/completions shape — the common denominator for most internal LLM gateways. */
async function askInternal({ system, messages }) {
  const base = (process.env.LLM_BASE_URL || '').replace(/\/$/, '');
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`내부 LLM API 오류 (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * @param {{ system: string, messages: {role: 'user'|'assistant', content: string}[] }} args
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
export async function askLlm({ system, messages }) {
  const provider = process.env.LLM_PROVIDER || 'none';

  if (provider === 'none' || !process.env.LLM_API_KEY) {
    return { ok: false, message: NOT_CONFIGURED_MESSAGE };
  }

  try {
    const message = provider === 'anthropic'
      ? await askAnthropic({ system, messages })
      : await askInternal({ system, messages });
    return { ok: true, message };
  } catch (err) {
    return { ok: false, message: `LLM 호출 중 오류가 발생했습니다: ${err.message}` };
  }
}
