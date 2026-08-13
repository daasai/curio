import React, { useEffect, useState } from 'react';
import { changePasswordApi, getLearningSnapshotApi, getMeApi } from '../apiClient';
import { useAppStore } from '../store';

export function PasswordSettings({ onClose }: { onClose: () => void }) {
  const loadSnapshot = useAppStore((state) => state.loadSnapshot);
  const [mustChange, setMustChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getMeApi().then((result) => setMustChange(Boolean(result?.user?.mustChangePassword)));
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    setError('');
    if (newPassword.length < 8 || newPassword.length > 72) return setError('新密码需为 8–72 个字符。');
    if (newPassword !== confirmPassword) return setError('两次输入的新密码不一致。');
    setSaving(true);
    try {
      const result = await changePasswordApi({ currentPassword, newPassword });
      if (result?.success) {
        setMessage('密码已更新。下次请使用新密码登录。');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setMustChange(false);
        const snapshot = await getLearningSnapshotApi();
        if (snapshot) loadSnapshot(snapshot);
      } else {
        setError(result?.error?.message || '密码更新失败，请重试。');
      }
    } catch {
      setError('网络异常，请稍后重试。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="screen" style={{ alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <main className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '28px' }}>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>← 返回首页</button>
        <h2 style={{ marginTop: '16px' }}>账户与密码</h2>
        <p style={{ fontSize: '0.9rem', marginTop: '8px' }}>{mustChange ? '你正在使用初始密码，请先设置自己的密码。' : '可随时修改登录密码。'}</p>
        {error && <p role="alert" style={{ color: 'var(--accent-coral)', marginTop: '16px' }}>{error}</p>}
        {message && <p role="status" style={{ color: 'var(--accent-teal)', marginTop: '16px' }}>{message}</p>}
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '22px' }}>
          <label className="account-password-label">当前密码<input className="account-password-input" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required /></label>
          <label className="account-password-label">新密码<input className="account-password-input" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={8} maxLength={72} required /></label>
          <label className="account-password-label">确认新密码<input className="account-password-input" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} maxLength={72} required /></label>
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? '保存中...' : '保存新密码'}</button>
        </form>
      </main>
    </div>
  );
}
