<script lang="ts">
  import { Copy, Check } from "@lucide/svelte";

  interface Props {
    code: string;
    variant?: "ghost" | "ghost-inverted";
    class?: string;
  }

  let { code, variant = "ghost-inverted", class: className }: Props = $props();

  let copied = $state(false);
  let resetTimer: ReturnType<typeof setTimeout> | null = null;

  async function handleClick() {
    await navigator.clipboard.writeText(code);
    copied = true;
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      copied = false;
    }, 2000);
  }
</script>

<button
  title="Copy"
  onclick={handleClick}
  data-copied={copied ? "" : undefined}
  class={[
    "group relative cursor-pointer transition-colors p-1 size-5.5",
    variant === "ghost-inverted" &&
      "text-foreground/70 hover:text-foreground dark:text-white/50 dark:hover:text-white",
    variant !== "ghost-inverted" && "text-muted hover:text-foreground",
    className,
  ]}
>
  <Copy
    class="absolute inset-0 m-auto scale-100 blur-[0px] transition-all duration-200 ease group-data-copied:opacity-0 group-data-copied:scale-[0.6] group-data-copied:blur-sm"
    size={14}
  />
  <Check
    class="absolute inset-0 m-auto transition-all duration-200 ease opacity-0 scale-[0.6] blur-sm group-data-copied:opacity-100 group-data-copied:scale-100 group-data-copied:blur-[0px]"
    size={14}
    strokeWidth={2.5}
  />
</button>
