import { Grammar } from "./Grammar";
import { type ParsingTable, ActionType } from "./Table";

export interface ParseStep {
  step: number;
  stack: string[];
  input: string[];
  action: string;
}

export interface ParseNode {
  symbol: string;
  children: ParseNode[];
}

export interface ParseResult {
  steps: ParseStep[];
  accepted: boolean;
  error?: string;
  parseTree?: ParseNode;
}

export function parseString(
  input: string,
  _grammar: Grammar,
  table: ParsingTable,
): ParseResult {
  const steps: ParseStep[] = [];

  // Convert input string to tokens/symbols
  // Assuming space-separated or just characters?
  // The grammar parser assumed space separated symbols for productions.
  // Let's assume input is space separated terminals.
  // And append '$'
  const inputTokens = [...input.trim().split(/\s+/), "$"].filter(
    (t) => t.length > 0,
  );

  const stack: (number | string)[] = [0]; // Stack of states and symbols. Actually CLR parser usually pushes state.
  // Standard LR stack: s0 X1 s1 X2 s2 ...
  // where s0 is start state.

  // Parallel stack for parse tree construction.
  // SHIFT pushes a terminal node.
  // REDUCE pops |rhs| nodes, wraps them in an LHS node, then pushes it.
  const nodeStack: ParseNode[] = [];

  let ip = 0; // Input pointer
  let stepCount = 0;

  while (true) {
    const topState = stack[stack.length - 1] as number;
    const currentToken = inputTokens[ip];

    const action = table.action.get(topState)?.get(currentToken);

    const stepLog: ParseStep = {
      step: stepCount++,
      stack: stack.map((x) => x.toString()),
      input: inputTokens.slice(ip),
      action: "",
    };

    if (!action) {
      stepLog.action = "ERROR";
      steps.push(stepLog);
      const result = {
        steps,
        accepted: false,
        error: `Syntax Error at '${currentToken}' in state ${topState}. Expected: ${Array.from(table.action.get(topState)?.keys() || []).join(", ")}`,
      };
      console.log("[parseString] result:", result);
      return result;
    }

    if (action.type === ActionType.SHIFT) {
      const nextState = action.value as number;
      stepLog.action = `Shift ${currentToken}`;
      steps.push(stepLog);

      stack.push(currentToken);
      stack.push(nextState);

      nodeStack.push({ symbol: currentToken, children: [] });
      ip++;
    } else if (action.type === ActionType.REDUCE) {
      stepLog.action = `Reduce by ${action.productionStr}`;
      steps.push(stepLog);

      const len = action.productionRhsLen!;
      // Pop 2 * len items (symbol + state)
      for (let k = 0; k < 2 * len; k++) {
        stack.pop();
      }

      const children: ParseNode[] = [];
      for (let k = 0; k < len; k++) {
        const child = nodeStack.pop();
        if (child) children.push(child);
      }
      children.reverse();

      const lhsNode: ParseNode = {
        symbol: action.productionLhs!,
        children: len === 0 ? [{ symbol: "ε", children: [] }] : children,
      };
      nodeStack.push(lhsNode);

      const prevState = stack[stack.length - 1] as number;
      const lhs = action.productionLhs!;

      const nextState = table.goto.get(prevState)?.get(lhs);

      if (nextState === undefined) {
        const result = {
          steps,
          accepted: false,
          error: `GOTO Error: No transition from state ${prevState} on symbol ${lhs}`,
        };
        console.log("[parseString] result:", result);
        return result;
      }

      stack.push(lhs);
      stack.push(nextState);
      // Input pointer does not move
    } else if (action.type === ActionType.ACCEPT) {
      stepLog.action = "ACCEPT";
      steps.push(stepLog);

      const parseTree =
        nodeStack.length > 0 ? nodeStack[nodeStack.length - 1] : undefined;
      const result = { steps, accepted: true, parseTree };
      console.log("[parseString] result:", result);
      return result;
    }
  }
}
