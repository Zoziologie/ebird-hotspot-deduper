import { computed, ref, watch } from 'vue'
import JaroWinklerDistance from 'natural/lib/natural/distance/jaro-winkler_distance.js'

const METERS_PER_LAT_DEG = 111320
const HARD_MAX_DISTANCE_METERS = 1000
const SCORE_WEIGHTS = {
  jaroWinkler: 0.45,
  tokenJaccard: 0.35,
  distance: 0.2,
}

export function usePairEngine({ hotspots, thresholdMeters, nameSimilarityThreshold, sortBy }) {
  const selectedPairId = ref(null)

  const preparedHotspots = computed(() =>
    hotspots.value.map((hotspot) => {
      const normalizedName = normalizeName(hotspot.locName)
      return {
        hotspot,
        lat: hotspot.lat,
        lng: hotspot.lng,
        normalizedName,
        tokenSet: new Set(tokenizeNormalizedName(normalizedName)),
      }
    }),
  )

  const allPairs = computed(() => {
    const prepared = preparedHotspots.value
    if (prepared.length < 2) {
      return []
    }

    const sortedIndices = prepared
      .map((_, index) => index)
      .sort((left, right) => prepared[left].lat - prepared[right].lat)

    const results = []
    for (let leftPos = 0; leftPos < sortedIndices.length - 1; leftPos += 1) {
      const leftPrepared = prepared[sortedIndices[leftPos]]

      for (let rightPos = leftPos + 1; rightPos < sortedIndices.length; rightPos += 1) {
        const rightPrepared = prepared[sortedIndices[rightPos]]

        const latDiffMeters = (rightPrepared.lat - leftPrepared.lat) * METERS_PER_LAT_DEG
        if (latDiffMeters > HARD_MAX_DISTANCE_METERS) {
          break
        }

        const midLatRad = ((leftPrepared.lat + rightPrepared.lat) / 2) * (Math.PI / 180)
        const metersPerLon = Math.max(1, METERS_PER_LAT_DEG * Math.cos(midLatRad))
        const lonDiffMeters = Math.abs(rightPrepared.lng - leftPrepared.lng) * metersPerLon
        if (lonDiffMeters > HARD_MAX_DISTANCE_METERS) {
          continue
        }

        const approxDistance = Math.sqrt(latDiffMeters ** 2 + lonDiffMeters ** 2)
        if (approxDistance > HARD_MAX_DISTANCE_METERS) {
          continue
        }

        const distanceMeters = haversineDistanceMeters(
          leftPrepared.lat,
          leftPrepared.lng,
          rightPrepared.lat,
          rightPrepared.lng,
        )
        if (distanceMeters > HARD_MAX_DISTANCE_METERS) {
          continue
        }

        const baseHotspotA = leftPrepared.hotspot
        const baseHotspotB = rightPrepared.hotspot
        const [hotspotA, hotspotB] = orderHotspotsByChecklist(baseHotspotA, baseHotspotB)
        const preparedA = hotspotA === baseHotspotA ? leftPrepared : rightPrepared
        const preparedB = hotspotB === baseHotspotB ? rightPrepared : leftPrepared

        const jaroWinkler = JaroWinklerDistance(preparedA.normalizedName, preparedB.normalizedName)
        const tokenJaccard = tokenJaccardSimilarity(preparedA.tokenSet, preparedB.tokenSet)
        const distanceScore = clampSimilarityThreshold(1 - distanceMeters / HARD_MAX_DISTANCE_METERS)
        const finalScore =
          SCORE_WEIGHTS.jaroWinkler * jaroWinkler +
          SCORE_WEIGHTS.tokenJaccard * tokenJaccard +
          SCORE_WEIGHTS.distance * distanceScore
        const nameSimilarityScore =
          (SCORE_WEIGHTS.jaroWinkler * jaroWinkler + SCORE_WEIGHTS.tokenJaccard * tokenJaccard) /
          (SCORE_WEIGHTS.jaroWinkler + SCORE_WEIGHTS.tokenJaccard)

        results.push({
          id: pairId(hotspotA.locId, hotspotB.locId),
          hotspotA,
          hotspotB,
          distanceMeters,
          nameSimilarityScore,
          finalScore,
          isExactDuplicate: Math.abs(hotspotA.lat - hotspotB.lat) < 1e-9 && Math.abs(hotspotA.lng - hotspotB.lng) < 1e-9,
        })
      }
    }

    return results
  })

  const pairsSortedByDistance = computed(() => {
    const items = [...allPairs.value]
    items.sort(compareByDistance)
    return items
  })

  const pairsSortedByName = computed(() => {
    const items = [...allPairs.value]
    items.sort(compareByNameSimilarity)
    return items
  })

  const visiblePairs = computed(() => {
    const thresholdDistance = Number(thresholdMeters.value)
    const thresholdName = Number(nameSimilarityThreshold.value)
    const maxDistance = Number.isFinite(thresholdDistance)
      ? Math.min(HARD_MAX_DISTANCE_METERS, Math.max(0, thresholdDistance))
      : HARD_MAX_DISTANCE_METERS
    const minNameSimilarity = Number.isFinite(thresholdName) ? thresholdName : 0
    const source = sortBy.value === 'nameSimilarity' ? pairsSortedByName.value : pairsSortedByDistance.value

    const results = []
    for (const pair of source) {
      if (pair.distanceMeters > maxDistance) {
        continue
      }
      if (pair.nameSimilarityScore < minNameSimilarity) {
        continue
      }
      results.push(pair)
    }

    return results
  })

  const pairsById = computed(() => {
    const byId = new Map()
    for (const pair of allPairs.value) {
      byId.set(pair.id, pair)
    }
    return byId
  })

  const selectedPair = computed(() => pairsById.value.get(selectedPairId.value) || null)

  watch(
    allPairs,
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

  function selectPair(id) {
    selectedPairId.value = id
  }

  function clearSelection() {
    selectedPairId.value = null
  }

  return {
    selectedPairId,
    selectedPair,
    allPairs,
    visiblePairs,
    selectPair,
    clearSelection,
  }
}

function clampSimilarityThreshold(value) {
  return Math.min(1, Math.max(0, Number(value) || 0))
}

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tokenizeNormalizedName(value) {
  if (!value) {
    return []
  }
  return value.split(/\s+/).filter(Boolean)
}

function tokenJaccardSimilarity(leftSet, rightSet) {
  if (!leftSet.size && !rightSet.size) {
    return 1
  }
  if (!leftSet.size || !rightSet.size) {
    return 0
  }

  let intersection = 0
  for (const token of leftSet) {
    if (rightSet.has(token)) {
      intersection += 1
    }
  }
  const union = leftSet.size + rightSet.size - intersection
  return union ? intersection / union : 0
}

function compareByDistance(left, right) {
  if (left.distanceMeters !== right.distanceMeters) {
    return left.distanceMeters - right.distanceMeters
  }
  return right.finalScore - left.finalScore
}

function compareByNameSimilarity(left, right) {
  if (right.nameSimilarityScore !== left.nameSimilarityScore) {
    return right.nameSimilarityScore - left.nameSimilarityScore
  }
  if (right.finalScore !== left.finalScore) {
    return right.finalScore - left.finalScore
  }
  return left.distanceMeters - right.distanceMeters
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
