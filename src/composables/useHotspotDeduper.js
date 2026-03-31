import { computed, ref, watch } from 'vue'

const METERS_PER_LAT_DEG = 111320
const HARD_MAX_DISTANCE_METERS = 1000

export function useHotspotDeduper({ ebirdGet, apiToken, selectedRegionCode, thresholdStorageKey }) {
  const hotspots = ref([])
  const isLoading = ref(false)
  const fetchError = ref('')
  const selectedPairId = ref(null)
  const thresholdMeters = ref(clampThreshold(localStorage.getItem(thresholdStorageKey) || 10))

  const thresholdMetersValue = computed(() => clampThreshold(thresholdMeters.value))

  const approximateCandidates = computed(() => {
    if (hotspots.value.length < 2) {
      return []
    }

    const sortedIndices = hotspots.value
      .map((_, index) => index)
      .sort((left, right) => hotspots.value[left].lat - hotspots.value[right].lat)

    const candidatePairs = []

    for (let leftPos = 0; leftPos < sortedIndices.length - 1; leftPos += 1) {
      const leftIndex = sortedIndices[leftPos]
      const left = hotspots.value[leftIndex]

      for (let rightPos = leftPos + 1; rightPos < sortedIndices.length; rightPos += 1) {
        const rightIndex = sortedIndices[rightPos]
        const right = hotspots.value[rightIndex]

        const latDiffMeters = (right.lat - left.lat) * METERS_PER_LAT_DEG
        if (latDiffMeters > HARD_MAX_DISTANCE_METERS) {
          break
        }

        const midLatRad = ((left.lat + right.lat) / 2) * (Math.PI / 180)
        const metersPerLon = Math.max(1, METERS_PER_LAT_DEG * Math.cos(midLatRad))
        const lonDiffMeters = Math.abs(right.lng - left.lng) * metersPerLon
        if (lonDiffMeters > HARD_MAX_DISTANCE_METERS) {
          continue
        }

        const approxDistance = Math.sqrt(latDiffMeters ** 2 + lonDiffMeters ** 2)
        if (approxDistance > HARD_MAX_DISTANCE_METERS) {
          continue
        }

        candidatePairs.push(leftIndex, rightIndex)
      }
    }

    return candidatePairs
  })

  const exactCandidatePairs = computed(() => {
    const pairsWithinHardLimit = []
    const candidates = approximateCandidates.value

    for (let index = 0; index < candidates.length; index += 2) {
      const hotspotAIndex = candidates[index]
      const hotspotBIndex = candidates[index + 1]
      const hotspotA = hotspots.value[hotspotAIndex]
      const hotspotB = hotspots.value[hotspotBIndex]
      const distanceMeters = haversineDistanceMeters(hotspotA.lat, hotspotA.lng, hotspotB.lat, hotspotB.lng)

      if (distanceMeters <= HARD_MAX_DISTANCE_METERS) {
        pairsWithinHardLimit.push({
          hotspotAIndex,
          hotspotBIndex,
          distanceMeters,
        })
      }
    }

    pairsWithinHardLimit.sort((left, right) => left.distanceMeters - right.distanceMeters)
    return pairsWithinHardLimit
  })

  const pairs = computed(() => {
    if (hotspots.value.length < 2) {
      return []
    }

    const threshold = thresholdMetersValue.value
    const results = []

    for (const pair of exactCandidatePairs.value) {
      if (pair.distanceMeters > threshold) {
        break
      }

      const baseHotspotA = hotspots.value[pair.hotspotAIndex]
      const baseHotspotB = hotspots.value[pair.hotspotBIndex]
      const [hotspotA, hotspotB] = orderHotspotsByChecklist(baseHotspotA, baseHotspotB)
      results.push({
        id: pairId(hotspotA.locId, hotspotB.locId),
        hotspotA,
        hotspotB,
        distanceMeters: pair.distanceMeters,
        isExactDuplicate: Math.abs(hotspotA.lat - hotspotB.lat) < 1e-9 && Math.abs(hotspotA.lng - hotspotB.lng) < 1e-9,
      })
    }

    return results
  })

  const filteredPairs = computed(() => pairs.value)
  const selectedPair = computed(() => filteredPairs.value.find((pair) => pair.id === selectedPairId.value) || null)

  watch(
    thresholdMeters,
    (value) => {
      const clamped = clampThreshold(value)
      if (Number(value) !== clamped) {
        thresholdMeters.value = clamped
        return
      }
      localStorage.setItem(thresholdStorageKey, String(clamped))
    },
  )

  watch(
    filteredPairs,
    (items) => {
      if (!items.length) {
        selectedPairId.value = null
        return
      }
      if (!items.some((item) => item.id === selectedPairId.value)) {
        selectedPairId.value = items[0].id
      }
    },
    { immediate: true },
  )

  async function fetchHotspots() {
    if (!apiToken.value.trim() || !selectedRegionCode.value.trim()) {
      return
    }

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
      selectedPairId.value = null
      fetchError.value = error instanceof Error ? error.message : 'Failed to fetch hotspots.'
    } finally {
      isLoading.value = false
    }
  }

  function resetHotspotResults() {
    hotspots.value = []
    selectedPairId.value = null
  }

  function clearFetchError() {
    fetchError.value = ''
  }

  function setThresholdMeters(value) {
    thresholdMeters.value = value
  }

  function selectPair(id) {
    selectedPairId.value = id
  }

  return {
    hotspots,
    isLoading,
    fetchError,
    selectedPairId,
    selectedPair,
    filteredPairs,
    thresholdMeters,
    thresholdMetersValue,
    fetchHotspots,
    resetHotspotResults,
    clearFetchError,
    setThresholdMeters,
    selectPair,
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

function clampThreshold(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return 10
  }
  return Math.min(HARD_MAX_DISTANCE_METERS, Math.max(0, parsed))
}

function pairId(a, b) {
  return a < b ? `${a}__${b}` : `${b}__${a}`
}

function orderHotspotsByChecklist(leftCandidate, rightCandidate) {
  const leftChecklist = Number.isFinite(leftCandidate.checklistCount) ? leftCandidate.checklistCount : -1
  const rightChecklist = Number.isFinite(rightCandidate.checklistCount) ? rightCandidate.checklistCount : -1

  if (rightChecklist > leftChecklist) {
    return [rightCandidate, leftCandidate]
  }

  if (rightChecklist === leftChecklist && rightCandidate.locName.localeCompare(leftCandidate.locName) < 0) {
    return [rightCandidate, leftCandidate]
  }

  return [leftCandidate, rightCandidate]
}

function haversineDistanceMeters(lat1, lng1, lat2, lng2) {
  const radius = 6371000
  const toRad = Math.PI / 180
  const dLat = (lat2 - lat1) * toRad
  const dLng = (lng2 - lng1) * toRad
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) ** 2
  return 2 * radius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
