import { BookText, FlaskConical } from "@lucide/astro";

export interface NavLink {
  href: string;
  label: string;
  external?: boolean;
  active?: boolean;
  matchPrefix?: boolean;
  icon: typeof BookText;
}

export const navigationLinks = [
  { href: "/docs/", label: "Docs", icon: BookText, matchPrefix: true },
  { href: "/play/", label: "Playground", icon: FlaskConical },
];
