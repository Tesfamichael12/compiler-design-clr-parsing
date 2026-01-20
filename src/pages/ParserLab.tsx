import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { Grammar, parseGrammar } from "../core/Grammar";
import {
  buildCanonicalCollection,
  type CanonicalCollection,
} from "../core/Items";
import {
  ActionType,
  buildParsingTable,
  type ParsingTable,
} from "../core/Table";
import { parseString, type ParseNode, type ParseStep } from "../core/Parser";
import {
  AlertCircle,
  CheckCircle,
  FastForward,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Zap,
} from "lucide-react";
import { useTheme } from "../App";

const SAMPLES = {
  simple: {
    grammar: `S -> C C\nC -> c C | d`,
    input: "c c d d",
    label: "Simple",
  },
  assignment: {
    grammar: `S -> L = R | R\nL -> * R | i\nR -> L`,
    input: "* i = i",
    label: "Assignment",
  },
  expression: {
    grammar: `E -> E + T | T\nT -> T * F | F\nF -> ( E ) | i`,
    input: "i + i * i",
    label: "Expression",
  },
};

export default function ParserLab() {
  const { isDark } = useTheme();
  const [grammarInput, setGrammarInput] = useState(SAMPLES.simple.grammar);
  const [inputString, setInputString] = useState(SAMPLES.simple.input);

  const [grammar, setGrammar] = useState<Grammar | null>(null);
  const [parsingTable, setParsingTable] = useState<ParsingTable | null>(null);
  const [dfaDiagram, setDfaDiagram] = useState("");
  const [dfaError, setDfaError] = useState<string | null>(null);

  const [parseTreeDiagram, setParseTreeDiagram] = useState("");
  const [parseTreeError, setParseTreeError] = useState<string | null>(null);

  const [allSteps, setAllSteps] = useState<ParseStep[]>([]);
  const [visibleSteps, setVisibleSteps] = useState<ParseStep[]>([]);
  const [isAccepted, setIsAccepted] = useState(false);
  const [parseError, setParseError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(500);
  const [currentStep, setCurrentStep] = useState(0);

  const animationRef = useRef<number | null>(null);
  const traceEndRef = useRef<HTMLTableRowElement | null>(null);
  const dfaContainerRef = useRef<HTMLDivElement | null>(null);
  const dfaViewportRef = useRef<HTMLDivElement | null>(null);
  const dfaRenderCount = useRef(0);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastTranslateRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const parseTreeContainerRef = useRef<HTMLDivElement | null>(null);
  const parseTreeViewportRef = useRef<HTMLDivElement | null>(null);
  const parseTreeRenderCount = useRef(0);
  const parseTreePanStartRef = useRef<{ x: number; y: number } | null>(null);
  const parseTreeLastTranslateRef = useRef<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  const [dfaScale, setDfaScale] = useState(1);
  const [dfaTranslate, setDfaTranslate] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);

  const [parseTreeScale, setParseTreeScale] = useState(1);
  const [parseTreeTranslate, setParseTreeTranslate] = useState({ x: 0, y: 0 });
  const [isParseTreePanning, setIsParseTreePanning] = useState(false);

  const buildDfaMermaid = (
    collection: CanonicalCollection,
    table: ParsingTable,
  ) => {
    const lines: string[] = ["stateDiagram-v2", "direction LR", "[*] --> I0"];
    const escapeLabel = (value: string) => value.replace(/"/g, '\\"');

    collection.states.forEach((state, index) => {
      const items = state.map((item) => item.toString());
      const label = `I${index}\\n${items.join("\\n")}`;
      lines.push(`state \"${escapeLabel(label)}\" as I${index}`);
    });

    const transitions = Array.from(collection.transitions.entries())
      .sort(([a], [b]) => a - b)
      .map(
        ([from, map]) =>
          [
            from,
            Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)),
          ] as const,
      );

    transitions.forEach(([from, edges]) => {
      edges.forEach(([symbol, to]) => {
        lines.push(`I${from} --> I${to}: ${symbol}`);
      });
    });

    const acceptStates: number[] = [];
    const reduceStates: number[] = [];
    const shiftStates: number[] = [];

    table.action.forEach((actions, stateIndex) => {
      let hasShift = false;
      let hasReduce = false;
      let hasAccept = false;

      actions.forEach((action) => {
        if (action.type === ActionType.ACCEPT) hasAccept = true;
        if (action.type === ActionType.REDUCE) hasReduce = true;
        if (action.type === ActionType.SHIFT) hasShift = true;
      });

      if (hasAccept) {
        acceptStates.push(stateIndex);
      } else if (hasReduce) {
        reduceStates.push(stateIndex);
      } else if (hasShift) {
        shiftStates.push(stateIndex);
      }
    });

    lines.push(
      "classDef shift fill:var(--accent),color:white,stroke:var(--accent-dark),stroke-width:1px;",
    );
    lines.push(
      "classDef reduce fill:var(--warning),color:#111827,stroke:#ef4444,stroke-width:1px;",
    );
    lines.push(
      "classDef accept fill:var(--success),color:white,stroke:#16a34a,stroke-width:1px;",
    );

    if (shiftStates.length > 0) {
      lines.push(`class ${shiftStates.map((i) => `I${i}`).join(", ")} shift`);
    }
    if (reduceStates.length > 0) {
      lines.push(`class ${reduceStates.map((i) => `I${i}`).join(", ")} reduce`);
    }
    if (acceptStates.length > 0) {
      lines.push(`class ${acceptStates.map((i) => `I${i}`).join(", ")} accept`);
    }

    const diagram = lines.join("\n");
    console.log("[buildDfaMermaid] diagram:", diagram);
    return diagram;
  };

  const buildParseTreeMermaid = (root: ParseNode) => {
    const lines: string[] = ["flowchart TD"];
    const escapeLabel = (value: string) => value.replace(/"/g, '\\"');

    let counter = 0;
    const nextId = () => `N${counter++}`;

    const walk = (node: ParseNode): string => {
      const id = nextId();
      lines.push(`${id}["${escapeLabel(node.symbol)}"]`);
      node.children.forEach((child) => {
        const childId = walk(child);
        lines.push(`${id} --> ${childId}`);
      });
      return id;
    };

    walk(root);
    return lines.join("\n");
  };

  const handleGenerate = () => {
    setError(null);
    setDfaError(null);
    setParseTreeError(null);
    setAllSteps([]);
    setVisibleSteps([]);
    setIsPlaying(false);
    setCurrentStep(0);
    setParseTreeDiagram("");
    try {
      const g = parseGrammar(grammarInput);
      const collection = buildCanonicalCollection(g);
      const table = buildParsingTable(g);

      console.log("[handleGenerate] grammar:", g);
      console.log("[handleGenerate] collection:", collection);
      console.log("[handleGenerate] table:", table);
      setGrammar(g);
      setParsingTable(table);
      setDfaDiagram(buildDfaMermaid(collection, table));
    } catch (err: any) {
      setError(err.message || "Failed to parse grammar");
      setGrammar(null);
      setParsingTable(null);
      setDfaDiagram("");
      setParseTreeDiagram("");
    }
  };

  const handleParse = () => {
    if (!grammar || !parsingTable) return;
    setIsPlaying(false);
    setCurrentStep(0);
    setVisibleSteps([]);
    setParseTreeError(null);
    setParseTreeDiagram("");

    try {
      const parseResult = parseString(inputString, grammar, parsingTable);
      const trace = parseResult.steps.map((s, i) => ({ ...s, step: i + 1 }));

      setAllSteps(trace);
      setIsAccepted(parseResult.accepted);
      setParseError(parseResult.error);

      if (parseResult.accepted && parseResult.parseTree) {
        setParseTreeDiagram(buildParseTreeMermaid(parseResult.parseTree));
      }
      setIsPlaying(true);
    } catch (err: any) {
      setError("Parsing error: " + err.message);
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

  useEffect(() => {
    if (isPlaying && currentStep < allSteps.length) {
      animationRef.current = window.setTimeout(() => {
        setVisibleSteps((prev) => [...prev, allSteps[currentStep]]);
        setCurrentStep((prev) => prev + 1);
      }, speed);
    } else if (currentStep >= allSteps.length && allSteps.length > 0) {
      setIsPlaying(false);
    }

    return () => {
      if (animationRef.current) clearTimeout(animationRef.current);
    };
  }, [isPlaying, currentStep, allSteps, speed]);

  useEffect(() => {
    if (!dfaDiagram || !dfaContainerRef.current) return;
    let isMounted = true;

    setDfaScale(1);
    setDfaTranslate({ x: 0, y: 0 });
    lastTranslateRef.current = { x: 0, y: 0 };

    const renderDiagram = async () => {
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? "dark" : "default",
          securityLevel: "loose",
        });

        const renderId = `dfa-${dfaRenderCount.current++}`;
        const { svg } = await mermaid.render(renderId, dfaDiagram);
        if (isMounted && dfaContainerRef.current) {
          dfaContainerRef.current.innerHTML = svg;
          setDfaError(null);
        }
      } catch (renderErr: any) {
        if (isMounted) {
          setDfaError(renderErr?.message || "Failed to render DFA diagram");
        }
      }
    };

    renderDiagram();

    return () => {
      isMounted = false;
    };
  }, [dfaDiagram, isDark]);

  useEffect(() => {
    if (!parseTreeDiagram || !parseTreeContainerRef.current) return;
    let isMounted = true;

    setParseTreeScale(1);
    setParseTreeTranslate({ x: 0, y: 0 });
    parseTreeLastTranslateRef.current = { x: 0, y: 0 };

    const renderDiagram = async () => {
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? "dark" : "default",
          securityLevel: "loose",
        });

        const renderId = `parse-tree-${parseTreeRenderCount.current++}`;
        const { svg } = await mermaid.render(renderId, parseTreeDiagram);
        if (isMounted && parseTreeContainerRef.current) {
          parseTreeContainerRef.current.innerHTML = svg;
          setParseTreeError(null);
        }
      } catch (renderErr: any) {
        if (isMounted) {
          setParseTreeError(
            renderErr?.message || "Failed to render parse tree diagram",
          );
        }
      }
    };

    renderDiagram();

    return () => {
      isMounted = false;
    };
  }, [parseTreeDiagram, isDark]);

  useEffect(() => {
    const viewport = dfaViewportRef.current;
    if (!viewport) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();

      const rect = viewport.getBoundingClientRect();
      const cursorX = event.clientX - rect.left;
      const cursorY = event.clientY - rect.top;

      const zoomDelta = event.deltaY > 0 ? -0.1 : 0.1;
      const nextScale = Math.min(6, Math.max(0.25, dfaScale + zoomDelta));

      if (nextScale === dfaScale) return;

      const scaleRatio = nextScale / dfaScale;
      const nextTranslate = {
        x: cursorX - (cursorX - dfaTranslate.x) * scaleRatio,
        y: cursorY - (cursorY - dfaTranslate.y) * scaleRatio,
      };

      setDfaScale(nextScale);
      setDfaTranslate(nextTranslate);
      lastTranslateRef.current = nextTranslate;
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      viewport.removeEventListener("wheel", handleWheel);
    };
  }, [dfaScale, dfaTranslate]);

  useEffect(() => {
    const viewport = parseTreeViewportRef.current;
    if (!viewport) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();

      const rect = viewport.getBoundingClientRect();
      const cursorX = event.clientX - rect.left;
      const cursorY = event.clientY - rect.top;

      const zoomDelta = event.deltaY > 0 ? -0.1 : 0.1;
      const nextScale = Math.min(6, Math.max(0.25, parseTreeScale + zoomDelta));

      if (nextScale === parseTreeScale) return;

      const scaleRatio = nextScale / parseTreeScale;
      const nextTranslate = {
        x: cursorX - (cursorX - parseTreeTranslate.x) * scaleRatio,
        y: cursorY - (cursorY - parseTreeTranslate.y) * scaleRatio,
      };

      setParseTreeScale(nextScale);
      setParseTreeTranslate(nextTranslate);
      parseTreeLastTranslateRef.current = nextTranslate;
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      viewport.removeEventListener("wheel", handleWheel);
    };
  }, [parseTreeScale, parseTreeTranslate]);

  const handleDfaPanStart = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    setIsPanning(true);
    panStartRef.current = { x: event.clientX, y: event.clientY };
  };

  const handleDfaPanMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning || !panStartRef.current) return;
    const dx = event.clientX - panStartRef.current.x;
    const dy = event.clientY - panStartRef.current.y;

    const nextTranslate = {
      x: lastTranslateRef.current.x + dx,
      y: lastTranslateRef.current.y + dy,
    };

    setDfaTranslate(nextTranslate);
  };

  const handleDfaPanEnd = () => {
    if (!isPanning) return;
    setIsPanning(false);
    panStartRef.current = null;
    lastTranslateRef.current = dfaTranslate;
  };

  const handleParseTreePanStart = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    setIsParseTreePanning(true);
    parseTreePanStartRef.current = { x: event.clientX, y: event.clientY };
  };

  const handleParseTreePanMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isParseTreePanning || !parseTreePanStartRef.current) return;
    const dx = event.clientX - parseTreePanStartRef.current.x;
    const dy = event.clientY - parseTreePanStartRef.current.y;

    const nextTranslate = {
      x: parseTreeLastTranslateRef.current.x + dx,
      y: parseTreeLastTranslateRef.current.y + dy,
    };

    setParseTreeTranslate(nextTranslate);
  };

  const handleParseTreePanEnd = () => {
    if (!isParseTreePanning) return;
    setIsParseTreePanning(false);
    parseTreePanStartRef.current = null;
    parseTreeLastTranslateRef.current = parseTreeTranslate;
  };

  const zoomDfaBy = (delta: number) => {
    const viewport = dfaViewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const nextScale = Math.min(6, Math.max(0.25, dfaScale + delta));
    if (nextScale === dfaScale) return;

    const scaleRatio = nextScale / dfaScale;
    const nextTranslate = {
      x: centerX - (centerX - dfaTranslate.x) * scaleRatio,
      y: centerY - (centerY - dfaTranslate.y) * scaleRatio,
    };

    setDfaScale(nextScale);
    setDfaTranslate(nextTranslate);
    lastTranslateRef.current = nextTranslate;
  };

  const resetDfaView = () => {
    setDfaScale(1);
    setDfaTranslate({ x: 0, y: 0 });
    lastTranslateRef.current = { x: 0, y: 0 };
  };

  const zoomParseTreeBy = (delta: number) => {
    const viewport = parseTreeViewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const nextScale = Math.min(6, Math.max(0.25, parseTreeScale + delta));
    if (nextScale === parseTreeScale) return;

    const scaleRatio = nextScale / parseTreeScale;
    const nextTranslate = {
      x: centerX - (centerX - parseTreeTranslate.x) * scaleRatio,
      y: centerY - (centerY - parseTreeTranslate.y) * scaleRatio,
    };

    setParseTreeScale(nextScale);
    setParseTreeTranslate(nextTranslate);
    parseTreeLastTranslateRef.current = nextTranslate;
  };

  const resetParseTreeView = () => {
    setParseTreeScale(1);
    setParseTreeTranslate({ x: 0, y: 0 });
    parseTreeLastTranslateRef.current = { x: 0, y: 0 };
  };

  const handleDownloadDfa = () => {
    if (!dfaContainerRef.current) return;
    const svgElement = dfaContainerRef.current.querySelector("svg");
    if (!svgElement) return;

    const serializer = new XMLSerializer();
    const svgContent = serializer.serializeToString(svgElement);
    const blob = new Blob([svgContent], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "clr-dfa.svg";
    link.click();

    URL.revokeObjectURL(url);
  };

  const handleDownloadParseTree = () => {
    if (!parseTreeContainerRef.current) return;
    const svgElement = parseTreeContainerRef.current.querySelector("svg");
    if (!svgElement) return;

    const serializer = new XMLSerializer();
    const svgContent = serializer.serializeToString(svgElement);
    const blob = new Blob([svgContent], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "clr-parse-tree.svg";
    link.click();

    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (traceEndRef.current) {
      traceEndRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [visibleSteps]);

  const togglePlay = () => {
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
      setVisibleSteps((prev) => [...prev, allSteps[currentStep]]);
      setCurrentStep((prev) => prev + 1);
    }
  };

  useEffect(() => {
    handleGenerate();
  }, []);

  const isSimulating = allSteps.length > 0;
  const isComplete = currentStep >= allSteps.length && allSteps.length > 0;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "1.5rem",
        alignItems: "start",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div className="card">
          <h2
            style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}
          >
            Grammar
          </h2>

          <label
            style={{
              fontSize: "0.75rem",
              fontWeight: 500,
              color: "var(--text-secondary)",
              display: "block",
              marginBottom: "0.5rem",
            }}
          >
            Productions
          </label>
          <textarea
            className="textarea"
            value={grammarInput}
            onChange={(e) => setGrammarInput(e.target.value)}
            placeholder="S -> A A"
            spellCheck={false}
          />

          <p
            style={{
              fontSize: "0.75rem",
              color: "var(--text-tertiary)",
              marginTop: "0.5rem",
            }}
          >
            Format: LHS → RHS separated by spaces
          </p>

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
            {Object.entries(SAMPLES).map(([key, { label }]) => (
              <button
                key={key}
                onClick={() => loadSample(key as keyof typeof SAMPLES)}
                className="btn-secondary"
                style={{ flex: 1, padding: "0.5rem", fontSize: "0.75rem" }}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={handleGenerate}
            className="btn"
            style={{ width: "100%", marginTop: "1rem" }}
          >
            <Zap size={16} />
            Generate Table
          </button>

          {error && (
            <div className="alert alert-error" style={{ marginTop: "1rem" }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {parsingTable && (
          <div className="card animate-in">
            <h2
              style={{
                fontSize: "1rem",
                fontWeight: 600,
                marginBottom: "1rem",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <Play size={16} style={{ color: "var(--accent)" }} />
              Simulation
            </h2>

            <label
              style={{
                fontSize: "0.75rem",
                fontWeight: 500,
                color: "var(--text-secondary)",
                display: "block",
                marginBottom: "0.5rem",
              }}
            >
              Input String
            </label>
            <div style={{ position: "relative" }}>
              <input
                className="input"
                value={inputString}
                onChange={(e) => setInputString(e.target.value)}
                placeholder="e.g. c c d d"
                style={{ paddingRight: "2.5rem" }}
              />
              <span
                style={{
                  position: "absolute",
                  right: "0.75rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "0.75rem",
                  color: "var(--text-tertiary)",
                  background: "var(--bg-tertiary)",
                  padding: "0.125rem 0.375rem",
                  borderRadius: "4px",
                }}
              >
                $
              </span>
            </div>

            <button
              onClick={handleParse}
              className="btn"
              style={{ width: "100%", marginTop: "1rem" }}
            >
              <Play size={16} />
              Parse String
            </button>

            {isSimulating && (
              <div
                style={{
                  marginTop: "1rem",
                  padding: "1rem",
                  background: "var(--bg-tertiary)",
                  borderRadius: "8px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "0.75rem",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 500,
                      color: "var(--text-secondary)",
                    }}
                  >
                    Step {currentStep} / {allSteps.length}
                  </span>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      onClick={togglePlay}
                      className="btn-ghost"
                      style={{ padding: "0.375rem", borderRadius: "6px" }}
                      title={
                        isComplete ? "Restart" : isPlaying ? "Pause" : "Play"
                      }
                    >
                      {isComplete ? (
                        <RotateCcw size={16} />
                      ) : isPlaying ? (
                        <Pause size={16} />
                      ) : (
                        <Play size={16} />
                      )}
                    </button>
                    <button
                      onClick={stepForward}
                      className="btn-ghost"
                      style={{ padding: "0.375rem", borderRadius: "6px" }}
                      title="Step forward"
                      disabled={isComplete}
                    >
                      <SkipForward size={16} />
                    </button>
                    <button
                      onClick={skipToEnd}
                      className="btn-ghost"
                      style={{ padding: "0.375rem", borderRadius: "6px" }}
                      title="Skip to end"
                    >
                      <FastForward size={16} />
                    </button>
                  </div>
                </div>

                <div className="speed-control">
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    Speed:
                  </span>
                  <input
                    type="range"
                    min="100"
                    max="1000"
                    step="100"
                    value={1100 - speed}
                    onChange={(e) => setSpeed(1100 - parseInt(e.target.value))}
                  />
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-tertiary)",
                      minWidth: "40px",
                    }}
                  >
                    {speed < 300 ? "Fast" : speed < 600 ? "Med" : "Slow"}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          minWidth: 0,
        }}
      >
        {dfaDiagram && (
          <div className="card animate-in">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
                gap: "0.75rem",
              }}
            >
              <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>LR(1) DFA</h2>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  flexWrap: "wrap",
                }}
              >
                <span className="badge badge-blue">Item-set Automaton</span>
                <button
                  className="btn-ghost"
                  style={{ padding: "0.375rem 0.75rem", borderRadius: "6px" }}
                  onClick={() => zoomDfaBy(0.2)}
                  title="Zoom in"
                >
                  Zoom In
                </button>
                <button
                  className="btn-ghost"
                  style={{ padding: "0.375rem 0.75rem", borderRadius: "6px" }}
                  onClick={() => zoomDfaBy(-0.2)}
                  title="Zoom out"
                >
                  Zoom Out
                </button>
                <button
                  className="btn-ghost"
                  style={{ padding: "0.375rem 0.75rem", borderRadius: "6px" }}
                  onClick={resetDfaView}
                  title="Reset zoom"
                >
                  Reset
                </button>
                <button
                  className="btn-ghost"
                  style={{ padding: "0.375rem 0.75rem", borderRadius: "6px" }}
                  onClick={handleDownloadDfa}
                  title="Download DFA as SVG"
                >
                  Download
                </button>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: "1rem",
                flexWrap: "wrap",
                fontSize: "0.75rem",
                marginBottom: "0.75rem",
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                }}
              >
                <span
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    background: "var(--accent)",
                  }}
                />
                Shift
              </span>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                }}
              >
                <span
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    background: "var(--warning)",
                  }}
                />
                Reduce
              </span>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                }}
              >
                <span
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    background: "var(--success)",
                  }}
                />
                Accept
              </span>
            </div>

            {dfaError ? (
              <div className="alert alert-error">
                <AlertCircle size={16} />
                <span>{dfaError}</span>
              </div>
            ) : (
              <div
                ref={dfaViewportRef}
                style={{
                  overflow: "auto",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  padding: "0.75rem",
                  background: "var(--bg-primary)",
                  minHeight: "240px",
                  cursor: isPanning ? "grabbing" : "grab",
                  userSelect: "none",
                }}
                onMouseDown={handleDfaPanStart}
                onMouseMove={handleDfaPanMove}
                onMouseUp={handleDfaPanEnd}
                onMouseLeave={handleDfaPanEnd}
              >
                <div
                  ref={dfaContainerRef}
                  style={{
                    transform: `translate(${dfaTranslate.x}px, ${dfaTranslate.y}px) scale(${dfaScale})`,
                    transformOrigin: "0 0",
                    width: "fit-content",
                  }}
                />
              </div>
            )}
          </div>
        )}

        {parsingTable && grammar && (
          <div className="card animate-in">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>
                CLR(1) Table
              </h2>
              <div
                style={{ display: "flex", gap: "1rem", fontSize: "0.75rem" }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                  }}
                >
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "var(--accent)",
                    }}
                  />
                  Shift
                </span>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                  }}
                >
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "var(--warning)",
                    }}
                  />
                  Reduce
                </span>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                  }}
                >
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "var(--success)",
                    }}
                  />
                  Accept
                </span>
              </div>
            </div>

            <div
              style={{
                overflow: "auto",
                maxHeight: "400px",
                border: "1px solid var(--border)",
                borderRadius: "8px",
              }}
            >
              <table style={{ minWidth: "100%" }}>
                <thead>
                  <tr>
                    <th
                      rowSpan={2}
                      style={{ borderRight: "1px solid var(--border)" }}
                    >
                      State
                    </th>
                    <th
                      colSpan={Array.from(grammar.terminals).length + 1}
                      style={{ borderRight: "1px solid var(--border)" }}
                    >
                      Action
                    </th>
                    <th colSpan={Array.from(grammar.nonTerminals).length}>
                      Goto
                    </th>
                  </tr>
                  <tr>
                    {Array.from(grammar.terminals).map((t) => (
                      <th key={t}>{t}</th>
                    ))}
                    <th style={{ borderRight: "1px solid var(--border)" }}>
                      $
                    </th>
                    {Array.from(grammar.nonTerminals)
                      .filter((nt) => nt !== grammar.startSymbol.name)
                      .map((nt) => (
                        <th key={nt}>{nt}</th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {parsingTable.states.map((_, i) => (
                    <tr key={i}>
                      <td
                        style={{
                          fontFamily: "monospace",
                          borderRight: "1px solid var(--border)",
                          background: "var(--bg-tertiary)",
                        }}
                      >
                        {i}
                      </td>

                      {Array.from(grammar.terminals).map((t) => {
                        const act = parsingTable.action.get(i)?.get(t);
                        return (
                          <td key={t}>
                            {act && (
                              <span
                                style={{
                                  color:
                                    act.type === "SHIFT"
                                      ? "var(--accent)"
                                      : "var(--warning)",
                                }}
                              >
                                {act.type === "SHIFT"
                                  ? `s${act.value}`
                                  : `r${act.productionStr}`}
                              </span>
                            )}
                          </td>
                        );
                      })}

                      <td style={{ borderRight: "1px solid var(--border)" }}>
                        {(() => {
                          const act = parsingTable.action.get(i)?.get("$");
                          if (!act) return null;
                          if (act.type === "ACCEPT") {
                            return (
                              <span
                                style={{
                                  color: "var(--success)",
                                  fontWeight: 600,
                                }}
                              >
                                ACC
                              </span>
                            );
                          }
                          return (
                            <span
                              style={{
                                color:
                                  act.type === "SHIFT"
                                    ? "var(--accent)"
                                    : "var(--warning)",
                              }}
                            >
                              {act.type === "SHIFT"
                                ? `s${act.value}`
                                : `r${act.productionStr}`}
                            </span>
                          );
                        })()}
                      </td>

                      {Array.from(grammar.nonTerminals)
                        .filter((nt) => nt !== grammar.startSymbol.name)
                        .map((nt) => (
                          <td key={nt} style={{ fontWeight: 500 }}>
                            {parsingTable.goto.get(i)?.get(nt) ?? ""}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {(visibleSteps.length > 0 || (isAccepted && parseTreeDiagram)) && (
        <div
          style={{
            gridColumn: "1 / -1",
            display: "grid",
            gridTemplateColumns:
              visibleSteps.length > 0 && isAccepted && parseTreeDiagram
                ? "1fr 1fr"
                : "1fr",
            gap: "1rem",
            alignItems: "start",
          }}
        >
          {visibleSteps.length > 0 && (
            <div className="card animate-in">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1rem",
                }}
              >
                <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>
                  Parsing Trace
                </h2>
                {isComplete &&
                  (isAccepted ? (
                    <span
                      className="badge badge-green"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                      }}
                    >
                      <CheckCircle size={14} /> Accepted
                    </span>
                  ) : (
                    <span
                      className="badge badge-red"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                      }}
                    >
                      <AlertCircle size={14} /> {parseError || "Rejected"}
                    </span>
                  ))}
              </div>

              <div style={{ overflow: "auto", maxHeight: "300px" }}>
                <table style={{ minWidth: "100%" }}>
                  <thead>
                    <tr>
                      <th style={{ width: "60px" }}>Step</th>
                      <th style={{ textAlign: "left" }}>Stack</th>
                      <th style={{ textAlign: "right" }}>Input</th>
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
                            background: isLatest
                              ? "var(--accent-subtle)"
                              : undefined,
                            transition: "background 0.3s ease",
                          }}
                        >
                          <td style={{ color: "var(--text-secondary)" }}>
                            {step.step}
                          </td>
                          <td
                            style={{
                              fontFamily: "monospace",
                              textAlign: "left",
                            }}
                          >
                            {step.stack.join(" ")}
                          </td>
                          <td
                            style={{
                              fontFamily: "monospace",
                              textAlign: "right",
                            }}
                          >
                            {step.input.join(" ")}
                          </td>
                          <td
                            style={{
                              fontWeight: 600,
                              color: "var(--accent)",
                            }}
                          >
                            {step.action}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {isAccepted && parseTreeDiagram && (
            <div className="card animate-in">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1rem",
                  gap: "0.75rem",
                  flexWrap: "wrap",
                }}
              >
                <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>
                  Parse Tree
                </h2>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    flexWrap: "wrap",
                  }}
                >
                  <span className="badge badge-blue">Mermaid</span>
                  <button
                    className="btn-ghost"
                    style={{ padding: "0.375rem 0.75rem", borderRadius: "6px" }}
                    onClick={() => zoomParseTreeBy(0.2)}
                    title="Zoom in"
                  >
                    Zoom In
                  </button>
                  <button
                    className="btn-ghost"
                    style={{ padding: "0.375rem 0.75rem", borderRadius: "6px" }}
                    onClick={() => zoomParseTreeBy(-0.2)}
                    title="Zoom out"
                  >
                    Zoom Out
                  </button>
                  <button
                    className="btn-ghost"
                    style={{ padding: "0.375rem 0.75rem", borderRadius: "6px" }}
                    onClick={resetParseTreeView}
                    title="Reset zoom"
                  >
                    Reset
                  </button>
                  <button
                    className="btn-ghost"
                    style={{ padding: "0.375rem 0.75rem", borderRadius: "6px" }}
                    onClick={handleDownloadParseTree}
                    title="Download parse tree as SVG"
                  >
                    Download
                  </button>
                </div>
              </div>

              {parseTreeError ? (
                <div className="alert alert-error">
                  <AlertCircle size={16} />
                  <span>{parseTreeError}</span>
                </div>
              ) : (
                <div
                  ref={parseTreeViewportRef}
                  style={{
                    overflow: "auto",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "0.75rem",
                    background: "var(--bg-primary)",
                    minHeight: "240px",
                    cursor: isParseTreePanning ? "grabbing" : "grab",
                    userSelect: "none",
                  }}
                  onMouseDown={handleParseTreePanStart}
                  onMouseMove={handleParseTreePanMove}
                  onMouseUp={handleParseTreePanEnd}
                  onMouseLeave={handleParseTreePanEnd}
                >
                  <div
                    ref={parseTreeContainerRef}
                    style={{
                      transform: `translate(${parseTreeTranslate.x}px, ${parseTreeTranslate.y}px) scale(${parseTreeScale})`,
                      transformOrigin: "0 0",
                      width: "fit-content",
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
