<script lang="ts" generics="T extends string">
  let {
    options,
    value,
    onchange,
    class: containerClass = "",
    style: containerStyle = "",
  }: {
    options: Array<{ value: T; label: string }>;
    value: T;
    onchange: (v: T) => void;
    class?: string;
    style?: string;
  } = $props();

  let containerEl = $state<HTMLDivElement | null>(null);
  let indicatorEl = $state<HTMLDivElement | null>(null);
  let isSliding = $state(false);

  $effect(() => {
    const active = value;
    const idx = options.findIndex((o) => o.value === active);
    if (idx === -1 || !containerEl || !indicatorEl) {
      return;
    }

    const container = containerEl;
    const indicator = indicatorEl;

    function measure() {
      const buttons = container.querySelectorAll("button");
      const btn = buttons[idx] as HTMLButtonElement | undefined;
      if (!btn || btn.offsetWidth === 0) {
        return;
      }
      indicator.style.left = `${btn.offsetLeft}px`;
      indicator.style.width = `${btn.offsetWidth}px`;
    }

    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(container);

    return () => ro.disconnect();
  });

  function select(v: T) {
    if (v === value) {
      return;
    }

    onchange(v);
    isSliding = true;
    setTimeout(() => {
      isSliding = false;
    }, 450);
  }
</script>

<div
  bind:this={containerEl}
  class="pill-container group relative inline-flex items-center bg-surface-raised backdrop-blur-md border border-border rounded-full p-0.75 gap-0.5 shadow-[0_1px_2px_color-mix(in_srgb,var(--color-foreground)_4%,transparent)] {containerClass}"
  style={containerStyle}
>
  {#each options as opt (opt.value)}
    <button
      class="px-4 py-1.5 rounded-full font-body text-[11px] font-semibold uppercase tracking-[0.08em] cursor-pointer transition-colors duration-300 bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 {value ===
      opt.value
        ? 'text-primary-foreground'
        : 'text-muted-foreground hover:text-foreground'}"
      onclick={() => select(opt.value)}
    >
      {opt.label}
    </button>
  {/each}
  <div
    bind:this={indicatorEl}
    class="pill-indicator bg-primary rounded-full absolute -z-1 h-7 {isSliding
      ? 'is-sliding'
      : ''}"
    style="transition: left 300ms cubic-bezier(0.34, 1.2, 0.64, 1), width 300ms cubic-bezier(0.34, 1.2, 0.64, 1);"
  ></div>
</div>

<style>
  .pill-container:hover .pill-indicator {
    transform: scaleX(var(--pill-hover-expand, 1));
  }

  @media (prefers-reduced-motion: no-preference) {
    .is-sliding {
      animation: slide 450ms ease-out forwards;
    }
  }

  @keyframes slide {
    0% {
      filter: blur(0px);
      transform: scaleX(1);
    }
    20% {
      filter: blur(1px);
      transform: scaleX(1.03);
    }
    60% {
      filter: blur(0.5px);
      transform: scaleX(0.98);
    }
    100% {
      filter: blur(0px);
      transform: scaleX(1);
    }
  }
</style>
