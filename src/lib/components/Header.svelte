<script lang="ts">
  import { version } from '$app/environment';
  import SiteLogo from '$lib/assets/logo.png';
  import GitHubIcon from '~icons/mdi/github-box';
</script>

<header class="bg-surface-950 flex h-12 items-center justify-between px-2">
  <a href="/" class="flex items-center gap-4 font-bold">
    <img src={SiteLogo} alt="Site Logo" class="max-h-[32px] max-w-[32px]" />
    YGO Tools v{version}
  </a>
  <a href="https://github.com/AntiTcb/ygo.tools" target="_blank" rel="noopener noreferrer">
    <GitHubIcon class="h-[32px] w-[32px]" />
  </a>
</header>
