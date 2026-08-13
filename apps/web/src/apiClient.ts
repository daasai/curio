const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {})
      },
      ...options
    });

    if (!res.ok) {
      console.warn(`API call ${endpoint} failed with status: ${res.status}`);
      return null;
    }

    return await res.json() as T;
  } catch (err) {
    console.warn(`API call ${endpoint} network error:`, err);
    return null;
  }
}

// Auth
export async function activatePilotApi(data: { phone: string; inviteCode: string; pin: string }) {
  const res = await fetch(`${API_BASE}/auth/pilot/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function loginPilotApi(data: { phone: string; pin: string }) {
  return loginApi({ phone: data.phone, password: data.pin });
}

export async function loginApi(data: { phone: string; password: string }) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function changePasswordApi(data: { currentPassword: string; newPassword: string }) {
  const res = await fetch(`${API_BASE}/auth/password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function getMeApi() {
  const res = await fetch('/api/me', {
    method: 'GET'
  });
  return res.json();
}

export async function logoutApi() {
  const res = await fetch('/api/auth/logout', {
    method: 'POST'
  });
  return res.json();
}

export async function saveOnboardingApi(data: {
  commandId: string;
  preferences: { genres: string[]; intensity: 'light' | 'medium' | 'deep' };
  diagnostic: { itemSetVersion: string; correctCount: number; itemCount: number; derivedLevel: string };
}) {
  try {
    const res = await fetch(`${API_BASE}/learning/onboarding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return await res.json() as { success?: boolean; idempotent?: boolean; error?: { code: string } };
  } catch (err) {
    console.warn('Onboarding save network error:', err);
    return null;
  }
}

// Learning snapshot & session APIs
export async function getLearningSnapshotApi() {
  return apiFetch<any>('/learning/snapshot', {
    method: 'GET',
    credentials: 'include'
  });
}

export async function getLearningVocabularyApi() {
  return apiFetch<{ list: any[] }>('/learning/vocabulary', { method: 'GET', credentials: 'include' });
}

export async function getLearningVocabularyItemApi(word: string) {
  return apiFetch<{ item: any }>(`/learning/vocabulary/${encodeURIComponent(word)}`, { method: 'GET', credentials: 'include' });
}

export async function startLearningSessionApi() {
  return apiFetch<any>('/learning/session/start', {
    method: 'POST',
    credentials: 'include'
  });
}

export async function submitLearningEventApi(
  sessionId: string,
  eventId: string,
  type: string,
  payload: any,
  occurredAt: string
) {
  return apiFetch<{ success?: boolean; idempotent?: boolean; requiresSync?: boolean; confirmed?: boolean }>(`/learning/session/${encodeURIComponent(sessionId)}/event`, {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify({ eventId, eventType: type, payload, occurredAt })
  });
}

export async function completeLearningSessionApi(
  sessionId: string,
  commandId: string,
  clientRevision: number
) {
  try {
    const res = await fetch(`${API_BASE}/learning/session/${encodeURIComponent(sessionId)}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ commandId, clientRevision })
    });
    return await res.json() as any;
  } catch (err) {
    console.warn('Learning session completion network error:', err);
    return null;
  }
}

export async function getLearningReportApi() {
  return apiFetch<any>('/report/learning', {
    method: 'GET',
    credentials: 'include'
  });
}

export async function postPosterExportedApi() {
  return apiFetch<{ success: boolean }>('/report/poster-exported', {
    method: 'POST',
    credentials: 'include'
  });
}
