<script lang="ts">
  import { browser } from '$app/environment';
  import { createDamageCalculator } from '$lib/damageCalc.svelte';
  import { useSearchParams } from 'runed/kit';
  import Seo from 'sk-seo';
  import { untrack } from 'svelte';
  import { toast } from 'svelte-sonner';
  import ShareIcon from '~icons/mdi/share';
  import SwapIcon from '~icons/mdi/swap-horizontal';
  import BattleModifiers from './BattleModifiers.svelte';
  import Monster from './Monster.svelte';
  import {
    applyModifiers,
    cloneMonster,
    damagecalcSearchParamsSchema,
    snapshotDamagecalcParams,
  } from './damagecalcSearchParams.schema';

  const params = useSearchParams(damagecalcSearchParamsSchema, {
    pushHistory: false,
    debounce: 300,
    noScroll: true,
    compress: true,
  });

  const calc = createDamageCalculator();
  calc.attackingMonster = cloneMonster(params.attackingMonster);
  calc.defendingMonster = cloneMonster(params.defendingMonster);
  applyModifiers(calc.playerAModifiers, params.playerAModifiers);
  applyModifiers(calc.playerBModifiers, params.playerBModifiers);

  let open = $state<boolean>(true);
  let showExamples = $state<boolean>(params.showExamples);

  /** Sync incoming URL params onto local calculator state. */
  $effect(() => {
    if (!browser) return;
    const fromUrl = {
      attackingMonster: params.attackingMonster,
      defendingMonster: params.defendingMonster,
      playerAModifiers: params.playerAModifiers,
      playerBModifiers: params.playerBModifiers,
      showExamples: params.showExamples,
    };
    const urlJson = JSON.stringify(fromUrl);
    const localJson = JSON.stringify(
      untrack(() =>
        snapshotDamagecalcParams({
          attackingMonster: calc.attackingMonster,
          defendingMonster: calc.defendingMonster,
          playerAModifiers: calc.playerAModifiers,
          playerBModifiers: calc.playerBModifiers,
          showExamples,
        }),
      ),
    );
    if (localJson === urlJson) return;

    calc.attackingMonster = cloneMonster(fromUrl.attackingMonster);
    calc.defendingMonster = cloneMonster(fromUrl.defendingMonster);
    applyModifiers(calc.playerAModifiers, fromUrl.playerAModifiers);
    applyModifiers(calc.playerBModifiers, fromUrl.playerBModifiers);
    showExamples = fromUrl.showExamples;
  });

  /** Push local calculator mutations into the URL. */
  $effect(() => {
    if (!browser) return;
    JSON.stringify(calc.attackingMonster);
    JSON.stringify(calc.defendingMonster);
    JSON.stringify(calc.playerAModifiers.getProps());
    JSON.stringify(calc.playerBModifiers.getProps());
    void showExamples;

    const next = snapshotDamagecalcParams({
      attackingMonster: calc.attackingMonster,
      defendingMonster: calc.defendingMonster,
      playerAModifiers: calc.playerAModifiers,
      playerBModifiers: calc.playerBModifiers,
      showExamples,
    });
    const current = {
      attackingMonster: params.attackingMonster,
      defendingMonster: params.defendingMonster,
      playerAModifiers: params.playerAModifiers,
      playerBModifiers: params.playerBModifiers,
      showExamples: params.showExamples,
    };
    if (JSON.stringify(current) === JSON.stringify(next)) return;
    params.update(next);
  });

  const swap = () => {
    const tempMonster = calc.attackingMonster;
    calc.attackingMonster = calc.defendingMonster;
    calc.defendingMonster = tempMonster;

    const tempModifiers = calc.playerAModifiers;
    calc.playerAModifiers = calc.playerBModifiers;
    calc.playerBModifiers = tempModifiers;
  };

  const copy = (text: string) => {
    toast.promise(() => navigator.clipboard.writeText(text), {
      loading: 'Copying link...',
      success: `Copied link to clipboard!`,
      error: 'Failed to copy',
    });
  };
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
      <table class="table w-auto" data-testid="damagecalc-result-desktop">
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
          <tr data-testid="damagecalc-result-a">
            <td>Player A</td>
            <td data-testid="damagecalc-a-battle">{calc.battleResult.playerA.battleDamage}</td>
            <td>{calc.battleResult.playerA.effectDamage}</td>
            <td>{calc.battleResult.playerA.redirectedDamage}</td>
            <td>{calc.battleResult.playerA.redirectedEffectDamage}</td>
            <td>{calc.battleResult.playerA.lifeGained}</td>
            <td
              >{calc.battleResult.playerA.battleDamage +
                calc.battleResult.playerA.effectDamage +
                calc.battleResult.playerA.redirectedDamage +
                calc.battleResult.playerA.redirectedEffectDamage -
                calc.battleResult.playerA.lifeGained}</td>
          </tr>
          <tr data-testid="damagecalc-result-b">
            <td>Player B</td>
            <td data-testid="damagecalc-b-battle">{calc.battleResult.playerB.battleDamage}</td>
            <td>{calc.battleResult.playerB.effectDamage}</td>
            <td>{calc.battleResult.playerB.redirectedDamage}</td>
            <td>{calc.battleResult.playerB.redirectedEffectDamage}</td>
            <td>{calc.battleResult.playerB.lifeGained}</td>
            <td
              >{calc.battleResult.playerB.battleDamage +
                calc.battleResult.playerB.effectDamage +
                calc.battleResult.playerB.redirectedDamage +
                calc.battleResult.playerB.redirectedEffectDamage -
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
                calc.battleResult.playerA.effectDamage +
                calc.battleResult.playerA.redirectedDamage +
                calc.battleResult.playerA.redirectedEffectDamage -
                calc.battleResult.playerA.lifeGained}</td>
            <td
              >{calc.battleResult.playerB.battleDamage +
                calc.battleResult.playerB.effectDamage +
                calc.battleResult.playerB.redirectedDamage +
                calc.battleResult.playerB.redirectedEffectDamage -
                calc.battleResult.playerB.lifeGained}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <button type="button" class="btn btn-sm preset-filled" data-testid="damagecalc-share" onclick={() => copy(window.location.href)}>
      <ShareIcon class="size-[24px]" /> Share battle results
    </button>
  </div>

  <div class="card col-span-2">
    <label class="flex items-center space-x-2">
      <input type="checkbox" class="checkbox" data-testid="damagecalc-show-examples" bind:checked={showExamples} />
      <p class="italic">Show card examples</p>
    </label>
  </div>

  <div id="attacking" class="card" data-testid="damagecalc-attacking">
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
  <div id="defending" class="card" data-testid="damagecalc-defending">
    <h4 class="h4">Player B: Defending Monster</h4>
    <Monster bind:monster={calc.defendingMonster} defending />

    <details bind:open>
      <summary class="text-lg font-bold">Modifiers</summary>
      <BattleModifiers bind:modifiers={calc.playerBModifiers} bind:showExamples />
    </details>
  </div>
</div>
