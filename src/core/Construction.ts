
import { Grammar, Symbol, SymbolType } from './Grammar';
import { type ParseStep } from './Parser';
import { first } from './Sets';
import { LR1Item, closure, goto } from './Items';

/**
 * Generates a sequence of "steps" that represent the construction of the CLR(1) parser.
 * This includes:
 * 1. Augmented Grammar
 * 2. FIRST sets
 * 3. Canonical Collection construction (Closure & Goto)
 */
export function generateConstructionTrace(grammar: Grammar): ParseStep[] {
    const steps: ParseStep[] = [];
    // Helper to add step
    const addStep = (action: string, stack: string[], input: string[] = []) => {
        steps.push({
            step: 0, // Placeholder, will be re-indexed
            action,
            stack,
            input
        });
    };

    // 1. Augmented Grammar
    // The grammar passed in is already augmented by `parseGrammar`.
    // We can show the start production.
    const startProd = grammar.productions[0];
    addStep(
        "Augmented Grammar",
        [`Start Symbol: ${grammar.startSymbol.name}`, `production: ${startProd.toString()}`],
        ["S' -> S"]
    );

    // 2. FIRST Sets
    // Compute FIRST for all non-terminals
    const nonTerminals = Array.from(grammar.nonTerminals).sort();
    nonTerminals.forEach(ntName => {
        const sym = new Symbol(ntName, SymbolType.NON_TERMINAL);
        const fSet = first(sym, grammar);
        addStep(
            `FIRST(${ntName})`,
            Array.from(fSet).map(t => t),
            []
        );
    });

    // 3. Canonical Collection Construction
    // We strictly simulate the build process to generate the trace.
    // This duplicates some logic from buildCanonicalCollection but allows us to capture "events".
    
    // Initial item: S' -> . S, $
    const endSymbol = new Symbol('$', SymbolType.END);
    const startItem = new LR1Item(startProd, 0, endSymbol);
    
    // Log Initial Item
    addStep(
        "Initial Item",
        [startItem.toString()],
        []
    );

    // Initial Closure
    const initialClosure = closure([startItem], grammar);
    addStep(
        "Closure(I0)",
        initialClosure.map(item => item.toString()),
        ["State I0 constructed"]
    );

    const states: LR1Item[][] = [initialClosure];
    // We need to track processed states to avoid infinite loops in our "simulation" logging
    // But actually, we want to show the creation of NEW states.
    
    // We'll mimic the loop.
    const transitionsLog: {fromState: number, symbol: string, toStateItems: LR1Item[]}[] = [];
    
    let changed = true;
    let iterations = 0;
    
    // To avoid infinite trace generation in case of bugs, cap iterations
    while(changed && iterations < 100) {
        changed = false;
        iterations++;

        // We iterate current states. 
        // Note: In the real builder, we keep adding to 'states'.
        // Here we do the same.
        const currentStatesCount = states.length;

        for (let i = 0; i < currentStatesCount; i++) {
            const state = states[i];
            
            // Collect symbols
            const symbols = new Set<string>();
            state.forEach(item => {
                const next = item.nextSymbol();
                if (next) symbols.add(next.name);
            });

            // For each symbol, compute Goto
            const sortedSymbols = Array.from(symbols).sort();
            
            for (const symName of sortedSymbols) {
                 const symObj = state.find(it => it.nextSymbol()?.name === symName)!.nextSymbol()!;
                 
                 // We don't want to log "Goto" for every existing transition again and again in the loop if we handled it.
                 // But the algorithm re-checks.
                 // Let's only log if it produces a meaningful result (new state or link).
                 // Actually, checking "did we already log this transition?" is complex.
                 // Simpler: Just allow the logic to run, but maybe only log "New State" events?
                 // Or "Goto(I_i, X) = I_j".
                 
                 const nextStateItems = goto(state, symObj, grammar);
                 if (nextStateItems.length === 0) continue;

                 // Check existence
                 let existingStateIndex = -1;
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
                    
                    // Log creation of new state
                    addStep(
                        `Goto(I${i}, ${symName})`,
                        nextStateItems.map(it => it.toString()),
                        [`Creates New State I${existingStateIndex}`]
                    );
                } else {
                     // It links to existing. 
                     // We might want to log this too? "Goto(I_i, X) = Existing I_j"
                     // To avoid spam, maybe only if we haven't logged this specific transition for this state?
                     // Let's check our local log.
                     const alreadyLogged = transitionsLog.some(t => t.fromState === i && t.symbol === symName);
                     if (!alreadyLogged) {
                         addStep(
                            `Goto(I${i}, ${symName})`,
                            [`Matches Item Set I${existingStateIndex}`],
                            [`Links to existing State I${existingStateIndex}`]
                         );
                     }
                }
                
                // Track transition to avoid duplicate logs in next pass
                const alreadyLogged = transitionsLog.some(t => t.fromState === i && t.symbol === symName);
                if (!alreadyLogged) {
                     transitionsLog.push({ fromState: i, symbol: symName, toStateItems: nextStateItems });
                }
            }
        }
    }

    // Fix step numbers
    // We want these to be negative or just start from 1?
    // If we prepend to parsing steps, we might want them to be distinct.
    // The UI handles them as a continuous list.
    // We'll re-index them in the UI integration or just here?
    // Let's just return raw steps and let the caller sequence them.
    
    return steps;
}
