import { LR1Item, buildCanonicalCollection } from "./Items";
import { Grammar, SymbolType } from "./Grammar";

export const ActionType = {
  SHIFT: "SHIFT",
  REDUCE: "REDUCE",
  ACCEPT: "ACCEPT",
  ERROR: "ERROR",
} as const;

export type ActionType = (typeof ActionType)[keyof typeof ActionType];

export interface Action {
  type: ActionType;
  value?: number | string; // State index for SHIFT, Production index or string for REDUCE
  // Note: For REDUCE, it's better to store the actual Production or its string representation
  productionStr?: string;
  productionLhs?: string;
  productionRhsLen?: number;
}

export interface ParsingTable {
  action: Map<number, Map<string, Action>>;
  goto: Map<number, Map<string, number>>;
  states: LR1Item[][];
}

export function buildParsingTable(grammar: Grammar): ParsingTable {
  const collection = buildCanonicalCollection(grammar);
  const action = new Map<number, Map<string, Action>>();
  const goto = new Map<number, Map<string, number>>();

  collection.states.forEach((state, i) => {
    if (!action.has(i)) action.set(i, new Map());
    if (!goto.has(i)) goto.set(i, new Map());

    // Items in state I_i
    state.forEach((item) => {
      const next = item.nextSymbol();

      // 1. [A -> alpha . a beta, b] and transition on 'a' to I_j -> SHIFT j
      if (next && next.type === SymbolType.TERMINAL) {
        const nextState = collection.transitions.get(i)?.get(next.name);
        if (nextState !== undefined) {
          const existing = action.get(i)!.get(next.name);
          // Check shift-reduce conflict later? For now, implementing basic rules.
          // Prioritize Shift?? Or report conflict.
          // Standard: if conflict, it's not CLR(1).
          if (existing && existing.type !== ActionType.SHIFT) {
            // Conflict!
            // Just overwrite for now or throw?
            // Let's store.
          }
          action
            .get(i)!
            .set(next.name, { type: ActionType.SHIFT, value: nextState });
        }
      }

      // 2. [A -> alpha ., a] -> REDUCE by A -> alpha
      if (!next) {
        if (
          item.production.lhs.name === grammar.startSymbol.name &&
          item.lookahead.name === "$"
        ) {
          // [S' -> S ., $] -> ACCEPT
          action.get(i)!.set("$", { type: ActionType.ACCEPT });
        } else {
          // Reduce
          // Store details for the parser to use (pop len symbols, push LHS)
          const reduceAction: Action = {
            type: ActionType.REDUCE,
            value: item.production.toString(),
            productionStr: item.production.toString(),
            productionLhs: item.production.lhs.name,
            productionRhsLen: item.production.rhs.length,
          };

          const existing = action.get(i)!.get(item.lookahead.name);
          if (existing) {
            // Conflict
            // If existing is Shift, Shift-Reduce conflict
            // If existing is Reduce, Reduce-Reduce conflict
            console.warn(
              `Conflict in state ${i} on symbol ${item.lookahead.name}: Existing ${existing.type} vs New REDUCE`,
            );
          }
          action.get(i)!.set(item.lookahead.name, reduceAction);
        }
      }
    });

    // 3. Transitions for GOTO (Non-terminals)
    collection.transitions.get(i)?.forEach((nextState, sym) => {
      // We need to check if 'sym' is non-terminal.
      // We can check the grammar if we had 'sym' object, but here we just have string name.
      // We can infer from grammar.terminals set.
      if (!grammar.terminals.has(sym) && sym !== "$") {
        goto.get(i)!.set(sym, nextState);
      }
    });
  });

  const table = { action, goto, states: collection.states };
  console.log(
    "[buildParsingTable] action:",
    Array.from(action.entries()).map(([state, map]) => [
      state,
      Object.fromEntries(map),
    ]),
  );
  console.log(
    "[buildParsingTable] goto:",
    Array.from(goto.entries()).map(([state, map]) => [
      state,
      Object.fromEntries(map),
    ]),
  );
  console.log(
    "[buildParsingTable] states:",
    collection.states.map((s) => s.map((i) => i.toString())),
  );
  return table;
}
