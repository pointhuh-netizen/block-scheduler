import { useState, useEffect, useCallback } from 'react';
import { auth, tasks as tasksApi, events as eventsApi, timelogs as timelogsApi, categories as categoriesApi, settings as settingsApi } from './api';
import type { Task, CalendarEvent, TimeLog, Category, Settings } from './types';
import Timeline from './components/Timeline/Timeline';
import TaskPool from './components/TaskPool/TaskPool';

type AuthState = 'loading' | 'need_setup' | 'need_login' | 'authenticated';

export default function App() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [timelogs, setTimelogs] = useState<TimeLog[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [appSettings, setAppSettings] = useState<Settings>({ sleep_start: '23:00', sleep_end: '07:00', timezone: 'Asia/Seoul' });
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState<Settings>({ sleep_start: '23:00', sleep_end: '07:00', timezone: 'Asia/Seoul' });

  useEffect(() => {
    const token = localStorage.getItem('token');
    auth.getStatus().then(({ setup }) => {
      if (!setup) { setAuthState('need_setup'); return; }
      if (token) { setAuthState('authenticated'); } else { setAuthState('need_login'); }
    }).catch(() => setAuthState('need_login'));
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [t, e, tl, c, s] = await Promise.all([
        tasksApi.list(), eventsApi.list(), timelogsApi.list(), categoriesApi.list(), settingsApi.get()
      ]);
      setTasks(t); setCalendarEvents(e); setTimelogs(tl); setCategories(c); setAppSettings(s); setSettingsForm(s);
    } catch (err) {
      console.error('Load data error', err);
    }
  }, []);

  useEffect(() => {
    if (authState === 'authenticated') loadData();
  }, [authState, loadData]);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault(); setAuthError('');
    try {
      const { token } = await auth.setup(password);
      localStorage.setItem('token', token); setAuthState('authenticated');
    } catch (err: unknown) { setAuthError(err instanceof Error ? err.message : 'Error'); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setAuthError('');
    try {
      const { token } = await auth.login(password);
      localStorage.setItem('token', token); setAuthState('authenticated');
    } catch (err: unknown) { setAuthError(err instanceof Error ? err.message : 'Error'); }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const s = await settingsApi.update(settingsForm);
      setAppSettings(s); setShowSettings(false);
    } catch (err) { console.error(err); }
  };

  const activeTimeLog = timelogs.find(tl => !tl.end_time);

  if (authState === 'loading') {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1a1a2e', color: '#e2e8f0', fontSize: 18 }}>로딩 중...</div>;
  }

  if (authState === 'need_setup' || authState === 'need_login') {
    const isSetup = authState === 'need_setup';
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1a1a2e', color: '#e2e8f0' }}>
        <form onSubmit={isSetup ? handleSetup : handleLogin} style={{ background: '#16213e', padding: 32, borderRadius: 12, minWidth: 300, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h2 style={{ margin: 0, color: '#6366f1', textAlign: 'center' }}>블럭 스케줄러</h2>
          <p style={{ margin: 0, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>{isSetup ? '처음 사용 시 비밀번호를 설정하세요' : '비밀번호를 입력하세요'}</p>
          {authError && <p style={{ margin: 0, color: '#ef4444', textAlign: 'center', fontSize: 14 }}>{authError}</p>}
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="비밀번호" required
            style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #374151', background: '#0f3460', color: '#e2e8f0', fontSize: 16 }} />
          <button type="submit" style={{ padding: '10px 0', background: '#6366f1', color: 'white', border: 'none', borderRadius: 8, fontSize: 16, cursor: 'pointer', fontWeight: 600 }}>
            {isSetup ? '설정하기' : '로그인'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#1a1a2e', color: '#e2e8f0', overflow: 'hidden' }}>
      {/* Header */}
      <header style={{ background: '#16213e', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #374151', flexShrink: 0 }}>
        <h1 style={{ margin: 0, fontSize: 18, color: '#6366f1', fontWeight: 700 }}>📅 블럭 스케줄러</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {activeTimeLog && (
            <div style={{ background: '#ef4444', borderRadius: 20, padding: '4px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'white', display: 'inline-block' }} />
              {activeTimeLog.title}
            </div>
          )}
          <button onClick={() => setShowSettings(true)} style={{ background: 'transparent', border: '1px solid #374151', borderRadius: 8, padding: '6px 12px', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}>⚙️</button>
          <button onClick={() => { localStorage.removeItem('token'); setAuthState('need_login'); }} style={{ background: 'transparent', border: '1px solid #374151', borderRadius: 8, padding: '6px 12px', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}>로그아웃</button>
        </div>
      </header>

      {/* Main content area */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <Timeline
            tasks={tasks}
            events={calendarEvents}
            timelogs={timelogs}
            categories={categories}
            settings={appSettings}
            onTimeLogStop={async (id) => { await timelogsApi.stop(id); loadData(); }}
            onAddTimeLog={async (data) => { await timelogsApi.create(data); loadData(); }}
            onAddEvent={async (data) => { await eventsApi.create(data); loadData(); }}
            onRefresh={loadData}
          />
        </div>
        <TaskPool tasks={tasks} categories={categories} onRefresh={loadData} />
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handleSaveSettings} style={{ background: '#16213e', padding: 24, borderRadius: 12, minWidth: 300, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ margin: 0, color: '#6366f1' }}>⚙️ 설정</h3>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14 }}>
              수면 시작
              <input type="time" value={settingsForm.sleep_start} onChange={e => setSettingsForm(f => ({ ...f, sleep_start: e.target.value }))}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #374151', background: '#0f3460', color: '#e2e8f0', fontSize: 16 }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14 }}>
              수면 종료
              <input type="time" value={settingsForm.sleep_end} onChange={e => setSettingsForm(f => ({ ...f, sleep_end: e.target.value }))}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #374151', background: '#0f3460', color: '#e2e8f0', fontSize: 16 }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14 }}>
              타임존
              <input type="text" value={settingsForm.timezone} onChange={e => setSettingsForm(f => ({ ...f, timezone: e.target.value }))}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #374151', background: '#0f3460', color: '#e2e8f0', fontSize: 16 }} />
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" style={{ flex: 1, padding: '10px 0', background: '#6366f1', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>저장</button>
              <button type="button" onClick={() => setShowSettings(false)} style={{ flex: 1, padding: '10px 0', background: '#374151', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>취소</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
