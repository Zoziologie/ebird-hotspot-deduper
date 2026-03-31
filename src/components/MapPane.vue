<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'

const VIEW_BOUNDS_BUFFER = 0.25

const props = defineProps({
  showLoadingOverlay: {
    type: Boolean,
    default: false,
  },
  hotspots: {
    type: Array,
    default: () => [],
  },
  selectedPair: {
    type: Object,
    default: null,
  },
  mapStyleStorageKey: {
    type: String,
    default: 'deduper-map-style',
  },
})

const mapContainer = ref(null)

const map = ref(null)
const backgroundPointsLayer = ref(null)
const selectionPointsLayer = ref(null)
const lineLayer = ref(null)
const backgroundRenderer = ref(null)
const selectionRenderer = ref(null)
const streetTileLayer = ref(null)
const satelliteTileLayer = ref(null)
const layerControl = ref(null)

watch(
  () => props.hotspots,
  () => {
    drawBackgroundHotspots()
    drawSelectionOverlay()
    fitMapToCurrentSelection()
  },
)

watch(
  () => props.selectedPair,
  () => {
    drawSelectionOverlay()
    fitMapToCurrentSelection()
  },
)

onMounted(() => {
  initMap()
})

onBeforeUnmount(() => {
  destroyMap()
})

function initMap() {
  if (!mapContainer.value || map.value) {
    return
  }

  map.value = L.map(mapContainer.value, {
    zoomControl: true,
    attributionControl: true,
    preferCanvas: true,
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

  const initialMapStyle = localStorage.getItem(props.mapStyleStorageKey) || 'street'
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
    localStorage.setItem(props.mapStyleStorageKey, selectedStyle)
  })
  map.value.on('moveend', () => {
    drawBackgroundHotspots()
  })

  backgroundRenderer.value = L.canvas({ padding: VIEW_BOUNDS_BUFFER + 0.15 })
  selectionRenderer.value = L.canvas({ padding: 0.35 })

  backgroundPointsLayer.value = L.layerGroup().addTo(map.value)
  selectionPointsLayer.value = L.layerGroup().addTo(map.value)
  lineLayer.value = L.layerGroup().addTo(map.value)

  drawBackgroundHotspots()
  drawSelectionOverlay()
  fitMapToCurrentSelection()
}

function destroyMap() {
  if (map.value) {
    map.value.remove()
    map.value = null
    backgroundPointsLayer.value = null
    selectionPointsLayer.value = null
    lineLayer.value = null
    backgroundRenderer.value = null
    selectionRenderer.value = null
    streetTileLayer.value = null
    satelliteTileLayer.value = null
    layerControl.value = null
  }
}

function drawBackgroundHotspots() {
  if (!map.value || !backgroundPointsLayer.value) {
    return
  }

  backgroundPointsLayer.value.clearLayers()
  const bufferedBounds = map.value.getBounds().pad(VIEW_BOUNDS_BUFFER)
  const south = bufferedBounds.getSouth()
  const north = bufferedBounds.getNorth()
  const west = bufferedBounds.getWest()
  const east = bufferedBounds.getEast()
  const crossesDateLine = west > east

  props.hotspots.forEach((hotspot) => {
    if (!isPointInBounds(hotspot.lat, hotspot.lng, south, north, west, east, crossesDateLine)) {
      return
    }

    const marker = L.circleMarker([hotspot.lat, hotspot.lng], {
      radius: 5,
      weight: 2,
      color: '#2b6cb0',
      fillColor: '#60a5fa',
      fillOpacity: 0.9,
      renderer: backgroundRenderer.value || undefined,
    })
    marker.bindPopup(buildHotspotPopup(hotspot))
    marker.addTo(backgroundPointsLayer.value)
  })
}

function drawSelectionOverlay() {
  if (!map.value || !selectionPointsLayer.value || !lineLayer.value) {
    return
  }

  selectionPointsLayer.value.clearLayers()
  lineLayer.value.clearLayers()

  if (props.selectedPair) {
    const hotspotA = props.selectedPair.hotspotA
    const hotspotB = props.selectedPair.hotspotB

    const selectedMarkers = [hotspotA, hotspotB]
    selectedMarkers.forEach((hotspot) => {
      const marker = L.circleMarker([hotspot.lat, hotspot.lng], {
        radius: 8,
        weight: 2,
        color: '#c81d4f',
        fillColor: '#f43f5e',
        fillOpacity: 0.95,
        renderer: selectionRenderer.value || undefined,
      })
      marker.bindPopup(buildHotspotPopup(hotspot))
      marker.addTo(selectionPointsLayer.value)
    })

    L.polyline(
      [
        [hotspotA.lat, hotspotA.lng],
        [hotspotB.lat, hotspotB.lng],
      ],
      {
        color: '#c81d4f',
        weight: 3,
      },
    ).addTo(lineLayer.value)
  }
}

function fitMapToCurrentSelection() {
  if (!map.value) {
    return
  }

  if (props.selectedPair) {
    const hotspotA = props.selectedPair.hotspotA
    const hotspotB = props.selectedPair.hotspotB
    const bounds = L.latLngBounds(
      [hotspotA.lat, hotspotA.lng],
      [hotspotB.lat, hotspotB.lng],
    )
    map.value.fitBounds(bounds.pad(0.2), { animate: true })
    return
  }

  const allPoints = props.hotspots.map((hotspot) => [hotspot.lat, hotspot.lng])
  if (!allPoints.length) {
    map.value.setView([20, 0], 2)
    return
  }

  map.value.fitBounds(L.latLngBounds(allPoints).pad(0.2), { animate: true, maxZoom: 13 })
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function buildHotspotPopup(hotspot) {
  const name = escapeHtml(hotspot.locName)
  const url = `https://ebird.org/hotspot/${encodeURIComponent(hotspot.locId)}`
  const species = formatCount(hotspot.speciesCount)
  const checklists = formatCount(hotspot.checklistCount)

  return `<strong>${name}</strong><br><a href="${url}" target="_blank" rel="noopener noreferrer">Open in eBird</a><br>${species} species · ${checklists} checklists`
}

function formatCount(value) {
  return Number.isFinite(value) ? Number(value).toLocaleString() : 'n/a'
}

function isPointInBounds(lat, lng, south, north, west, east, crossesDateLine) {
  if (lat < south || lat > north) {
    return false
  }
  if (crossesDateLine) {
    return lng >= west || lng <= east
  }
  return lng >= west && lng <= east
}
</script>

<template>
  <section class="map-pane">
    <div ref="mapContainer" class="leaflet-map" />
    <div v-if="showLoadingOverlay" class="loading-overlay">
      <div class="loading-card">
        <div class="spinner-border text-primary" role="status" aria-hidden="true" />
        <div class="small text-muted mt-2">Loading hotspots...</div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.map-pane {
  min-height: 0;
  border-top: 1px solid var(--brand-border);
  background:
    radial-gradient(circle at 0% 100%, rgba(var(--brand-primary-rgb), 0.12) 0%, transparent 34%),
    #ffffff;
  position: relative;
}

.leaflet-map {
  width: 100%;
  height: 100%;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(246, 251, 251, 0.72);
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(1px);
}

.loading-card {
  background: #ffffff;
  border: 1px solid color-mix(in srgb, var(--brand-border) 80%, #ffffff 20%);
  border-radius: 0.85rem;
  box-shadow: 0 14px 32px rgba(14, 36, 54, 0.18);
  padding: 0.85rem 1rem 0.65rem;
  text-align: center;
}
</style>
