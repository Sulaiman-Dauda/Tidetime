"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
}

/**
 * Filter dropdown for the GET forms on list pages. Radix renders a hidden
 * native select for `name`, so the surrounding form still submits normally —
 * we get the design-system trigger without hand-rolling form plumbing.
 *
 * Radix reserves the empty string for "no value", so callers use a sentinel
 * ("all") for the unfiltered option; the server parses it to `undefined`.
 */
export function FilterSelect({
  name,
  defaultValue,
  options,
  ariaLabel,
  className,
}: {
  name: string;
  defaultValue: string;
  options: FilterOption[];
  ariaLabel: string;
  className?: string;
}) {
  return (
    <Select name={name} defaultValue={defaultValue}>
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn("h-8 w-auto min-w-[8.5rem] gap-2 rounded-lg text-[13px]", className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
