<script lang="ts">
  import Button from "../../components/Button.svelte";

  let dialogEl = $state<HTMLDialogElement | null>(null);
  let title = $state("");
  let message = $state("");
  let onConfirm = $state<(() => void) | null>(null);

  $effect(() => {
    if (onConfirm && dialogEl && !dialogEl.open) {
      dialogEl.showModal();
    }
  });

  function handleClose() {
    onConfirm = null;
  }

  function handleConfirm() {
    const cb = onConfirm;
    onConfirm = null;
    dialogEl?.close();
    cb?.();
  }

  export function show(t: string, msg: string, cb: () => void) {
    title = t;
    message = msg;
    onConfirm = cb;
  }
</script>

<dialog
  bind:this={dialogEl}
  class="confirm-dialog backdrop:bg-foreground/40 backdrop:backdrop-blur-sm bg-transparent p-0 max-w-none w-full my-auto outline-none rounded-lg"
  onclose={handleClose}
  onclick={(e) => {
    if (dialogEl && e.target === dialogEl) {
      dialogEl.close();
    }
  }}
>
  <div
    class="bg-surface border border-border rounded-lg w-[min(90vw,360px)] mx-auto my-auto p-6 shadow-xl"
  >
    <h3 class="font-heading text-lg font-medium text-foreground mb-2">
      {title}
    </h3>
    <p class="font-body text-xs text-muted-foreground leading-relaxed mb-6">
      {message}
    </p>
    <div class="flex justify-end gap-3">
      <Button variant="ghost" onclick={() => dialogEl?.close()}>Cancel</Button>
      <Button variant="primary" onclick={handleConfirm}>Switch anyway</Button>
    </div>
  </div>
</dialog>

<style>
  @starting-style {
    dialog[open].confirm-dialog > div {
      opacity: 0;
      transform: scale(0.95);
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    dialog[open].confirm-dialog > div {
      transition:
        opacity 200ms ease-out,
        transform 200ms ease-out;
    }
  }
</style>
