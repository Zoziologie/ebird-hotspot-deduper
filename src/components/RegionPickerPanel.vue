<script setup>
const props = defineProps({
  tokenPresent: {
    type: Boolean,
    default: false,
  },
  countryQuery: {
    type: String,
    default: '',
  },
  subnational1Query: {
    type: String,
    default: '',
  },
  subnational2Query: {
    type: String,
    default: '',
  },
  thresholdMeters: {
    type: [String, Number],
    default: 10,
  },
  thresholdMetersValue: {
    type: Number,
    required: true,
  },
  countrySuggestions: {
    type: Array,
    default: () => [],
  },
  subnational1Suggestions: {
    type: Array,
    default: () => [],
  },
  subnational2Suggestions: {
    type: Array,
    default: () => [],
  },
  countriesLoading: {
    type: Boolean,
    default: false,
  },
  subnational1Loading: {
    type: Boolean,
    default: false,
  },
  subnational2Loading: {
    type: Boolean,
    default: false,
  },
  selectedCountry: {
    type: Object,
    default: null,
  },
  selectedSubnational1: {
    type: Object,
    default: null,
  },
  canFetch: {
    type: Boolean,
    default: false,
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  hasSelectedRegion: {
    type: Boolean,
    default: false,
  },
  selectedRegionName: {
    type: String,
    default: '',
  },
  selectedRegionCode: {
    type: String,
    default: '',
  },
  canClearSelection: {
    type: Boolean,
    default: false,
  },
  regionLookupBusy: {
    type: Boolean,
    default: false,
  },
  fetchError: {
    type: String,
    default: '',
  },
  hasHotspots: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits([
  'update:countryQuery',
  'update:subnational1Query',
  'update:subnational2Query',
  'update:thresholdMeters',
  'country-query-input',
  'subnational1-query-input',
  'subnational2-query-input',
  'country-query-blur',
  'subnational1-query-blur',
  'subnational2-query-blur',
  'select-country',
  'select-subnational1',
  'select-subnational2',
  'fetch-hotspots',
  'clear-selection',
])

function onCountryInput(event) {
  emit('update:countryQuery', event.target.value)
  emit('country-query-input')
}

function onSubnational1Input(event) {
  emit('update:subnational1Query', event.target.value)
  emit('subnational1-query-input')
}

function onSubnational2Input(event) {
  emit('update:subnational2Query', event.target.value)
  emit('subnational2-query-input')
}

function onThresholdInput(event) {
  emit('update:thresholdMeters', event.target.value)
}
</script>

<template>
  <div class="list-controls">
    <h1 class="panel-title">eBird Hotspot Deduper</h1>

    <div class="region-field position-relative">
      <label class="region-field-label">Country</label>
      <input
        :value="countryQuery"
        type="text"
        class="form-control form-control-lg region-input"
        placeholder="Type to search countries"
        :disabled="!tokenPresent"
        @input="onCountryInput"
        @blur="emit('country-query-blur')"
      >
      <div v-if="countriesLoading" class="input-spinner-wrap">
        <div class="spinner-border spinner-border-sm text-secondary" role="status" aria-hidden="true" />
      </div>
      <div v-if="countrySuggestions.length" class="suggestions">
        <button
          v-for="item in countrySuggestions"
          :key="item.code"
          type="button"
          class="suggestion-item"
          @mousedown.prevent="emit('select-country', item)"
        >
          <span class="suggestion-main">
            <span class="suggestion-name">{{ item.name }}</span>
          </span>
          <span class="suggestion-code">{{ item.code }}</span>
        </button>
      </div>
    </div>

    <div class="region-field position-relative mt-2">
      <label class="region-field-label">Region / State / Province (optional)</label>
      <input
        :value="subnational1Query"
        type="text"
        class="form-control region-input"
        placeholder="Type to search level 2 region"
        :disabled="!tokenPresent || !selectedCountry"
        @input="onSubnational1Input"
        @blur="emit('subnational1-query-blur')"
      >
      <div v-if="subnational1Loading" class="input-spinner-wrap">
        <div class="spinner-border spinner-border-sm text-secondary" role="status" aria-hidden="true" />
      </div>
      <div v-if="subnational1Suggestions.length" class="suggestions">
        <button
          v-for="item in subnational1Suggestions"
          :key="item.code"
          type="button"
          class="suggestion-item"
          @mousedown.prevent="emit('select-subnational1', item)"
        >
          <span class="suggestion-main">
            <span class="suggestion-name">{{ item.name }}</span>
          </span>
          <span class="suggestion-code">{{ item.code }}</span>
        </button>
      </div>
    </div>

    <div class="region-field position-relative mt-2">
      <label class="region-field-label">Subregion / County / District (optional)</label>
      <input
        :value="subnational2Query"
        type="text"
        class="form-control region-input"
        placeholder="Type to search level 3 subregion"
        :disabled="!tokenPresent || !selectedSubnational1"
        @input="onSubnational2Input"
        @blur="emit('subnational2-query-blur')"
      >
      <div v-if="subnational2Loading" class="input-spinner-wrap">
        <div class="spinner-border spinner-border-sm text-secondary" role="status" aria-hidden="true" />
      </div>
      <div v-if="subnational2Suggestions.length" class="suggestions">
        <button
          v-for="item in subnational2Suggestions"
          :key="item.code"
          type="button"
          class="suggestion-item"
          @mousedown.prevent="emit('select-subnational2', item)"
        >
          <span class="suggestion-main">
            <span class="suggestion-name">{{ item.name }}</span>
          </span>
          <span class="suggestion-code">{{ item.code }}</span>
        </button>
      </div>
    </div>

    <div class="region-actions mt-2">
      <button type="button" class="btn btn-primary btn-sm" :disabled="!canFetch || isLoading" @click="emit('fetch-hotspots')">
        <i class="bi bi-binoculars-fill me-1" aria-hidden="true" />
        Hunt Duplicates
      </button>
      <div class="selected-region-text">
        <span class="text-muted small">Selected region</span>
        <strong>{{ hasSelectedRegion ? selectedRegionName + ' (' + selectedRegionCode + ')' : 'not selected' }}</strong>
      </div>
      <button
        type="button"
        class="btn btn-sm btn-outline-secondary"
        :disabled="!canClearSelection"
        @click="emit('clear-selection')"
      >
        Clear
      </button>
    </div>

    <div class="threshold-row mt-2">
      <span class="threshold-label">
        Distance threshold
        <strong>{{ thresholdMetersValue.toFixed(0) }} m</strong>
      </span>
      <input
        :value="thresholdMeters"
        type="range"
        class="form-range threshold-slider"
        min="0"
        max="1000"
        step="1"
        :disabled="!hasHotspots && !isLoading"
        @input="onThresholdInput"
      >
    </div>

    <div class="controls-status mt-2">
      <span v-if="regionLookupBusy" class="small text-muted">
        <span class="spinner-border spinner-border-sm align-text-bottom me-1" role="status" aria-hidden="true" />
        loading region lists...
      </span>
      <span v-if="isLoading" class="small text-muted ms-2">
        <span class="spinner-border spinner-border-sm align-text-bottom me-1" role="status" aria-hidden="true" />
        fetching hotspots...
      </span>
    </div>
    <div v-if="fetchError" class="small text-danger mt-1">{{ fetchError }}</div>
  </div>
</template>

<style scoped>
.list-controls {
  padding: 0.75rem 0.75rem 0.55rem;
  border-bottom: 1px solid #d2deeb;
  background: linear-gradient(180deg, #ffffff 0%, #f4f9ff 100%);
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

.region-field-label {
  display: block;
  font-size: 0.74rem;
  font-weight: 600;
  color: #47617f;
  margin: 0 0 0.28rem;
  letter-spacing: 0.01em;
}

.selected-region-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.selected-region-text strong {
  font-size: 0.9rem;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.region-actions {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}

.region-actions .btn {
  flex: 0 0 auto;
}

.region-actions .selected-region-text {
  flex: 1 1 auto;
  border: 1px solid #c8d8ec;
  border-radius: 0.6rem;
  padding: 0.38rem 0.55rem;
  background: linear-gradient(180deg, #f8fbff 0%, #f1f7ff 100%);
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

.suggestion-code {
  font-size: 0.75rem;
  color: #475569;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.35rem;
  padding: 0.12rem 0.35rem;
  white-space: nowrap;
}

@media (max-width: 520px) {
  .region-actions {
    flex-direction: column;
    align-items: stretch;
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
