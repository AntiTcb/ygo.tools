<script lang="ts">
  import { type MonsterProps } from '$lib/damageCalc.svelte';
  import { Switch } from '@skeletonlabs/skeleton-svelte';

  let { monster = $bindable() }: { monster: MonsterProps } = $props();

  const setPosition = (e: boolean) => {
    monster.position = e ? 'DEF' : 'ATK';
  };
</script>

<article class="space-y-2">
  <div class="inline-flex gap-4">
    <label class="label" for="atk">
      <span class="label-text">ATK</span>
      <input class="input text-sm" type="number" id="atk" bind:value={monster.atk} />
    </label>

    <label class="label" for="atk">
      <span class="label-text">DEF</span>
      <input class="input text-sm" type="number" id="atk" bind:value={monster.def} />
    </label>
  </div>

  <label class="label" for="position">
    <label class="flex items-center space-x-2">
      <p>{monster.position} Position</p>
      <Switch id="position" name="position" checked={monster.position === 'DEF'} onCheckedChange={setPosition} />
    </label>

    <label class="flex items-center space-x-2">
      <p>Piercing</p>
      <Switch id="piercing" name="piercing" bind:checked={monster.hasPiercing} />
    </label>
  </label>
</article>
