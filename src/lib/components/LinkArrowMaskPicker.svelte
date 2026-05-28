<script lang="ts">
  import { LINK_ARROW_GRID } from '$lib/db/linkArrows';
  import ArrowDown from '~icons/lucide/arrow-down';
  import ArrowDownLeft from '~icons/lucide/arrow-down-left';
  import ArrowDownRight from '~icons/lucide/arrow-down-right';
  import ArrowLeft from '~icons/lucide/arrow-left';
  import ArrowRight from '~icons/lucide/arrow-right';
  import ArrowUp from '~icons/lucide/arrow-up';
  import ArrowUpLeft from '~icons/lucide/arrow-up-left';
  import ArrowUpRight from '~icons/lucide/arrow-up-right';

  type Props = {
    /** Selected direction digits (same single digits as in raw `link_arrows`). */
    values?: number[] | undefined;
  };

  let { values = $bindable<number[] | undefined>() }: Props = $props();

  const selected = (): number[] => values ?? [];

  const isOn = (digit: number) => selected().includes(digit);

  const toggle = (digit: number) => {
    const cur = [...selected()];
    const i = cur.indexOf(digit);
    if (i >= 0) cur.splice(i, 1);
    else cur.push(digit);
    cur.sort((a, b) => a - b);
    values = cur;
  };

  const getArrowIcon = (digit: number) => {
    switch (digit) {
      case 7:
        return ArrowUpLeft;
      case 8:
        return ArrowUp;
      case 9:
        return ArrowUpRight;
      case 4:
        return ArrowLeft;
      case 6:
        return ArrowRight;
      case 1:
        return ArrowDownLeft;
      case 2:
        return ArrowDown;
      case 3:
        return ArrowDownRight;
    }
  };
</script>

<div class="inline-grid w-fit grid-cols-3 gap-1" role="group" aria-label="Link arrows">
  {#each LINK_ARROW_GRID as row, ri (ri)}
    {#each row as cell, ci (`${ri}-${ci}`)}
      {#if cell === null}
        <div class="flex aspect-square min-h-9 min-w-9 items-center justify-center" aria-hidden="true">
          <span class="text-xs opacity-40">·</span>
        </div>
      {:else}
        {@const Icon = getArrowIcon(cell.digit)}
        <button
          type="button"
          class="btn flex aspect-square min-h-9 min-w-9 flex-col"
          class:preset-filled-surface-500={isOn(cell.digit)}
          class:preset-tonal-surface={!isOn(cell.digit)}
          aria-pressed={isOn(cell.digit)}
          title={`${cell.label} (${cell.digit})`}
          onclick={() => toggle(cell.digit)}>
          <Icon class="size-5" />
        </button>
      {/if}
    {/each}
  {/each}
</div>
