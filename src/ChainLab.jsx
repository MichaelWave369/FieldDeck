import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, FileDown, FileUp, ListChecks, Plus, RotateCcw, Trash2, ShieldCheck } from 'lucide-react';
import { APPROVED_CHAIN, STEPS, addStep, exportDraft, isApprovedChain, moveStep, normalizeSteps, removeStep } from './chain-model.mjs';

import { BLUEPRINT_TEMPLATES, MAX_BLUEPRINT_BYTES, createBlueprint, parseBlueprint, preflightChain } from './blueprint-model.mjs';

const STORAGE_KEY = 'fielddeck-chain-draft-v0.4';
function readLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return raw === null ? [...APPROVED_CHAIN.steps] : normalizeSteps(raw);
  } catch { return [...APPROVED_CHAIN.steps]; }
}

export default function ChainLab({ onRequest, onExport, catalogActions = [] }) {
  const [steps, setSteps] = useState(readLocal);
  const [newStep, setNewStep] = useState(STEPS[0].id);
  const [templateId, setTemplateId] = useState(BLUEPRINT_TEMPLATES[0].id);
  const [preflight, setPreflight] = useState(null);
  const [blueprintNotice, setBlueprintNotice] = useState('');
  const [blueprintError, setBlueprintError] = useState('');
  const fileInput = useRef(null);
  const proposal = preflightChain(steps, catalogActions);
  const approved = isApprovedChain(steps) && proposal.status === 'REQUEST_ELIGIBLE';
  useEffect(() => { setPreflight(null); }, [steps]);

  function loadTemplate() {
    const chosen = BLUEPRINT_TEMPLATES.find(item => item.id === templateId);
    if (!chosen) return;
    setSteps([...chosen.steps]);
    setBlueprintError('');
    setBlueprintNotice('Template loaded as a local draft. Nothing has executed.');
  }

  async function importFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > MAX_BLUEPRINT_BYTES) throw new Error('Maximum blueprint size is 16 KB.');
      const text = await file.text();
      const result = parseBlueprint(text);
      setSteps(result.steps);
      setBlueprintError('');
      setBlueprintNotice('Imported "' + result.name + '" as a draft. No execution permission was imported.');
    } catch (err) {
      setBlueprintError(err.message);
      setBlueprintNotice('');
    }
  }

  function preview() {
    const report = preflightChain(steps, catalogActions);
    setPreflight(report);
    setBlueprintError('');
    setBlueprintNotice('Preflight is read-only. No job was started.');
  }

  function exportBlueprint() {
    try {
      onExport(createBlueprint(steps));
      setBlueprintError('');
    } catch (err) { setBlueprintError(err.message); }
  }
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(steps)); } catch {} }, [steps]);

  return <section className="chain-lab" id="chain-lab" aria-labelledby="chain-heading">
    <div className="chain-intro">
      <div><span className="section-kicker">04 / AUTOMATION LAB</span><h2 id="chain-heading">Chain composer</h2>
        <p>Compose from reviewed action IDs, load templates, import or export safe blueprints, and preview readiness. Drafts never grant execution authority.</p></div>
      <div className={approved ? 'chain-mode approved' : 'chain-mode'}><ListChecks size={17}/>{approved ? 'REQUEST ELIGIBLE' : proposal.status === 'BLOCKED' ? 'CATALOG BLOCKED' : 'DRAFT ONLY'}</div>
    </div>
    <div className="blueprint-templates">
      <label htmlFor="blueprint-template">STARTER BLUEPRINT</label>
      <select id="blueprint-template" value={templateId} onChange={e => setTemplateId(e.target.value)}>
        {BLUEPRINT_TEMPLATES.map(template => <option key={template.id} value={template.id}>{template.label} · {template.id === 'approved-health-sweep' ? 'reviewed' : 'draft only'}</option>)}
      </select>
      <button type="button" onClick={loadTemplate}>LOAD TEMPLATE</button>
      <span>Only Field Health Sweep is executable through an authenticated GitHub request.</span>
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
    <div className="blueprint-preflight">
      <div className="blueprint-head">
        <div><span className="section-kicker">05 / READ-ONLY VALIDATION</span><h3>Blueprint preflight</h3></div>
        <button type="button" className="chain-secondary" onClick={preview}><ShieldCheck size={15}/> RUN PREFLIGHT</button>
      </div>
      <p>Validates step order and catalog readiness locally. Never contacts an execution runner.</p>
      {preflight && <div className="blueprint-report" role="status">
        <strong>{preflight.status.replaceAll('_', ' ')}</strong>
        <span>EXECUTION AUTHORIZED: NO</span>
        {preflight.steps.map(check => <div className="preflight-row" key={check.index}>
          <span>{String(check.index).padStart(2, '0')} · {check.action_id}</span>
          <small>{check.check.replaceAll('_', ' ')}</small>
        </div>)}
        <small>This is a planning report, not an execution receipt.</small>
      </div>}
      {blueprintNotice && <p className="blueprint-message" role="status">{blueprintNotice}</p>}
      {blueprintError && <p className="blueprint-error" role="alert">{blueprintError}</p>}
    </div>
    <div className="chain-bottom">
      <p>{approved ? 'Exact reviewed sequence and catalog-ready steps. GitHub issue submission and permission verification are still required.' : 'Custom or unavailable sequences can only be inspected and exported, never executed.'}</p>
      <div className="chain-buttons">
        <button type="button" className="chain-secondary" onClick={() => setSteps([...APPROVED_CHAIN.steps])}><RotateCcw size={15}/> RESET TO PRESET</button>
        <button type="button" className="chain-secondary" onClick={() => onExport(exportDraft(steps))}><FileDown size={15}/> LEGACY DRAFT</button>
        <button type="button" className="chain-secondary" onClick={exportBlueprint}><FileDown size={15}/> EXPORT BLUEPRINT</button>
        <input ref={fileInput} type="file" accept=".json,application/json" className="blueprint-file" aria-label="Import blueprint JSON" onChange={importFile}/>
        <button type="button" className="chain-secondary" onClick={() => fileInput.current?.click()}><FileUp size={15}/> IMPORT BLUEPRINT</button>
        <button type="button" className="chain-execute" disabled={!approved} onClick={onRequest}><ExternalLink size={15}/> REQUEST APPROVED CHAIN</button>
      </div>
    </div>
  </section>;
}
