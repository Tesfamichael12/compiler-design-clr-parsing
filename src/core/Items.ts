
import { Grammar, Symbol, SymbolType, Production } from './Grammar';
import { firstOfSequence } from './Sets';

export class LR1Item {
  public production: Production;
  public dotPosition: number;
  public lookahead: Symbol;

  constructor(
    production: Production,
    dotPosition: number,
    lookahead: Symbol
  ) {
    this.production = production;
    this.dotPosition = dotPosition;
    this.lookahead = lookahead;
  }

  toString() {
    const rhsNames = this.production.rhs.map(s => s.name);
    rhsNames.splice(this.dotPosition, 0, '.');
    // If dot is at end, it looks like A -> B C .
    // If dot is at start, . A -> B C
    // Handle epsilon: A -> .
    if (this.production.rhs.length === 0) {
        return `${this.production.lhs.name} -> . , ${this.lookahead.name}`;
    }
    return `${this.production.lhs.name} -> ${rhsNames.join(' ')} , ${this.lookahead.name}`;
  }
  
  equals(other: LR1Item) {
      return this.production === other.production &&
             this.dotPosition === other.dotPosition &&
             this.lookahead.name === other.lookahead.name;
  }

  nextSymbol(): Symbol | null {
      if (this.dotPosition < this.production.rhs.length) {
          return this.production.rhs[this.dotPosition];
      }
      return null;
  }
}

export function closure(items: LR1Item[], grammar: Grammar): LR1Item[] {
  const result = [...items];
  let changed = true;

  while (changed) {
    changed = false;
    const currentSize = result.length;

    for (let i = 0; i < currentSize; i++) {
        const item = result[i];
        
        // Item form: A -> alpha . B beta, a
        const B = item.nextSymbol();
        
        if (B && B.type === SymbolType.NON_TERMINAL) {
            // Found non-terminal B after dot
            // Construct beta (symbols after B)
            const beta = item.production.rhs.slice(item.dotPosition + 1);
            // new lookaheads = FIRST(beta a)
            const firstSet = firstOfSequence([...beta, item.lookahead], grammar);
            
            const prodB = grammar.getProductionsFor(B);
            
            prodB.forEach(prod => {
                firstSet.forEach(term => {
                    if (term === 'ε') return; // Lookahead cannot be epsilon
                    
                    const newItem = new LR1Item(prod, 0, new Symbol(term, term === '$' ? SymbolType.END : SymbolType.TERMINAL));
                    
                    // Check if newItem exists
                    const exists = result.some(existing => existing.equals(newItem));
                    if (!exists) {
                        result.push(newItem);
                        changed = true;
                    }
                });
            });
        }
    }
    // Note: the loop limit is fixed at start of iteration, but we push to 'result'.
    // To handle new items, we need to iterate over them too.
    // The simple 'while(changed)' combined with iterating over ever-growing result allows this,
    // provided we check duplicates.
    // Optimization: iterating only new items?
    // For simplicity, re-scanning 'result' but we need to ensure we process valid indices.
    // The structure `for (let i = 0; i < currentSize` might miss newly added items in the SAME pass,
    // but the `while(changed)` will catch them in the next pass.
    // Actually, it's safer to iterate `for (const item of result)` but modifying array during iter is tricky.
    // Better: use a queue or repeated passes.
    // In this implementation: `currentSize` limits the loop, so valid (but possibly slow).
    // Let's optimize slightly:
    // We already have 'changed' flag.
    // We can just keep looping until no new size change.
  }
  
  // A cleaner approach for closure to avoid repeated work:
  // Queue based.
  const closureSet = [...items];
  const processed = new Set<string>(); // Use toString for unique check
  items.forEach(it => processed.add(it.toString()));
  
  const queue = [...items];
  
  while (queue.length > 0) {
      const item = queue.shift()!;
      const B = item.nextSymbol();
      
      if (B && B.type === SymbolType.NON_TERMINAL) {
          const beta = item.production.rhs.slice(item.dotPosition + 1);
          const firstSet = firstOfSequence([...beta, item.lookahead], grammar);
          const prodB = grammar.getProductionsFor(B);
          
          prodB.forEach(prod => {
             firstSet.forEach(term => {
                 if (term === 'ε') return;
                 const newLookahead = new Symbol(term, term === '$' ? SymbolType.END : SymbolType.TERMINAL);
                 const newItem = new LR1Item(prod, 0, newLookahead);
                 const key = newItem.toString();
                 if (!processed.has(key)) {
                     processed.add(key);
                     closureSet.push(newItem);
                     queue.push(newItem);
                 }
             });
          });
      }
  }
  
  return closureSet;
}

export function goto(items: LR1Item[], symbol: Symbol, grammar: Grammar): LR1Item[] {
  const movedItems: LR1Item[] = [];
  
  items.forEach(item => {
      const next = item.nextSymbol();
      if (next && next.name === symbol.name) {
          movedItems.push(new LR1Item(item.production, item.dotPosition + 1, item.lookahead));
      }
  });
  
  return closure(movedItems, grammar);
}

export class CanonicalCollection {
    states: LR1Item[][];
    transitions: Map<number, Map<string, number>>; // stateIndex -> symbol -> nextStateIndex

    constructor(states: LR1Item[][], transitions: Map<number, Map<string, number>>) {
        this.states = states;
        this.transitions = transitions;
    }
}

export function buildCanonicalCollection(grammar: Grammar): CanonicalCollection {
    // Initial item: S' -> . S, $
    const startProd = grammar.productions[0]; // S' -> S
    const endSymbol = new Symbol('$', SymbolType.END);
    const startItem = new LR1Item(startProd, 0, endSymbol);
    
    const initialClosure = closure([startItem], grammar);
    
    const states: LR1Item[][] = [initialClosure];
    const transitions = new Map<number, Map<string, number>>();
    
    let changed = true;
    while(changed) {
        changed = false;
        
        for (let i = 0; i < states.length; i++) {
            const state = states[i];
            
            // Collect all symbols that can be transitioned on
            const symbols = new Set<string>();
            state.forEach(item => {
                const next = item.nextSymbol();
                if (next) symbols.add(next.name);
            });
            
            symbols.forEach(symName => {
                // Find symbol object (can be generic, just need name matching usually)
                const symObj = state.find(it => it.nextSymbol()?.name === symName)!.nextSymbol()!;
                
                const nextStateItems = goto(state, symObj, grammar);
                if (nextStateItems.length === 0) return;
                
                // Check if this state already exists
                let existingStateIndex = -1;
                
                // Helper to compare two sets of items
                const isSameState = (s1: LR1Item[], s2: LR1Item[]) => {
                    if (s1.length !== s2.length) return false;
                    const set1 = new Set(s1.map(it => it.toString()));
                    for (const it of s2) {
                        if (!set1.has(it.toString())) return false;
                    }
                    return true;
                };
                
                for (let j = 0; j < states.length; j++) {
                    if (isSameState(states[j], nextStateItems)) {
                        existingStateIndex = j;
                        break;
                    }
                }
                
                if (existingStateIndex === -1) {
                    existingStateIndex = states.length;
                    states.push(nextStateItems);
                    changed = true;
                }
                
                if (!transitions.has(i)) transitions.set(i, new Map());
                transitions.get(i)!.set(symName, existingStateIndex);
            });
        }
    }
    
    return new CanonicalCollection(states, transitions);
}
