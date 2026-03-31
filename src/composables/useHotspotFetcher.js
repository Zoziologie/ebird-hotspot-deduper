import { ref } from 'vue'

export function useHotspotFetcher({ ebirdGet, apiToken, selectedRegionCode }) {
  const hotspots = ref([])
  const isLoading = ref(false)
  const fetchError = ref('')
  const hasFetchAttempted = ref(false)

  async function fetchHotspots() {
    if (!apiToken.value.trim() || !selectedRegionCode.value.trim()) {
      return
    }

    hasFetchAttempted.value = true
    isLoading.value = true
    fetchError.value = ''

    try {
      const regionCode = selectedRegionCode.value.trim()
      const payload = await ebirdGet(`/ref/hotspot/${encodeURIComponent(regionCode)}?fmt=json`)
      hotspots.value = (payload || [])
        .map((item, index) => normalizeHotspot(item, index))
        .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng))
    } catch (error) {
      hotspots.value = []
      fetchError.value = error instanceof Error ? error.message : 'Failed to fetch hotspots.'
    } finally {
      isLoading.value = false
    }
  }

  function reset() {
    hotspots.value = []
    hasFetchAttempted.value = false
  }

  function clearFetchError() {
    fetchError.value = ''
  }

  function setFetchError(message) {
    fetchError.value = message || ''
  }

  return {
    hotspots,
    isLoading,
    fetchError,
    hasFetchAttempted,
    fetchHotspots,
    reset,
    clearFetchError,
    setFetchError,
  }
}

function normalizeHotspot(raw, index) {
  return {
    locId: raw.locId || `unknown-${index}`,
    locName: raw.locName || 'Unnamed hotspot',
    lat: Number(raw.lat),
    lng: Number(raw.lng),
    checklistCount:
      numberOrNull(raw.numChecklistAllTime) ??
      numberOrNull(raw.numChecklists) ??
      numberOrNull(raw.numChecklistsAllTime),
    speciesCount: numberOrNull(raw.numSpeciesAllTime) ?? numberOrNull(raw.speciesCount),
  }
}

function numberOrNull(value) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}
