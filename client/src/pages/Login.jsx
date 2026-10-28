import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!/^\d{4}$/.test(name)) return setError('사번은 숫자 4자리로 입력해 주세요 (예: 4220)');
    setLoading(true);
    try {
      await login(name.trim(), password, 'admin');
      navigate('/', { replace: true });
    } catch (err) {
      if (err.status === 401) setError('로그인에 실패했습니다. 비밀번호를 확인해 주세요.');
      else if (err.status && err.serverMessage) setError(err.serverMessage);
      else setError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="brand-icon" style={{ fontSize: 32 }}>🛰️</div>
        <h1 className="page-title" style={{ marginBottom: 4 }}>Submarine Schedule</h1>
        <div className="page-sub" style={{ marginBottom: 20 }}>조회는 로그인 없이 가능합니다. 데이터를 수정하려면 관리자로 로그인하세요.</div>

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

        {error && <div className="error-box">{error}</div>}

        <button className="btn-sm btn-primary" type="submit" disabled={loading} style={{ marginTop: 8 }}>
          {loading ? '로그인 중...' : '관리자 로그인'}
        </button>
        <button className="btn-sm" type="button" onClick={() => navigate('/')}>
          취소하고 대시보드로
        </button>
      </form>
    </div>
  );
}
