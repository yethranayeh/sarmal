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
  <path d="M12 3v12" />
  <path d="m17 8-5-5-5 5" />
  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
</svg>
