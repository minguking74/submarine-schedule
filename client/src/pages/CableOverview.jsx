import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

export default function CableOverview({ cableKey }) {
  const { isAdmin } = useAuth();
  const [cable, setCable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);

  function reload() {
    setLoading(true);
    api.get(`/cables/${cableKey}`).then(setCable).finally(() => setLoading(false));
  }
  useEffect(reload, [cableKey]);

  function startEdit() {
    setDraft({
      service_year: cable.service_year,
      status: cable.status,
      summary: cable.summary,
      details: cable.details,
    });
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    try {
      const updated = await api.put(`/cables/${cableKey}`, draft);
      setCable(updated);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="loading">불러오는 중...</div>;
  if (!cable) return <div className="error-box">케이블 정보를 찾을 수 없습니다</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🌊 {cable.name}</h1>
          <div className="page-sub">
            서비스 예정 {cable.service_year || '-'}년 · 상태 {cable.status || '-'}
          </div>
        </div>
        {isAdmin && !editing && <button className="btn-sm" onClick={startEdit}>수정</button>}
      </div>

      {!editing ? (
        <>
          <div className="card">
            <h3 className="card-title">개요</h3>
            <p style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{cable.summary || '등록된 개요가 없습니다.'}</p>
          </div>
          <div className="card">
            <h3 className="card-title">상세 정보</h3>
            <p style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{cable.details || '등록된 상세 정보가 없습니다.'}</p>
          </div>
        </>
      ) : (
        <div className="card">
          <h3 className="card-title">개요 수정</h3>
          <form className="settings-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <label>
              서비스 예정 연도
              <input type="number" value={draft.service_year ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, service_year: Number(e.target.value) }))} />
            </label>
            <label>
              상태
              <input type="text" value={draft.status ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))} />
            </label>
            <label>
              개요
              <textarea rows={3} value={draft.summary ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))} />
            </label>
            <label>
              상세 정보
              <textarea rows={6} value={draft.details ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, details: e.target.value }))} />
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-sm btn-primary" type="submit" disabled={saving}>저장</button>
              <button className="btn-sm" type="button" onClick={() => setEditing(false)}>취소</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
