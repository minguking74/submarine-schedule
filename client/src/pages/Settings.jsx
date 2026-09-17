import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import DataTable from '../components/DataTable.jsx';
import { useAuth } from '../auth.jsx';

const KPI_COLUMNS = [
  { key: 'year', label: '연도', type: 'number' },
  { key: 'memo', label: '메모', type: 'text' },
];

const TABLE_LABELS = {
  capacity_design: 'Capacity Design',
  capacity_phase: 'Capacity Phase (단계별 용량)',
  lightup_schedule: 'Lightup Schedule',
  funnel: 'Funnel',
  kpis: 'KPI 메모',
  internal_demand_s: '내부수요 Segment S',
  internal_demand_l: '내부수요 Segment L',
  contracts: 'Contracts (계약)',
};

export default function Settings() {
  const { isAdmin } = useAuth();
  const [fxRate, setFxRate] = useState(1380);
  const [savedMsg, setSavedMsg] = useState('');
  const [kpis, setKpis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef(null);

  function reload() {
    Promise.all([api.get('/settings'), api.get('/kpis')])
      .then(([s, k]) => { setFxRate(s.fx_rate); setKpis(k); })
      .finally(() => setLoading(false));
  }
  useEffect(reload, []);

  async function saveFxRate(e) {
    e.preventDefault();
    await api.put('/settings', { fx_rate: fxRate });
    setSavedMsg('저장되었습니다');
    setTimeout(() => setSavedMsg(''), 2000);
  }

  async function downloadExcel() {
    setDownloading(true);
    try {
      const blob = await api.getBlob('/data-io/export');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SJC2_Capacity_Schedule_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setImportError(err.message);
    } finally {
      setDownloading(false);
    }
  }

  async function uploadExcel(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    setImportError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.postForm('/data-io/import', formData);
      setImportResult(res.results);
      reload();
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  if (loading) return <div className="loading">불러오는 중...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">⚙️ 설정</h1>
          <div className="page-sub">환율 기준값과 연도별 KPI 메모를 관리합니다</div>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">₩/$ 기준환율</h3>
        <form className="settings-form" onSubmit={saveFxRate}>
          <label>
            기준환율 (KRW per USD)
            <input type="number" value={fxRate} disabled={!isAdmin} onChange={(e) => setFxRate(Number(e.target.value))} />
          </label>
          {isAdmin && <button className="btn-sm btn-primary" type="submit" style={{ width: 'fit-content' }}>저장</button>}
          {savedMsg && <span style={{ color: '#5ee6a0', fontSize: 12 }}>{savedMsg}</span>}
        </form>
      </div>

      <div className="card">
        <h3 className="card-title">엑셀 일괄 다운로드 / 업로드</h3>
        <div className="page-sub">
          전체 데이터를 시트별로 엑셀 파일 하나에 담아 내려받아 보고용으로 전달할 수 있습니다. Dashboard 시트는
          다른 시트를 참조하는 수식으로 계산되어 있어 Contracts/Lightup/Funnel 등의 값을 엑셀에서 직접 고쳐보며
          확인할 수 있습니다. 전달받은 파일에서 값을 수정한 뒤 다시 업로드하면 변경/추가된 행만 반영됩니다
          (기존 행은 A열의 ID로 식별하니 ID 값은 바꾸지 마세요. 시트에서 지운 행은 삭제되지 않고, Dashboard 시트는
          참고용이라 업로드해도 반영되지 않습니다).
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
          <button className="btn-sm btn-primary" onClick={downloadExcel} disabled={downloading}>
            {downloading ? '다운로드 중...' : '⬇️ 전체 엑셀 다운로드'}
          </button>
          {isAdmin && (
            <>
              <button className="btn-sm" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                {importing ? '업로드 중...' : '⬆️ 엑셀 업로드 (변경 반영)'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                style={{ display: 'none' }}
                onChange={uploadExcel}
              />
            </>
          )}
        </div>
        {importError && <div style={{ color: '#ff6b6b', fontSize: 12, marginTop: 8 }}>오류: {importError}</div>}
        {importResult && (
          <ul style={{ marginTop: 12, fontSize: 13, lineHeight: 1.8 }}>
            {importResult.map((r) => (
              <li key={r.table}>
                {TABLE_LABELS[r.table] || r.table}: 추가 {r.created}건, 수정 {r.updated}건, 변경없음 {r.unchanged}건
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3 className="card-title">연도별 KPI 메모</h3>
        <DataTable
          readOnly={!isAdmin}
          columns={KPI_COLUMNS}
          rows={kpis}
          onCreate={async (v) => { await api.post('/kpis', v); reload(); }}
          onUpdate={async (id, v) => { await api.put(`/kpis/${id}`, v); reload(); }}
          onDelete={async (id) => { await api.del(`/kpis/${id}`); reload(); }}
        />
      </div>
    </div>
  );
}
