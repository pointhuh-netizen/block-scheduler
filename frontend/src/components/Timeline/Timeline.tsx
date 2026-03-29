import { useRef, useEffect, useState, useCallback } from 'react';
import type { Task, CalendarEvent, TimeLog, Category, Settings } from '../../types';
import { timelogs as timelogsApi, events as eventsApi } from '../../api';
import { useTheme } from '../../theme';

interface Props {
  tasks: Task[];
  events: CalendarEvent[];
  timelogs: TimeLog[];
  categories: Category[];
  settings: Settings;
  onTimeLogStop: (id: string) => void;
  onAddTimeLog: (data: Partial<TimeLog>) => void;
  onAddEvent: (data: Partial<CalendarEvent>) => void;
  onRefresh: () => void;
}

const PX_PER_MIN = 1;
const DAYS_BEFORE = 30;
const DAYS_AFTER = 30;
const TOTAL_DAYS = DAYS_BEFORE + DAYS_AFTER;

const SIZE_MINUTES: Record<string, number> = {
  small: 15, medium: 60, large: 120, half_day: 240, full_day: 480
};

function todayMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function yPos(dt: Date, base: Date): number {
  return (dt.getTime() - base.getTime()) / 60000 * PX_PER_MIN;
}

function parseSleepPeriods(base: Date, settings: Settings): Array<{ start: Date; end: Date }> {
  const periods: Array<{ start: Date; end: Date }> = [];
  const [shH, shM] = settings.sleep_start.split(':').map(Number);
  const [seH, seM] = settings.sleep_end.split(':').map(Number);

  for (let i = -1; i < TOTAL_DAYS + 1; i++) {
    const day = new Date(base);
    day.setDate(day.getDate() + i);
    const sleepStart = new Date(day);
    sleepStart.setHours(shH, shM, 0, 0);
    const sleepEnd = new Date(day);
    if (shH > seH || (shH === seH && shM > seM)) {
      sleepEnd.setDate(sleepEnd.getDate() + 1);
    }
    sleepEnd.setHours(seH, seM, 0, 0);
    if (sleepStart < sleepEnd) {
      periods.push({ start: sleepStart, end: sleepEnd });
    }
  }
  return periods;
}

function nextWakeTime(from: Date, periods: Array<{ start: Date; end: Date }>): Date {
  const period = periods.find(p => from >= p.start && from < p.end);
  if (period) return period.end;
  return from;
}

interface GhostBlock {
  task: Task;
  start: Date;
  end: Date;
}

function computeGhostBlocks(
  tasks: Task[],
  events: CalendarEvent[],
  sleepPeriods: Array<{ start: Date; end: Date }>
): GhostBlock[] {
  const pending = tasks.filter(t => (t.status === 'pending' || t.status === 'in_progress') && t.deadline)
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());

  const ghosts: GhostBlock[] = [];
  let cursor = new Date();

  cursor = nextWakeTime(cursor, sleepPeriods);

  for (const task of pending) {
    const durationMin = SIZE_MINUTES[task.estimated_size] || 60;
    let start = new Date(cursor);

    start = nextWakeTime(start, sleepPeriods);

    const eventsInWay = events.filter(e => {
      const es = new Date(e.start_time);
      const ee = new Date(e.end_time);
      const blockEnd = new Date(start.getTime() + durationMin * 60000);
      return es < blockEnd && ee > start;
    });

    if (eventsInWay.length > 0) {
      const latestEnd = eventsInWay.reduce((acc, e) => {
        const ee = new Date(e.end_time);
        return ee > acc ? ee : acc;
      }, new Date(0));
      cursor = nextWakeTime(latestEnd, sleepPeriods);
      start = new Date(cursor);
    }

    const end = new Date(start.getTime() + durationMin * 60000);

    const crossesSleep = sleepPeriods.find(p => start < p.end && end > p.start);
    if (crossesSleep) {
      cursor = crossesSleep.end;
      const newStart = new Date(cursor);
      const newEnd = new Date(newStart.getTime() + durationMin * 60000);
      ghosts.push({ task, start: newStart, end: newEnd });
      cursor = newEnd;
    } else {
      ghosts.push({ task, start, end });
      cursor = end;
    }
  }
  return ghosts;
}

