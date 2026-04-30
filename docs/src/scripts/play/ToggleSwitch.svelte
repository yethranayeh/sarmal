<script lang="ts">
  interface Props {
    checked: boolean;
    label?: string;
    onChange: (v: boolean) => void;
  }

  let { checked, label, onChange }: Props = $props();

  const ariaLabel = $derived(
    label ?? (checked ? "Hide controls" : "Show controls"),
  );
</script>

{#if label}
  <button
    class="flex items-center justify-between cursor-pointer w-full"
    onclick={() => onChange(!checked)}
    aria-label={label}
  >
    <span
      class="font-body text-[12px] {checked
        ? 'text-foreground'
        : 'text-muted-gray'}"
    >
      {label}
    </span>
    <span
      class="relative w-8 h-4.5 rounded-full transition-colors duration-150 shrink-0 {checked
        ? 'bg-primary'
        : 'bg-border'}"
    >
      <span
        class="absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition-[left] duration-150 {checked
          ? 'left-4'
          : 'left-0.5'}"
      ></span>
    </span>
  </button>
{:else}
  <button
    class="relative w-8 h-4.5 rounded-full transition-colors duration-150 shrink-0 cursor-pointer {checked
      ? 'bg-primary'
      : 'bg-border'}"
    onclick={() => onChange(!checked)}
    aria-label={ariaLabel}
  >
    <span
      class="absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition-[left] duration-150 {checked
        ? 'left-4'
        : 'left-0.5'}"
    ></span>
  </button>
{/if}
