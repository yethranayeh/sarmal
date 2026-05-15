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
  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
</svg>
