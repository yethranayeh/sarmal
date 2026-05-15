<script lang="ts">
  // Lucide — ISC License (https://lucide.dev). Copied locally.
  // ! module resolution prevents @lucide/svelte from loading in Astro dev: https://github.com/withastro/astro/issues/15821
  // CheckIcon is an alias for Check in Lucide.

  import Check from "./Check.svelte";

  interface Props {
    size?: number;
    strokeWidth?: number | string;
    class?: string;
    [key: string]: unknown;
  }

  let { ...rest }: Props = $props();
</script>

<Check {...rest} />
