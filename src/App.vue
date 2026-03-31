<script setup>
import { nextTick, ref, watch } from 'vue'
import AppFooter from './components/AppFooter.vue'
import MapPane from './components/MapPane.vue'
import RegionPickerPanel from './components/RegionPickerPanel.vue'
import ResultsPanel from './components/ResultsPanel.vue'
import TokenModal from './components/TokenModal.vue'
import { useEbirdApi } from './composables/useEbirdApi'
import { useHotspotFetcher } from './composables/useHotspotFetcher'
import { useListFilters } from './composables/useListFilters'
import { usePairEngine } from './composables/usePairEngine'

const STORAGE_KEYS = {
  ebirdApiKey: 'deduper-ebird-api-key',
  thresholdMeters: 'deduper-threshold-meters',
  nameSimilarityThreshold: 'deduper-name-similarity-threshold',
  sortBy: 'deduper-sort-by',
  mapStyle: 'deduper-map-style',
}

const appVersion = __APP_VERSION__

const showTokenModal = ref(!localStorage.getItem(STORAGE_KEYS.ebirdApiKey))
const apiToken = ref(localStorage.getItem(STORAGE_KEYS.ebirdApiKey) || '')
const tokenDraft = ref(apiToken.value)
const tokenError = ref('')
const selectedRegionCode = ref('')

const { ebirdGet } = useEbirdApi({ apiToken })

const hotspotFetcher = useHotspotFetcher({
  ebirdGet,
  apiToken,
  selectedRegionCode,
})

const filters = useListFilters({
  thresholdStorageKey: STORAGE_KEYS.thresholdMeters,
  nameThresholdStorageKey: STORAGE_KEYS.nameSimilarityThreshold,
  sortByStorageKey: STORAGE_KEYS.sortBy,
})

const pairEngine = usePairEngine({
  hotspots: hotspotFetcher.hotspots,
  thresholdMeters: filters.thresholdMetersValue,
  nameSimilarityThreshold: filters.nameSimilarityThresholdValue,
  sortBy: filters.sortBy,
})

watch(
  selectedRegionCode,
  () => {
    hotspotFetcher.reset()
    hotspotFetcher.clearFetchError()
    pairEngine.clearSelection()
  },
)

function saveToken() {
  const trimmed = tokenDraft.value.trim()
  if (!trimmed) {
    tokenError.value = 'Token required.'
    return
  }

  apiToken.value = trimmed
  localStorage.setItem(STORAGE_KEYS.ebirdApiKey, trimmed)
  showTokenModal.value = false
  tokenError.value = ''
}

function openTokenModal() {
  tokenDraft.value = apiToken.value
  tokenError.value = ''
  showTokenModal.value = true
}

function selectPair(id) {
  pairEngine.selectPair(id)
}

function updateSelectedRegionCode(code) {
  selectedRegionCode.value = String(code || '')
}

async function fetchHotspotsAndSelectFirstPair() {
  await hotspotFetcher.fetchHotspots()
  await nextTick()

  const firstVisiblePair = pairEngine.visiblePairs.value[0]
  if (firstVisiblePair) {
    pairEngine.selectPair(firstVisiblePair.id)
  } else {
    pairEngine.clearSelection()
  }
}
</script>

<template>
  <div class="app-shell">
    <main class="content-split">
      <aside class="control-pane">
        <RegionPickerPanel
          :api-token="apiToken"
          :ebird-get="ebirdGet"
          :is-loading="hotspotFetcher.isLoading.value"
          :fetch-error="hotspotFetcher.fetchError.value"
          @update:region-code="updateSelectedRegionCode"
          @fetch-hotspots="fetchHotspotsAndSelectFirstPair"
        />

        <MapPane
          :show-loading-overlay="hotspotFetcher.isLoading.value"
          :hotspots="hotspotFetcher.hotspots.value"
          :selected-pair="pairEngine.selectedPair.value"
          :map-style-storage-key="STORAGE_KEYS.mapStyle"
        />
      </aside>

      <aside class="list-pane">
        <ResultsPanel
          :visible-pair-count="pairEngine.visiblePairs.value.length"
          :total-pair-count="pairEngine.allPairs.value.length"
          :has-fetch-attempted="hotspotFetcher.hasFetchAttempted.value"
          :is-loading="hotspotFetcher.isLoading.value"
          :threshold-meters="filters.thresholdMetersValue.value"
          :name-similarity-percent="filters.nameSimilarityPercent.value"
          :sort-by="filters.sortBy.value"
          :pairs="pairEngine.visiblePairs.value"
          :selected-pair-id="pairEngine.selectedPairId.value"
          @update:threshold-meters="filters.setThresholdMeters($event)"
          @update:name-similarity-threshold="filters.setNameSimilarityPercent($event)"
          @update:sort-by="filters.setSortBy($event)"
          @select-pair="selectPair"
        />
      </aside>
    </main>

    <AppFooter :app-version="appVersion" @open-token-modal="openTokenModal" />

    <TokenModal
      :show="showTokenModal"
      :token-draft="tokenDraft"
      :token-error="tokenError"
      @update:token-draft="tokenDraft = $event"
      @save-token="saveToken"
      @close="showTokenModal = false"
    />
  </div>