function computeTimelogColumns(timelogs: TimeLog[]): Map<string, { col: number; total: number }> {
  const now = Date.now();
  const intervals = timelogs.map(tl => ({
    id: tl.id,
    start: new Date(tl.start_time).getTime(),
    end: tl.end_time ? new Date(tl.end_time).getTime() : now,
  })).sort((a, b) => a.start - b.start || a.end - b.end);

  const colAssign = new Map<string, number>();
  const colEndTimes: number[] = [];

  for (const iv of intervals) {
    let assigned = -1;
    for (let c = 0; c < colEndTimes.length; c++) {
      if (colEndTimes[c] <= iv.start) {
        assigned = c;
        colEndTimes[c] = iv.end;
        break;
      }
    }
    if (assigned === -1) {
      assigned = colEndTimes.length;
      colEndTimes.push(iv.end);
    }
    colAssign.set(iv.id, assigned);
  }

  const result = new Map<string, { col: number; total: number }>();
  for (const iv of intervals) {
    const overlapping = intervals.filter(o => o.start < iv.end && o.end > iv.start);
    const maxCol = Math.max(...overlapping.map(o => colAssign.get(o.id)!));
    result.set(iv.id, { col: colAssign.get(iv.id)!, total: maxCol + 1 });
  }
  return result;
}

