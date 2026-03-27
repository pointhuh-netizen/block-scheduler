import { useState, useEffect, useCallback } from 'react';
import { auth, tasks as tasksApi, events as eventsApi, timelogs as timelogsApi, categories as categoriesApi, settings as settingsApi } from './api';
import type { Task, CalendarEvent, TimeLog, Category, Settings } from './types';
import Timeline from './components/Timeline/Timeline';
import TaskPool from './components/TaskPool/TaskPool';
import { ThemeContext, resolveTheme, type ThemeMode } from './theme';

type AuthState = 'loading' | 'need_setup' | 'need_login' | 'authenticated';

type CatForm = { name: string; color: string; icon: string };
const PRESET_COLORS = ['#7C7FF5', '#F87171', '#34D399', '#FBBF24', '#60A5FA', '#F472B6', '#A78BFA', '#FB923C'];

export default function App() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [timelogs, setTimelogs] = useState<TimeLog[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [appSettings, setAppSettings] = useState<Settings>({ sleep_start: '23:00', sleep_end: '07:00', timezone: 'Asia/Seoul', theme: 'system' });
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState<Settings>({ sleep_start: '23:00', sleep_end: '07:00', timezone: 'Asia/Seoul', theme: 'system' });

  // Category management state
  const [catForm, setCatForm] = useState<CatForm>({ name: '', color: '#7C7FF5', icon: '' });
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [showCatAdd, setShowCatAdd] = useState(false);

  // Theme
  const themePref: ThemeMode = (appSettings.theme as ThemeMode) || 'system';
  const theme = resolveTheme(themePref);

  useEffect(() => {
    const token = localStorage.getItem('token');
    // Apply saved theme from localStorage before API loads
    const savedTheme = localStorage.getItem('themePref') as ThemeMode | null;
    if (savedTheme) setAppSettings(s => ({ ...s, theme: savedTheme }));
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
      setTasks(t); setCalendarEvents(e); setTimelogs(tl); setCategories(c);
      setAppSettings(s); setSettingsForm(s);
      if (s.theme) localStorage.setItem('themePref', s.theme);
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
      setAppSettings(s);
      if (s.theme) localStorage.setItem('themePref', s.theme);
      setShowSettings(false);
    } catch (err) { console.error(err); }
  };

  const handleToggleTheme = async () => {
    const next: ThemeMode = theme.mode === 'dark' ? 'light' : 'dark';
    const updated = { ...appSettings, theme: next };
    setAppSettings(updated);
    setSettingsForm(updated);
    localStorage.setItem('themePref', next);
    try { await settingsApi.update({ theme: next }); } catch (_) { /* silent */ }
  };

  // Category handlers
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    await categoriesApi.create({ name: catForm.name, color: catForm.color, icon: catForm.icon || undefined });
    setCatForm({ name: '', color: '#7C7FF5', icon: '' });
    setShowCatAdd(false);
    loadData();
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCat) return;
    await categoriesApi.update(editingCat.id, { name: catForm.name, color: catForm.color, icon: catForm.icon || undefined });
    setEditingCat(null);
    loadData();
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('카테고리를 삭제하시겠습니까?')) return;
    await categoriesApi.delete(id);
    loadData();
  };

  const openEditCat = (cat: Category) => {
    setEditingCat(cat);
    setCatForm({ name: cat.name, color: cat.color, icon: cat.icon || '' });
    setShowCatAdd(false);
  };

  const activeTimeLog = timelogs.find(tl => !tl.end_time);

  const t = theme; // shorthand

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px', borderRadius: 8,
    border: `1px solid ${t.border}`,
    background: t.bg3, color: t.textPrimary,
    fontSize: 14, width: '100%', boxSizing: 'border-box',
  };

  if (authState === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: t.bg, color: t.textPrimary, fontSize: 18 }}>
        로딩 중...
      </div>
    );
  }

  if (authState === 'need_setup' || authState === 'need_login') {
    const isSetup = authState === 'need_setup';
    return (
      <ThemeContext.Provider value={theme}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: t.bg, color: t.textPrimary }}>
          <form onSubmit={isSetup ? handleSetup : handleLogin} style={{ background: t.bg2, padding: 32, borderRadius: 12, minWidth: 300, display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}>
            <h2 style={{ margin: 0, color: t.accent, textAlign: 'center' }}>📅 블럭 스케줄러</h2>
            <p style={{ margin: 0, textAlign: 'center', color: t.textSecondary, fontSize: 14 }}>{isSetup ? '처음 사용 시 비밀번호를 설정하세요' : '비밀번호를 입력하세요'}</p>
            {authError && <p style={{ margin: 0, color: t.red, textAlign: 'center', fontSize: 14 }}>{authError}</p>}
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="비밀번호" required
              style={{ padding: '10px 14px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.bg3, color: t.textPrimary, fontSize: 16 }} />
            <button type="submit" style={{ padding: '10px 0', background: t.accent, color: 'white', border: 'none', borderRadius: 8, fontSize: 16, cursor: 'pointer', fontWeight: 600 }}>
              {isSetup ? '설정하기' : '로그인'}
            </button>
          </form>
        </div>
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={theme}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: t.bg, color: t.textPrimary, overflow: 'hidden' }}>
        {/* Header */}
        <header style={{ background: t.bg2, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
          <h1 style={{ margin: 0, fontSize: 17, color: t.accent, fontWeight: 700 }}>📅 블럭 스케줄러</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {activeTimeLog && (
              <div style={{ background: t.red, borderRadius: 20, padding: '4px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, color: 'white' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'white', display: 'inline-block' }} />
                {activeTimeLog.title}
              </div>
            )}
            {/* Theme toggle */}
            <button onClick={handleToggleTheme} title={theme.mode === 'dark' ? '라이트 모드로' : '다크 모드로'}
              style={{ background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, padding: '6px 10px', color: t.textSecondary, cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>
              {theme.mode === 'dark' ? '☀️' : '🌙'}
            </button>
            <button onClick={() => setShowSettings(true)} style={{ background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, padding: '6px 12px', color: t.textSecondary, cursor: 'pointer', fontSize: 14 }}>⚙️</button>
            <button onClick={() => { localStorage.removeItem('token'); setAuthState('need_login'); }} style={{ background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, padding: '6px 12px', color: t.textSecondary, cursor: 'pointer', fontSize: 14 }}>로그아웃</button>
          </div>
        </header>

        {/* Main content */}
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
          <div style={{ position: 'fixed', inset: 0, background: t.modalOverlay, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
            onClick={() => setShowSettings(false)}>
            <div style={{ background: t.bg2, padding: 24, borderRadius: 12, width: '90%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 0, maxHeight: '85vh', overflowY: 'auto' }}
              onClick={e => e.stopPropagation()}>
              <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <h3 style={{ margin: '0 0 4px', color: t.accent }}>⚙️ 설정</h3>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, color: t.textPrimary }}>
                  수면 시작
                  <input type="time" value={settingsForm.sleep_start} onChange={e => setSettingsForm(f => ({ ...f, sleep_start: e.target.value }))} style={inputStyle} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, color: t.textPrimary }}>
                  수면 종료
                  <input type="time" value={settingsForm.sleep_end} onChange={e => setSettingsForm(f => ({ ...f, sleep_end: e.target.value }))} style={inputStyle} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, color: t.textPrimary }}>
                  타임존
                  <input type="text" value={settingsForm.timezone} onChange={e => setSettingsForm(f => ({ ...f, timezone: e.target.value }))} style={inputStyle} />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, color: t.textPrimary }}>
                  테마
                  <select value={settingsForm.theme || 'system'} onChange={e => setSettingsForm(f => ({ ...f, theme: e.target.value as Settings['theme'] }))} style={inputStyle}>
                    <option value="system">시스템 설정 따르기</option>
                    <option value="light">라이트 모드</option>
                    <option value="dark">다크 모드</option>
                  </select>
                </label>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" style={{ flex: 1, padding: '10px 0', background: t.accent, color: 'white', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>저장</button>
                  <button type="button" onClick={() => setShowSettings(false)} style={{ flex: 1, padding: '10px 0', background: t.bg3, color: t.textPrimary, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>취소</button>
                </div>
              </form>

              {/* Category Management */}
              <div style={{ marginTop: 20, borderTop: `1px solid ${t.border}`, paddingTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <h4 style={{ margin: 0, color: t.textPrimary, fontSize: 14 }}>🏷️ 카테고리 관리</h4>
                  <button onClick={() => { setShowCatAdd(v => !v); setEditingCat(null); setCatForm({ name: '', color: '#7C7FF5', icon: '' }); }}
                    style={{ background: t.accent, color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>
                    {showCatAdd ? '취소' : '＋ 추가'}
                  </button>
                </div>

                {/* Add category inline form */}
                {showCatAdd && (
                  <form onSubmit={handleAddCategory} style={{ background: t.bg3, borderRadius: 8, padding: 12, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} placeholder="카테고리 이름" required
                      style={{ ...inputStyle, background: t.bg2 }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <label style={{ fontSize: 12, color: t.textSecondary, whiteSpace: 'nowrap' }}>색상:</label>
                      <input type="color" value={catForm.color} onChange={e => setCatForm(f => ({ ...f, color: e.target.value }))}
                        style={{ width: 36, height: 32, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 2, background: 'transparent' }} />
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {PRESET_COLORS.map(c => (
                          <button key={c} type="button" onClick={() => setCatForm(f => ({ ...f, color: c }))}
                            style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: catForm.color === c ? `2px solid ${t.textPrimary}` : '2px solid transparent', cursor: 'pointer', padding: 0 }} />
                        ))}
                      </div>
                    </div>
                    <button type="submit" style={{ padding: '8px 0', background: t.accent, color: 'white', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>추가</button>
                  </form>
                )}

                {/* Edit category inline form */}
                {editingCat && (
                  <form onSubmit={handleUpdateCategory} style={{ background: t.bg3, borderRadius: 8, padding: 12, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 2 }}>편집 중: <strong style={{ color: t.textPrimary }}>{editingCat.name}</strong></div>
                    <input value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} placeholder="카테고리 이름" required
                      style={{ ...inputStyle, background: t.bg2 }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <label style={{ fontSize: 12, color: t.textSecondary, whiteSpace: 'nowrap' }}>색상:</label>
                      <input type="color" value={catForm.color} onChange={e => setCatForm(f => ({ ...f, color: e.target.value }))}
                        style={{ width: 36, height: 32, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 2, background: 'transparent' }} />
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {PRESET_COLORS.map(c => (
                          <button key={c} type="button" onClick={() => setCatForm(f => ({ ...f, color: c }))}
                            style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: catForm.color === c ? `2px solid ${t.textPrimary}` : '2px solid transparent', cursor: 'pointer', padding: 0 }} />
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="submit" style={{ flex: 1, padding: '8px 0', background: t.accent, color: 'white', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>저장</button>
                      <button type="button" onClick={() => setEditingCat(null)} style={{ padding: '8px 12px', background: t.bg2, color: t.textPrimary, border: `1px solid ${t.border}`, borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>취소</button>
                    </div>
                  </form>
                )}

                {/* Category list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {categories.length === 0 && (
                    <p style={{ color: t.textMuted, fontSize: 13, textAlign: 'center', margin: '8px 0' }}>카테고리가 없습니다</p>
                  )}
                  {categories.map(cat => (
                    <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: t.bg3, borderRadius: 8, border: `1px solid ${t.border}` }}>
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 13, color: t.textPrimary }}>{cat.name}</span>
                      <button onClick={() => openEditCat(cat)} style={{ background: 'transparent', border: 'none', color: t.textSecondary, cursor: 'pointer', fontSize: 14, padding: '2px 4px' }}>✏️</button>
                      <button onClick={() => handleDeleteCategory(cat.id)} style={{ background: 'transparent', border: 'none', color: t.red, cursor: 'pointer', fontSize: 14, padding: '2px 4px' }}>🗑️</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ThemeContext.Provider>
  );
}

