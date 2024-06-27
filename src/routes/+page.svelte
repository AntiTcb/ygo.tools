<script lang="ts">
  import { createDamageCalculator } from '$lib/damageCalc.svelte';
  import Monster from './Monster.svelte';

  const calc = createDamageCalculator();
  $inspect({ calc });
</script>

<div class="flex flex-col gap-4 md:grid md:grid-cols-2">
  <div id="attacking" class="card">
    <header>Player A: Attacking Monster</header>
    <Monster bind:monster={calc.attackingMonster} />
  </div>
  <div id="defending" class="card">
    <header>Player B: Defending Monster</header>
    <Monster bind:monster={calc.defendingMonster} />
  </div>
  <div id="modifications" class="card col-span-2">
    <header>Modifications</header>
    <article>
      <ul>
        <li>Player A's Modifiers:</li>
        <li>Player B's Modifiers:</li>
      </ul>
    </article>
  </div>
  <div id="result" class="card col-span-2">
    <header>Battle Result</header>
    <article>
      <ul>
        <li>Damage Player A Takes: {calc.damage.attackingPlayer.battleDamage}</li>
        <li>Damage Player B Takes: {calc.damage.defendingPlayer.battleDamage}</li>
      </ul>
    </article>
  </div>
</div>

<style lang="postcss">
  .card {
    @apply p-4 preset-filled-surface-100-900;
  }
</style>
