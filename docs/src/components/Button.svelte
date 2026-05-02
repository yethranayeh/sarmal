<script lang="ts">
  import type { Snippet } from "svelte";

  type Variant = "primary" | "ghost" | "ghost-inverted";

  interface Props {
    id?: string;
    type?: "button" | "submit" | "reset";
    class?: string;
    variant?: Variant;
    active?: boolean;
    hoverColor?: "foreground" | "error";
    onclick?: (e: MouseEvent) => void;
    children?: Snippet;
    icon?: Snippet;
    "aria-label"?: string;
    "aria-expanded"?: boolean;
    "aria-haspopup"?: "dialog" | "menu" | "grid" | "listbox" | "tree" | boolean;
    disabled?: boolean;
  }

  let {
    id,
    type = "button",
    class: className,
    variant = "primary",
    active = false,
    hoverColor = "foreground",
    onclick,
    children,
    icon,
    ...rest
  }: Props = $props();
</script>

<button
  {id}
  {type}
  {onclick}
  {...rest}
  class={[
    "font-ui cursor-pointer transition-colors inline-flex items-center gap-1.5 rounded-full px-4.5 py-2.5 text-[13px] font-semibold leading-none",
    variant === "primary" &&
      "bg-primary text-primary-foreground hover:bg-accent",
    variant === "ghost" && active && "text-primary hover:bg-primary/10",
    variant === "ghost" &&
      !active &&
      hoverColor === "foreground" &&
      "text-foreground hover:bg-foreground/8",
    variant === "ghost" &&
      !active &&
      hoverColor === "error" &&
      "text-foreground hover:bg-error/10 hover:text-error",
    variant === "ghost-inverted" &&
      "text-white/70 hover:text-white hover:bg-white/10",
    className,
  ]}
>
  {#if icon}{@render icon()}{/if}
  {#if children}{@render children()}{/if}
</button>
