<script lang="ts">
  import { BattleModifiers } from '$lib/damageCalc.svelte';

  let { modifiers = $bindable<BattleModifiers>(), showExamples = $bindable<boolean>(false) }: { modifiers: BattleModifiers; showExamples: boolean } =
    $props();

  const setEffectDamageInflictType = () =>
    (modifiers.convertedToEffectDamageInflictType =
      modifiers.convertedToEffectDamageInflictType === 'deal'
        ? 'take'
        : modifiers.convertedToEffectDamageInflictType === 'take'
          ? 'deal/take'
          : 'deal');
  const setZeroDamageInflictType = () =>
    (modifiers.battleDamageBecomesZeroInflictType =
      modifiers.battleDamageBecomesZeroInflictType === 'deal'
        ? 'take'
        : modifiers.battleDamageBecomesZeroInflictType === 'take'
          ? 'deal/take'
          : 'deal');
  const setHalvedDamageInflictType = () =>
    (modifiers.battleDamageIsHalvedInflictType =
      modifiers.battleDamageIsHalvedInflictType === 'deal' ? 'take' : modifiers.battleDamageIsHalvedInflictType === 'take' ? 'deal/take' : 'deal');
  const setDoubledDamageInflictType = () =>
    (modifiers.battleDamageIsDoubledInflictType =
      modifiers.battleDamageIsDoubledInflictType === 'deal' ? 'take' : modifiers.battleDamageIsDoubledInflictType === 'take' ? 'deal/take' : 'deal');
  const setSpecificDamageInflictType = () =>
    (modifiers.specificValueInflictType =
      modifiers.specificValueInflictType === 'deal' ? 'take' : modifiers.specificValueInflictType === 'take' ? 'deal/take' : 'deal');
  const setPreventedDamageType = () => {};
  modifiers.preventedDamageType =
    modifiers.preventedDamageType === 'battle' ? 'effect' : modifiers.preventedDamageType === 'effect' ? 'any' : 'battle';
</script>

