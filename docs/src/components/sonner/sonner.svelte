<script lang="ts">
  import {
    CircleCheck,
    Frown,
    Info,
    Loader,
    TriangleAlert,
  } from "@lucide/svelte";

  import {
    Toaster as Sonner,
    type ToasterProps as SonnerProps,
  } from "svelte-sonner";

  let { ...restProps }: SonnerProps = $props();

  let dark = $state(
    typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : false,
  );

  $effect(() => {
    const observer = new MutationObserver(() => {
      dark = document.documentElement.classList.contains("dark");
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  });
</script>

<Sonner
  theme={dark ? "dark" : "light"}
  richColors
  closeButton
  toastOptions={{
    unstyled: true,
    classes: {
      toast:
        "group[toast] bg-surface-raised border border-border rounded-lg rounded-br-none shadow-sm p-4 flex items-center gap-3 min-w-50",
      title: "text-sm font-medium",
      description: "text-sm",
      actionButton:
        "bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium hover:bg-accent",
      cancelButton:
        "bg-surface text-foreground rounded-md px-3 py-1.5 text-sm font-medium hover:bg-surface-raised border border-border",
      // TODO: make close button bigger: text-* and size-* did not seem to work
      closeButton: "absolute right-2 top-2 opacity-50 hover:opacity-100",
      error: "border-error/30 bg-error/5 text-error",
      success: "border-success/30 bg-success/5 text-success",
      warning: "border-warning/30 bg-warning/5 text-warning",
      info: "border-info/30 bg-info/5 text-info",
    },
  }}
  {...restProps}
>
  {#snippet loadingIcon()}
    <Loader class="size-4 animate-spin text-muted" />
  {/snippet}
  {#snippet successIcon()}
    <CircleCheck class="size-4 text-success" />
  {/snippet}
  {#snippet errorIcon()}
    <Frown class="size-4 text-error" />
  {/snippet}
  {#snippet infoIcon()}
    <Info class="size-4 text-info" />
  {/snippet}
  {#snippet warningIcon()}
    <TriangleAlert class="size-4 text-warning" />
  {/snippet}
</Sonner>
