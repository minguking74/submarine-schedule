import { useState } from 'react';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { login } = useAuth();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('viewer');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!/^\d{4}$/.test(name)) return setError('사번은 숫자 4자리로 입력해 주세요 (예: 4220)');
    setLoading(true);
    try {
      await login(name.trim(), password, role);
    } catch (err) {
      setError('로그인에 실패했습니다. 비밀번호를 확인해 주세요.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="brand-icon" style={{ fontSize: 32 }}>🛰️</div>
        <h1 className="page-title" style={{ marginBottom: 4 }}>Submarine Schedule</h1>
        <div className="page-sub" style={{ marginBottom: 20 }}>로그인 후 이용해 주세요</div>

        <label>
          사번
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            placeholder="4220"
            value={name}
            onChange={(e) => setName(e.target.value.replace(/\D/g, '').slice(0, 4))}
            autoFocus
          />
        </label>
        <label>
          비밀번호
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label>
          권한
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="viewer">viewer</option>
            <option value="admin">admin</option>
          </select>
        </label>

        {error && <div className="error-box">{error}</div>}

        <button className="btn-sm btn-primary" type="submit" disabled={loading} style={{ marginTop: 8 }}>
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </form>
    </div>
  );
}
