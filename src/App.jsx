import { useEffect, useMemo, useState } from 'react';
import { issueRequestUrl } from '../scripts/issue_gate.mjs';
import ChainLab from './ChainLab.jsx';
import ReviewBoard from './ReviewBoard.jsx';
import PilotConsole from './PilotConsole.jsx';
import { proposalIssueUrl } from './proposal-model.mjs';
import { BASE_DECK, normalizeDecks, addDeck, toggleInDeck, removeDeck } from './deck-model.mjs';
import { publicRunsApi, parsePublicRuns } from './run-model.mjs';
import {
  Activity, ArrowUpRight, Bot, BrainCircuit, Check, ChevronRight,
  Clock3, Database, Download, ExternalLink, HardDrive, Layers3,
  LockKeyhole, MousePointerClick, Search, ShieldCheck, Terminal, Zap, Plus, Star, Trash2, RefreshCw, ListChecks
} from 'lucide-react';

const ICONS = {
  activity: Activity, terminal: Terminal, 'mouse-pointer-click': MousePointerClick,
  'brain-circuit': BrainCircuit, download: Download, 'external-link': ExternalLink, 'list-checks': ListChecks,
  bot: Bot, 'hard-drive': HardDrive, database: Database, 'clock-3': Clock3
};
const NAV = ['All actions', 'Skills', 'Scripts', 'Macros', 'Automations', 'Diagnostics', 'Agents', 'Apps'];
const CATALOG_URL = import.meta.env.BASE_URL + 'fielddeck.manifest.json';
const REPO = import.meta.env.VITE_REPOSITORY || 'MichaelWave369/FieldDeck';
const VALID_KINDS = new Set(['workflow', 'copy', 'export', 'link', 'future']);

