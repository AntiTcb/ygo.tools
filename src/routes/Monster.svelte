<script lang="ts">
    import { type MonsterProps } from '$lib/damageCalc.svelte';

    let { monster = $bindable<MonsterProps>(), defending = false }: { monster: MonsterProps; defending?: boolean } = $props();

    const setPosition = () => {
        monster.position = monster.position === 'DEF' ? 'ATK' : 'DEF';
    };
</script>

<article class="space-y-2">
    <div class="grid grid-cols-[auto] justify-start gap-2 sm:grid-cols-[auto_auto]">
        <label class="label" for="atk">
            <span class="label-text">ATK</span>
            <input class="input inline w-32 text-sm" type="number" id="atk" bind:value={monster.atk} />
        </label>

        <label class="label" for="atk">
            <span class="label-text">DEF</span>
            <input class="input inline w-32 text-sm" type="number" id="atk" bind:value={monster.def} />
        </label>

        <p>
            Use <button type="button" class="chip preset-filled" onclick={setPosition}>{monster.position}</button>
            for damage calculation
        </p>

        {#if !defending}
            <label class="flex items-center space-x-2">
                <input class="checkbox" type="checkbox" bind:checked={monster.hasPiercing} />
                <p>Inflicts piercing damage</p>
            </label>
        {/if}
    </div>
    <div class="flex gap-2"></div>
</article>
