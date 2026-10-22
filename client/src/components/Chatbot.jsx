import { useRef, useState, useEffect } from 'react';
import { api } from '../api.js';

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [mode, setMode] = useState(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  useEffect(() => {
    if (!open || mode) return;
    api.get('/chatbot/suggestions')
      .then((res) => { setSuggestions(res.suggestions || []); setMode(res.mode); })
      .catch(() => {});
  }, [open, mode]);

  async function send(preset) {
    const text = (preset ?? input).trim();
    if (!text || loading) return;
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setInput('');
    setLoading(true);
    try {
      const res = await api.post('/chatbot', { message: text, history });
      setMessages((m) => [...m, { role: 'assistant', content: res.message, ok: res.ok, sources: res.sources || [] }]);
    } catch (err) {
      const reason = err.serverMessage || err.message;
      setMessages((m) => [...m, { role: 'assistant', content: `오류가 발생했습니다: ${reason}`, ok: false }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  }

  return (
    <>
      <button className="chatbot-fab" onClick={() => setOpen((o) => !o)} title="챗봇 열기">
        {open ? '✕' : '💬'}
      </button>
      {open && (
        <div className="chatbot-panel">
          <div className="chatbot-header">
            🤖 데이터 챗봇
            {mode && (
              <span className="chatbot-mode" title="이 챗봇은 앱 내부 데이터만 근거로 답변합니다">
                {mode === 'llm' ? 'AI · 내부 데이터 전용' : '내부 데이터 전용'}
              </span>
            )}
          </div>
          <div className="chatbot-messages" ref={listRef}>
            {messages.length === 0 && (
              <div className="chatbot-empty">
                Capacity, Lightup, Funnel, Contracts, 매출, 내부수요 등 이 앱의 내부 데이터에 대해서만 답변합니다.
                {suggestions.length > 0 && (
                  <div className="chatbot-suggestions">
                    {suggestions.map((s) => (
                      <button key={s} className="chatbot-chip" onClick={() => send(s)}>{s}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`chatbot-msg ${m.role} ${m.ok === false ? 'warn' : ''}`}>
                {m.content}
                {m.sources?.length > 0 && (
                  <div className="chatbot-sources">근거: {m.sources.join(' · ')}</div>
                )}
              </div>
            ))}
            {loading && <div className="chatbot-msg assistant">내부 데이터 조회 중...</div>}
          </div>
          <div className="chatbot-input-row">
            <textarea
              rows={1}
              value={input}
              placeholder="질문을 입력하세요"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button className="btn-sm btn-primary" onClick={() => send()} disabled={loading}>전송</button>
          </div>
        </div>
      )}
    </>
  );
}