<ul class="divide-y-2">
  <li>
    <label class="flex items-center space-x-2">
      <input class="checkbox" type="checkbox" bind:checked={modifiers.inflictsDoubleBattleDamage} />
      <p>(01): This card inflicts double battle damage</p>
    </label>
    {@render cardExamples([
      {
        id: 12487,
        name: 'Blue-Eyes Chaos MAX Dragon',
      },
      {
        id: 20217,
        name: 'Silvera, Wolf Tamer of the White Forest',
      },
    ])}
  </li>
  <li>
    <label class="flex items-center space-x-2">
      <input class="checkbox" type="checkbox" bind:checked={modifiers.battleDamageIsTakenByBothPlayers} />
      <p>(02): Battle damage is taken by both players</p>
    </label>
    {@render cardExamples([
      {
        id: 14877,
        name: 'Double-Edged Sword',
      },
    ])}
  </li>
  <li>
    <label class="flex items-center space-x-2">
      <input class="checkbox" type="checkbox" bind:checked={modifiers.yourOpponentTakesYourBattleDamage} />
      <p>(03): Your opponent takes any battle damage you would take instead</p>
    </label>
    {@render cardExamples([
      {
        id: 18017,
        name: 'Ohime the Manifested Mikanko',
      },
      {
        id: 5284,
        name: 'Amazoness Swords Woman',
      },
      {
        id: 19509,
        name: 'Nightmare Pain',
      },
    ])}
  </li>
  <li>
    <label class="flex items-center space-x-2">
      <input class="checkbox" type="checkbox" bind:checked={modifiers.battleDamageIsAlsoInflictedToYourOpponent} />
      <p title="This is applied after the previous rule despite having the same ordering number">
        (03): <span class="underline decoration-dashed">Battle damage you take is also inflicted to your opponent</span>
      </p>
    </label>
    {#if showExamples}
      {@render cardExamples([
        {
          id: 12862,
          name: 'Lyrilusc - Recital Starling',
        },
        {
          id: 16645,
          name: 'Majesty Hyperion',
        },
      ])}
    {/if}
  </li>
  <li>
    <label class="flex items-center space-x-2">
      <input class="checkbox" type="checkbox" bind:checked={modifiers.battleDamageIsConvertedToEffectDamage} />
      <p>
        (04): Battle damage you <button type="button" class="chip preset-filled px-1" onclick={setEffectDamageInflictType}
          >{modifiers.convertedToEffectDamageInflictType}</button> is treated as effect damage
      </p>
    </label>
    {@render cardExamples([
      {
        id: 5513,
        name: "Gravekeeper's Vassal",
      },
    ])}
  </li>
  <li>
    <label class="flex items-center space-x-2">
      <input class="checkbox" type="checkbox" bind:checked={modifiers.damageIsConvertedToHealing} />
      <p>(05): You gain Life Points instead of taking battle damage</p>
    </label>
    {@render cardExamples([
      {
        id: 7463,
        name: 'Rainbow Life',
      },
      {
        id: 14341,
        name: 'Performapal Kuribohble',
      },
    ])}
  </li>
  <li>
    <label class="flex items-center space-x-2">
      <input class="checkbox" type="checkbox" bind:checked={modifiers.battleDamageBecomesZero} />
      <p>
        (06): Battle damage you <button type="button" class="chip preset-filled px-1" onclick={setZeroDamageInflictType}
          >{modifiers.battleDamageBecomesZeroInflictType}</button> becomes 0
      </p>
    </label>
    {@render cardExamples([
      {
        id: 5295,
        name: 'Amazoness Fighter',
      },
      {
        id: 7409,
        name: 'Yubel',
      },
      {
        id: 19857,
        name: 'Tenpai Dragon Paidra',
      },
    ])}
  </li>
  <li>
    <label class="flex items-center space-x-2">
      <input class="checkbox" type="checkbox" bind:checked={modifiers.battleDamageIsHalved} />
      <p>
        (07): Battle damage you <button type="button" class="chip preset-filled px-1" onclick={setHalvedDamageInflictType}
          >{modifiers.battleDamageIsHalvedInflictType}</button> is halved
      </p>
    </label>
    {@render cardExamples([
      {
        id: 15756,
        name: 'Pot of Prosperity',
      },
      {
        id: 14738,
        name: 'Smoke Mosquito',
      },
    ])}
  </li>
  <li>
    <label class="flex items-center space-x-2">
      <input class="checkbox" type="checkbox" bind:checked={modifiers.battleDamageIsDoubled} />
      <p>
        (08): Battle damage you <button type="button" class="chip preset-filled px-1" onclick={setDoubledDamageInflictType}
          >{modifiers.battleDamageIsDoubledInflictType}</button> is doubled
      </p>
    </label>
    {@render cardExamples([
      {
        id: 4754,
        name: 'Stone Statue of the Aztecs',
      },
      {
        id: 17746,
        name: 'Garura, Wings of Resonant Life',
      },
      {
        id: 11213,
        name: 'Odd-Eyes Pendulum Dragon',
      },
    ])}
  </li>
  <li>
    <label class="flex items-center space-x-2">
      <input class="checkbox" type="checkbox" bind:checked={modifiers.battleDamageBecomesSpecificValue} />
      <p>
        (09): Battle damage you <button type="button" class="chip preset-filled px-1" onclick={setSpecificDamageInflictType}
          >{modifiers.specificValueInflictType}</button> becomes
      </p>
      <input class="input inline! w-20 text-sm!" type="number" min="0" bind:value={modifiers.specificValue} />
    </label>
    {@render cardExamples([
      {
        id: 13280,
        name: "Temple of the Mind's Eye",
      },
      {
        id: 18539,
        name: 'Dinomorphia Intact',
      },
    ])}
  </li>
  <li>
    <label class="flex flex-row flex-wrap items-center space-x-2 lg:flex-nowrap">
      <input class="checkbox" type="checkbox" bind:checked={modifiers.damageYouTakeIsPreventedIf} />
      <p>
        (10): You do not take <button type="button" class="chip preset-filled px-1" onclick={setPreventedDamageType}
          >{modifiers.preventedDamageType}</button> damage if it is:
      </p>
      <div class="flex gap-2 py-2 md:py-0">
        <select class="select w-24 text-sm" bind:value={modifiers.damagePreventionComparison}>
          <option value="<">&lt;</option>
          <option value="<=">&leq;</option>
          <option value=">">&gt;</option>
          <option value=">=">&geq;</option>
        </select>
        <input class="input w-20! text-sm!" type="number" bind:value={modifiers.damagePreventionValue} />
      </div>
    </label>
    {@render cardExamples([
      {
        id: 11837,
        name: 'Performage Trapeze Magician',
      },
    ])}
  </li>
</ul>

{#snippet cardExamples(cards: { name: string; id: number }[])}
  {#if showExamples}
    <div class="flex flex-wrap gap-1 pt-1 text-xs italic">
      Examples:
      {#each cards.sort((a, b) => a.name.localeCompare(b.name)) as { name, id } (id)}
        <a href="https://www.db.yugioh-card.com/yugiohdb/card_search.action?ope=2&cid={id}" target="_blank" class="chip preset-filled">{name}</a>
      {/each}
    </div>
  {/if}
{/snippet}

<style lang="postcss">
  @reference '../../app.css'

  li {
    @apply py-2;
  }
</style>
