"use client";

// Lightweight toast store adapted from the shadcn/ui pattern.
import * as React from "react";
import type { ToastProps } from "@/components/ui/toast";

const TOAST_LIMIT = 3;
const TOAST_REMOVE_DELAY = 4000;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
};

let count = 0;
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

type State = { toasts: ToasterToast[] };
const listeners: Array<(state: State) => void> = [];
let memoryState: State = { toasts: [] };

function dispatch(toasts: ToasterToast[]) {
  memoryState = { toasts };
  listeners.forEach((l) => l(memoryState));
}

function toast(props: Omit<ToasterToast, "id">) {
  const id = genId();
  const next = [{ ...props, id, open: true }, ...memoryState.toasts].slice(0, TOAST_LIMIT);
  dispatch(next);
  setTimeout(() => {
    dispatch(memoryState.toasts.filter((t) => t.id !== id));
  }, TOAST_REMOVE_DELAY);
  return { id };
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);
  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const i = listeners.indexOf(setState);
      if (i > -1) listeners.splice(i, 1);
    };
  }, []);
  return {
    ...state,
    toast,
    dismiss: (id?: string) =>
      dispatch(id ? memoryState.toasts.filter((t) => t.id !== id) : []),
  };
}

export { useToast, toast };
