import { useState } from 'react';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { login } = useAuth();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('이름을 입력해 주세요');
    setLoading(true);
    try {
      await login(name.trim(), password);
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
          이름
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <label>
          비밀번호
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>

        {error && <div className="error-box">{error}</div>}

        <button className="btn-sm btn-primary" type="submit" disabled={loading} style={{ marginTop: 8 }}>
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </form>
    </div>
  );
}
