<script lang="ts">
  import { page } from '$app/state';
  import { createDamageCalculator } from '$lib/damageCalc.svelte';
  import { watch } from 'runed';
  import Seo from 'sk-seo';
  import SwapIcon from '~icons/mdi/swap-horizontal';
  import BattleModifiers from './BattleModifiers.svelte';
  import Monster from './Monster.svelte';

  const calc = createDamageCalculator(page.url.hash ? page.url.hash.slice(1) : null);

  let open = $state<boolean>(true);
  let showExamples = $state<boolean>(false);

  const swap = () => {
    // swap monsters and modifiers
    const tempMonster = calc.attackingMonster;
    calc.attackingMonster = calc.defendingMonster;
    calc.defendingMonster = tempMonster;

    const tempModifiers = calc.playerAModifiers;
    calc.playerAModifiers = calc.playerBModifiers;
    calc.playerBModifiers = tempModifiers;
  };

  watch(
    () => calc.battleResult,
    () => {
      if (!calc.isModified) {
        history.replaceState({}, '', window.location.pathname);
        return;
      }
      window.location.hash = calc.encodedString;
    },
    {
      lazy: true,
    },
  );
</script>

<Seo
  title="Yu-Gi-Oh! Damage Calculation Calculator"
  description="A calculator for the various effects that modify how battle damage is applied to players during Damage Calculation."
  keywords="Yu-Gi-Oh!, ygo, yugioh, damage calculation, damage calc, dmg step, damage step, dmg calc"
  author="AntiTcb" />

<div class="flex flex-col gap-4 lg:grid lg:grid-cols-2">
  <div id="result" class="card col-span-2">
    <header class="card-header">Battle Result:</header>
    <!-- Desktop Table -->
    <div class="table-wrap hidden lg:table">
      <table class="table w-auto">
        <thead>
          <tr>
            <th class="min-w-32"></th>
            <th class="text-right! font-bold!">Battle Damage</th>
            <th class="text-right! font-bold!">Effect Damage</th>
            <th class="text-right! font-bold!">Redirected Battle Damage</th>
            <th class="text-right! font-bold!">Redirected Effect Damage</th>
            <th class="text-right! font-bold!">Life Gained</th>
            <th class="text-right! font-bold!">Net Difference</th>
          </tr>
        </thead>
        <tbody class="[&>tr]:hover:preset-tonal-primary text-right [&>tr>td:first-child]:italic">
          <tr>
            <td>Player A</td>
            <td>{calc.battleResult.playerA.battleDamage}</td>
            <td>{calc.battleResult.playerA.effectDamage}</td>
            <td>{calc.battleResult.playerA.redirectedDamage}</td>
            <td>{calc.battleResult.playerA.redirectedEffectDamage}</td>
            <td>{calc.battleResult.playerA.lifeGained}</td>
            <td
              >{calc.battleResult.playerA.battleDamage +
                calc.battleResult.playerA.effectDamage -
                calc.battleResult.playerA.redirectedDamage -
                calc.battleResult.playerA.redirectedEffectDamage +
                calc.battleResult.playerA.lifeGained}</td>
          </tr>
          <tr>
            <td>Player B</td>
            <td>{calc.battleResult.playerB.battleDamage}</td>
            <td>{calc.battleResult.playerB.effectDamage}</td>
            <td>{calc.battleResult.playerB.redirectedDamage}</td>
            <td>{calc.battleResult.playerB.redirectedEffectDamage}</td>
            <td>{calc.battleResult.playerB.lifeGained}</td>
            <td
              >{calc.battleResult.playerB.battleDamage +
                calc.battleResult.playerB.effectDamage -
                calc.battleResult.playerB.redirectedDamage -
                calc.battleResult.playerB.redirectedEffectDamage +
                calc.battleResult.playerB.lifeGained}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <!-- Mobile Table -->
    <div class="table-wrap block lg:hidden">
      <table class="table w-auto">
        <thead>
          <tr>
            <th class="min-w-32"></th>
            <th class="text-right! font-bold!">Player A</th>
            <th class="text-right! font-bold!">Player B</th>
          </tr>
        </thead>
        <tbody class="[&>tr]:hover:preset-tonal-primary text-right [&>tr>td:first-child]:italic">
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
            <td>Redirected Battle Damage</td>
            <td>{calc.battleResult.playerA.redirectedDamage}</td>
            <td>{calc.battleResult.playerB.redirectedDamage}</td>
          </tr>
          <tr>
            <td>Redirected Effect Damage</td>
            <td>{calc.battleResult.playerA.redirectedEffectDamage}</td>
            <td>{calc.battleResult.playerB.redirectedEffectDamage}</td>
          </tr>
          <tr>
            <td>Life Gained</td>
            <td>{calc.battleResult.playerA.lifeGained}</td>
            <td>{calc.battleResult.playerB.lifeGained}</td>
          </tr>
          <tr>
            <td>Net Difference</td>
            <td
              >{calc.battleResult.playerA.battleDamage +
                calc.battleResult.playerA.effectDamage -
                calc.battleResult.playerA.redirectedDamage -
                calc.battleResult.playerA.redirectedEffectDamage +
                calc.battleResult.playerA.lifeGained}</td>
            <td
              >{calc.battleResult.playerB.battleDamage +
                calc.battleResult.playerB.effectDamage -
                calc.battleResult.playerB.redirectedDamage -
                calc.battleResult.playerB.redirectedEffectDamage +
                calc.battleResult.playerB.lifeGained}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="card col-span-2">
    <label class="flex items-center space-x-2">
      <input type="checkbox" class="checkbox" bind:checked={showExamples} />
      <p class="italic">Show card examples</p>
    </label>
  </div>

  <div id="attacking" class="card">
    <div class="flex justify-between">
      <h4 class="h4">Player A: Attacking Monster</h4>
      <button type="button" class="btn btn-sm preset-filled" onclick={swap}><SwapIcon class="size-[24px]" /> Swap</button>
    </div>
    <Monster bind:monster={calc.attackingMonster} />

    <details bind:open>
      <summary class="text-lg font-bold">Modifiers</summary>
      <BattleModifiers bind:modifiers={calc.playerAModifiers} bind:showExamples />
    </details>
  </div>
  <div id="defending" class="card">
    <h4 class="h4">Player B: Defending Monster</h4>
    <Monster bind:monster={calc.defendingMonster} defending />

    <details bind:open>
      <summary class="text-lg font-bold">Modifiers</summary>
      <BattleModifiers bind:modifiers={calc.playerBModifiers} bind:showExamples />
    </details>
  </div>
</div>
