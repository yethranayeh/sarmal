<script lang="ts">
  // Lucide — ISC License (https://lucide.dev). Copied locally.
  // ! module resolution prevents @lucide/svelte from loading in Astro dev: https://github.com/withastro/astro/issues/15821

  interface Props {
    size?: number;
    strokeWidth?: number | string;
    class?: string;
    [key: string]: unknown;
  }

  let {
    size = 24,
    strokeWidth = 2,
    class: className = "",
    ...rest
  }: Props = $props();
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  class={className}
  {...rest}
>
  <rect width="18" height="18" x="3" y="3" rx="2" />
  <path d="M7 3v18" />
  <path d="M3 7.5h4" />
  <path d="M3 12h18" />
  <path d="M3 16.5h4" />
  <path d="M17 3v18" />
  <path d="M17 7.5h4" />
  <path d="M17 16.5h4" />
</svg>
