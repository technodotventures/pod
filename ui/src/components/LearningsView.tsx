import React from 'react';
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Lightbulb,
  Loader2,
  Moon,
  MessageSquare,
  RefreshCw,
  Search,
  TriangleAlert,
} from 'lucide-react';

interface ExperienceLesson {
  id: string;
  scope: string;
  task: {
    key: string;
    title?: string;
    goal?: string;
    environment?: string;
    tags: string[];
  };
  instruction: string;
  applies_when: string;
  failure: string;
  feedback: string;
  origin: 'agent_reflection' | 'user_feedback';
  evidence_observation_ids: string[];
  learned_from_actor_ids: string[];
  failure_count: number;
  success_count: number;
  validation_status: 'candidate' | 'validated';
  confidence: number;
  utility_score: number;
  learned_at: string;
  last_applied_at?: string;
}

interface LearningsResponse {
  summary: {
    total: number;
    candidates: number;
    validated: number;
    successful_applications: number;
    failed_attempts_learned_from: number;
    conversations_indexed: number;
  };
  cadence: {
    mode: 'manual_only' | 'hourly' | 'every_6h' | 'daily';
    last_dreamed_at: string | null;
    next_dream_after: string | null;
  };
  lessons: ExperienceLesson[];
}

type LessonFilter = 'all' | 'candidate' | 'validated';

function authHeaders(token?: string): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function shortDate(value?: string | null): string {
  if (!value) return 'Not yet';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Not yet';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function cadenceLabel(mode: LearningsResponse['cadence']['mode']): string {
  if (mode === 'manual_only') return 'Manual';
  if (mode === 'every_6h') return 'Every 6 hours';
  return mode[0]!.toUpperCase() + mode.slice(1);
}

