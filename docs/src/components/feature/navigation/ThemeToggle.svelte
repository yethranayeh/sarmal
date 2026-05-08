<script lang="ts">
  import { Sun, Moon, SunMoon } from "@lucide/svelte";
  import Button from "../../Button.svelte";

  type Preference = "light" | "dark" | "system";

  let hydrated = $state(false);
  let preference = $state<Preference>("system");

  try {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "light" || stored === "system") {
      preference = stored as Preference;
    }
  } catch {}

  $effect(() => {
    hydrated = true;
  });

  const resolved = $derived.by((): "light" | "dark" => {
    if (preference !== "system") {
      return preference;
    }
    if (typeof window === "undefined") {
      return "light";
    }
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return isDark ? "dark" : "light";
  });

  $effect(() => {
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

  const modeLabel: Record<Preference, string> = {
    light: "Light mode",
    dark: "Dark mode",
    system: "System preference",
  };

  function toggle() {
    if (preference === "system") {
      preference = resolved === "dark" ? "light" : "dark";
    } else if (preference === "light") {
      preference = "dark";
    } else {
      preference = "system";
    }
    try {
      localStorage.setItem("theme", preference);
    } catch {}
  }
</script>

<Button
  variant="ghost"
  class="p-0! md:p-2!"
  onclick={toggle}
  aria-label={`${modeLabel[preference]} — click to change`}
  title={modeLabel[preference]}
>
  {#snippet icon()}
    <div class="relative h-4 w-4">
      <SunMoon
        size={16}
        class="absolute inset-0 transition-opacity duration-500"
        style={hydrated && preference === "system" ? "" : "opacity:0"}
      />
      <Moon
        size={16}
        class="absolute inset-0 transition-opacity duration-500"
        style={hydrated && preference === "dark" ? "" : "opacity:0"}
      />
      <Sun
        size={16}
        class="absolute inset-0 transition-opacity duration-500"
        style={hydrated && preference === "light" ? "" : "opacity:0"}
      />
    </div>
  {/snippet}
</Button>