</template>

<style scoped>
:global(:root) {
  --brand-primary: #169b89;
  --brand-primary-rgb: 22, 155, 137;
  --brand-primary-dark: #0f7669;
  --brand-accent: #ff7a59;
  --brand-accent-rgb: 255, 122, 89;
  --brand-ink: #173042;
  --brand-muted: #5f7382;
  --brand-surface: #f6fbfb;
  --brand-surface-soft: #eaf5f6;
  --brand-border: #c5d8df;
  --brand-card: #ffffff;

  --bs-primary: var(--brand-primary);
  --bs-primary-rgb: var(--brand-primary-rgb);
  --bs-link-color: #0f7669;
  --bs-link-hover-color: #0b5f54;
}

:global(html, body, #app) {
  height: 100%;
  overflow: hidden;
}

:global(body) {
  margin: 0;
  font-family: 'Avenir Next', 'Nunito Sans', 'Source Sans 3', 'Segoe UI', sans-serif;
  color: var(--brand-ink);
  text-rendering: geometricPrecision;
}

:global(.btn-primary) {
  --bs-btn-bg: var(--brand-primary);
  --bs-btn-border-color: var(--brand-primary);
  --bs-btn-hover-bg: var(--brand-primary-dark);
  --bs-btn-hover-border-color: var(--brand-primary-dark);
  --bs-btn-active-bg: var(--brand-primary-dark);
  --bs-btn-active-border-color: var(--brand-primary-dark);
  --bs-btn-disabled-bg: rgba(var(--brand-primary-rgb), 0.5);
  --bs-btn-disabled-border-color: rgba(var(--brand-primary-rgb), 0.5);
  --bs-btn-focus-shadow-rgb: var(--brand-primary-rgb);
}

:global(.form-control:focus),
:global(.form-select:focus),
:global(.btn:focus-visible) {
  border-color: rgba(var(--brand-primary-rgb), 0.55);
  box-shadow: 0 0 0 0.24rem rgba(var(--brand-primary-rgb), 0.2);
}

.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background:
    radial-gradient(circle at 8% 10%, rgba(22, 155, 137, 0.2) 0%, transparent 34%),
    radial-gradient(circle at 90% 18%, rgba(var(--brand-accent-rgb), 0.2) 0%, transparent 28%),
    radial-gradient(circle at 100% 100%, rgba(56, 189, 248, 0.16) 0%, transparent 26%),
    linear-gradient(180deg, #f6fbfd 0%, #eef6f9 100%);
  color: var(--brand-ink);
}

.content-split {
  flex: 1;
  min-height: 0;
  position: relative;
  display: grid;
  grid-template-columns: minmax(340px, 42%) 1fr;
}

.control-pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-right: 1px solid var(--brand-border);
  background: color-mix(in srgb, var(--brand-surface) 86%, white 14%);
  backdrop-filter: blur(4px);
}

.control-pane :deep(.map-pane) {
  flex: 1 1 auto;
  min-height: 230px;
  border-left: none;
  background: color-mix(in srgb, var(--brand-surface-soft) 50%, #ffffff 50%);
}

.list-pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: color-mix(in srgb, var(--brand-surface) 84%, white 16%);
}

.list-pane :deep(.list-pane-body) {
  flex: 1 1 auto;
  min-height: 0;
}

@media (max-width: 920px) {
  .content-split {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }

  .control-pane {
    border-right: none;
    border-bottom: 1px solid var(--brand-border);
  }

  .control-pane :deep(.map-pane) {
    min-height: 180px;
    flex: 1 1 auto;
  }
}
</style>
