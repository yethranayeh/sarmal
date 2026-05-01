<script lang="ts">
  interface Props {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    formatValue?: (v: number) => string;
    onChange: (v: number) => void;
    onCommit?: (v: number) => void;
  }

  let {
    label,
    value,
    min,
    max,
    step = 0.01,
    formatValue,
    onChange,
    onCommit,
  }: Props = $props();

  const pct = $derived(((value - min) / (max - min)) * 100);
  const display = $derived(formatValue ? formatValue(value) : value.toString());
</script>

<div class="flex items-center gap-3">
  <span
    class="w-24 font-ui text-[10px] font-medium tracking-[0.12em] uppercase text-muted-gray"
    >{label}</span
  >
  <div class="relative h-3.5 flex items-center flex-1">
    <div class="absolute inset-x-0 h-1 rounded-full bg-border"></div>
    <div
      class="absolute h-1 rounded-full bg-primary"
      style="width: {pct}%"
    ></div>
    <div
      class="absolute w-3.5 h-3.5 rounded-full bg-surface-raised border border-border shadow-[0_1px_2px_color-mix(in_srgb,var(--color-foreground)_8%,transparent)] pointer-events-none"
      style="left: calc({pct}% - 7px)"
    ></div>
    <input
      type="range"
      {min}
      {max}
      {step}
      {value}
      oninput={(e) =>
        onChange(parseFloat((e.target as HTMLInputElement).value))}
      onchange={(e) =>
        onCommit?.(parseFloat((e.target as HTMLInputElement).value))}
      class="absolute inset-0 w-full opacity-0 cursor-pointer"
    />
  </div>
  <span class="w-10 font-mono text-xs text-foreground tabular-nums">
    {display}
  </span>
</div>