function validatedCatalog(data) {
  if (!data || !Array.isArray(data.actions) || data.execution_policy?.default !== 'deny') {
    throw new Error('Invalid or unsafe catalog policy');
  }
  const used = new Set();
  for (const a of data.actions) {
    if (!a.id || !a.label || !a.group || !VALID_KINDS.has(a.kind) || used.has(a.id)) {
      throw new Error('Invalid catalog action');
    }
    used.add(a.id);
  }
  return data;
}
function loadHistory() {
  try {
    const items = JSON.parse(localStorage.getItem('fielddeck-interactions-v1') || '[]');
    return Array.isArray(items) ? items.slice(0, 10) : [];
  } catch { return []; }
}
function loadDecks() {
  try { return normalizeDecks(JSON.parse(localStorage.getItem('fielddeck-decks-v1') || 'null')); }
  catch { return normalizeDecks(null); }
}
function saveJSON(name, value) {
  const blob = new Blob([JSON.stringify(value, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
function Glyph({ name, size = 20 }) {
  const Icon = ICONS[name] || Zap;
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true" />;
}

export default function App() {
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('All actions');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [history, setHistory] = useState(loadHistory);
  const [notice, setNotice] = useState('');
  const [decks, setDecks] = useState(loadDecks);
  const [pinTarget, setPinTarget] = useState(BASE_DECK.id);
  const [showDeckForm, setShowDeckForm] = useState(false);
  const [deckName, setDeckName] = useState('');
  const [deckError, setDeckError] = useState('');
  const [runs, setRuns] = useState([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [runsError, setRunsError] = useState('');
  const [lastChecked, setLastChecked] = useState(null);

  useEffect(() => {
    try { localStorage.setItem('fielddeck-decks-v1', JSON.stringify(decks)); } catch {}
  }, [decks]);

  async function refreshRuns(signal) {
    setRunsLoading(true);
    setRunsError('');
    try {
      const response = await fetch(publicRunsApi(REPO), {
        signal,
        headers: { Accept: 'application/vnd.github+json' }
      });
      if (!response.ok) throw new Error(response.status === 403 ? 'GitHub API rate limit or access denied (403)' : 'GitHub API returned ' + response.status);
      setRuns(parsePublicRuns(await response.json(), REPO));
      setLastChecked(new Date().toLocaleTimeString());
    } catch (e) {
      if (e.name !== 'AbortError') setRunsError(e.message);
    } finally {
      if (!signal?.aborted) setRunsLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    refreshRuns(controller.signal);
    return () => controller.abort();
  }, []);

  function createPersonalDeck(event) {
    event.preventDefault();
    try {
      const id = 'deck-' + globalThis.crypto.randomUUID();
      const next = addDeck(decks, deckName, id);
      setDecks(next);
      setPinTarget(id);
      setCategory('@deck:' + id);
      setDeckName('');
      setDeckError('');
      setShowDeckForm(false);
    } catch (e) { setDeckError(e.message); }
  }

  function removePersonalDeck(id) {
    if (!window.confirm('Delete this local deck? Catalog actions will not be deleted.')) return;
    setDecks((current) => removeDeck(current, id));
    setCategory('All actions');
    setPinTarget(BASE_DECK.id);
  }

  function toggleSelectedPin(action) {
    try {
      setDecks(current => toggleInDeck(current, pinTarget, action.id));
      setNotice('Updated your local deck. This does not change execution permissions.');
    } catch (e) { setNotice(e.message); }
  }

  useEffect(() => {
    const controller = new AbortController();
    fetch(CATALOG_URL, { signal: controller.signal })
      .then((r) => { if (!r.ok) throw new Error('Catalog HTTP ' + r.status); return r.json(); })
      .then((v) => {
        const next = validatedCatalog(v);
        setCatalog(next);
        setSelectedId(next.actions[0]?.id || null);
      })
      .catch((e) => { if (e.name !== 'AbortError') setError(e.message); });
    return () => controller.abort();
  }, []);

  const actions = catalog?.actions || [];
  const ready = actions.filter((a) => a.status === 'ready').length;
  const currentDeck = category.startsWith('@deck:') ? decks.find(d => d.id === category.slice(6)) : null;
  const selectedPinDeck = decks.find(d => d.id === pinTarget) || decks[0];
  const visible = useMemo(() => actions.filter((a) => {
    const matches = currentDeck ? currentDeck.actionIds.includes(a.id) : category === 'All actions' || a.group === category;
    const text = (a.label + ' ' + a.description + ' ' + a.group).toLowerCase();
    return matches && text.includes(search.toLowerCase());
  }), [actions, category, currentDeck, search]);
  const selected = visible.find((a) => a.id === selectedId) || visible[0] || null;

  function record(action, status, detail) {
    const event = {
      id: Date.now() + '-' + Math.random().toString(16).slice(2),
      title: action.label, status, detail,
      time: new Date().toLocaleString()
    };
    setHistory((previous) => {
      const next = [event, ...previous].slice(0, 10);
      try { localStorage.setItem('fielddeck-interactions-v1', JSON.stringify(next)); } catch {}
      return next;
    });
    setNotice(detail);
  }
  async function activate(action) {
    if (!action || action.status !== 'ready') return;
    try {
      if (action.kind === 'workflow') {
        window.open(issueRequestUrl(REPO, action.task), '_blank', 'noopener,noreferrer');
        record(action, 'HANDOFF', 'Opened a prefilled GitHub request. Review and SUBMIT the issue to request the job; no job has run yet. Only repository writers are authorized.');
      } else if (action.kind === 'copy') {
        await navigator.clipboard.writeText(action.payload);
        record(action, 'LOCAL', 'Research skill copied to clipboard.');
      } else if (action.kind === 'export') {
        saveJSON('fielddeck.manifest.json', catalog);
        record(action, 'LOCAL', 'Action catalog downloaded to your device.');
      } else if (action.kind === 'link') {
        const url = new URL(action.url);
        if (url.protocol !== 'https:') throw new Error('Only HTTPS links are allowed');
        window.open(url.href, '_blank', 'noopener,noreferrer');
        record(action, 'HANDOFF', 'Opened external application in another tab.');
      }
    } catch (e) {
      record(action, 'ERROR', 'Action failed: ' + e.message);
    }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href={import.meta.env.BASE_URL} aria-label="FieldDeck home">
          <span className="brand-symbol"><Layers3 size={23} /></span>
          <span><strong>FIELDDECK</strong><small>THE ACTION FABRIC</small></span>
        </a>
        <div className="side-caption">WORKSPACE</div>
        <nav className="navigation" aria-label="Action categories">
          {NAV.map((name) => {
            const Icon = ({
              'All actions': Layers3, Skills: BrainCircuit, Scripts: Terminal,
              Macros: MousePointerClick, Automations: Clock3, Diagnostics: Activity,
              Agents: Bot, Apps: ExternalLink
            })[name];
            return <button type="button" key={name} onClick={() => setCategory(name)} className={category === name ? 'nav-link active' : 'nav-link'}>
              <Icon size={17} strokeWidth={1.7} /><span>{name}</span>
              {name === 'All actions' && <b>{actions.length || '·'}</b>}
            </button>;
          })}
        </nav>
        <a className="nav-link chain-side-link" href="#chain-lab"><ListChecks size={17} strokeWidth={1.7}/><span>Chain Lab</span><ArrowUpRight size={13}/></a>
        <a className="nav-link chain-side-link" href="#review-board"><ShieldCheck size={17} strokeWidth={1.7}/><span>Review Board</span><ArrowUpRight size={13}/></a>
        <a className="nav-link chain-side-link" href="#pilot-console"><Activity size={17} strokeWidth={1.7}/><span>Pilot Console</span><ArrowUpRight size={13}/></a>
        <div className="side-caption decks-caption">MY DECKS</div>
        <nav className="navigation deck-nav" aria-label="Personal decks">
          {decks.map(deck => <button key={deck.id} type="button"
            onClick={() => { setCategory('@deck:' + deck.id); setPinTarget(deck.id); }}
            className={category === '@deck:' + deck.id ? 'nav-link active' : 'nav-link'}>
            <Star size={16} strokeWidth={1.7}/><span>{deck.name}</span><b>{deck.actionIds.length}</b>
          </button>)}
        </nav>
        {showDeckForm ? <form className="deck-form" onSubmit={createPersonalDeck}>
          <input aria-label="New deck name" maxLength={36} value={deckName} onChange={e => setDeckName(e.target.value)} placeholder="Deck name..." required/>
          <div><button type="submit">CREATE</button><button type="button" onClick={() => {setShowDeckForm(false);setDeckError('');}}>CANCEL</button></div>
          {deckError && <small role="alert">{deckError}</small>}
        </form> : <button type="button" className="new-deck" onClick={() => setShowDeckForm(true)}><Plus size={15}/> NEW DECK</button>}
        <div className="sidebar-spacer" />
        <div className="side-note"><ShieldCheck size={18} /><strong>GOVERNED BY DEFAULT</strong><span>Discovery never grants execution authority.</span></div>
        <a className="repo-link" href={'https://github.com/' + REPO} target="_blank" rel="noreferrer">VIEW SOURCE <ArrowUpRight size={14}/></a>
      </aside>
      <main className="main">
        <header className="topbar">
          <div><span className="breadcrumb">FIELD SYSTEM</span><ChevronRight size={14}/><span>CONTROL SURFACE</span></div>
          <div className="topbar-right"><span className="status-dot" /> PUBLIC CATALOG <span className="version">v0.9.1</span></div>
        </header>

        <div className="content">
          <div className="eyebrow"><span className="eyebrow-line" /> HUMAN + AGENT COMMAND INTERFACE</div>
          <section className="hero">
            <div>
              <h1>Every action.<br/><em>One deck.</em></h1>
              <p>Launch reviewed skills, scripts, macros, and workflows from a single governed surface. Built for humans. Readable by agents.</p>
              <div className="hero-meta"><span><span className="micro-dot"/> CATALOG ONLINE</span><span>CAPABILITY ≠ AUTHORITY</span></div>
            </div>
            <div className="hero-visual" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="core"><Zap size={38} strokeWidth={1.4}/></div></div>
          </section>

          <div className="stats">
            <div className="stat"><span>TOTAL ACTIONS</span><strong>{actions.length}</strong><small>REGISTRY ENTRIES</small></div>
            <div className="stat"><span>READY</span><strong>{ready}</strong><small>BROWSER + HANDOFF</small></div>
            <div className="stat"><span>LOCKED</span><strong>{actions.length - ready}</strong><small>FUTURE / GOVERNED</small></div>
            <div className="stat policy"><ShieldCheck size={24}/><div><strong>DEFAULT DENY</strong><small>EXECUTION POLICY ACTIVE</small></div></div>
          </div>

          <div className="section-header">
            <div><span className="section-kicker">01 / COMMAND LIBRARY</span><h2>{currentDeck ? currentDeck.name : category}</h2>
              {currentDeck && currentDeck.id !== BASE_DECK.id && <button type="button" className="delete-deck" onClick={() => removePersonalDeck(currentDeck.id)}><Trash2 size={13}/> DELETE THIS DECK</button>}
            </div>
            <label className="search"><Search size={17}/><input placeholder="Search actions..." aria-label="Search actions" value={search} onChange={(e) => setSearch(e.target.value)}/></label>
          </div>

          {error && <div role="alert" className="error">Catalog unavailable: {error}</div>}
          {!catalog && !error && <div className="loading">Reading the action catalog…</div>}
          {catalog && visible.length === 0 && <div className="loading">No actions matched your filters.</div>}

          <div className="action-layout">
            <div className="tiles">
              {visible.map((a) => <button type="button" key={a.id} onClick={() => setSelectedId(a.id)} className={'tile ' + (selected?.id === a.id ? 'selected' : '') + (a.status === 'locked' ? ' locked' : '')}>
                <div className="tile-top"><div className="tile-icon"><Glyph name={a.icon} size={23}/></div>{a.status === 'locked' ? <LockKeyhole size={16}/> : <ArrowUpRight size={16}/>}</div>
                <strong>{a.label}</strong>
                <p>{a.description}</p>
                <div className="tile-bottom"><span>{a.group.toUpperCase()}</span><span className={a.status === 'ready' ? 'state ready' : 'state'}>{a.status.toUpperCase()}</span></div>
              </button>)}
            </div>
            <aside className="inspector">
              <div className="inspector-header"><span>02 / ACTION INSPECTOR</span><span className="inspector-dot"/></div>
              {selected ? <>
                <div className="inspect-glyph"><Glyph name={selected.icon} size={30}/></div>
                <div className="inspect-group">{selected.group.toUpperCase()} / {selected.kind.toUpperCase()}</div>
                <h3>{selected.label}</h3>
                <p>{selected.description}</p>
                <div className="inspect-details">
                  <div><span>STATUS</span><strong>{selected.status.toUpperCase()}</strong></div>
                  <div><span>RISK LEVEL</span><strong>{selected.risk.toUpperCase()}</strong></div>
                  <div><span>EXECUTION</span><strong>{selected.kind === 'workflow' ? 'GITHUB ISSUE REQUEST' : selected.kind === 'future' ? 'DISABLED' : 'BROWSER'}</strong></div>
                </div>
                <div className="deck-picker">
                  <label htmlFor="deck-target">PERSONAL DECK</label>
                  <select id="deck-target" value={pinTarget} onChange={e => setPinTarget(e.target.value)}>
                    {decks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <button type="button" className="pin-action" onClick={() => toggleSelectedPin(selected)}>
                    <Star size={15} fill={selectedPinDeck.actionIds.includes(selected.id) ? 'currentColor' : 'none'}/>
                    {selectedPinDeck.actionIds.includes(selected.id) ? 'REMOVE FROM DECK' : 'ADD TO DECK'}
                  </button>
                </div>
                <button type="button" className="activate" disabled={selected.status !== 'ready'} onClick={() => activate(selected)}>
                  {selected.status === 'locked' ? <LockKeyhole size={17}/> : selected.kind === 'workflow' ? <ExternalLink size={17}/> : <Zap size={17}/>}
                  {selected.status === 'locked' ? 'NOT ENABLED' : selected.kind === 'workflow' ? 'REQUEST VIA GITHUB' : 'ACTIVATE'}
                </button>
                {selected.kind === 'workflow' && <a className="manual-action-link" href={'https://github.com/' + REPO + '/actions/workflows/run-task.yml'} target="_blank" rel="noreferrer">OR OPEN ACTIONS MANUALLY <ArrowUpRight size={12}/></a>}
                <p className="inspector-footnote">{selected.kind === 'workflow' ? 'Opens a prefilled GitHub issue. Submit it to request an allowlisted job; GitHub checks your repository write permission. Receipts appear in Actions.' : 'Catalog discovery alone never authorizes remote execution.'}</p>
              </> : <p>Select an action to inspect its permissions and available controls.</p>}
            </aside>
          </div>

          {notice && <div className="notice" role="status"><Check size={16} />{notice}<button type="button" aria-label="Dismiss" onClick={() => setNotice('')}>×</button></div>}

          <section className="live-executions">
            <div className="ledger-title"><div><span className="section-kicker">03 / VERIFIED EXECUTIONS</span><h2>Live run history</h2></div>
              <button type="button" className="refresh-runs" onClick={() => refreshRuns()} disabled={runsLoading}>
                <RefreshCw size={15}/> {runsLoading ? 'CHECKING…' : 'REFRESH'}
              </button>
            </div>
            <p className="ledger-receipts">Read-only history from the public GitHub Actions API. A browser handoff is not a completed run. {lastChecked && 'Last checked: ' + lastChecked}</p>
            {runsError && <div className="runs-error" role="alert">{runsError}. <a href={'https://github.com/' + REPO + '/actions/workflows/issueops.yml'} target="_blank" rel="noreferrer">View GitHub Actions <ArrowUpRight size={12}/></a></div>}
            {!runsError && runsLoading && runs.length === 0 && <p className="runs-empty">Checking public GitHub runs…</p>}
            {!runsError && !runsLoading && runs.length === 0 && <p className="runs-empty">No authenticated IssueOps requests found yet.</p>}
            {runs.map(run => <a className="live-row" key={run.id} href={run.url} target="_blank" rel="noreferrer">
              <span className={'run-pill ' + (run.conclusion || run.status)}>{(run.conclusion || run.status).replaceAll('_',' ').toUpperCase()}</span>
              <strong>{run.task}</strong>
              <span>{run.createdAt ? new Date(run.createdAt).toLocaleString() : 'Unknown date'}</span>
              <ArrowUpRight size={15}/>
            </a>)}
          </section>
          <ChainLab
            catalogActions={actions}
            onPropose={(blueprint) => {
              const url = proposalIssueUrl(REPO, blueprint);
              const opened = window.open(url, '_blank', 'noopener,noreferrer');
              record({ label: 'Blueprint Proposal' }, 'HANDOFF', 'Opened a prefilled review-only GitHub issue. Submit there to request validation. No execution occurred.');
            }}
            onRequest={() => {
              const chainAction = actions.find(a => a.id === 'field-health-sweep' && a.status === 'ready');
              if (chainAction) activate(chainAction);
              else setNotice('Approved chain is unavailable in the current catalog.');
            }}
            onExport={(draft) => {
              saveJSON('fielddeck-chain-draft.json', draft);
              setNotice('Local chain draft exported. This grants no execution permission.');
            }}
          />
          <ReviewBoard repository={REPO}/>
          <PilotConsole repository={REPO} onExport={(report) => {
            saveJSON('fielddeck-review-pilot-observation.json', report);
            setNotice('Read-only GitHub evidence report downloaded. It is not an execution receipt.');
          }}/>
          <section className="ledger">
            <div className="ledger-title"><div><span className="section-kicker">08 / LOCAL EVENT LOG</span><h2>Recent interactions</h2></div><span>Browser only • not execution receipts</span></div>
            <p className="ledger-receipts">Actual run receipts are published in <a href={'https://github.com/' + REPO + '/actions/workflows/issueops.yml'} target="_blank" rel="noreferrer">GitHub Actions <ArrowUpRight size={12}/></a>. Submission and authorization happen on GitHub, not this public page.</p>
            {history.length === 0 ? <p>No actions recorded in this browser yet.</p> :
              history.map((e) => <div className="ledger-row" key={e.id}><span className="ledger-state">{e.status}</span><span>{e.title}</span><small>{e.time}</small></div>)}
          </section>
          <footer>FIELDDECK / v0.9.1 <span>BUILT FOR THE FIELD · DISCOVERY IS NOT AUTHORITY</span></footer>
        </div>
      </main>
    </div>
  );
}