export function LearningsView(props: { authToken?: string }) {
  const [data, setData] = React.useState<LearningsResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [dreaming, setDreaming] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [filter, setFilter] = React.useState<LessonFilter>('all');
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/pod/experience/lessons?limit=500', {
        headers: authHeaders(props.authToken),
      });
      if (!response.ok) throw new Error(`Pod returned ${response.status}`);
      const next = await response.json() as LearningsResponse;
      setData(next);
      setSelectedId(current => current && next.lessons.some(lesson => lesson.id === current)
        ? current
        : next.lessons[0]?.id ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Learnings could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [props.authToken]);

  React.useEffect(() => { void load(); }, [load]);

  const runDream = async () => {
    setDreaming(true);
    setError(null);
    try {
      const runtimeResponse = await fetch('/pod/runtime', { headers: authHeaders(props.authToken) });
      if (!runtimeResponse.ok) throw new Error(`Pod returned ${runtimeResponse.status}`);
      const runtime = await runtimeResponse.json() as { owner_id: string };
      const response = await fetch('/pod/dream', {
        method: 'POST',
        headers: { ...authHeaders(props.authToken), 'content-type': 'application/json' },
        body: JSON.stringify({ actor_id: runtime.owner_id, scope_alias: 'workspace' }),
      });
      if (!response.ok) throw new Error(`Dream returned ${response.status}`);
      await load();
    } catch (dreamError) {
      setError(dreamError instanceof Error ? dreamError.message : 'Dream could not run.');
    } finally {
      setDreaming(false);
    }
  };

  const filtered = (data?.lessons ?? []).filter(lesson => {
    if (filter !== 'all' && lesson.validation_status !== filter) return false;
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return [
      lesson.task.key,
      lesson.task.title,
      lesson.task.goal,
      lesson.instruction,
      lesson.applies_when,
      lesson.failure,
      ...lesson.task.tags,
    ].filter(Boolean).join(' ').toLowerCase().includes(needle);
  });
  const selected = filtered.find(lesson => lesson.id === selectedId)
    ?? data?.lessons.find(lesson => lesson.id === selectedId)
    ?? filtered[0]
    ?? null;

  return (
    <div className="learnings-view">
      <header className="learnings-header">
        <div>
          <div className="learnings-eyebrow"><Lightbulb size={13} /> Pod learnings</div>
          <h1>What worked better next time</h1>
          <p>Lessons carried between the agents and apps allowed to use the same memory space.</p>
          <div className="learnings-memory-note">
            <MessageSquare size={12} />
            <span>{data?.summary.conversations_indexed ?? '—'} source-backed conversation{data?.summary.conversations_indexed === 1 ? '' : 's'} ready to recall</span>
          </div>
        </div>
        <div className="learnings-dream-status">
          <span><Moon size={14} /> Dream · {data ? cadenceLabel(data.cadence.mode) : '—'}</span>
          <small>{data?.cadence.next_dream_after ? `Next review ${shortDate(data.cadence.next_dream_after)}` : 'Automatic review is off'}</small>
          <button type="button" onClick={() => void runDream()} disabled={dreaming || loading}>
            {dreaming ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />}
            {dreaming ? 'Reviewing…' : 'Review now'}
          </button>
        </div>
      </header>

      {error && (
        <div className="learnings-error"><TriangleAlert size={15} /> {error} <button onClick={() => void load()}>Try again</button></div>
      )}

      <section className="learning-proof-rail" aria-label="How Pod learning is progressing">
        <div className="learning-proof-step">
          <span>{data?.summary.failed_attempts_learned_from ?? '—'}</span>
          <small>Mistakes noticed</small>
        </div>
        <ArrowRight className="learning-proof-arrow" size={18} />
        <div className="learning-proof-step is-middle">
          <span>{data?.summary.total ?? '—'}</span>
          <small>Better approaches kept</small>
        </div>
        <ArrowRight className="learning-proof-arrow" size={18} />
        <div className="learning-proof-step is-proven">
          <span>{data?.summary.successful_applications ?? '—'}</span>
          <small>Later runs helped</small>
        </div>
      </section>

      <div className="learnings-toolbar">
        <div className="learnings-filters" role="group" aria-label="Filter learnings">
          {([
            ['all', 'All', data?.summary.total],
            ['candidate', 'Still learning', data?.summary.candidates],
            ['validated', 'Proven useful', data?.summary.validated],
          ] as const).map(([key, label, count]) => (
            <button key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>
              {label}<span>{count ?? 0}</span>
            </button>
          ))}
        </div>
        <label className="learnings-search">
          <Search size={14} />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search learnings" />
        </label>
      </div>

      <div className={`learnings-body${selected ? ' has-detail' : ''}`}>
        <div className="learnings-list" aria-busy={loading}>
          {loading && !data && (
            <div className="learnings-empty"><Loader2 size={22} className="spin" /><strong>Reviewing what Pod has learned…</strong></div>
          )}
          {!loading && data && data.lessons.length === 0 && (
            <div className="learnings-empty">
              <CircleDashed size={28} />
              <strong>No learnings yet</strong>
              <p>After an agent records a failed attempt and a better next step, Pod will carry that lesson into a later run.</p>
            </div>
          )}
          {!loading && data && data.lessons.length > 0 && filtered.length === 0 && (
            <div className="learnings-empty"><Search size={24} /><strong>No matching learnings</strong><p>Try a different search or filter.</p></div>
          )}
          {filtered.map(lesson => (
            <button
              type="button"
              key={lesson.id}
              className={`learning-row${selected?.id === lesson.id ? ' selected' : ''}`}
              onClick={() => setSelectedId(lesson.id)}
            >
              <span className={`learning-state-dot is-${lesson.validation_status}`} />
              <span className="learning-row-copy">
                <span className="learning-row-meta">
                  <code>{lesson.task.title ?? lesson.task.key}</code>
                  <span>{lesson.validation_status === 'validated' ? 'Proven useful' : 'Still learning'}</span>
                </span>
                <strong>{lesson.instruction}</strong>
                <small>{lesson.success_count > 0 ? `Helped ${lesson.success_count} later run${lesson.success_count === 1 ? '' : 's'}` : 'Waiting to see if this helps'}</small>
              </span>
              <ArrowRight size={14} />
            </button>
          ))}
        </div>

        {selected && (
          <aside className="learning-detail">
            <div className="learning-detail-top">
              <span className={`learning-state-badge is-${selected.validation_status}`}>
                {selected.validation_status === 'validated' ? <CheckCircle2 size={13} /> : <CircleDashed size={13} />}
                {selected.validation_status === 'validated' ? 'Proven useful' : 'Still learning'}
              </span>
              <span className="learning-detail-date">Learned {shortDate(selected.learned_at)}</span>
            </div>
            <h2>{selected.instruction}</h2>
            <div className="learning-detail-section">
              <span>Use this when</span>
              <p>{selected.applies_when}</p>
            </div>
            <div className="learning-detail-section is-failure">
              <span>What went wrong before</span>
              <p>{selected.failure}</p>
            </div>
            <div className="learning-detail-section">
              <span>Why Pod kept it</span>
              <p>{selected.feedback}</p>
            </div>
            <div className="learning-evidence-chain">
              <div><strong>{selected.failure_count}</strong><span>failed attempt{selected.failure_count === 1 ? '' : 's'}</span></div>
              <ArrowRight size={15} />
              <div className="is-lesson"><Lightbulb size={16} /><span>lesson</span></div>
              <ArrowRight size={15} />
              <div className={selected.success_count > 0 ? 'is-success' : ''}><strong>{selected.success_count}</strong><span>helped run{selected.success_count === 1 ? '' : 's'}</span></div>
            </div>
            <dl className="learning-detail-meta">
              <div><dt>Task</dt><dd>{selected.task.title ?? selected.task.key}</dd></div>
              {selected.task.environment && <div><dt>Environment</dt><dd>{selected.task.environment}</dd></div>}
              <div><dt>Proposed by</dt><dd>{selected.origin === 'user_feedback' ? 'Your correction' : 'Agent reflection'}</dd></div>
              <div><dt>Confidence</dt><dd>{Math.round(selected.confidence * 100)}%</dd></div>
              <div><dt>Evidence</dt><dd>{selected.evidence_observation_ids.length} source{selected.evidence_observation_ids.length === 1 ? '' : 's'}</dd></div>
            </dl>
          </aside>
        )}
      </div>
    </div>
  );
}
