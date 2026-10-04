import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge only knows Tailwind's default scale. Without this it reads
// `text-meta` as a text colour and `shadow-popover` as a shadow colour, and
// drops whichever real colour class it thinks they conflict with.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["meta"] }],
      shadow: [{ shadow: ["button", "popover"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
