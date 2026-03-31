import { computed, ref } from 'vue'

const HARD_MAX_DISTANCE_METERS = 1000
const DEFAULT_NAME_SIMILARITY_THRESHOLD = 0.5
const DEFAULT_SORT_BY = 'distance'

export function useListFilters({ thresholdStorageKey, nameThresholdStorageKey, sortByStorageKey }) {
  const thresholdMeters = ref(clampThreshold(localStorage.getItem(thresholdStorageKey) || 10))
  const nameSimilarityThreshold = ref(
    clampSimilarityThreshold(localStorage.getItem(nameThresholdStorageKey) || DEFAULT_NAME_SIMILARITY_THRESHOLD),
  )
  const sortBy = ref(readSortBy(sortByStorageKey ? localStorage.getItem(sortByStorageKey) : null))

  const thresholdMetersValue = computed(() => thresholdMeters.value)
  const nameSimilarityThresholdValue = computed(() => nameSimilarityThreshold.value)
  const nameSimilarityPercent = computed(() => Math.round(nameSimilarityThresholdValue.value * 100))

  function setThresholdMeters(value) {
    const clamped = clampThreshold(value)
    thresholdMeters.value = clamped
    if (thresholdStorageKey) {
      localStorage.setItem(thresholdStorageKey, String(clamped))
    }
  }

  function setNameSimilarityThreshold(value) {
    const clamped = clampSimilarityThreshold(value)
    nameSimilarityThreshold.value = clamped
    if (nameThresholdStorageKey) {
      localStorage.setItem(nameThresholdStorageKey, String(clamped))
    }
  }

  function setNameSimilarityPercent(value) {
    const clamped = clampPercent(value) / 100
    setNameSimilarityThreshold(clamped)
  }

  function setSortBy(value) {
    const resolved = readSortBy(value)
    sortBy.value = resolved
    if (sortByStorageKey) {
      localStorage.setItem(sortByStorageKey, resolved)
    }
  }

  return {
    thresholdMeters,
    thresholdMetersValue,
    nameSimilarityThreshold,
    nameSimilarityThresholdValue,
    nameSimilarityPercent,
    sortBy,
    setThresholdMeters,
    setNameSimilarityThreshold,
    setNameSimilarityPercent,
    setSortBy,
  }
}

function clampThreshold(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return 10
  }
  return Math.min(HARD_MAX_DISTANCE_METERS, Math.max(0, parsed))
}

function clampSimilarityThreshold(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return DEFAULT_NAME_SIMILARITY_THRESHOLD
  }
  return Math.min(1, Math.max(0, parsed))
}

function clampPercent(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return 0
  }
  return Math.min(100, Math.max(0, Math.round(parsed)))
}

function readSortBy(value) {
  return value === 'nameSimilarity' ? value : DEFAULT_SORT_BY
}
