export const SymbolType = {
  TERMINAL: "TERMINAL",
  NON_TERMINAL: "NON_TERMINAL",
  EPSILON: "EPSILON",
  END: "END", // $
} as const;

export type SymbolType = (typeof SymbolType)[keyof typeof SymbolType];

export class Symbol {
  public name: string;
  public type: SymbolType;

  constructor(name: string, type: SymbolType) {
    this.name = name;
    this.type = type;
  }

  toString() {
    return this.name;
  }

  equals(other: Symbol) {
    return this.name === other.name && this.type === other.type;
  }
}

export class Production {
  public lhs: Symbol;
  public rhs: Symbol[];

  constructor(lhs: Symbol, rhs: Symbol[]) {
    this.lhs = lhs;
    this.rhs = rhs;
  }

  toString() {
    if (this.rhs.length === 0) {
      return `${this.lhs.name} -> ε`;
    }
    return `${this.lhs.name} -> ${this.rhs.map((s) => s.name).join(" ")}`;
  }
}

export class Grammar {
  productions: Production[];
  startSymbol: Symbol;
  terminals: Set<string>;
  nonTerminals: Set<string>;

  constructor(productions: Production[], startSymbol: Symbol) {
    this.productions = productions;
    this.startSymbol = startSymbol;
    this.terminals = new Set();
    this.nonTerminals = new Set();

    this.productions.forEach((p) => {
      this.nonTerminals.add(p.lhs.name);
      p.rhs.forEach((s) => {
        if (s.type === SymbolType.TERMINAL) {
          this.terminals.add(s.name);
        } else if (s.type === SymbolType.NON_TERMINAL) {
          this.nonTerminals.add(s.name);
        }
      });
    });
  }

  getProductionsFor(nonTerminal: Symbol): Production[] {
    return this.productions.filter((p) => p.lhs.name === nonTerminal.name);
  }

  // Helper to check if a symbol is terminal
  isTerminal(name: string): boolean {
    return this.terminals.has(name) || name === "$";
  }
}

// Utility to parse string grammar
// Example input:
// S -> C C
// C -> c C | d
export function parseGrammar(input: string): Grammar {
  const lines = input.split("\n").filter((l) => l.trim().length > 0);
  const productions: Production[] = [];
  const nonTerminals = new Set<string>();

  // First pass: identify non-terminals (LHS of productions)
  lines.forEach((line) => {
    const parts = line.split("->");
    if (parts.length > 0) {
      nonTerminals.add(parts[0].trim());
    }
  });

  let originalStartSymbol: Symbol | null = null;

  lines.forEach((line, index) => {
    const [lhsStr, rhsStr] = line.split("->");
    if (!lhsStr || !rhsStr) return;

    const lhsName = lhsStr.trim();
    if (index === 0) {
      originalStartSymbol = new Symbol(lhsName, SymbolType.NON_TERMINAL);
    }

    const lhs = new Symbol(lhsName, SymbolType.NON_TERMINAL);

    const rhsOptions = rhsStr.split("|");
    rhsOptions.forEach((opt) => {
      const symbolsStr = opt.trim().split(/\s+/);
      const rhs: Symbol[] = [];

      symbolsStr.forEach((s) => {
        if (s === "ε" || s === "''" || s === '""' || s === "") {
          // Epsilon production, empty RHS
          // Or maybe explicitly SymbolType.EPSILON if we want to track it
          // For this implementation, empty RHS usually implies epsilon
        } else {
          const type = nonTerminals.has(s)
            ? SymbolType.NON_TERMINAL
            : SymbolType.TERMINAL;
          rhs.push(new Symbol(s, type));
        }
      });
      productions.push(new Production(lhs, rhs));
    });
  });

  if (!originalStartSymbol) throw new Error("Empty grammar");

  // Augment Grammar
  const startName: string = (originalStartSymbol as Symbol).name;
  const augmentedStart = new Symbol(startName + "'", SymbolType.NON_TERMINAL);
  // @ts-ignore
  const augmentedProd = new Production(augmentedStart, [originalStartSymbol]);

  const grammar = new Grammar([augmentedProd, ...productions], augmentedStart);
  console.log("[parseGrammar] lines:", lines);
  console.log(
    "[parseGrammar] productions:",
    grammar.productions.map((p) => p.toString()),
  );
  console.log("[parseGrammar] startSymbol:", grammar.startSymbol.name);
  console.log("[parseGrammar] terminals:", Array.from(grammar.terminals));
  console.log("[parseGrammar] nonTerminals:", Array.from(grammar.nonTerminals));
  return grammar;
}
