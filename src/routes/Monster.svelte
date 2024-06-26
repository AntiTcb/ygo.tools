<script lang="ts">
  type MonsterProps = {
    atk: number;
    def: number | null;
    position: 'ATK' | 'DEF';
  };
  let { atk = $bindable(0), def = $bindable(), position = $bindable('ATK') }: MonsterProps = $props();

  $inspect({ atk, def, position });
</script>

<article>
  <div class="inline-flex gap-4">
    <label class="label" for="atk">
      <span class="label-text">ATK</span>
      <input class="input" type="number" id="atk" bind:value={atk} />
    </label>

    <label class="label" for="atk">
      <span class="label-text">DEF</span>
      <input class="input" type="number" id="atk" bind:value={def} />
    </label>
  </div>

  <label class="label" for="position">
    <span class="label-text">Position</span>
    <div class="flex gap-4">
      <label class="flex items-center space-x-2">
        <p>ATK</p>
        <input type="radio" name="pos" id="pos" class="radio" value="atk" bind:group={position} />
      </label>
      <label class="flex items-center space-x-2">
        <p>DEF</p>
        <input type="radio" name="pos" id="pos" class="radio" value="def" bind:group={position} />
      </label>
    </div>
  </label>
</article>
