<script lang="ts" module>
  // Reference: https://www.shadcn-svelte.com/docs/components/button
  import { tv, type VariantProps } from "tailwind-variants";

  export const buttonVariants = tv({
    base: "font-ui cursor-pointer transition-colors inline-flex items-center gap-1.5 rounded-full px-4.5 py-2.5 text-[13px] font-semibold leading-none disabled:pointer-events-none disabled:opacity-50",
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-accent",
        ghost: "text-foreground hover:bg-foreground/8",
        "ghost-inverted": "text-white/70 hover:text-white hover:bg-white/10",
        destructive: "text-error hover:bg-error/10",
      },
      active: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      {
        variant: "ghost",
        active: true,
        class: "text-primary bg-primary/10 hover:bg-primary/15",
      },
      {
        variant: "ghost-inverted",
        active: true,
        class: "text-white bg-white/15 hover:bg-white/20",
      },
      {
        variant: "destructive",
        active: true,
        class: "text-error bg-error/10 hover:bg-error/15",
      },
    ],
    defaultVariants: {
      variant: "primary",
      active: false,
    },
  });

  export type ButtonVariant = VariantProps<typeof buttonVariants>["variant"];
</script>

<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    id?: string;
    type?: "button" | "submit" | "reset";
    class?: string;
    variant?: ButtonVariant;
    active?: boolean;
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
  class={buttonVariants({ variant, active, class: className })}
>
  {#if icon}{@render icon()}{/if}
  {#if children}{@render children()}{/if}
</button>
