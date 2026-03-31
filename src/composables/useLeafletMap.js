import { ref, watch } from 'vue'
import L from 'leaflet'

export function useLeafletMap({ filteredPairs, selectedPair, mapStyleStorageKey }) {
  const mapContainer = ref(null)

  const map = ref(null)
  const pointsLayer = ref(null)
  const lineLayer = ref(null)
  const streetTileLayer = ref(null)
  const satelliteTileLayer = ref(null)
  const layerControl = ref(null)

  watch([filteredPairs, selectedPair], () => {
    drawMap()
  })

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

    const initialMapStyle = localStorage.getItem(mapStyleStorageKey) || 'street'
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
      localStorage.setItem(mapStyleStorageKey, selectedStyle)
    })

    pointsLayer.value = L.layerGroup().addTo(map.value)
    lineLayer.value = L.layerGroup().addTo(map.value)
  }

  function destroyMap() {
    if (map.value) {
      map.value.remove()
      map.value = null
    }
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
      const hotspotA = selectedPair.value.hotspotA
      const hotspotB = selectedPair.value.hotspotB
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

    fitMapToCurrentSelection()
  }

  function fitMapToCurrentSelection() {
    if (!map.value) {
      return
    }

    if (selectedPair.value) {
      const hotspotA = selectedPair.value.hotspotA
      const hotspotB = selectedPair.value.hotspotB
      const bounds = L.latLngBounds(
        [hotspotA.lat, hotspotA.lng],
        [hotspotB.lat, hotspotB.lng],
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

  return {
    mapContainer,
    initMap,
    destroyMap,
    fitMapToCurrentSelection,
  }
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
