import type {
  RoutingAction,
  RoutingCondition,
  RoutingField,
  RoutingRoute,
} from "@/db/schema";

/**
 * Pure routing-form evaluation. Given a respondent's answers, find the first
 * route whose conditions all match (AND within a route, first-match-wins across
 * routes) and return its action — else the fallback. No I/O; fully unit-tested.
 */

function norm(v: string): string {
  return v.trim().toLowerCase();
}

export function matchCondition(
  condition: RoutingCondition,
  answers: Record<string, string>,
): boolean {
  const raw = answers[condition.fieldId];
  const answer = norm(raw ?? "");
  const target = norm(condition.value);
  switch (condition.operator) {
    case "equals":
      return answer === target;
    case "not_equals":
      return answer !== target;
    case "contains":
      return answer.includes(target);
    case "is_any_of":
      return condition.value
        .split(",")
        .map((v) => norm(v))
        .filter(Boolean)
        .includes(answer);
    default:
      return false;
  }
}

/** A route matches when every one of its conditions matches. */
export function matchRoute(route: RoutingRoute, answers: Record<string, string>): boolean {
  return route.conditions.every((c) => matchCondition(c, answers));
}

/**
 * Resolve where a respondent should go. Returns the first matching route's
 * action, or the fallback, or null when neither is configured.
 */
export function evaluateRouting(
  routes: RoutingRoute[],
  fallback: RoutingAction | null | undefined,
  answers: Record<string, string>,
): RoutingAction | null {
  for (const route of routes) {
    if (matchRoute(route, answers)) return route.action;
  }
  return fallback ?? null;
}

/** Validate required fields are answered. Returns a map of fieldId -> error. */
export function validateRoutingAnswers(
  fields: RoutingField[],
  answers: Record<string, string>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const value = (answers[field.id] ?? "").trim();
    if (field.required && !value) {
      errors[field.id] = `${field.label} is required`;
      continue;
    }
    if (value && field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      errors[field.id] = "Enter a valid email";
    }
    if (value && field.type === "number" && Number.isNaN(Number(value))) {
      errors[field.id] = "Enter a number";
    }
  }
  return errors;
}
