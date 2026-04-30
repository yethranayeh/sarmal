<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    /** Text content of the tooltip. Use `\n` for line breaks. Ignored if `tooltip` snippet is provided. */
    content?: string;
    /** Custom HTML for the tooltip content. Overrides `content`. */
    tooltip?: Snippet;
    class?: string;
    placement?: "top" | "bottom";
    /** The element that triggers the tooltip on hover. */
    children: Snippet;
  }

  let {
    content = "",
    children,
    tooltip,
    class: className = "",
    placement = "bottom",
  }: Props = $props();

  const placementClass = $derived(
    placement === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5",
  );
</script>

<span class="relative inline-flex group">
  {@render children()}
  <span
    class="absolute left-1/2 -translate-x-1/2 {placementClass}
           bg-surface-raised border border-border rounded px-2 py-1.5
           shadow-[0_2px_8px_rgba(27,28,26,0.06)]
           font-heading italic text-xs leading-relaxed text-muted-foreground
           opacity-0 group-hover:opacity-100
           transition-opacity duration-150
           pointer-events-none whitespace-pre-line z-50
           hidden lg:block w-max {className}"
  >
    {#if tooltip}
      {@render tooltip()}
    {:else}
      {content}
    {/if}
  </span>
</span>
