import { useRef, useState, useEffect } from 'react';
import { api } from '../api.js';

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setInput('');
    setLoading(true);
    try {
      const res = await api.post('/chatbot', { message: text, history });
      setMessages((m) => [...m, { role: 'assistant', content: res.message, ok: res.ok }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: `오류가 발생했습니다: ${err.message}`, ok: false }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
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
          <div className="chatbot-header">🤖 데이터 챗봇</div>
          <div className="chatbot-messages" ref={listRef}>
            {messages.length === 0 && (
              <div className="chatbot-empty">
                Capacity, Lightup, Contracts, 매출 등 이 대시보드 데이터에 대해 물어보세요.
                <br />예: "Segment S 가용 용량 얼마나 남았어?"
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`chatbot-msg ${m.role} ${m.ok === false ? 'warn' : ''}`}>
                {m.content}
              </div>
            ))}
            {loading && <div className="chatbot-msg assistant">생각 중...</div>}
          </div>
          <div className="chatbot-input-row">
            <textarea
              rows={1}
              value={input}
              placeholder="질문을 입력하세요"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button className="btn-sm btn-primary" onClick={send} disabled={loading}>전송</button>
          </div>
        </div>
      )}
    </>
  );
}
