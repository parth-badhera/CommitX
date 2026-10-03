import { Code2, Footprints, BookOpen, Dumbbell, Library, Flower2, PersonStanding, Sparkles } from "lucide-react";

export const CATEGORY_META = {
  Coding: { icon: Code2, hue: "#D7FF3E" },
  Running: { icon: Footprints, hue: "#FFB547" },
  Studying: { icon: BookOpen, hue: "#A393FF" },
  Fitness: { icon: Dumbbell, hue: "#FF6B5B" },
  Reading: { icon: Library, hue: "#7FD4FF" },
  Meditation: { icon: Flower2, hue: "#4ADE9A" },
  Walking: { icon: PersonStanding, hue: "#F2C3FF" },
  Custom: { icon: Sparkles, hue: "#F4F3EE" },
};

export const CATEGORIES = Object.keys(CATEGORY_META);

export function categoryMeta(name) {
  return CATEGORY_META[name] || CATEGORY_META.Custom;
}
