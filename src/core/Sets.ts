
import { Grammar, Symbol, SymbolType } from './Grammar';

// Compute FIRST set for a single symbol
export function first(symbol: Symbol, grammar: Grammar, visited: Set<string> = new Set()): Set<string> {
  const result = new Set<string>();

  if (symbol.type === SymbolType.TERMINAL || symbol.type === SymbolType.END) {
    result.add(symbol.name);
    return result;
  }

  // Avoid infinite recursion
  if (visited.has(symbol.name)) return result;
  visited.add(symbol.name);

  // For non-terminal, look at productions
  const productions = grammar.getProductionsFor(symbol);
  
  for (const prod of productions) {
      // For each production X -> Y1 Y2 ... Yk
      if (prod.rhs.length === 0) {
          // X -> epsilon
          result.add('ε');
          continue;
      }

      let allDeriveEpsilon = true;
      for (const rhsSym of prod.rhs) {
          const rhsFirst = first(rhsSym, grammar, new Set(visited));
          
          let hasEpsilon = false;
          rhsFirst.forEach(f => {
              if (f === 'ε') hasEpsilon = true;
              else result.add(f);
          });

          if (!hasEpsilon) {
              allDeriveEpsilon = false;
              break;
          }
      }
      
      if (allDeriveEpsilon) {
          result.add('ε');
      }
  }

  return result;
}

// Compute FIRST set for a sequence of symbols
export function firstOfSequence(sequence: Symbol[], grammar: Grammar): Set<string> {
    const result = new Set<string>();
    
    if (sequence.length === 0) {
        result.add('ε');
        return result;
    }

    let allDeriveEpsilon = true;
    for (const sym of sequence) {
        const symFirst = first(sym, grammar);
        let hasEpsilon = false;
        
        symFirst.forEach(f => {
            if (f === 'ε') hasEpsilon = true;
            else result.add(f);
        });
        
        if (!hasEpsilon) {
            allDeriveEpsilon = false;
            break;
        }
    }
    
    if (allDeriveEpsilon) {
        result.add('ε');
    }
    
    return result;
}
