<script lang="ts">
  import { Sun, Moon } from "@lucide/svelte";
  import Button from "../../Button.svelte";

  let resolved = $state<"light" | "dark">("light");

  $effect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") {
      resolved = stored;
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      resolved = "dark";
    }
    apply(resolved);
  });

  function apply(theme: "light" | "dark") {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    }
  }

  function toggle() {
    resolved = resolved === "dark" ? "light" : "dark";
    apply(resolved);
    localStorage.setItem("theme", resolved);
  }
</script>

<Button variant="ghost" class="p-2!" onclick={toggle} aria-label="Toggle theme">
  {#snippet icon()}
    {#if resolved === "dark"}
      <Sun size={16} />
    {:else}
      <Moon size={16} />
    {/if}
  {/snippet}
</Button>
