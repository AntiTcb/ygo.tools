<script lang="ts">
  import Seo from 'sk-seo';
  import CalculatorIcon from 'virtual:icons/mdi/calculator';
  import DatabaseIcon from '~icons/mdi/database-search';
</script>

<Seo
  title="YGO Tools"
  description="A collection of tools for Yu-Gi-Oh! players to become the greatest duelists"
  keywords="yugioh, ygo, tools, Yu-Gi-Oh!"
  author="AntiTcb" />

<div class="h-full">
  <div class="flex gap-2">
    <a
      href="/damagecalc"
      class="card card-hover block max-w-md divide-y overflow-hidden border border-surface-200-800 divide-surface-200-800 preset-filled-surface-100-900">
      <article class="space-y-2 p-4">
        <h5 class="h5 flex flex-shrink-0 flex-nowrap justify-between">
          Damage Calculation Calculator
          <CalculatorIcon class="inline size-[32px] min-w-[28px] hue-rotate-90" />
        </h5>
        <p class="opacity-70">A calculator for the various effects that modify how battle damage is applied to players during Damage Calculation.</p>
      </article>
    </a>
    <a
      href="/database"
      class="card card-hover block max-w-md divide-y overflow-hidden border border-surface-200-800 divide-surface-200-800 preset-filled-surface-100-900">
      <article class="space-y-2 p-4">
        <h5 class="h5 flex flex-shrink-0 flex-nowrap justify-between">
          Card Database
          <DatabaseIcon class="inline size-[32px] min-w-[28px] hue-rotate-90" />
        </h5>
        <p class="opacity-70">A card database with advanced search capabilities.</p>
      </article>
    </a>
  </div>
</div>
