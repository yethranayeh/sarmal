<script lang="ts">
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
      <button
        class="font-body text-xs px-4 py-2 rounded bg-surface-raised border border-border text-foreground hover:bg-surface-raised/70 transition-colors cursor-pointer"
        onclick={() => dialogEl?.close()}
      >
        Cancel
      </button>
      <button
        class="font-body text-xs px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/80 transition-colors cursor-pointer"
        onclick={handleConfirm}
      >
        Switch anyway
      </button>
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
