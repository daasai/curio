import React, { useState } from 'react';
import { loginApi } from '../apiClient';

interface LoginScreenProps {
  onSuccess: () => void;
  onExit: () => void;
}

export function LoginScreen({ onSuccess, onExit }: LoginScreenProps) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (!phone || !password) {
        setErrorMsg('请填写手机号和密码');
        setLoading(false);
        return;
      }
      const res = await loginApi({ phone, password });
      if (res.error) {
        setErrorMsg(res.error.message || '登录失败');
      } else if (res.success) {
        onSuccess();
      }
    } catch (err: any) {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <button type="button" style={styles.backButton} onClick={onExit}>← 返回 DaasKit</button>
        <h2 style={styles.title}>
          试点登录
        </h2>
        {errorMsg && <div style={styles.error}>{errorMsg}</div>}
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Phone Number</label>
            <input
              style={styles.input}
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="请输入手机号"
            />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>密码</label>
            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              autoComplete="current-password"
            />
          </div>
          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
        <div style={styles.footer}>
          <p>首次使用请填写管理员提供的初始密码，登录后可自行修改。</p>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#121212',
    color: '#E0E0E0',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  card: {
    backgroundColor: '#1E1E1E',
    padding: '2rem',
    borderRadius: '8px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
    width: '100%',
    maxWidth: '400px'
  },
  backButton: {
    background: 'transparent',
    border: 'none',
    color: '#AAAAAA',
    cursor: 'pointer',
    fontSize: '0.875rem',
    marginBottom: '1.25rem',
    padding: 0
  },
  title: {
    marginTop: 0,
    marginBottom: '1.5rem',
    textAlign: 'center',
    color: '#FFFFFF'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  },
  label: {
    fontSize: '0.875rem',
    color: '#AAAAAA'
  },
  input: {
    padding: '0.75rem',
    borderRadius: '4px',
    border: '1px solid #333',
    backgroundColor: '#2D2D2D',
    color: '#FFF',
    fontSize: '1rem'
  },
  button: {
    padding: '0.75rem',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: '#4A90E2',
    color: '#FFF',
    fontSize: '1rem',
    cursor: 'pointer',
    marginTop: '0.5rem',
    fontWeight: 'bold'
  },
  error: {
    color: '#FF5252',
    backgroundColor: 'rgba(255, 82, 82, 0.1)',
    padding: '0.75rem',
    borderRadius: '4px',
    marginBottom: '1rem',
    fontSize: '0.875rem',
    textAlign: 'center'
  },
  footer: {
    marginTop: '1.5rem',
    textAlign: 'center',
    fontSize: '0.875rem',
    color: '#AAAAAA'
  },
  link: {
    color: '#4A90E2',
    cursor: 'pointer',
    textDecoration: 'underline'
  }
};
