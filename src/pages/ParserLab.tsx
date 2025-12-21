import { useState, useEffect, useRef } from 'react';
import { Grammar, parseGrammar } from '../core/Grammar';
import { buildParsingTable, type ParsingTable } from '../core/Table';
import { parseString, type ParseStep } from '../core/Parser';
import { AlertCircle, CheckCircle, Play, Zap, FastForward, Pause, SkipForward, RotateCcw } from 'lucide-react';

const SAMPLES = {
  simple: { grammar: `S -> C C\nC -> c C | d`, input: 'c c d d', label: 'Simple' },
  assignment: { grammar: `S -> L = R | R\nL -> * R | i\nR -> L`, input: '* i = i', label: 'Assignment' },
  expression: { grammar: `E -> E + T | T\nT -> T * F | F\nF -> ( E ) | i`, input: 'i + i * i', label: 'Expression' }
};

export default function ParserLab() {
  const [grammarInput, setGrammarInput] = useState(SAMPLES.simple.grammar);
  const [inputString, setInputString] = useState(SAMPLES.simple.input);
  
  const [grammar, setGrammar] = useState<Grammar | null>(null);
  const [parsingTable, setParsingTable] = useState<ParsingTable | null>(null);
  const [allSteps, setAllSteps] = useState<ParseStep[]>([]);
  const [visibleSteps, setVisibleSteps] = useState<ParseStep[]>([]);
  const [isAccepted, setIsAccepted] = useState(false);
  const [parseError, setParseError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  
  // Animation state
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(500);
  const [currentStep, setCurrentStep] = useState(0);
  const animationRef = useRef<number | null>(null);
  const traceEndRef = useRef<HTMLTableRowElement | null>(null);

  const handleGenerate = () => {
    setError(null);
    setAllSteps([]);
    setVisibleSteps([]);
    setIsPlaying(false);
    setCurrentStep(0);
    try {
      const g = parseGrammar(grammarInput);
      setGrammar(g);
      setParsingTable(buildParsingTable(g));
    } catch (err: any) {
      setError(err.message || 'Failed to parse grammar');
      setGrammar(null);
      setParsingTable(null);
    }
  };

  const handleParse = () => {
    if (!grammar || !parsingTable) return;
    setIsPlaying(false);
    setCurrentStep(0);
    setVisibleSteps([]);
    
    try {
      const result = parseString(inputString, grammar, parsingTable);
      setAllSteps(result.steps);
      setIsAccepted(result.accepted);
      setParseError(result.error);
      setIsPlaying(true);
    } catch (err: any) {
      setError('Parsing error: ' + err.message);
    }
  };

  const restartSimulation = () => {
    setCurrentStep(0);
    setVisibleSteps([]);
    setIsPlaying(true);
  };

  const loadSample = (key: keyof typeof SAMPLES) => {
    setGrammarInput(SAMPLES[key].grammar);
    setInputString(SAMPLES[key].input);
    setAllSteps([]);
    setVisibleSteps([]);
  };

  // Animation effect
  useEffect(() => {
    if (isPlaying && currentStep < allSteps.length) {
      animationRef.current = window.setTimeout(() => {
        setVisibleSteps(prev => [...prev, allSteps[currentStep]]);
        setCurrentStep(prev => prev + 1);
      }, speed);
    } else if (currentStep >= allSteps.length && allSteps.length > 0) {
      setIsPlaying(false);
    }

    return () => {
      if (animationRef.current) clearTimeout(animationRef.current);
    };
  }, [isPlaying, currentStep, allSteps, speed]);

  // Auto-scroll to latest step
  useEffect(() => {
    if (traceEndRef.current) {
      traceEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [visibleSteps]);

  const togglePlay = () => {
    // If simulation is complete, restart it
    if (currentStep >= allSteps.length && allSteps.length > 0) {
      restartSimulation();
    } else {
      setIsPlaying(!isPlaying);
    }
  };
  
  const skipToEnd = () => {
    setIsPlaying(false);
    setVisibleSteps(allSteps);
    setCurrentStep(allSteps.length);
  };

  const stepForward = () => {
    if (currentStep < allSteps.length) {
      setVisibleSteps(prev => [...prev, allSteps[currentStep]]);
      setCurrentStep(prev => prev + 1);
    }
  };

  useEffect(() => { handleGenerate(); }, []);

  const isSimulating = allSteps.length > 0;
  const isComplete = currentStep >= allSteps.length && allSteps.length > 0;

  // Get current step for highlighting
  const currentDisplayStep = visibleSteps.length > 0 ? visibleSteps[visibleSteps.length - 1] : null;

  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: '1fr 1fr', /* both panels share width */
      gap: '1.5rem', 
      alignItems: 'start',
      width: '100%'
    }}>
      {/* Left Panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Grammar Input */}
        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Grammar</h2>
          
          <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
            Productions
          </label>
          <textarea
            className="textarea"
            value={grammarInput}
            onChange={(e) => setGrammarInput(e.target.value)}
            placeholder="S -> A A"
            spellCheck={false}
          />
          
          <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
            Format: LHS → RHS separated by spaces
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            {Object.entries(SAMPLES).map(([key, { label }]) => (
              <button
                key={key}
                onClick={() => loadSample(key as keyof typeof SAMPLES)}
                className="btn-secondary"
                style={{ flex: 1, padding: '0.5rem', fontSize: '0.75rem' }}
              >
                {label}
              </button>
            ))}
          </div>

          <button 
            onClick={handleGenerate} 
            className="btn" 
            style={{ width: '100%', marginTop: '1rem' }}
          >
            <Zap size={16} />
            Generate Table
          </button>

          {error && (
            <div className="alert alert-error" style={{ marginTop: '1rem' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Parse Input */}
        {parsingTable && (
          <div className="card animate-in">
            <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Play size={16} style={{ color: 'var(--accent)' }} />
              Simulation
            </h2>
            
            <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
              Input String
            </label>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                value={inputString}
                onChange={(e) => setInputString(e.target.value)}
                placeholder="e.g. c c d d"
                style={{ paddingRight: '2.5rem' }}
              />
              <span style={{ 
                position: 'absolute', 
                right: '0.75rem', 
                top: '50%', 
                transform: 'translateY(-50%)',
                fontSize: '0.75rem',
                color: 'var(--text-tertiary)',
                background: 'var(--bg-tertiary)',
                padding: '0.125rem 0.375rem',
                borderRadius: '4px'
              }}>$</span>
            </div>

            <button 
              onClick={handleParse} 
              className="btn" 
              style={{ width: '100%', marginTop: '1rem' }}
            >
              <Play size={16} />
              Parse String
            </button>

            {/* Playback Controls */}
            {isSimulating && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    Step {currentStep} / {allSteps.length}
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={togglePlay}
                      className="btn-ghost"
                      style={{ padding: '0.375rem', borderRadius: '6px' }}
                      title={isComplete ? 'Restart' : isPlaying ? 'Pause' : 'Play'}
                    >
                      {isComplete ? <RotateCcw size={16} /> : isPlaying ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <button
                      onClick={stepForward}
                      className="btn-ghost"
                      style={{ padding: '0.375rem', borderRadius: '6px' }}
                      title="Step forward"
                      disabled={isComplete}
                    >
                      <SkipForward size={16} />
                    </button>
                    <button
                      onClick={skipToEnd}
                      className="btn-ghost"
                      style={{ padding: '0.375rem', borderRadius: '6px' }}
                      title="Skip to end"
                    >
                      <FastForward size={16} />
                    </button>
                  </div>
                </div>
                
                <div className="speed-control">
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Speed:</span>
                  <input
                    type="range"
                    min="100"
                    max="1000"
                    step="100"
                    value={1100 - speed}
                    onChange={(e) => setSpeed(1100 - parseInt(e.target.value))}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', minWidth: '40px' }}>
                    {speed < 300 ? 'Fast' : speed < 600 ? 'Med' : 'Slow'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Current Step Detail */}
        {currentDisplayStep && (
          <div className="card animate-in" style={{ background: 'var(--accent-subtle)', borderColor: 'var(--accent)' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--accent)' }}>Current Action</h3>
            <div style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              fontFamily: 'monospace',
              marginBottom: '1rem',
              color: 'var(--text-primary)'
            }}>{currentDisplayStep.action}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Stack visualization */}
              <div>
                <label style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Stack</label>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.25rem',
                  marginTop: '0.25rem'
                }}>
                  {currentDisplayStep.stack.map((item, idx) => (
                    <span
                      key={idx}
                      style={{
                        padding: '0.25rem 0.5rem',
                        background: idx === currentDisplayStep.stack.length - 1 ? 'var(--accent)' : 'var(--bg-secondary)',
                        color: idx === currentDisplayStep.stack.length - 1 ? 'white' : 'var(--text-primary)',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                        fontFamily: 'monospace',
                        fontWeight: 500,
                        border: '1px solid var(--border)'
                      }}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              {/* Input visualization */}
              <div>
                <label style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Input</label>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
                  {/* Processed part */}
                  <div>
                    <label style={{ fontSize: '0.5rem', color: 'var(--text-secondary)' }}>Processed</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                      {(() => {
                        const tokens = inputString.trim().split(/\s+/);
                        const processed = tokens.slice(0, tokens.length - currentDisplayStep.input.length);
                        return processed.map((tok, i) => (
                          <span key={i} style={{
                            padding: '0.2rem 0.4rem',
                            background: 'var(--success)',
                            color: 'white',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontFamily: 'monospace'
                          }}>{tok}</span>
                        ));
                      })()}
                    </div>
                  </div>
                  {/* Remaining part */}
                  <div>
                    <label style={{ fontSize: '0.5rem', color: 'var(--text-secondary)' }}>Remaining</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                      {currentDisplayStep.input.map((item, idx) => (
                        <span
                          key={idx}
                          style={{
                            padding: '0.25rem 0.5rem',
                            background: idx === 0 ? 'var(--warning)' : 'var(--bg-secondary)',
                            color: idx === 0 ? 'white' : 'var(--text-primary)',
                            borderRadius: '4px',
                            fontSize: '0.875rem',
                            fontFamily: 'monospace',
                            fontWeight: 500,
                            border: '1px solid var(--border)'
                          }}
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>
        {/* Parsing Table */}
        {parsingTable && grammar && (
          <div className="card animate-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>CLR(1) Table</h2>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)' }}></span>
                  Shift
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--warning)' }}></span>
                  Reduce
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }}></span>
                  Accept
                </span>
              </div>
            </div>

            <div style={{ overflow: 'auto', maxHeight: '400px', border: '1px solid var(--border)', borderRadius: '8px' }}>
              <table style={{ minWidth: '100%' }}>
                <thead>
                  <tr>
                    <th rowSpan={2} style={{ borderRight: '1px solid var(--border)' }}>State</th>
                    <th colSpan={Array.from(grammar.terminals).length + 1} style={{ borderRight: '1px solid var(--border)' }}>Action</th>
                    <th colSpan={Array.from(grammar.nonTerminals).length}>Goto</th>
                  </tr>
                  <tr>
                    {Array.from(grammar.terminals).map(t => <th key={t}>{t}</th>)}
                    <th style={{ borderRight: '1px solid var(--border)' }}>$</th>
                    {Array.from(grammar.nonTerminals)
                      .filter(nt => nt !== grammar.startSymbol.name)
                      .map(nt => <th key={nt}>{nt}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {parsingTable.states.map((_, i) => (
                    <tr key={i}>
                      <td style={{ fontFamily: 'monospace', borderRight: '1px solid var(--border)', background: 'var(--bg-tertiary)' }}>{i}</td>
                      
                      {Array.from(grammar.terminals).map(t => {
                        const act = parsingTable.action.get(i)?.get(t);
                        return (
                          <td key={t}>
                            {act && (
                              <span style={{ color: act.type === 'SHIFT' ? 'var(--accent)' : 'var(--warning)' }}>
                                {act.type === 'SHIFT' ? `s${act.value}` : `r${act.productionStr}`}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      
                      <td style={{ borderRight: '1px solid var(--border)' }}>
                        {(() => {
                          const act = parsingTable.action.get(i)?.get('$');
                          if (!act) return null;
                          if (act.type === 'ACCEPT') return <span style={{ color: 'var(--success)', fontWeight: 600 }}>ACC</span>;
                          return <span style={{ color: act.type === 'SHIFT' ? 'var(--accent)' : 'var(--warning)' }}>
                            {act.type === 'SHIFT' ? `s${act.value}` : `r${act.productionStr}`}
                          </span>;
                        })()}
                      </td>

                      {Array.from(grammar.nonTerminals)
                        .filter(nt => nt !== grammar.startSymbol.name)
                        .map(nt => (
                          <td key={nt} style={{ fontWeight: 500 }}>
                            {parsingTable.goto.get(i)?.get(nt) ?? ''}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Parse Result */}
        {visibleSteps.length > 0 && (
          <div className="card animate-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Parsing Trace</h2>
              {isComplete && (
                isAccepted ? (
                  <span className="badge badge-green" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <CheckCircle size={14} /> Accepted
                  </span>
                ) : (
                  <span className="badge badge-red" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <AlertCircle size={14} /> {parseError || 'Rejected'}
                  </span>
                )
              )}
            </div>

            <div style={{ overflow: 'auto', maxHeight: '300px' }}>
              <table style={{ minWidth: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>Step</th>
                    <th style={{ textAlign: 'left' }}>Stack</th>
                    <th style={{ textAlign: 'right' }}>Input</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSteps.map((step, idx) => {
                    const isLatest = idx === visibleSteps.length - 1;
                    return (
                      <tr 
                        key={step.step} 
                        ref={isLatest ? traceEndRef : null}
                        style={{ 
                          background: isLatest ? 'var(--accent-subtle)' : undefined,
                          transition: 'background 0.3s ease'
                        }}
                      >
                        <td style={{ color: 'var(--text-secondary)' }}>{step.step}</td>
                        <td style={{ fontFamily: 'monospace', textAlign: 'left' }}>
                          {step.stack.join(' ')}
                        </td>
                        <td style={{ fontFamily: 'monospace', textAlign: 'right' }}>{step.input.join(' ')}</td>
                        <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{step.action}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
