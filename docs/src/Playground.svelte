<script lang="ts">
  import type { PresetData, SharedState } from "./scripts/play/types";
  import { setContext } from "svelte";

  import { createPlaygroundState } from "./scripts/play/playgroundState.svelte";
  import Sidebar from "./scripts/play/Sidebar.svelte";
  import ViewArea from "./scripts/play/ViewArea.svelte";
  import ConfirmDialog from "./scripts/play/ConfirmDialog.svelte";

  interface Props {
    presets: PresetData[];
    savedState?: SharedState | null;
  }

  let { presets, savedState }: Props = $props();

  const previewRef: { current: SVGSVGElement | null } = {
    current: null,
  };

  let confirmDialog: {
    show: (title: string, message: string, onConfirm: () => void) => void;
  } | null = $state(null);

  const pg = createPlaygroundState(
    previewRef,
    (title, message, onConfirm) => {
      confirmDialog?.show(title, message, onConfirm);
    },
    // svelte-ignore state_referenced_locally - my AI told me it is a false positive
    presets,
    // svelte-ignore state_referenced_locally - my AI told me it is a false positive
    savedState ?? null,
  );

  setContext("playground", pg);
</script>

<div class="flex flex-col lg:flex-row h-[calc(100dvh-57px)] relative">
  {#if pg.sidebarVisible}
    <div
      class="absolute inset-0 z-20 bg-black/40 lg:hidden"
      onclick={() => (pg.sidebarVisible = false)}
      role="presentation"
    ></div>
  {/if}
  <Sidebar />
  <ViewArea />
</div>

<ConfirmDialog bind:this={confirmDialog} />
