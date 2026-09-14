import { useState } from 'react';

/**
 * Generic spreadsheet-like editable table.
 * columns: [{ key, label, type: 'text'|'number'|'date'|'select', options?: string[], width? }]
 */
export default function DataTable({ columns, rows, onCreate, onUpdate, onDelete, emptyLabel = '데이터가 없습니다', readOnly = false }) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({});
  const [creating, setCreating] = useState(false);
  const [newRow, setNewRow] = useState({});

  function startEdit(row) {
    setEditingId(row.id);
    setDraft({ ...row });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft({});
  }

  async function saveEdit() {
    await onUpdate(editingId, draft);
    setEditingId(null);
    setDraft({});
  }

  function startCreate() {
    const blank = {};
    for (const c of columns) blank[c.key] = c.type === 'number' ? 0 : '';
    setNewRow(blank);
    setCreating(true);
  }

  async function saveCreate() {
    await onCreate(newRow);
    setCreating(false);
    setNewRow({});
  }

  function displayValue(col, row) {
    const value = row[col.key];
    if (col.render) return col.render(value, row);
    if (typeof value === 'number' && !Number.isInteger(value)) {
      return Number(value.toFixed(3)).toString();
    }
    return String(value ?? '');
  }

  function renderInput(col, value, onChange) {
    if (col.type === 'select') {
      return (
        <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          {col.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    if (col.type === 'number') {
      return (
        <input
          type="number"
          value={value ?? 0}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
      );
    }
    if (col.type === 'date') {
      return <input type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
    }
    return <input type="text" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
  }

  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => <th key={c.key} style={{ width: c.width }}>{c.label}</th>)}
            {!readOnly && <th className="actions-col">관리</th>}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && !creating && (
            <tr><td colSpan={columns.length + (readOnly ? 0 : 1)} className="empty-row">{emptyLabel}</td></tr>
          )}
          {rows.map((row) => {
            const isEditing = !readOnly && editingId === row.id;
            return (
              <tr key={row.id} className={isEditing ? 'editing' : ''}>
                {columns.map((c) => (
                  <td key={c.key}>
                    {isEditing && !c.readOnly
                      ? renderInput(c, draft[c.key], (v) => setDraft((d) => ({ ...d, [c.key]: v })))
                      : displayValue(c, row)}
                  </td>
                ))}
                {!readOnly && (
                  <td className="actions-col">
                    {isEditing ? (
                      <>
                        <button className="btn-sm btn-primary" onClick={saveEdit}>저장</button>
                        <button className="btn-sm" onClick={cancelEdit}>취소</button>
                      </>
                    ) : (
                      <>
                        <button className="btn-sm" onClick={() => startEdit(row)}>수정</button>
                        <button className="btn-sm btn-danger" onClick={() => {
                          if (confirm('삭제하시겠습니까?')) onDelete(row.id);
                        }}>삭제</button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
          {!readOnly && creating && (
            <tr className="editing">
              {columns.map((c) => (
                <td key={c.key}>
                  {c.readOnly ? '' : renderInput(c, newRow[c.key], (v) => setNewRow((d) => ({ ...d, [c.key]: v })))}
                </td>
              ))}
              <td className="actions-col">
                <button className="btn-sm btn-primary" onClick={saveCreate}>추가</button>
                <button className="btn-sm" onClick={() => setCreating(false)}>취소</button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {!readOnly && !creating && <button className="btn-add" onClick={startCreate}>+ 행 추가</button>}
    </div>
  );
}
