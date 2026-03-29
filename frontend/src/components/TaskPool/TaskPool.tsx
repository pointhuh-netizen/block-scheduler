import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { Task, Category, TimeLog } from '../../types';
import { tasks as tasksApi, timelogs as timelogsApi } from '../../api';
import { useTheme } from '../../theme';

interface Props {
  tasks: Task[];
  categories: Category[];
  timelogs: TimeLog[];
  onRefresh: () => void;
}

const SIZE_LABELS: Record<string, string> = {
  small: '15분', medium: '1시간', large: '2시간', half_day: '4시간', full_day: '8시간'
};
const SIZE_MINUTES: Record<string, number> = {
  small: 15, medium: 60, large: 120, half_day: 240, full_day: 480
};

function dday(deadline: string): string {
  const diff = Math.floor((new Date(deadline).setHours(23,59,59,999) - Date.now()) / 86400000);
  if (diff === 0) return 'D-Day';
  if (diff > 0) return `D-${diff}`;
  return `D+${Math.abs(diff)}`;
}

function totalRemainingHours(tasks: Task[]): number {
  const pending = tasks.filter(t => t.status !== 'done');
  return pending.reduce((sum, t) => sum + (SIZE_MINUTES[t.estimated_size] || 60), 0) / 60;
}

type ActionModal = { task: Task } | null;
type EditModal = { task: Task } | null;

