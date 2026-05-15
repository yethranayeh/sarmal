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
  <path d="m8 11 4 4 4-4" />
  <path
    d="M8 5H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4"
  />
</svg>