export default function Timeline({ tasks, events, timelogs, categories, settings, onTimeLogStop, onRefresh }: Props) {
  const theme = useTheme();
  const t = theme;
  const containerRef = useRef<HTMLDivElement>(null);
  const [popup, setPopup] = useState<{ y: number; clickTime: Date; type: 'add' | 'timelog' | 'event'; item?: TimeLog | CalendarEvent } | null>(null);
  const [addForm, setAddForm] = useState<{ mode: 'timelog' | 'event'; title: string; endTime: string } | null>(null);

  const base = todayMidnight();
  base.setDate(base.getDate() - DAYS_BEFORE);
  const totalHeight = TOTAL_DAYS * 24 * 60 * PX_PER_MIN;

  const sleepPeriods = parseSleepPeriods(base, settings);
  const ghostBlocks = computeGhostBlocks(tasks, events, sleepPeriods);

  const getCategoryColor = useCallback((id?: string) => {
    if (!id) return '#6366f1';
    return categories.find(c => c.id === id)?.color || '#6366f1';
  }, [categories]);

  useEffect(() => {
    if (containerRef.current) {
      const now = new Date();
      const y = yPos(now, base);
      containerRef.current.scrollTop = y - containerRef.current.clientHeight / 2;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-block]')) return;
    const rect = containerRef.current!.getBoundingClientRect();
    const y = e.clientY - rect.top + containerRef.current!.scrollTop;
    const clickTime = new Date(base.getTime() + y / PX_PER_MIN * 60000);
    setPopup({ y, clickTime, type: 'add' });
    setAddForm(null);
  };

  const scrollToNow = () => {
    if (containerRef.current) {
      const now = new Date();
      const y = yPos(now, base);
      containerRef.current.scrollTop = y - containerRef.current.clientHeight / 2;
    }
  };

  const nowY = yPos(new Date(), base);

  const dayLines: React.ReactNode[] = [];
  const hourMarks: React.ReactNode[] = [];
  for (let d = 0; d < TOTAL_DAYS; d++) {
    const day = new Date(base);
    day.setDate(day.getDate() + d);
    const y = d * 24 * 60 * PX_PER_MIN;
    const isToday = day.toDateString() === new Date().toDateString();
    dayLines.push(
      <div key={`day-${d}`} style={{ position: 'absolute', left: 0, right: 0, top: y, height: 1, background: isToday ? t.accent : t.border, zIndex: 1 }}>
        <span style={{ position: 'absolute', left: 48, top: -10, fontSize: 11, color: isToday ? t.accent : t.textMuted, fontWeight: isToday ? 700 : 400, whiteSpace: 'nowrap' }}>
          {day.getMonth() + 1}/{day.getDate()}({['일','월','화','수','목','금','토'][day.getDay()]}){isToday ? ' 오늘' : ''}
        </span>
      </div>
    );
    for (let h = 1; h < 24; h++) {
      const hy = y + h * 60 * PX_PER_MIN;
      hourMarks.push(
        <div key={`h-${d}-${h}`} style={{ position: 'absolute', left: 0, right: 0, top: hy, height: 1, background: t.mode === 'dark' ? '#1e2a3a' : '#EBEBE3', zIndex: 0 }}>
          <span style={{ position: 'absolute', left: 2, top: -8, fontSize: 10, color: t.textMuted, width: 36, textAlign: 'right' }}>{String(h).padStart(2,'0')}:00</span>
        </div>
      );
    }
  }

  const sleepZones = sleepPeriods.map((p, i) => {
    const sy = yPos(p.start, base);
    const ey = yPos(p.end, base);
    if (ey < 0 || sy > totalHeight) return null;
    return (
      <div key={`sleep-${i}`} style={{ position: 'absolute', left: 44, right: 0, top: sy, height: ey - sy, background: t.sleepBg, zIndex: 2, pointerEvents: 'none', borderTop: `1px dashed ${t.border}`, borderBottom: `1px dashed ${t.border}` }} />
    );
  });

  const timelogColumns = computeTimelogColumns(timelogs);

  const timelogBlocks = timelogs.map(tl => {
    const sy = yPos(new Date(tl.start_time), base);
    const ey = tl.end_time ? yPos(new Date(tl.end_time), base) : nowY;
    const h = Math.max(ey - sy, 20);
    const active = !tl.end_time;
    const color = getCategoryColor(tl.category_id);
    const { col, total } = timelogColumns.get(tl.id) ?? { col: 0, total: 1 };
    const blockAreaLeft = 44;
    const blockAreaRight = 8;
    const colWidthExpr = `(100% - ${blockAreaLeft + blockAreaRight}px) / ${total}`;
    const leftExpr = `${blockAreaLeft}px + (${colWidthExpr}) * ${col}`;
    const widthExpr = total > 1 ? `calc(${colWidthExpr} - 2px)` : `calc(100% - ${blockAreaLeft + blockAreaRight}px)`;
    return (
      <div key={tl.id} data-block="1" onClick={() => setPopup({ y: sy, clickTime: new Date(tl.start_time), type: 'timelog', item: tl })}
        style={{ position: 'absolute', left: `calc(${leftExpr})`, width: widthExpr, top: sy, height: h, background: color + '33', border: `2px solid ${color}`, borderRadius: 6, padding: '2px 6px', cursor: 'pointer', zIndex: 5, overflow: 'hidden', boxSizing: 'border-box' }}>
        <div style={{ fontSize: 12, color: t.textPrimary, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {active && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: t.red, marginRight: 4, verticalAlign: 'middle' }} />}
          {tl.title}
        </div>
        {h > 24 && <div style={{ fontSize: 10, color: t.textSecondary }}>{new Date(tl.start_time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}{tl.end_time ? ` ~ ${new Date(tl.end_time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}` : ' ~'}</div>}
      </div>
    );
  });

  const eventBlocks = events.map(ev => {
    const sy = yPos(new Date(ev.start_time), base);
    const ey = yPos(new Date(ev.end_time), base);
    const h = Math.max(ey - sy, 20);
    const color = getCategoryColor(ev.category_id);
    return (
      <div key={ev.id} data-block="1" onClick={() => setPopup({ y: sy, clickTime: new Date(ev.start_time), type: 'event', item: ev })}
        style={{ position: 'absolute', left: 44, right: 8, top: sy, height: h, background: color + '22', border: `2px dashed ${color}`, borderRadius: 6, padding: '2px 6px', cursor: 'pointer', zIndex: 4, overflow: 'hidden', boxSizing: 'border-box' }}>
        <div style={{ fontSize: 12, color: t.textPrimary, fontWeight: 600 }}>📌 {ev.title}</div>
      </div>
    );
  });

  const ghostBlockEls = ghostBlocks.map((g, i) => {
    const sy = yPos(g.start, base);
    const h = (g.end.getTime() - g.start.getTime()) / 60000 * PX_PER_MIN;
    const deadline = new Date(g.task.deadline!);
    const soon = deadline.getTime() - Date.now() < 24 * 3600000;
    return (
      <div key={`ghost-${i}`} style={{ position: 'absolute', right: 12, width: 120, top: sy, height: Math.max(h, 16), background: soon ? `${t.red}20` : t.accentLight, border: `1px dashed ${soon ? t.red : t.accent}`, borderRadius: 4, padding: '1px 4px', zIndex: 3, overflow: 'hidden', boxSizing: 'border-box', pointerEvents: 'none' }}>
        <div style={{ fontSize: 10, color: soon ? t.red : t.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.task.title}</div>
      </div>
    );
  });

  const deadlineLines = tasks.filter(task => task.deadline && task.status !== 'done').map(task => {
    const dy = yPos(new Date(task.deadline!), base);
    const soon = new Date(task.deadline!).getTime() - Date.now() < 24 * 3600000;
    return (
      <div key={`dl-${task.id}`} style={{ position: 'absolute', left: 44, right: 0, top: dy, height: 0, borderTop: `2px dashed ${soon ? t.red : t.amber}`, zIndex: 6, pointerEvents: 'none' }}>
        <span style={{ position: 'absolute', right: 4, top: -16, fontSize: 10, color: soon ? t.red : t.amber, whiteSpace: 'nowrap' }}>⚑ {task.title}</span>
      </div>
    );
  });

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm || !popup) return;
    const startISO = popup.clickTime.toISOString();
    if (addForm.mode === 'timelog') {
      await timelogsApi.create({ title: addForm.title, start_time: startISO, end_time: addForm.endTime || undefined });
    } else {
      if (!addForm.endTime) return;
      await eventsApi.create({ title: addForm.title, start_time: startISO, end_time: new Date(addForm.endTime).toISOString() });
    }
    onRefresh();
    setPopup(null);
    setAddForm(null);
  };

  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
      <div ref={containerRef} onClick={handleContainerClick} style={{ position: 'relative', height: '100%', overflowY: 'scroll', overflowX: 'hidden', background: t.bg }}>
        <div style={{ position: 'relative', height: totalHeight, minWidth: 300 }}>
          {dayLines}
          {hourMarks}
          {sleepZones}
          {ghostBlockEls}
          {deadlineLines}
          {eventBlocks}
          {timelogBlocks}
          {/* Current time line */}
          <div style={{ position: 'absolute', left: 44, right: 0, top: nowY, height: 2, background: t.red, zIndex: 10, pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', left: -10, top: -5, width: 12, height: 12, borderRadius: '50%', background: t.red }} />
          </div>
        </div>
      </div>

      {/* Scroll to now button */}
      <button onClick={scrollToNow} style={{ position: 'absolute', bottom: 16, right: 16, background: t.accent, color: 'white', border: 'none', borderRadius: 24, padding: '8px 16px', fontSize: 13, cursor: 'pointer', zIndex: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
        ⏱ 현재로
      </button>

      {/* Popup */}
      {popup && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={() => { setPopup(null); setAddForm(null); }}>
          <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', background: t.bg2, borderRadius: 12, padding: 20, minWidth: 280, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            {popup.type === 'add' && !addForm && (
              <>
                <p style={{ margin: '0 0 12px', color: t.textSecondary, fontSize: 13 }}>
                  {popup.clickTime.toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button onClick={() => setAddForm({ mode: 'timelog', title: '', endTime: '' })} style={{ padding: '10px 0', background: t.accent, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>⏱ 시간 기록 추가</button>
                  <button onClick={() => setAddForm({ mode: 'event', title: '', endTime: '' })} style={{ padding: '10px 0', background: t.bg3, color: t.textPrimary, border: `1px solid ${t.border}`, borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>📌 일정 추가</button>
                  <button onClick={() => setPopup(null)} style={{ padding: '10px 0', background: 'transparent', color: t.textSecondary, border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>취소</button>
                </div>
              </>
            )}
            {popup.type === 'add' && addForm && (
              <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h4 style={{ margin: 0, color: t.accent }}>{addForm.mode === 'timelog' ? '⏱ 시간 기록' : '📌 일정'} 추가</h4>
                <input value={addForm.title} onChange={e => setAddForm(f => f ? { ...f, title: e.target.value } : null)} placeholder="제목" required
                  style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.bg3, color: t.textPrimary, fontSize: 14 }} />
                <label style={{ fontSize: 12, color: t.textSecondary, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  종료 시간{addForm.mode === 'event' ? ' (필수)' : ' (선택)'}
                  <input type="datetime-local" value={addForm.endTime} onChange={e => setAddForm(f => f ? { ...f, endTime: e.target.value } : null)} required={addForm.mode === 'event'}
                    style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.bg3, color: t.textPrimary, fontSize: 14 }} />
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" style={{ flex: 1, padding: '10px 0', background: t.accent, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>추가</button>
                  <button type="button" onClick={() => { setPopup(null); setAddForm(null); }} style={{ flex: 1, padding: '10px 0', background: t.bg3, color: t.textPrimary, border: `1px solid ${t.border}`, borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>취소</button>
                </div>
              </form>
            )}
            {popup.type === 'timelog' && popup.item && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h4 style={{ margin: 0, color: t.accent }}>⏱ {(popup.item as TimeLog).title}</h4>
                <p style={{ margin: 0, fontSize: 13, color: t.textSecondary }}>
                  {new Date((popup.item as TimeLog).start_time).toLocaleString('ko-KR')} ~ {(popup.item as TimeLog).end_time ? new Date((popup.item as TimeLog).end_time!).toLocaleString('ko-KR') : '진행 중'}
                </p>
                {!(popup.item as TimeLog).end_time && (
                  <button onClick={() => { onTimeLogStop((popup.item as TimeLog).id); setPopup(null); }} style={{ padding: '10px 0', background: t.red, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>⏹ 중지</button>
                )}
                <button onClick={() => setPopup(null)} style={{ padding: '10px 0', background: t.bg3, color: t.textPrimary, border: `1px solid ${t.border}`, borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>닫기</button>
              </div>
            )}
            {popup.type === 'event' && popup.item && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h4 style={{ margin: 0, color: t.accent }}>📌 {(popup.item as CalendarEvent).title}</h4>
                <p style={{ margin: 0, fontSize: 13, color: t.textSecondary }}>
                  {new Date((popup.item as CalendarEvent).start_time).toLocaleString('ko-KR')} ~ {new Date((popup.item as CalendarEvent).end_time).toLocaleString('ko-KR')}
                </p>
                {(popup.item as CalendarEvent).description && <p style={{ margin: 0, fontSize: 13, color: t.textPrimary }}>{(popup.item as CalendarEvent).description}</p>}
                <button onClick={() => setPopup(null)} style={{ padding: '10px 0', background: t.bg3, color: t.textPrimary, border: `1px solid ${t.border}`, borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>닫기</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
