<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import L from 'leaflet'

const STORAGE_KEYS = {
  ebirdApiKey: 'deduper-ebird-api-key',
  thresholdMeters: 'deduper-threshold-meters',
  regionCode: 'deduper-region-code',
  regionName: 'deduper-region-name',
  mapStyle: 'deduper-map-style',
}

const EBIRD_BASE = 'https://api.ebird.org/v2'
const METERS_PER_LAT_DEG = 111320
const HARD_MAX_DISTANCE_METERS = 1000
const appVersion = __APP_VERSION__

const mapContainer = ref(null)
const map = ref(null)
const pointsLayer = ref(null)
const lineLayer = ref(null)
const streetTileLayer = ref(null)
const satelliteTileLayer = ref(null)
const layerControl = ref(null)

const showTokenModal = ref(!localStorage.getItem(STORAGE_KEYS.ebirdApiKey))
const tokenDraft = ref(localStorage.getItem(STORAGE_KEYS.ebirdApiKey) || '')
const tokenError = ref('')

const form = reactive({
  ebirdApiKey: localStorage.getItem(STORAGE_KEYS.ebirdApiKey) || '',
  regionCode: localStorage.getItem(STORAGE_KEYS.regionCode) || '',
  regionName: localStorage.getItem(STORAGE_KEYS.regionName) || '',
  thresholdMeters: clampThreshold(localStorage.getItem(STORAGE_KEYS.thresholdMeters) || 10),
})

const hotspots = ref([])
const isLoading = ref(false)
const fetchError = ref('')

const selectedPairId = ref(null)

const countries = ref([])
const subnationalCache = ref(new Map())
const regionSuggestions = ref([])
const regionSearching = ref(false)

const canFetch = computed(() => Boolean(form.ebirdApiKey.trim() && form.regionCode.trim()))
const hasSelectedRegion = computed(() => Boolean(form.regionCode))
const showLoadingOverlay = computed(() => isLoading.value)

const thresholdMetersValue = computed(() => clampThreshold(form.thresholdMeters))

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
  () => form.thresholdMeters,
  (value) => {
    const clamped = clampThreshold(value)
    if (Number(value) !== clamped) {
      form.thresholdMeters = clamped
      return
    }
    localStorage.setItem(STORAGE_KEYS.thresholdMeters, String(clamped))
  },
)

watch(
  () => form.regionCode,
  (value) => localStorage.setItem(STORAGE_KEYS.regionCode, value),
)

