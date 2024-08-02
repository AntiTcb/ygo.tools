<script lang="ts">
  import { createDamageCalculator } from '$lib/damageCalc.svelte';
  import Seo from 'sk-seo';
  import BattleModifiers from './BattleModifiers.svelte';
  import Monster from './Monster.svelte';

  const calc = createDamageCalculator();

  let open = $state<boolean>(true);
  let showExamples = $state<boolean>(false);
</script>

<Seo
  title="Yu-Gi-Oh! Damage Calculation Calculator"
  description="A calculator for the various effects that modify how battle damage is applied to players during Damage Calculation."
  keywords="Yu-Gi-Oh!, ygo, yugioh, damage calculation, damage calc, dmg step, damage step, dmg calc"
  author="AntiTcb" />

<div class="flex flex-col gap-4 lg:grid lg:grid-cols-2">
  <div id="result" class="card col-span-2">
    <header class="h4">Battle Result:</header>
    <table class="table-hover table w-auto">
      <thead>
        <tr>
          <th class="min-w-32"></th>
          <th class="!font-bold">Player A</th>
          <th class="!font-bold">Player B</th>
        </tr>
      </thead>
      <tbody class="text-right [&>tr>td:first-child]:italic hover:[&>tr]:preset-tonal-primary">
        <tr>
          <td>Battle Damage</td>
          <td>{calc.battleResult.playerA.battleDamage}</td>
          <td>{calc.battleResult.playerB.battleDamage}</td>
        </tr>
        <tr>
          <td>Effect Damage</td>
          <td>{calc.battleResult.playerA.effectDamage}</td>
          <td>{calc.battleResult.playerB.effectDamage}</td>
        </tr>
        <tr>
          <td>Redirected Damage</td>
          <td>{calc.battleResult.playerA.redirectedDamage}</td>
          <td>{calc.battleResult.playerB.redirectedDamage}</td>
        </tr>
        <tr>
          <td>Life Gained</td>
          <td>{calc.battleResult.playerA.lifeGained}</td>
          <td>{calc.battleResult.playerB.lifeGained}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="card col-span-2">
    <label class="flex items-center space-x-2">
      <input type="checkbox" class="checkbox" bind:checked={showExamples} />
      <p class="italic">Show card examples</p>
    </label>
  </div>

  <div id="attacking" class="card">
    <h4 class="h4">Player A: Attacking Monster</h4>
    <Monster bind:monster={calc.attackingMonster} />

    <details bind:open>
      <summary class="text-xl font-bold">Modifiers</summary>
      <BattleModifiers bind:modifiers={calc.playerAModifiers} bind:showExamples />
    </details>
  </div>
  <div id="defending" class="card">
    <h4 class="h4">Player B: Defending Monster</h4>
    <Monster bind:monster={calc.defendingMonster} defending />

    <details bind:open>
      <summary class="text-xl font-bold">Modifiers</summary>
      <BattleModifiers bind:modifiers={calc.playerBModifiers} bind:showExamples />
    </details>
  </div>
</div>

<style lang="postcss">
  .card {
    @apply p-4 preset-filled-surface-100-900;
  }
</style>
