<script lang="ts">
  import type { NumCmp } from '#lib/effect-search/tagSchema.js';

  let { label, value, onchange }: { label: string; value: NumCmp | undefined; onchange: (next: NumCmp | null) => void } = $props();

  const OPS: { op: NumCmp['op']; text: string }[] = [
    { op: 'lte', text: '≤' },
    { op: 'gte', text: '≥' },
    { op: 'eq', text: '=' },
    { op: 'lt', text: '<' },
    { op: 'gt', text: '>' },
    { op: 'neq', text: '≠' },
  ];

  // The operator is kept locally so it can be picked before a number is typed.
  let op = $state<NumCmp['op']>('lte');
  let amount = $state<number | null>(null);
  $effect.pre(() => {
    op = value?.op ?? 'lte';
    amount = value?.value ?? null;
  });

  const commit = () => {
    const n = typeof amount === 'number' ? Math.trunc(amount) : Number.NaN;
    if (Number.isNaN(n)) {
      if (value) onchange(null);
      return;
    }
    if (value?.op !== op || value.value !== n) onchange({ op, value: n });
  };
</script>

<label class="flex items-center gap-1">
  <span class="w-12 shrink-0">{label}</span>
  <select class="select w-14 px-1 py-0 text-xs" aria-label="{label} comparison" bind:value={op} onchange={commit}>
    {#each OPS as o (o.op)}<option value={o.op}>{o.text}</option>{/each}
  </select>
  <input
    class="input w-20 py-0 text-xs"
    type="number"
    inputmode="numeric"
    aria-label={label}
    placeholder="any"
    bind:value={amount}
    onchange={commit} />
</label>
