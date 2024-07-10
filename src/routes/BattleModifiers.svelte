<script lang="ts">
    import { type BattleModifiers } from '$lib/damageCalc.svelte';

    let { modifiers = $bindable<BattleModifiers>() }: { modifiers: BattleModifiers } = $props();
</script>

<ul class="divide-y-2">
    <li>
        <label class="flex items-center space-x-2">
            <input class="checkbox" type="checkbox" bind:checked={modifiers.inflictsDoubleDamage} />
            <p>(01): This card inflicts double battle damage</p>
        </label>
    </li>
    <li>
        <label class="flex items-center space-x-2">
            <input class="checkbox" type="checkbox" bind:checked={modifiers.damageToBothPlayers} />
            <p>(02): Battle damage is taken by both players</p>
        </label>
    </li>
    <li>
        <label class="flex items-center space-x-2">
            <input class="checkbox" type="checkbox" bind:checked={modifiers.redirectToOpponent} />
            <p>(03): Your opponent takes any battle damage you would take instead</p>
        </label>
    </li>
    <li>
        <label class="flex items-center space-x-2">
            <input class="checkbox" type="checkbox" bind:checked={modifiers.alsoInflictedToOpponent} />
            <p title="This is applied after the previous rule despite having the same ordering number">
                (03): <span class="underline decoration-dashed">Battle damage you take is also inflicted to your opponent</span>
            </p>
        </label>
    </li>
    <li>
        <label class="flex items-center space-x-2">
            <input class="checkbox" type="checkbox" bind:checked={modifiers.convertToEffectDamage} />
            <p>(04): Battle damage is treated as effect damage</p>
        </label>
    </li>
    <li>
        <label class="flex items-center space-x-2">
            <input class="checkbox" type="checkbox" bind:checked={modifiers.convertToHealing} />
            <p>(05): The player gains Life Points instead of taking battle damage</p>
        </label>
    </li>
    <li>
        <label class="flex items-center space-x-2">
            <input class="checkbox" type="checkbox" bind:checked={modifiers.preventDamage} />
            <p>(06): Battle damage becomes 0</p>
        </label>
    </li>
    <li>
        <label class="flex items-center space-x-2">
            <input class="checkbox" type="checkbox" bind:checked={modifiers.halveDamage} />
            <p>(07): Battle damage is halved</p>
        </label>
    </li>
    <li>
        <label class="flex items-center space-x-2">
            <input class="checkbox" type="checkbox" bind:checked={modifiers.doubleDamage} />
            <p>(08): Battle damage is doubled</p>
        </label>
    </li>
    <li>
        <label class="flex items-center space-x-2">
            <input class="checkbox" type="checkbox" bind:checked={modifiers.setToSpecificValue} />
            <p>(09): Battle damage becomes</p>
            <input class="input !inline w-20 !text-sm" type="number" bind:value={modifiers.specificValue} />
        </label>
    </li>
    <li>
        <label class="flex flex-row flex-wrap items-center space-x-2 lg:flex-nowrap">
            <input class="checkbox" type="checkbox" bind:checked={modifiers.preventIfConditionMet} />
            <p>(10): You do not take battle damage if it is:</p>
            <div class="flex gap-2 py-2 md:py-0">
                <select class="select w-24 text-sm">
                    <option value="lt">&lt;</option>
                    <option value="lte">&leq;</option>
                    <option value="gt">&gt;</option>
                    <option value="gte">&geq;</option>
                </select>
                <input class="input !w-20 !text-sm" type="number" />
            </div>
        </label>
    </li>
</ul>

<style lang="postcss">
    li {
        @apply py-2;
    }
</style>
