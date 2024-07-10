<script lang="ts">
    import { createDamageCalculator } from '$lib/damageCalc.svelte';
    import BattleModifiers from './BattleModifiers.svelte';
    import Monster from './Monster.svelte';

    const calc = createDamageCalculator();
    $inspect({ calc });

    let open = $state<boolean>(true);
</script>

<div class="flex flex-col gap-4 lg:grid lg:grid-cols-2">
    <div id="result" class="card col-span-2">
        <header class="h3">Battle Result:</header>
        <article class="grid grid-cols-[auto_auto] justify-start gap-4">
            <section>
                <h4 class="h4">Player A</h4>
                {@render battleResult(calc.battleResult.attackingPlayer)}
            </section>
            <section>
                <h4 class="h4">Player B</h4>
                {@render battleResult(calc.battleResult.defendingPlayer)}
            </section>
        </article>
    </div>
    <div id="attacking" class="card">
        <h4 class="h4">Player A: Attacking Monster</h4>
        <Monster bind:monster={calc.attackingMonster} />

        <details bind:open>
            <summary class="text-xl font-bold">Modifiers</summary>
            <BattleModifiers bind:modifiers={calc.battleModifiers.playerA} />
        </details>
    </div>
    <div id="defending" class="card">
        <h4 class="h4">Player B: Defending Monster</h4>
        <Monster bind:monster={calc.defendingMonster} defending />

        <details bind:open>
            <summary class="text-xl font-bold">Modifiers</summary>
            <BattleModifiers bind:modifiers={calc.battleModifiers.playerB} />
        </details>
    </div>
</div>

{#snippet battleResult({ battleDamage, effectDamage, redirectedDamage }: { battleDamage: number; effectDamage: number; redirectedDamage: number })}
    <ul>
        {#if battleDamage < 0}
            <li class="text-green-600">Life Gained: {Math.abs(battleDamage)}</li>
        {:else}
            <li>Battle Damage: {battleDamage}</li>
        {/if}
        {#if redirectedDamage}
            <li>Redirected Damage: {redirectedDamage}</li>
        {/if}
        {#if effectDamage}
            <li>Effect Damage: {effectDamage}</li>
        {/if}
    </ul>
{/snippet}

<style lang="postcss">
    .card {
        @apply p-4 preset-filled-surface-100-900;
    }
</style>
