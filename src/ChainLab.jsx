import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, FileDown, ListChecks, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { APPROVED_CHAIN, STEPS, addStep, exportDraft, isApprovedChain, moveStep, normalizeSteps, removeStep } from './chain-model.mjs';

const STORAGE_KEY = 'fielddeck-chain-draft-v0.4';
function readLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return raw === null ? [...APPROVED_CHAIN.steps] : normalizeSteps(raw);
  } catch { return [...APPROVED_CHAIN.steps]; }
}

export default function ChainLab({ onRequest, onExport }) {
  const [steps, setSteps] = useState(readLocal);
  const [newStep, setNewStep] = useState(STEPS[0].id);
  const approved = isApprovedChain(steps);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(steps)); } catch {} }, [steps]);

  return <section className="chain-lab" id="chain-lab" aria-labelledby="chain-heading">
    <div className="chain-intro">
      <div><span className="section-kicker">04 / AUTOMATION LAB</span><h2 id="chain-heading">Chain composer</h2>
        <p>Arrange approved building blocks. Drafts stay local. Only the reviewed Field Health Sweep preset can be submitted to GitHub for execution.</p></div>
      <div className={approved ? 'chain-mode approved' : 'chain-mode'}><ListChecks size={17}/>{approved ? 'APPROVED PRESET' : 'DRAFT ONLY'}</div>
    </div>
    <div className="chain-track" aria-label="Chain steps">
      {steps.length === 0 && <p className="chain-empty">Add a step to build a draft.</p>}
      {steps.map((id, index) => {
        const step = STEPS.find(s => s.id === id);
        return <div key={index + ':' + id} className="chain-step">
          <span className="chain-index">{String(index + 1).padStart(2, '0')}</span>
          <div className="chain-step-content"><strong>{step?.label}</strong><small>{step?.detail}</small></div>
          <div className="chain-step-tools">
            <button type="button" aria-label={'Move ' + step.label + ' up'} disabled={index === 0} onClick={() => setSteps(s => moveStep(s, index, -1))}><ArrowUp size={15}/></button>
            <button type="button" aria-label={'Move ' + step.label + ' down'} disabled={index === steps.length - 1} onClick={() => setSteps(s => moveStep(s, index, 1))}><ArrowDown size={15}/></button>
            <button type="button" aria-label={'Remove ' + step.label} onClick={() => setSteps(s => removeStep(s, index))}><Trash2 size={15}/></button>
          </div>
        </div>;
      })}
    </div>
    <div className="chain-compose-controls">
      <label htmlFor="chain-step-picker">ADD ALLOWLISTED STEP</label>
      <select id="chain-step-picker" value={newStep} onChange={e => setNewStep(e.target.value)}>
        {STEPS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      <button type="button" className="chain-add" disabled={steps.length >= 6} onClick={() => setSteps(s => addStep(s, newStep))}><Plus size={15}/> ADD STEP</button>
    </div>
    <div className="chain-bottom">
      <p>{approved ? 'Exact reviewed sequence. GitHub issue submission and permission verification are still required.' : 'Custom sequences can be exported, but cannot run. This is a design draft, not approval.'}</p>
      <div className="chain-buttons">
        <button type="button" className="chain-secondary" onClick={() => setSteps([...APPROVED_CHAIN.steps])}><RotateCcw size={15}/> RESET TO PRESET</button>
        <button type="button" className="chain-secondary" onClick={() => onExport(exportDraft(steps))}><FileDown size={15}/> EXPORT DRAFT</button>
        <button type="button" className="chain-execute" disabled={!approved} onClick={onRequest}><ExternalLink size={15}/> REQUEST APPROVED CHAIN</button>
      </div>
    </div>
  </section>;
}