export default function TaskPool({ tasks, categories, timelogs, onRefresh }: Props) {
  const theme = useTheme();
  const t = theme;

  const [height, setHeight] = useState(220);
  const [actionModal, setActionModal] = useState<ActionModal>(null);
  const [editModal, setEditModal] = useState<EditModal>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [manualTime, setManualTime] = useState(false);
  const [manualStart, setManualStart] = useState('');
  const [manualEnd, setManualEnd] = useState('');
  const [tick, setTick] = useState(0);
  const dragStartY = useRef(0);
  const dragStartH = useRef(0);

  // Refresh elapsed time display every 30 seconds
  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const [addForm, setAddForm] = useState({ title: '', description: '', estimated_size: 'medium' as Task['estimated_size'], deadline: '', category_id: '' });
  const [editForm, setEditForm] = useState({ title: '', description: '', estimated_size: 'medium' as Task['estimated_size'], deadline: '', category_id: '' });

  const activeTimelogByTask = useMemo(() => {
    const map = new Map<string, TimeLog>();
    for (const tl of timelogs) {
      if (tl.task_id && !tl.end_time) map.set(tl.task_id, tl);
    }
    return map;
  }, [timelogs]);

  function elapsedLabel(startTime: string): string {
    // `tick` changes every 30 s to trigger a re-render and keep the display fresh
    const elapsed = Date.now() - new Date(startTime).getTime() + tick * 0;
    const h = Math.floor(elapsed / 3600000);
    const m = Math.floor((elapsed % 3600000) / 60000);
    if (h > 0) return `${h}시간 ${m}분째`;
    return `${m}분째`;
  }

  const sortedTasks = [...tasks].filter(t => t.status !== 'done').sort((a, b) => {
    const aActive = activeTimelogByTask.has(a.id);
    const bActive = activeTimelogByTask.has(b.id);
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    if (a.deadline && b.deadline) return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return 0;
  });

  const handleDragMove = useCallback((e: PointerEvent) => {
    const delta = dragStartY.current - e.clientY;
    const newH = Math.max(120, Math.min(window.innerHeight * 0.6, dragStartH.current + delta));
    setHeight(newH);
  }, []);

  const handleDragEnd = useCallback(() => {
    window.removeEventListener('pointermove', handleDragMove);
    window.removeEventListener('pointerup', handleDragEnd);
  }, [handleDragMove]);

  const handleDragStart = (e: React.PointerEvent) => {
    dragStartY.current = e.clientY;
    dragStartH.current = height;
    window.addEventListener('pointermove', handleDragMove);
    window.addEventListener('pointerup', handleDragEnd);
  };

  const handleStartNow = async (task: Task) => {
    const existing = activeTimelogByTask.get(task.id);
    if (existing) {
      // Already in progress — ask whether to stop old and restart
      const confirmed = window.confirm(`"${task.title}"이(가) 이미 진행 중입니다.\n기존 기록을 종료하고 새로 시작하시겠습니까?`);
      if (!confirmed) return;
      await timelogsApi.stop(existing.id);
    }
    await timelogsApi.create({ task_id: task.id, title: task.title, category_id: task.category_id || undefined, start_time: new Date().toISOString() });
    await tasksApi.update(task.id, { status: 'in_progress' });
    onRefresh();
    setActionModal(null);
  };

  const handleStopTask = async (task: Task) => {
    const existing = activeTimelogByTask.get(task.id);
    if (!existing) return;
    await timelogsApi.stop(existing.id);
    onRefresh();
    setActionModal(null);
  };

  const handleManualTime = async (task: Task) => {
    if (!manualStart) return;
    await timelogsApi.create({ task_id: task.id, title: task.title, category_id: task.category_id || undefined, start_time: new Date(manualStart).toISOString(), end_time: manualEnd ? new Date(manualEnd).toISOString() : undefined });
    await tasksApi.update(task.id, { status: 'in_progress' });
    onRefresh();
    setActionModal(null);
    setManualTime(false);
  };

  const handleComplete = async (task: Task) => {
    await tasksApi.complete(task.id);
    onRefresh();
    setActionModal(null);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    await tasksApi.create({ ...addForm, deadline: addForm.deadline || undefined, category_id: addForm.category_id || undefined, description: addForm.description || undefined });
    onRefresh();
    setShowAdd(false);
    setAddForm({ title: '', description: '', estimated_size: 'medium', deadline: '', category_id: '' });
  };

  const handleEditTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal) return;
    await tasksApi.update(editModal.task.id, { ...editForm, deadline: editForm.deadline || undefined, category_id: editForm.category_id || undefined, description: editForm.description || undefined });
    onRefresh();
    setEditModal(null);
  };

  const openEdit = (task: Task) => {
    setEditForm({ title: task.title, description: task.description || '', estimated_size: task.estimated_size, deadline: task.deadline ? task.deadline.slice(0,16) : '', category_id: task.category_id || '' });
    setEditModal({ task });
    setActionModal(null);
  };

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px', borderRadius: 8,
    border: `1px solid ${t.border}`,
    background: t.bg3, color: t.textPrimary,
    fontSize: 14, width: '100%', boxSizing: 'border-box',
  };
  const remainH = totalRemainingHours(tasks);

  return (
    <div style={{ background: t.bg2, borderTop: `1px solid ${t.border}`, height, flexShrink: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Drag handle */}
      <div onPointerDown={handleDragStart} style={{ height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'ns-resize', touchAction: 'none', userSelect: 'none' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: t.border }} />
      </div>

      {/* Header */}
      <div style={{ padding: '0 12px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <h3 style={{ margin: 0, fontSize: 14, color: t.textPrimary }}>
          할 일 풀 <span style={{ color: t.textSecondary, fontWeight: 400 }}>(남은 약 {remainH.toFixed(1)}h)</span>
        </h3>
        <button onClick={() => setShowAdd(true)} style={{ background: t.accent, color: 'white', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}>＋ 할 일 추가</button>
      </div>

      {/* Task list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
        {sortedTasks.length === 0 && <p style={{ color: t.textMuted, textAlign: 'center', fontSize: 13, marginTop: 16 }}>할 일이 없습니다</p>}
        {sortedTasks.map(task => {
          const cat = categories.find(c => c.id === task.category_id);
          const soon = task.deadline && new Date(task.deadline).getTime() - Date.now() < 24 * 3600000;
          const activeTl = activeTimelogByTask.get(task.id);
          return (
            <div key={task.id} onClick={() => setActionModal({ task })}
              onContextMenu={e => { e.preventDefault(); openEdit(task); }}
              style={{ background: t.bg3, borderRadius: 8, padding: '8px 10px', marginBottom: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${activeTl ? t.red + '66' : soon ? t.red + '55' : t.border}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: t.textPrimary, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {task.title}
                </div>
                <div style={{ fontSize: 11, color: t.textSecondary, display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                  <span>{SIZE_LABELS[task.estimated_size]}</span>
                  {cat && <span style={{ color: cat.color }}>● {cat.name}</span>}
                  {task.deadline
                    ? <span style={{ color: soon ? t.red : t.amber, fontWeight: 600 }}>{dday(task.deadline)}</span>
                    : <span style={{ color: t.textMuted }}>마감 없음</span>
                  }
                  {activeTl && (
                    <span style={{ color: t.red, fontWeight: 600 }}>🔴 진행 중 {elapsedLabel(activeTl.start_time)}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Modal */}
      {actionModal && (
        <div style={{ position: 'fixed', inset: 0, background: t.modalOverlay, zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => { setActionModal(null); setManualTime(false); }}>
          <div style={{ background: t.bg2, borderRadius: '16px 16px 0 0', padding: 20, width: '100%', maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <h4 style={{ margin: '0 0 16px', color: t.accent, fontSize: 15 }}>{actionModal.task.title}</h4>
            {!manualTime ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {activeTimelogByTask.has(actionModal.task.id) ? (
                  <>
                    <div style={{ padding: '8px 0', fontSize: 13, color: t.red, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.red, display: 'inline-block' }} />
                      진행 중 — {elapsedLabel(activeTimelogByTask.get(actionModal.task.id)!.start_time)}
                    </div>
                    <button onClick={() => handleStopTask(actionModal.task)} style={{ padding: '12px 0', background: t.red, color: 'white', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>⏹ 끝내기</button>
                    <button onClick={() => handleStartNow(actionModal.task)} style={{ padding: '12px 0', background: t.bg3, color: t.textPrimary, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>🔄 재시작 (기존 기록 종료 후)</button>
                  </>
                ) : (
                  <button onClick={() => handleStartNow(actionModal.task)} style={{ padding: '12px 0', background: t.accent, color: 'white', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>▶ 지금 시작</button>
                )}
                <button onClick={() => setManualTime(true)} style={{ padding: '12px 0', background: t.bg3, color: t.textPrimary, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>✏️ 시간 직접 입력</button>
                <button onClick={() => handleComplete(actionModal.task)} style={{ padding: '12px 0', background: t.green, color: 'white', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>✓ 완료</button>
                <button onClick={() => openEdit(actionModal.task)} style={{ padding: '12px 0', background: t.bg3, color: t.textPrimary, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>✏️ 편집</button>
                <button onClick={() => setActionModal(null)} style={{ padding: '12px 0', background: 'transparent', color: t.textSecondary, border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>취소</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ fontSize: 12, color: t.textSecondary }}>시작 시간
                  <input type="datetime-local" value={manualStart} onChange={e => setManualStart(e.target.value)} style={{ ...inputStyle, marginTop: 4 }} />
                </label>
                <label style={{ fontSize: 12, color: t.textSecondary }}>종료 시간 (선택)
                  <input type="datetime-local" value={manualEnd} onChange={e => setManualEnd(e.target.value)} style={{ ...inputStyle, marginTop: 4 }} />
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => handleManualTime(actionModal.task)} style={{ flex: 1, padding: '10px 0', background: t.accent, color: 'white', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>저장</button>
                  <button onClick={() => setManualTime(false)} style={{ flex: 1, padding: '10px 0', background: t.bg3, color: t.textPrimary, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>뒤로</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModal && (
        <div style={{ position: 'fixed', inset: 0, background: t.modalOverlay, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setEditModal(null)}>
          <form onSubmit={handleEditTask} style={{ background: t.bg2, borderRadius: 12, padding: 20, width: '90%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 12 }} onClick={e => e.stopPropagation()}>
            <h4 style={{ margin: 0, color: t.accent }}>할 일 편집</h4>
            <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} placeholder="제목" required style={inputStyle} />
            <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} placeholder="설명" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            <select value={editForm.estimated_size} onChange={e => setEditForm(f => ({ ...f, estimated_size: e.target.value as Task['estimated_size'] }))} style={inputStyle}>
              {Object.entries(SIZE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <label style={{ fontSize: 12, color: t.textSecondary }}>마감일
              <input type="datetime-local" value={editForm.deadline} onChange={e => setEditForm(f => ({ ...f, deadline: e.target.value }))} style={{ ...inputStyle, marginTop: 4 }} />
            </label>
            <select value={editForm.category_id} onChange={e => setEditForm(f => ({ ...f, category_id: e.target.value }))} style={inputStyle}>
              <option value="">카테고리 없음</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" style={{ flex: 1, padding: '10px 0', background: t.accent, color: 'white', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>저장</button>
              <button type="button" onClick={async () => { if (confirm('삭제하시겠습니까?')) { await tasksApi.delete(editModal.task.id); onRefresh(); setEditModal(null); } }} style={{ padding: '10px 16px', background: t.red, color: 'white', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>삭제</button>
              <button type="button" onClick={() => setEditModal(null)} style={{ flex: 1, padding: '10px 0', background: t.bg3, color: t.textPrimary, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>취소</button>
            </div>
          </form>
        </div>
      )}

      {/* Add Task Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: t.modalOverlay, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowAdd(false)}>
          <form onSubmit={handleAddTask} style={{ background: t.bg2, borderRadius: 12, padding: 20, width: '90%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 12 }} onClick={e => e.stopPropagation()}>
            <h4 style={{ margin: 0, color: t.accent }}>＋ 할 일 추가</h4>
            <input value={addForm.title} onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))} placeholder="제목 (필수)" required style={inputStyle} />
            <textarea value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} placeholder="설명" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            <select value={addForm.estimated_size} onChange={e => setAddForm(f => ({ ...f, estimated_size: e.target.value as Task['estimated_size'] }))} style={inputStyle}>
              {Object.entries(SIZE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <label style={{ fontSize: 12, color: t.textSecondary }}>마감일
              <input type="datetime-local" value={addForm.deadline} onChange={e => setAddForm(f => ({ ...f, deadline: e.target.value }))} style={{ ...inputStyle, marginTop: 4 }} />
            </label>
            <select value={addForm.category_id} onChange={e => setAddForm(f => ({ ...f, category_id: e.target.value }))} style={inputStyle}>
              <option value="">카테고리 없음</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" style={{ flex: 1, padding: '10px 0', background: t.accent, color: 'white', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>추가</button>
              <button type="button" onClick={() => setShowAdd(false)} style={{ flex: 1, padding: '10px 0', background: t.bg3, color: t.textPrimary, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>취소</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