watch(
  () => form.regionName,
  (value) => localStorage.setItem(STORAGE_KEYS.regionName, value),
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

watch([filteredPairs, selectedPair], () => {
  drawMap()
})

onMounted(async () => {
  initMap()
  if (form.ebirdApiKey.trim()) {
    await loadCountries()
  }
})

onBeforeUnmount(() => {
  if (map.value) {
    map.value.remove()
    map.value = null
  }
})

function saveToken() {
  const trimmed = tokenDraft.value.trim()
  if (!trimmed) {
    tokenError.value = 'Token required.'
    return
  }
  form.ebirdApiKey = trimmed
  localStorage.setItem(STORAGE_KEYS.ebirdApiKey, trimmed)
  showTokenModal.value = false
  tokenError.value = ''
  loadCountries()
}

function openTokenModal() {
  tokenDraft.value = form.ebirdApiKey
  tokenError.value = ''
  showTokenModal.value = true
}

async function loadCountries() {
  if (!form.ebirdApiKey.trim() || countries.value.length) {
    return
  }

  try {
    const result = await ebirdGet('/ref/region/list/country/world')
    countries.value = (result || []).map((item) => ({
      code: item.code,
      name: item.name,
      type: 'country',
      parentCode: 'world',
    }))
  } catch {
    countries.value = []
  }
}

function regionQueryInput() {
  form.regionCode = ''
  if (!form.regionName.trim()) {
    regionSuggestions.value = []
    resetHotspotResults()
    return
  }
  debounceSearchRegions()
}

let regionSearchTimer = null
function debounceSearchRegions() {
  if (regionSearchTimer) {
    clearTimeout(regionSearchTimer)
  }
  regionSearchTimer = setTimeout(async () => {
    await searchRegionsByName(form.regionName.trim())
  }, 220)
}

async function searchRegionsByName(query) {
  regionSuggestions.value = []
  if (!query || !form.ebirdApiKey.trim()) {
    return
  }

  await loadCountries()
  regionSearching.value = true
  const normalized = query.toLowerCase()

  const matchedCountries = countries.value
    .filter((country) => country.name.toLowerCase().includes(normalized))
    .slice(0, 8)

  const countryCodesToExpand = countries.value
    .filter((country) => {
      const name = country.name.toLowerCase()
      return name.startsWith(normalized.slice(0, 2)) || name.includes(normalized)
    })
    .slice(0, 6)
    .map((country) => country.code)

  for (const countryCode of countryCodesToExpand) {
    if (!subnationalCache.value.has(countryCode)) {
      try {
        const states = await ebirdGet(`/ref/region/list/subnational1/${countryCode}`)
        const normalizedStates = (states || []).map((state) => ({
          code: state.code,
          name: state.name,
          type: 'subnational1',
          parentCode: countryCode,
        }))
        subnationalCache.value.set(countryCode, normalizedStates)
      } catch {
        subnationalCache.value.set(countryCode, [])
      }
    }
  }

  const matchedStates = []
  subnationalCache.value.forEach((states) => {
    states.forEach((state) => {
      if (state.name.toLowerCase().includes(normalized)) {
        matchedStates.push(state)
      }
    })
  })

  const merged = [...matchedStates, ...matchedCountries]
  const uniqueByCode = new Map()
  merged.forEach((item) => {
    if (!uniqueByCode.has(item.code)) {
      uniqueByCode.set(item.code, item)
    }
  })

  regionSuggestions.value = Array.from(uniqueByCode.values()).slice(0, 12)
  regionSearching.value = false
}

async function selectRegion(region) {
  form.regionCode = region.code
  form.regionName = region.name
  regionSuggestions.value = []
  await fetchHotspots()
}

function clearSelectedRegion() {
  form.regionCode = ''
  form.regionName = ''
  regionSuggestions.value = []
  fetchError.value = ''
  resetHotspotResults()
}

async function fetchHotspots() {
  if (!canFetch.value) {
    return
  }

  isLoading.value = true
  fetchError.value = ''

  try {
    const regionCode = form.regionCode.trim()
    const payload = await ebirdGet(`/ref/hotspot/${encodeURIComponent(regionCode)}?fmt=json`)
    hotspots.value = (payload || [])
      .map((item, i) => normalizeHotspot(item, i))
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

async function ebirdGet(path) {
  const response = await fetch(`${EBIRD_BASE}${path}`, {
    headers: {
      'X-eBirdApiToken': form.ebirdApiKey.trim(),
    },
  })
  if (!response.ok) {
    throw new Error(`eBird request failed (${response.status})`)
  }
  return response.json()
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
  const n = Number(value)
  return Number.isFinite(n) ? n : null
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

function formatCount(value) {
  return Number.isFinite(value) ? value.toLocaleString() : 'n/a'
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

function editUrl(locId) {
  return `https://ebird.org/mylocations/edit/${encodeURIComponent(locId)}`
}

function hotspotUrl(locId) {
  return `https://ebird.org/hotspot/${encodeURIComponent(locId)}`
}

function selectPair(id) {
  selectedPairId.value = id
  fitMapToCurrentSelection()
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

function initMap() {
  if (!mapContainer.value || map.value) {
    return
  }

  map.value = L.map(mapContainer.value, {
    zoomControl: true,
    attributionControl: true,
  }).setView([20, 0], 2)

  streetTileLayer.value = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  })

  satelliteTileLayer.value = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri',
    },
  )

  const initialMapStyle = localStorage.getItem(STORAGE_KEYS.mapStyle) || 'street'
  if (initialMapStyle === 'satellite') {
    satelliteTileLayer.value.addTo(map.value)
  } else {
    streetTileLayer.value.addTo(map.value)
  }

  layerControl.value = L.control.layers(
    {
      Street: streetTileLayer.value,
      Satellite: satelliteTileLayer.value,
    },
    undefined,
    { position: 'topright', collapsed: true },
  )
  layerControl.value.addTo(map.value)

  map.value.on('baselayerchange', (event) => {
    const selectedStyle = event.name === 'Satellite' ? 'satellite' : 'street'
    localStorage.setItem(STORAGE_KEYS.mapStyle, selectedStyle)
  })

  pointsLayer.value = L.layerGroup().addTo(map.value)
  lineLayer.value = L.layerGroup().addTo(map.value)
}

function drawMap() {
  if (!map.value || !pointsLayer.value || !lineLayer.value) {
    return
  }

  pointsLayer.value.clearLayers()
  lineLayer.value.clearLayers()

  const points = new Map()
  const selectedLocIds = new Set()
  if (selectedPair.value) {
    selectedLocIds.add(selectedPair.value.hotspotA.locId)
    selectedLocIds.add(selectedPair.value.hotspotB.locId)
  }

  filteredPairs.value.forEach((pair) => {
    ;[pair.hotspotA, pair.hotspotB].forEach((hotspot) => {
      if (!points.has(hotspot.locId)) {
        points.set(hotspot.locId, hotspot)
      }
    })
  })

  points.forEach((hotspot) => {
    const isSelected = selectedLocIds.has(hotspot.locId)
    const marker = L.circleMarker([hotspot.lat, hotspot.lng], {
      radius: isSelected ? 8 : 5,
      weight: 2,
      color: isSelected ? '#c81d4f' : '#2b6cb0',
      fillColor: isSelected ? '#f43f5e' : '#60a5fa',
      fillOpacity: 0.9,
    })
    marker.bindPopup(`<strong>${escapeHtml(hotspot.locName)}</strong><br>${escapeHtml(hotspot.locId)}`)
    marker.addTo(pointsLayer.value)
  })

  if (selectedPair.value) {
    const a = selectedPair.value.hotspotA
    const b = selectedPair.value.hotspotB
    L.polyline(
      [
        [a.lat, a.lng],
        [b.lat, b.lng],
      ],
      {
        color: '#c81d4f',
        weight: 3,
      },
    ).addTo(lineLayer.value)
  }

  fitMapToCurrentSelection()
}

function fitMapToCurrentSelection() {
  if (!map.value) {
    return
  }

  if (selectedPair.value) {
    const a = selectedPair.value.hotspotA
    const b = selectedPair.value.hotspotB
    const bounds = L.latLngBounds(
      [a.lat, a.lng],
      [b.lat, b.lng],
    )
    map.value.fitBounds(bounds.pad(0.2), { animate: true })
    return
  }

  const allPoints = []
  filteredPairs.value.forEach((pair) => {
    allPoints.push([pair.hotspotA.lat, pair.hotspotA.lng], [pair.hotspotB.lat, pair.hotspotB.lng])
  })

  if (!allPoints.length) {
    map.value.setView([20, 0], 2)
    return
  }

  map.value.fitBounds(L.latLngBounds(allPoints).pad(0.2), { animate: true, maxZoom: 13 })
}

function clearRegionSuggestions() {
  setTimeout(() => {
    regionSuggestions.value = []
  }, 150)
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

watch(
  () => form.ebirdApiKey,
  async (token) => {
    if (token.trim()) {
      await loadCountries()
    }
  },
)
</script>

<template>
  <div class="app-shell">
    <main class="content-split">
      <div v-if="showLoadingOverlay" class="loading-overlay">
        <div class="loading-card">
          <div class="spinner-border text-primary" role="status" aria-hidden="true" />
          <div class="small text-muted mt-2">Loading hotspots...</div>
        </div>
      </div>

      <aside class="list-pane">
        <div class="list-controls">
          <h1 class="panel-title">eBird Hotspot Deduper</h1>
          <div v-if="!hasSelectedRegion" class="position-relative">
            <input
              v-model="form.regionName"
              type="text"
              class="form-control form-control-lg region-input"
              placeholder="Search and select region"
              @input="regionQueryInput"
              @blur="clearRegionSuggestions"
            >
            <div v-if="regionSearching" class="input-spinner-wrap">
              <div class="spinner-border spinner-border-sm text-secondary" role="status" aria-hidden="true" />
            </div>
            <div v-if="regionSuggestions.length" class="suggestions">
              <button
                v-for="item in regionSuggestions"
                :key="item.code"
                type="button"
                class="suggestion-item"
                @mousedown.prevent="selectRegion(item)"
              >
                <span class="suggestion-main">
                  <span class="suggestion-name">{{ item.name }}</span>
                  <span class="suggestion-type">{{ item.type === 'country' ? 'Country' : 'Region' }}</span>
                </span>
                <span class="suggestion-code">{{ item.code }}</span>
              </button>
            </div>
          </div>
          <div v-else class="selected-region">
            <div class="selected-region-text">
              <span class="text-muted small">Selected region</span>
              <strong>{{ form.regionName }} ({{ form.regionCode }})</strong>
            </div>
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary icon-only-btn"
              title="Edit selected region"
              aria-label="Edit selected region"
              @click="clearSelectedRegion"
            >
              <i class="bi bi-pencil-square" aria-hidden="true" />
            </button>
          </div>

          <div class="threshold-row mt-2">
            <span class="threshold-label">
              Distance threshold
              <strong>{{ thresholdMetersValue.toFixed(0) }} m</strong>
            </span>
            <input
              v-model="form.thresholdMeters"
              type="range"
              class="form-range threshold-slider"
              min="0"
              max="1000"
              step="1"
              :disabled="!hotspots.length && !isLoading"
            >
          </div>

          <div class="controls-status mt-2">
            <span v-if="regionSearching" class="small text-muted">
              <span class="spinner-border spinner-border-sm align-text-bottom me-1" role="status" aria-hidden="true" />
              searching regions...
            </span>
            <span v-if="isLoading" class="small text-muted ms-2">
              <span class="spinner-border spinner-border-sm align-text-bottom me-1" role="status" aria-hidden="true" />
              fetching hotspots...
            </span>
          </div>
          <div v-if="fetchError" class="small text-danger mt-1">{{ fetchError }}</div>
        </div>

        <div class="list-pane-head">
          <span class="fw-semibold">Duplicate hotspot pair</span>
          <span class="badge rounded-pill text-bg-light border">{{ filteredPairs.length }}</span>
        </div>
        <div class="list-pane-body">
          <div v-if="!filteredPairs.length" class="text-muted small px-3 py-3">No candidates.</div>
          <button
            v-for="pair in filteredPairs"
            :key="pair.id"
            type="button"
            class="pair-item btn btn-light text-start w-100"
            :class="{ active: selectedPairId === pair.id }"
            @click="selectPair(pair.id)"
          >
            <div class="d-flex justify-content-between align-items-center mb-1">
              <strong>{{ Math.round(pair.distanceMeters) }} m</strong>
              <span v-if="pair.isExactDuplicate" class="badge text-bg-danger">Exact</span>
            </div>

            <div class="pair-locations small">
              <div class="hotspot-side">
                <div class="hotspot-head">
                  <a
                    class="hotspot-name-link fw-semibold"
                    :href="hotspotUrl(pair.hotspotA.locId)"
                    target="_blank"
                    rel="noopener"
                    @click.stop
                  >
                    {{ pair.hotspotA.locName }}
                  </a>
                  <a
                    class="icon-link"
                    :href="editUrl(pair.hotspotA.locId)"
                    target="_blank"
                    rel="noopener"
                    title="Edit hotspot"
                    aria-label="Edit hotspot"
                    @click.stop
                  >
                    <i class="bi bi-pencil-square" aria-hidden="true" />
                  </a>
                </div>
                <div class="text-muted">
                  {{ formatCount(pair.hotspotA.checklistCount) }} checklists ·
                  {{ formatCount(pair.hotspotA.speciesCount) }} species
                </div>
              </div>

              <div class="hotspot-side">
                <div class="hotspot-head">
                  <a
                    class="hotspot-name-link fw-semibold"
                    :href="hotspotUrl(pair.hotspotB.locId)"
                    target="_blank"
                    rel="noopener"
                    @click.stop
                  >
                    {{ pair.hotspotB.locName }}
                  </a>
                  <a
                    class="icon-link"
                    :href="editUrl(pair.hotspotB.locId)"
                    target="_blank"
                    rel="noopener"
                    title="Edit hotspot"
                    aria-label="Edit hotspot"
                    @click.stop
                  >
                    <i class="bi bi-pencil-square" aria-hidden="true" />
                  </a>
                </div>
                <div class="text-muted">
                  {{ formatCount(pair.hotspotB.checklistCount) }} checklists ·
                  {{ formatCount(pair.hotspotB.speciesCount) }} species
                </div>
              </div>
            </div>
          </button>
        </div>
      </aside>

      <section class="map-pane">
        <div ref="mapContainer" class="leaflet-map" />
      </section>
    </main>

    <footer class="app-footer">
      <div class="container-fluid">
        <div class="footer-line">
          <span>v{{ appVersion }}</span>
          <span class="dot">•</span>
          <a href="https://github.com/Zoziologie/ebird-hotspot-deduper" target="_blank" rel="noopener">GitHub</a>
          <span class="dot">•</span>
          <a class="sponsor-link" href="https://github.com/sponsors/Zoziologie" target="_blank" rel="noopener">
            <i class="bi bi-heart-fill me-1" aria-hidden="true" />
            Sponsor
          </a>
          <span class="dot">•</span>
          <span>Powered by</span>
          <a href="https://zoziologie.raphaelnussbaumer.com/" target="_blank" rel="noopener">Zoziologie</a>
          <span class="dot">•</span>
          <button type="button" class="footer-token-btn" @click="openTokenModal">
            <i class="bi bi-key-fill me-1" aria-hidden="true" />
            API token
          </button>
        </div>
      </div>
    </footer>

    <div v-if="showTokenModal" class="modal-backdrop-custom">
      <div class="modal-dialog-custom card shadow">
        <div class="card-body">
          <h5 class="card-title mb-2">Enter eBird API token</h5>
          <p class="small text-muted mb-3">
            Needed for region lookup and hotspot fetch.
            <a href="https://ebird.org/api/keygen" target="_blank" rel="noopener">Get token</a>
          </p>
          <input
            v-model="tokenDraft"
            type="password"
            class="form-control"
            placeholder="API token"
            @keyup.enter="saveToken"
          >
          <div v-if="tokenError" class="text-danger small mt-2">{{ tokenError }}</div>
          <div class="d-flex justify-content-end mt-3">
            <button class="btn btn-primary" @click="saveToken">Save</button>
          </div>
        </div>
      </div>
    </div>
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

.panel-title {
  margin: 0;
  font-size: 1.22rem;
  font-weight: 700;
  color: #0c3a66;
  letter-spacing: 0.01em;
  margin-bottom: 0.55rem;
}

.region-input {
  border-color: #b9cce5;
  background: #fbfdff;
}

.selected-region {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid #b8cee8;
  border-radius: 0.65rem;
  background: linear-gradient(180deg, #f8fbff 0%, #f1f7ff 100%);
}

.selected-region-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.selected-region-text strong {
  font-size: 0.95rem;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-region-code {
  font-size: 0.75rem;
  color: #64748b;
}

.icon-only-btn {
  width: 2rem;
  min-width: 2rem;
  padding: 0;
}

.threshold-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.threshold-label {
  flex: 0 0 auto;
  font-size: 0.85rem;
  color: #39506a;
  white-space: nowrap;
}

.threshold-slider {
  flex: 1 1 auto;
  margin: 0;
}

.controls-status {
  min-height: 1.2rem;
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

.list-controls {
  padding: 0.75rem 0.75rem 0.55rem;
  border-bottom: 1px solid #d2deeb;
  background: linear-gradient(180deg, #ffffff 0%, #f4f9ff 100%);
}

.list-pane-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.72rem 0.8rem;
  border-bottom: 1px solid #d2deeb;
  background: #f8fbff;
}

.list-pane-body {
  overflow: auto;
  padding: 0.6rem;
}

.map-pane {
  min-height: 0;
  border-left: 1px solid #dde8f3;
  background: #ffffff;
}

.leaflet-map {
  width: 100%;
  height: 100%;
}

.pair-item {
  border: 1px solid #d6e2f0;
  margin-bottom: 0.55rem;
  border-radius: 0.68rem;
  background: #ffffff;
  box-shadow: 0 3px 12px rgba(15, 23, 42, 0.06);
  transition: border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease;
}

.pair-item:hover {
  border-color: #8ab4e6;
  box-shadow: 0 7px 18px rgba(30, 64, 112, 0.12);
  transform: translateY(-1px);
}

.pair-item.active {
  border-color: #2b77d3;
  background: #edf5ff;
}

.pair-locations {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}

.hotspot-side {
  border: 1px solid #dde7f3;
  border-radius: 0.55rem;
  padding: 0.45rem 0.52rem;
  background: linear-gradient(180deg, #fbfdff 0%, #f4f8ff 100%);
}

.hotspot-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.35rem;
  margin-bottom: 0.25rem;
}

.hotspot-name-link {
  color: #0f172a;
  text-decoration: none;
  line-height: 1.2;
}

.hotspot-name-link:hover {
  text-decoration: underline;
}

.icon-link {
  color: #475569;
  font-size: 0.95rem;
  line-height: 1;
  text-decoration: none;
  padding: 0.1rem;
}

.icon-link:hover {
  color: #0f6edb;
}

.suggestions {
  position: absolute;
  inset: calc(100% + 4px) 0 auto 0;
  z-index: 50;
  background: #ffffff;
  border: 1px solid #d5deea;
  border-radius: 0.7rem;
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.14);
  max-height: 280px;
  overflow: auto;
}

.input-spinner-wrap {
  position: absolute;
  right: 0.7rem;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(246, 250, 255, 0.7);
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(1px);
}

.loading-card {
  background: #ffffff;
  border: 1px solid #d8e2ef;
  border-radius: 0.7rem;
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.12);
  padding: 0.85rem 1rem 0.65rem;
  text-align: center;
}

.suggestion-item {
  width: 100%;
  border: 0;
  border-bottom: 1px solid #edf2f8;
  background: #ffffff;
  padding: 0.62rem 0.75rem;
  text-align: left;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
}

.suggestion-item:last-child {
  border-bottom: 0;
}

.suggestion-item:hover {
  background: #ecf5ff;
}

.suggestion-main {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
}

.suggestion-name {
  font-size: 0.92rem;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.suggestion-type {
  font-size: 0.72rem;
  color: #4b5563;
  background: #edf2ff;
  border: 1px solid #d9e4ff;
  border-radius: 999px;
  padding: 0.08rem 0.42rem;
}

.suggestion-code {
  font-size: 0.75rem;
  color: #475569;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.35rem;
  padding: 0.12rem 0.35rem;
  white-space: nowrap;
}

.modal-backdrop-custom {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(17, 24, 39, 0.45);
  z-index: 3000;
}

.modal-dialog-custom {
  width: min(520px, 92vw);
  position: relative;
  z-index: 3001;
}

.app-footer {
  border-top: 1px solid #ccd9ea;
  background: linear-gradient(180deg, #ffffff 0%, #f5f9ff 100%);
  padding: 0.36rem 0;
}

.footer-line {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  font-size: 0.82rem;
  color: #64748b;
}

.footer-line a {
  color: #334155;
  text-decoration: none;
}

.footer-line a:hover {
  text-decoration: underline;
}

.sponsor-link {
  color: #be185d;
  font-weight: 600;
}

.sponsor-link:hover {
  color: #9d174d;
}

.footer-token-btn {
  border: 0;
  background: transparent;
  color: #334155;
  font-size: 0.82rem;
  padding: 0;
}

.footer-token-btn:hover {
  text-decoration: underline;
}

.dot {
  color: #94a3b8;
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

@media (max-width: 520px) {
  .pair-locations {
    grid-template-columns: 1fr;
  }

  .threshold-row {
    flex-direction: column;
    align-items: stretch;
    gap: 0.35rem;
  }

  .threshold-label {
    white-space: normal;
  }
}
</style>
