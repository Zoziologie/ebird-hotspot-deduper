<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import AppFooter from './components/AppFooter.vue'
import DuplicatePairsList from './components/DuplicatePairsList.vue'
import MapPane from './components/MapPane.vue'
import RegionPickerPanel from './components/RegionPickerPanel.vue'
import TokenModal from './components/TokenModal.vue'
import { useEbirdApi } from './composables/useEbirdApi'
import { useHotspotDeduper } from './composables/useHotspotDeduper'
import { useLeafletMap } from './composables/useLeafletMap'
import { useRegionPicker } from './composables/useRegionPicker'

const STORAGE_KEYS = {
  ebirdApiKey: 'deduper-ebird-api-key',
  thresholdMeters: 'deduper-threshold-meters',
  mapStyle: 'deduper-map-style',
}

const appVersion = __APP_VERSION__

const showTokenModal = ref(!localStorage.getItem(STORAGE_KEYS.ebirdApiKey))
const apiToken = ref(localStorage.getItem(STORAGE_KEYS.ebirdApiKey) || '')
const tokenDraft = ref(apiToken.value)
const tokenError = ref('')

const { ebirdGet } = useEbirdApi({ apiToken })

let hotspotDeduper = null
const regionPicker = useRegionPicker({
  apiToken,
  ebirdGet,
  onRegionStateChange: () => {
    if (hotspotDeduper) {
      hotspotDeduper.resetHotspotResults()
    }
  },
  clearErrorMessage: () => {
    if (hotspotDeduper) {
      hotspotDeduper.clearFetchError()
    }
  },
  setErrorMessage: (message) => {
    if (hotspotDeduper) {
      hotspotDeduper.fetchError.value = message
    }
  },
})

hotspotDeduper = useHotspotDeduper({
  ebirdGet,
  apiToken,
  selectedRegionCode: regionPicker.selectedRegionCode,
  thresholdStorageKey: STORAGE_KEYS.thresholdMeters,
})

const canFetch = computed(() => Boolean(apiToken.value.trim() && regionPicker.selectedRegionCode.value))
const canClearSelection = computed(() => regionPicker.hasAnyRegionInput.value || Boolean(regionPicker.selectedRegionCode.value))
const showLoadingOverlay = computed(() => hotspotDeduper.isLoading.value)

const { mapContainer, initMap, destroyMap, fitMapToCurrentSelection } = useLeafletMap({
  filteredPairs: hotspotDeduper.filteredPairs,
  selectedPair: hotspotDeduper.selectedPair,
  mapStyleStorageKey: STORAGE_KEYS.mapStyle,
})

onMounted(async () => {
  initMap()
  if (apiToken.value.trim()) {
    await regionPicker.initializeRegionPicker()
  }
})

onBeforeUnmount(() => {
  destroyMap()
})

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
  hotspotDeduper.selectPair(id)
  fitMapToCurrentSelection()
}
</script>

<template>
  <div class="app-shell">
    <main class="content-split">
      <aside class="list-pane">
        <RegionPickerPanel
          :token-present="Boolean(apiToken.trim())"
          :country-query="regionPicker.form.countryQuery"
          :subnational1-query="regionPicker.form.subnational1Query"
          :subnational2-query="regionPicker.form.subnational2Query"
          :threshold-meters="hotspotDeduper.thresholdMeters"
          :threshold-meters-value="hotspotDeduper.thresholdMetersValue"
          :country-suggestions="regionPicker.countrySuggestions"
          :subnational1-suggestions="regionPicker.subnational1Suggestions"
          :subnational2-suggestions="regionPicker.subnational2Suggestions"
          :countries-loading="regionPicker.countriesLoading"
          :subnational1-loading="regionPicker.subnational1Loading"
          :subnational2-loading="regionPicker.subnational2Loading"
          :selected-country="regionPicker.selectedCountry"
          :selected-subnational1="regionPicker.selectedSubnational1"
          :can-fetch="canFetch"
          :is-loading="hotspotDeduper.isLoading"
          :has-selected-region="Boolean(regionPicker.selectedRegionCode)"
          :selected-region-name="regionPicker.selectedRegionName"
          :selected-region-code="regionPicker.selectedRegionCode"
          :can-clear-selection="canClearSelection"
          :region-lookup-busy="regionPicker.regionLookupBusy"
          :fetch-error="hotspotDeduper.fetchError"
          :has-hotspots="Boolean(hotspotDeduper.hotspots.length)"
          @update:country-query="regionPicker.form.countryQuery = $event"
          @update:subnational1-query="regionPicker.form.subnational1Query = $event"
          @update:subnational2-query="regionPicker.form.subnational2Query = $event"
          @update:threshold-meters="hotspotDeduper.setThresholdMeters($event)"
          @country-query-input="regionPicker.countryQueryInput"
          @subnational1-query-input="regionPicker.subnational1QueryInput"
          @subnational2-query-input="regionPicker.subnational2QueryInput"
          @country-query-blur="regionPicker.clearCountrySuggestions"
          @subnational1-query-blur="regionPicker.clearSubnational1Suggestions"
          @subnational2-query-blur="regionPicker.clearSubnational2Suggestions"
          @select-country="regionPicker.selectCountry"
          @select-subnational1="regionPicker.selectSubnational1"
          @select-subnational2="regionPicker.selectSubnational2"
          @fetch-hotspots="hotspotDeduper.fetchHotspots"
          @clear-selection="regionPicker.clearSelectedRegion"
        />

        <DuplicatePairsList
          :pairs="hotspotDeduper.filteredPairs"
          :selected-pair-id="hotspotDeduper.selectedPairId"
          @select-pair="selectPair"
        />
      </aside>

      <MapPane :show-loading-overlay="showLoadingOverlay" :map-container-ref="mapContainer" />
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
:global(html, body, #app) {
  height: 100%;
  overflow: hidden;
}

:global(body) {
  margin: 0;
}

.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: radial-gradient(circle at 2% 5%, #d7ebff 0%, transparent 34%),
    radial-gradient(circle at 100% 100%, #d6f5ec 0%, transparent 26%),
    linear-gradient(180deg, #f6f9ff 0%, #eef4fb 100%);
  color: #1e293b;
}

.content-split {
  flex: 1;
  min-height: 0;
  position: relative;
  display: grid;
  grid-template-columns: minmax(340px, 42%) 1fr;
}

.list-pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-right: 1px solid #d2deeb;
  background: #f5f9ff;
}

@media (max-width: 920px) {
  .content-split {
    grid-template-columns: 1fr;
    grid-template-rows: 48vh 52vh;
  }

  .list-pane {
    border-right: none;
    border-bottom: 1px solid #dbe2ea;
  }
}
</style>
