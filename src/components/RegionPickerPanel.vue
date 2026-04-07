<script setup>
import { computed, reactive, ref, watch } from 'vue'

const URL_REGION_KEY = 'regionCode'
const REGION_CODE_PATTERN = /^[A-Z]{2}(?:-[A-Z0-9]+)*$/i

const props = defineProps({
  apiToken: {
    type: String,
    default: '',
  },
  ebirdGet: {
    type: Function,
    required: true,
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  fetchError: {
    type: [String, Object],
    default: '',
  },
})

const emit = defineEmits(['update:region-code', 'fetch-hotspots'])

const form = reactive({
  countryQuery: '',
  subnational1Query: '',
  subnational2Query: '',
})

const selectedCountry = ref(null)
const selectedSubnational1 = ref(null)
const selectedSubnational2 = ref(null)

const countries = ref([])
const countriesLoaded = ref(false)
const countriesLoading = ref(false)

const subnational1Options = ref([])
const subnational1LoadedFor = ref('')
const subnational1Loading = ref(false)

const subnational2Options = ref([])
const subnational2LoadedFor = ref('')
const subnational2Loading = ref(false)

const countrySuggestions = ref([])
const subnational1Suggestions = ref([])
const subnational2Suggestions = ref([])

const regionError = ref('')
let subnational1RequestId = 0
let subnational2RequestId = 0

const tokenPresent = computed(() => Boolean(props.apiToken.trim()))
const selectedRegionCode = computed(
  () => selectedSubnational2.value?.code || selectedSubnational1.value?.code || selectedCountry.value?.code || '',
)
const canFetch = computed(() => Boolean(tokenPresent.value && selectedRegionCode.value))
const regionLookupBusy = computed(
  () => countriesLoading.value || subnational1Loading.value || subnational2Loading.value,
)
const subnational1ListLoaded = computed(
  () =>
    Boolean(selectedCountry.value?.code) &&
    subnational1LoadedFor.value === selectedCountry.value.code &&
    subnational1Options.value.length > 0 &&
    !subnational1Loading.value,
)
const subnational2ListLoaded = computed(
  () =>
    Boolean(selectedSubnational1.value?.code) &&
    subnational2LoadedFor.value === selectedSubnational1.value.code &&
    subnational2Options.value.length > 0 &&
    !subnational2Loading.value,
)

const fetchErrorText = computed(() => normalizeErrorMessage(regionError.value || props.fetchError))

watch(
  selectedRegionCode,
  (code) => {
    emit('update:region-code', code)
  },
  { immediate: true },
)

watch(
  () => props.apiToken,
  async (token, previousToken) => {
    const trimmedToken = token.trim()
    const previousTrimmedToken = previousToken?.trim() || ''

    if (!trimmedToken) {
      countries.value = []
      countriesLoaded.value = false
      resetRegionSelectionState()
      regionError.value = ''
      return
    }

    if (trimmedToken !== previousTrimmedToken) {
      countries.value = []
      countriesLoaded.value = false
      await initializeRegionPicker()
    }
  },
  { immediate: true },
)

const countryFocused = ref(false)
const subnational1Focused = ref(false)
const subnational2Focused = ref(false)

const activeCountryIndex = ref(-1)
const activeSubnational1Index = ref(-1)
const activeSubnational2Index = ref(-1)

const countryListId = 'country-suggestions-listbox'
const subnational1ListId = 'subnational1-suggestions-listbox'
const subnational2ListId = 'subnational2-suggestions-listbox'

const showCountryEmpty = computed(() =>
  shouldShowEmptyState({
    focused: countryFocused.value,
    query: form.countryQuery,
    loading: countriesLoading.value,
    suggestions: countrySuggestions.value,
    selectedName: selectedCountry.value?.name,
  }),
)
const showSubnational1Empty = computed(() =>
  shouldShowEmptyState({
    focused: subnational1Focused.value,
    query: form.subnational1Query,
    loading: subnational1Loading.value,
    suggestions: subnational1Suggestions.value,
    selectedName: selectedSubnational1.value?.name,
  }),
)
const showSubnational2Empty = computed(() =>
  shouldShowEmptyState({
    focused: subnational2Focused.value,
    query: form.subnational2Query,
    loading: subnational2Loading.value,
    suggestions: subnational2Suggestions.value,
    selectedName: selectedSubnational2.value?.name,
  }),
)
const showSubnational1Input = computed(
  () => Boolean(selectedCountry.value) && (subnational1Loading.value || subnational1ListLoaded.value),
)
const showSubnational2Input = computed(
  () => Boolean(selectedSubnational1.value) && (subnational2Loading.value || subnational2ListLoaded.value),
)

watch(countrySuggestions, (items) => {
  if (!items.length) {
    activeCountryIndex.value = -1
    return
  }
  if (activeCountryIndex.value >= items.length) {
    activeCountryIndex.value = items.length - 1
  }
})

watch(subnational1Suggestions, (items) => {
  if (!items.length) {
    activeSubnational1Index.value = -1
    return
  }
  if (activeSubnational1Index.value >= items.length) {
    activeSubnational1Index.value = items.length - 1
  }
})

watch(subnational2Suggestions, (items) => {
  if (!items.length) {
    activeSubnational2Index.value = -1
    return
  }
  if (activeSubnational2Index.value >= items.length) {
    activeSubnational2Index.value = items.length - 1
  }
})

function onCountryInput(event) {
  form.countryQuery = event.target.value
  void countryQueryInput()
}

function onSubnational1Input(event) {
  form.subnational1Query = event.target.value
  void subnational1QueryInput()
}

function onSubnational2Input(event) {
  form.subnational2Query = event.target.value
  void subnational2QueryInput()
}

function clearCountryInput() {
  form.countryQuery = ''
  countrySuggestions.value = []
  void countryQueryInput()
}

function clearSubnational1Input() {
  form.subnational1Query = ''
  subnational1Suggestions.value = []
  void subnational1QueryInput()
}

function clearSubnational2Input() {
  form.subnational2Query = ''
  subnational2Suggestions.value = []
  void subnational2QueryInput()
}

function onCountryFocus() {
  countryFocused.value = true
}

function onCountryBlur() {
  countryFocused.value = false
  activeCountryIndex.value = -1
  clearCountrySuggestions()
}

function onSubnational1Focus() {
  subnational1Focused.value = true
  void subnational1QueryFocus()
}

function onSubnational1Blur() {
  subnational1Focused.value = false
  activeSubnational1Index.value = -1
  clearSubnational1Suggestions()
}

function onSubnational2Focus() {
  subnational2Focused.value = true
  void subnational2QueryFocus()
}

function onSubnational2Blur() {
  subnational2Focused.value = false
  activeSubnational2Index.value = -1
  clearSubnational2Suggestions()
}

function countryOptionId(index) {
  return `country-suggestion-${index}`
}

function subnational1OptionId(index) {
  return `subnational1-suggestion-${index}`
}

function subnational2OptionId(index) {
  return `subnational2-suggestion-${index}`
}

function onCountryKeydown(event) {
  if (!countrySuggestions.value.length) {
    if (event.key === 'Escape') {
      activeCountryIndex.value = -1
    }
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeCountryIndex.value = activeCountryIndex.value < 0 ? 0 : (activeCountryIndex.value + 1) % countrySuggestions.value.length
    return
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeCountryIndex.value =
      activeCountryIndex.value < 0
        ? countrySuggestions.value.length - 1
        : (activeCountryIndex.value - 1 + countrySuggestions.value.length) % countrySuggestions.value.length
    return
  }
  if (event.key === 'Enter' && activeCountryIndex.value >= 0) {
    event.preventDefault()
    selectCountry(countrySuggestions.value[activeCountryIndex.value])
    return
  }
  if (event.key === 'Escape') {
    activeCountryIndex.value = -1
  }
}

function onSubnational1Keydown(event) {
  if (!subnational1Suggestions.value.length) {
    if (event.key === 'Escape') {
      activeSubnational1Index.value = -1
    }
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeSubnational1Index.value =
      activeSubnational1Index.value < 0 ? 0 : (activeSubnational1Index.value + 1) % subnational1Suggestions.value.length
    return
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeSubnational1Index.value =
      activeSubnational1Index.value < 0
        ? subnational1Suggestions.value.length - 1
        : (activeSubnational1Index.value - 1 + subnational1Suggestions.value.length) % subnational1Suggestions.value.length
    return
  }
  if (event.key === 'Enter' && activeSubnational1Index.value >= 0) {
    event.preventDefault()
    selectSubnational1(subnational1Suggestions.value[activeSubnational1Index.value])
    return
  }
  if (event.key === 'Escape') {
    activeSubnational1Index.value = -1
  }
}

function onSubnational2Keydown(event) {
  if (!subnational2Suggestions.value.length) {
    if (event.key === 'Escape') {
      activeSubnational2Index.value = -1
    }
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeSubnational2Index.value =
      activeSubnational2Index.value < 0 ? 0 : (activeSubnational2Index.value + 1) % subnational2Suggestions.value.length
    return
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeSubnational2Index.value =
      activeSubnational2Index.value < 0
        ? subnational2Suggestions.value.length - 1
        : (activeSubnational2Index.value - 1 + subnational2Suggestions.value.length) % subnational2Suggestions.value.length
    return
  }
  if (event.key === 'Enter' && activeSubnational2Index.value >= 0) {
    event.preventDefault()
    selectSubnational2(subnational2Suggestions.value[activeSubnational2Index.value])
    return
  }
  if (event.key === 'Escape') {
    activeSubnational2Index.value = -1
  }
}

async function initializeRegionPicker() {
  resetRegionSelectionState()
  regionError.value = ''
  await loadCountries()
  const regionCodeFromUrl = readRegionCodeFromUrl()
  if (regionCodeFromUrl) {
    await restoreRegionSelectionFromCode(regionCodeFromUrl)
  }
}

async function loadCountries() {
  if (!tokenPresent.value || countriesLoaded.value || countriesLoading.value) {
    return
  }

  countriesLoading.value = true
  try {
    const result = await props.ebirdGet('/ref/region/list/country/world')
    countries.value = normalizeRegionList(result)
    countriesLoaded.value = true
  } catch (error) {
    countries.value = []
    countriesLoaded.value = false
    regionError.value = normalizeErrorMessage(error) || 'Failed to load countries.'
  } finally {
    countriesLoading.value = false
  }
}

async function ensureSubnational1Loaded(countryCode) {
  if (!tokenPresent.value) {
    return
  }

  const normalizedCountryCode = asRegionCode(countryCode)
  if (!normalizedCountryCode || subnational1LoadedFor.value === normalizedCountryCode) {
    return
  }

  const requestId = subnational1RequestId + 1
  subnational1RequestId = requestId
  subnational1Loading.value = true

  try {
    const result = await props.ebirdGet(`/ref/region/list/subnational1/${encodeURIComponent(normalizedCountryCode)}`)
    if (requestId !== subnational1RequestId) {
      return
    }
    subnational1Options.value = normalizeRegionList(result)
    subnational1LoadedFor.value = normalizedCountryCode
  } catch (error) {
    if (requestId !== subnational1RequestId) {
      return
    }
    subnational1Options.value = []
    subnational1LoadedFor.value = ''
    regionError.value = normalizeErrorMessage(error) || 'Failed to load regions.'
  } finally {
    if (requestId === subnational1RequestId) {
      subnational1Loading.value = false
    }
  }
}

async function ensureSubnational2Loaded(subnational1Code) {
  if (!tokenPresent.value) {
    return
  }

  const normalizedSubnational1Code = asRegionCode(subnational1Code)
  if (!normalizedSubnational1Code || subnational2LoadedFor.value === normalizedSubnational1Code) {
    return
  }

  const requestId = subnational2RequestId + 1
  subnational2RequestId = requestId
  subnational2Loading.value = true

  try {
    const result = await props.ebirdGet(`/ref/region/list/subnational2/${encodeURIComponent(normalizedSubnational1Code)}`)
    if (requestId !== subnational2RequestId) {
      return
    }
    subnational2Options.value = normalizeRegionList(result)
    subnational2LoadedFor.value = normalizedSubnational1Code
  } catch (error) {
    if (requestId !== subnational2RequestId) {
      return
    }
    subnational2Options.value = []
    subnational2LoadedFor.value = ''
    regionError.value = normalizeErrorMessage(error) || 'Failed to load subregions.'
  } finally {
    if (requestId === subnational2RequestId) {
      subnational2Loading.value = false
    }
  }
}

async function countryQueryInput() {
  selectedCountry.value = null
  clearSubnational1Selection()
  clearSubnational2Selection()
  regionError.value = ''
  writeRegionCodeToUrl('')

  if (!form.countryQuery.trim()) {
    countrySuggestions.value = []
    return
  }

  await loadCountries()
  countrySuggestions.value = filterRegionList(countries.value, form.countryQuery)
}

async function subnational1QueryInput() {
  if (!selectedCountry.value) {
    subnational1Suggestions.value = []
    return
  }

  selectedSubnational1.value = null
  clearSubnational2Selection()
  regionError.value = ''
  writeRegionCodeToUrl(selectedCountry.value.code)

  await ensureSubnational1Loaded(selectedCountry.value.code)
  if (!form.subnational1Query.trim()) {
    subnational1Suggestions.value = topRegionList(subnational1Options.value)
    return
  }

  subnational1Suggestions.value = filterRegionList(subnational1Options.value, form.subnational1Query)
}

async function subnational2QueryInput() {
  if (!selectedSubnational1.value) {
    subnational2Suggestions.value = []
    return
  }

  selectedSubnational2.value = null
  regionError.value = ''
  writeRegionCodeToUrl(selectedSubnational1.value.code)

  await ensureSubnational2Loaded(selectedSubnational1.value.code)
  if (!form.subnational2Query.trim()) {
    subnational2Suggestions.value = topRegionList(subnational2Options.value)
    return
  }

  subnational2Suggestions.value = filterRegionList(subnational2Options.value, form.subnational2Query)
}

function selectCountry(region) {
  selectedCountry.value = region
  form.countryQuery = region.name
  countrySuggestions.value = []
  clearSubnational1Selection()
  clearSubnational2Selection()
  regionError.value = ''
  writeRegionCodeToUrl(region.code)
  void ensureSubnational1Loaded(region.code)
}

function selectSubnational1(region) {
  selectedSubnational1.value = region
  form.subnational1Query = region.name
  subnational1Suggestions.value = []
  clearSubnational2Selection()
  regionError.value = ''
  writeRegionCodeToUrl(region.code)
  void ensureSubnational2Loaded(region.code)
}

function selectSubnational2(region) {
  selectedSubnational2.value = region
  form.subnational2Query = region.name
  subnational2Suggestions.value = []
  regionError.value = ''
  writeRegionCodeToUrl(region.code)
}

function clearSubnational1Selection() {
  selectedSubnational1.value = null
  form.subnational1Query = ''
  subnational1Suggestions.value = []
  subnational1Options.value = []
  subnational1LoadedFor.value = ''
}

function clearSubnational2Selection() {
  selectedSubnational2.value = null
  form.subnational2Query = ''
  subnational2Suggestions.value = []
  subnational2Options.value = []
  subnational2LoadedFor.value = ''
}

function resetRegionSelectionState() {
  selectedCountry.value = null
  form.countryQuery = ''
  countrySuggestions.value = []
  clearSubnational1Selection()
  clearSubnational2Selection()
}

function clearCountrySuggestions() {
  setTimeout(() => {
    countrySuggestions.value = []
  }, 150)
}

function clearSubnational1Suggestions() {
  setTimeout(() => {
    subnational1Suggestions.value = []
  }, 150)
}

function clearSubnational2Suggestions() {
  setTimeout(() => {
    subnational2Suggestions.value = []
  }, 150)
}

async function subnational1QueryFocus() {
  if (!selectedCountry.value) {
    subnational1Suggestions.value = []
    return
  }
  await ensureSubnational1Loaded(selectedCountry.value.code)
  if (!form.subnational1Query.trim()) {
    subnational1Suggestions.value = topRegionList(subnational1Options.value)
  } else {
    subnational1Suggestions.value = filterRegionList(subnational1Options.value, form.subnational1Query)
  }
}

async function subnational2QueryFocus() {
  if (!selectedSubnational1.value) {
    subnational2Suggestions.value = []
    return
  }
  await ensureSubnational2Loaded(selectedSubnational1.value.code)
  if (!form.subnational2Query.trim()) {
    subnational2Suggestions.value = topRegionList(subnational2Options.value)
  } else {
    subnational2Suggestions.value = filterRegionList(subnational2Options.value, form.subnational2Query)
  }
}

async function restoreRegionSelectionFromCode(rawCode) {
  const code = asRegionCode(rawCode)
  if (!code) {
    return
  }

  const parts = code.split('-')
  const countryCode = parts[0]
  const country = countries.value.find((item) => item.code === countryCode)
  if (!country) {
    return
  }

  selectedCountry.value = country
  form.countryQuery = country.name

  if (parts.length < 2) {
    return
  }

  await ensureSubnational1Loaded(country.code)
  const subnational1Code = parts.slice(0, 2).join('-')
  const subnational1 = subnational1Options.value.find((item) => item.code === subnational1Code)
  if (!subnational1) {
    return
  }

  selectedSubnational1.value = subnational1
  form.subnational1Query = subnational1.name

  if (parts.length < 3) {
    return
  }

  await ensureSubnational2Loaded(subnational1.code)
  const subnational2 = subnational2Options.value.find((item) => item.code === code)
  if (!subnational2) {
    return
  }

  selectedSubnational2.value = subnational2
  form.subnational2Query = subnational2.name
}

function onFetchHotspots() {
  emit('fetch-hotspots')
}

function shouldShowEmptyState({ focused, query, loading, suggestions, selectedName }) {
  if (!focused) {
    return false
  }

  const normalizedQuery = normalizeText(query)
  if (!normalizedQuery || loading || suggestions.length) {
    return false
  }

  if (normalizeText(selectedName) === normalizedQuery) {
    return false
  }

  return true
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase()
}

function normalizeRegionList(items) {
  return (items || [])
    .map((item) => ({
      code: asRegionCode(item.code || ''),
      name: String(item.name || '').trim(),
    }))
    .filter((item) => item.code && item.name)
}

function filterRegionList(items, query) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return []
  }

  return items.filter(
    (item) => item.name.toLowerCase().includes(normalizedQuery) || item.code.toLowerCase().includes(normalizedQuery),
  )
}

function topRegionList(items) {
  return items || []
}

function readRegionCodeFromUrl() {
  const params = new URLSearchParams(window.location.search)
  return asRegionCode(params.get(URL_REGION_KEY) || '')
}

function writeRegionCodeToUrl(code) {
  const url = new URL(window.location.href)
  const normalizedCode = asRegionCode(code)
  if (normalizedCode) {
    url.searchParams.set(URL_REGION_KEY, normalizedCode)
  } else {
    url.searchParams.delete(URL_REGION_KEY)
  }

  const nextUrl = `${url.pathname}${url.search}${url.hash}`
  window.history.replaceState({}, '', nextUrl)
}

function asRegionCode(value) {
  const normalized = String(value || '').trim().toUpperCase()
  return REGION_CODE_PATTERN.test(normalized) ? normalized : ''
}

function normalizeErrorMessage(error) {
  if (!error) {
    return ''
  }
  if (typeof error === 'string') {
    return error
  }
  return error?.message || String(error)
}
</script>

<template>
  <div class="list-controls">
    <div class="panel-header">
      <h1 class="panel-title">eBird Hotspot Deduper</h1>
      <p class="panel-subtitle">Pick your region and scan for likely duplicate hotspots.</p>
    </div>

    <div class="region-field position-relative">
      <label class="region-field-label">Country</label>
      <div class="region-input-wrap">
        <input
          :value="form.countryQuery"
          type="text"
          class="form-control form-control-lg region-input has-trailing-control"
          placeholder="Type to search countries"
          :disabled="!tokenPresent"
          role="combobox"
          aria-autocomplete="list"
          :aria-expanded="Boolean(countrySuggestions.length)"
          :aria-controls="countryListId"
          :aria-activedescendant="activeCountryIndex >= 0 ? countryOptionId(activeCountryIndex) : undefined"
          @input="onCountryInput"
          @focus="onCountryFocus"
          @blur="onCountryBlur"
          @keydown="onCountryKeydown"
        >
        <button
          v-if="form.countryQuery && !countriesLoading"
          type="button"
          class="clear-input-btn"
          aria-label="Clear country input"
          @mousedown.prevent="clearCountryInput"
        >
          <span class="clear-input-glyph" aria-hidden="true">×</span>
        </button>
        <div v-if="countriesLoading" class="input-spinner-wrap">
          <div class="spinner-border spinner-border-sm text-secondary" role="status" aria-hidden="true" />
        </div>
      </div>
      <div v-if="countrySuggestions.length" :id="countryListId" class="suggestions" role="listbox">
        <button
          v-for="(item, index) in countrySuggestions"
          :key="item.code"
          :id="countryOptionId(index)"
          type="button"
          class="suggestion-item"
          :class="{ active: activeCountryIndex === index }"
          role="option"
          :aria-selected="activeCountryIndex === index"
          @mouseenter="activeCountryIndex = index"
          @mousedown.prevent="selectCountry(item)"
        >
          <span class="suggestion-main">
            <span class="suggestion-name">{{ item.name }}</span>
          </span>
          <span class="suggestion-code">{{ item.code }}</span>
        </button>
      </div>
      <div v-if="showCountryEmpty" class="suggestions suggestions-empty" role="status">
        No countries found.
      </div>
    </div>

    <div v-if="showSubnational1Input" class="region-field position-relative mt-2">
      <label class="region-field-label">Region / State / Province (optional)</label>
      <div class="region-input-wrap">
        <input
          :value="form.subnational1Query"
          type="text"
          class="form-control region-input has-trailing-control"
          placeholder="Type to search level 2 region"
          :disabled="!tokenPresent || !selectedCountry"
          role="combobox"
          aria-autocomplete="list"
          :aria-expanded="Boolean(subnational1Suggestions.length)"
          :aria-controls="subnational1ListId"
          :aria-activedescendant="activeSubnational1Index >= 0 ? subnational1OptionId(activeSubnational1Index) : undefined"
          @input="onSubnational1Input"
          @focus="onSubnational1Focus"
          @blur="onSubnational1Blur"
          @keydown="onSubnational1Keydown"
        >
        <button
          v-if="form.subnational1Query && !subnational1Loading"
          type="button"
          class="clear-input-btn"
          aria-label="Clear region input"
          @mousedown.prevent="clearSubnational1Input"
        >
          <span class="clear-input-glyph" aria-hidden="true">×</span>
        </button>
        <div v-if="subnational1Loading" class="input-spinner-wrap">
          <div class="spinner-border spinner-border-sm text-secondary" role="status" aria-hidden="true" />
        </div>
      </div>
      <div v-if="subnational1Suggestions.length" :id="subnational1ListId" class="suggestions" role="listbox">
        <button
          v-for="(item, index) in subnational1Suggestions"
          :key="item.code"
          :id="subnational1OptionId(index)"
          type="button"
          class="suggestion-item"
          :class="{ active: activeSubnational1Index === index }"
          role="option"
          :aria-selected="activeSubnational1Index === index"
          @mouseenter="activeSubnational1Index = index"
          @mousedown.prevent="selectSubnational1(item)"
        >
          <span class="suggestion-main">
            <span class="suggestion-name">{{ item.name }}</span>
          </span>
          <span class="suggestion-code">{{ item.code }}</span>
        </button>
      </div>
      <div v-if="showSubnational1Empty" class="suggestions suggestions-empty" role="status">
        No regions found.
      </div>
    </div>

    <div v-if="showSubnational2Input" class="region-field position-relative mt-2">
      <label class="region-field-label">Subregion / County / District (optional)</label>
      <div class="region-input-wrap">
        <input
          :value="form.subnational2Query"
          type="text"
          class="form-control region-input has-trailing-control"
          placeholder="Type to search level 3 subregion"
          :disabled="!tokenPresent || !selectedSubnational1"
          role="combobox"
          aria-autocomplete="list"
          :aria-expanded="Boolean(subnational2Suggestions.length)"
          :aria-controls="subnational2ListId"
          :aria-activedescendant="activeSubnational2Index >= 0 ? subnational2OptionId(activeSubnational2Index) : undefined"
          @input="onSubnational2Input"
          @focus="onSubnational2Focus"
          @blur="onSubnational2Blur"
          @keydown="onSubnational2Keydown"
        >
        <button
          v-if="form.subnational2Query && !subnational2Loading"
          type="button"
          class="clear-input-btn"
          aria-label="Clear subregion input"
          @mousedown.prevent="clearSubnational2Input"
        >
          <span class="clear-input-glyph" aria-hidden="true">×</span>
        </button>
        <div v-if="subnational2Loading" class="input-spinner-wrap">
          <div class="spinner-border spinner-border-sm text-secondary" role="status" aria-hidden="true" />
        </div>
      </div>
      <div v-if="subnational2Suggestions.length" :id="subnational2ListId" class="suggestions" role="listbox">
        <button
          v-for="(item, index) in subnational2Suggestions"
          :key="item.code"
          :id="subnational2OptionId(index)"
          type="button"
          class="suggestion-item"
          :class="{ active: activeSubnational2Index === index }"
          role="option"
          :aria-selected="activeSubnational2Index === index"
          @mouseenter="activeSubnational2Index = index"
          @mousedown.prevent="selectSubnational2(item)"
        >
          <span class="suggestion-main">
            <span class="suggestion-name">{{ item.name }}</span>
          </span>
          <span class="suggestion-code">{{ item.code }}</span>
        </button>
      </div>
      <div v-if="showSubnational2Empty" class="suggestions suggestions-empty" role="status">
        No subregions found.
      </div>
    </div>

    <div class="region-actions mt-2">
      <button
        type="button"
        class="btn btn-primary btn-sm search-cta"
        :disabled="!canFetch || isLoading"
        @click="onFetchHotspots"
      >
        <span
          v-if="isLoading"
          class="spinner-border spinner-border-sm me-1"
          role="status"
          aria-hidden="true"
        />
        <i v-else class="bi bi-binoculars-fill me-1" aria-hidden="true" />
        Scan Duplicates
      </button>
    </div>

    <div class="controls-status mt-2">
      <span v-if="regionLookupBusy" class="small text-muted">
        <span class="spinner-border spinner-border-sm align-text-bottom me-1" role="status" aria-hidden="true" />
        loading region lists...
      </span>
    </div>
    <div v-if="fetchErrorText" class="small text-danger mt-1">{{ fetchErrorText }}</div>
  </div>
</template>

<style scoped>
.list-controls {
  padding: 0.95rem 0.9rem 0.72rem;
  border-bottom: 1px solid var(--brand-border);
  background:
    radial-gradient(circle at 2% 0%, rgba(var(--brand-primary-rgb), 0.12) 0%, transparent 38%),
    linear-gradient(180deg, #ffffff 0%, color-mix(in srgb, var(--brand-surface) 78%, #ffffff 22%) 100%);
  position: relative;
  z-index: 1200;
  overflow: visible;
}

.panel-header {
  margin-bottom: 0.62rem;
}

.panel-title {
  margin: 0;
  font-size: 1.22rem;
  font-weight: 700;
  color: var(--brand-primary-dark);
  letter-spacing: 0.01em;
}

.panel-subtitle {
  margin: 0.2rem 0 0;
  color: var(--brand-muted);
  font-size: 0.84rem;
  line-height: 1.28;
}

.region-input {
  border-color: color-mix(in srgb, var(--brand-border) 72%, #ffffff 28%);
  background: #ffffff;
  border-radius: 0.76rem;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

.region-input:focus {
  border-color: rgba(var(--brand-primary-rgb), 0.52);
  box-shadow: 0 0 0 0.18rem rgba(var(--brand-primary-rgb), 0.2);
}

.has-trailing-control {
  padding-right: 2.1rem;
}

.region-input-wrap {
  position: relative;
}

.region-field-label {
  display: block;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--brand-muted);
  margin: 0 0 0.34rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.region-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
}

.region-actions .btn {
  flex: 0 0 auto;
}

.search-cta {
  min-width: min(100%, 16rem);
  border-radius: 999px;
  font-weight: 700;
  letter-spacing: 0.01em;
  padding-inline: 1rem;
  box-shadow: 0 8px 18px rgba(var(--brand-primary-rgb), 0.28);
}

.controls-status {
  min-height: 1.2rem;
  color: var(--brand-muted);
}

.suggestions {
  position: absolute;
  inset: calc(100% + 4px) 0 auto 0;
  z-index: 2200;
  background: #ffffff;
  border: 1px solid color-mix(in srgb, var(--brand-border) 84%, #ffffff 16%);
  border-radius: 0.84rem;
  box-shadow: 0 16px 34px rgba(14, 36, 54, 0.16);
  overflow: visible;
}

.input-spinner-wrap {
  position: absolute;
  right: 0.66rem;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
}

.clear-input-btn {
  position: absolute;
  right: 0.52rem;
  top: 50%;
  transform: translateY(-50%);
  width: 1.45rem;
  height: 1.45rem;
  border: 1px solid color-mix(in srgb, var(--brand-border) 82%, #ffffff 18%);
  border-radius: 999px;
  background: color-mix(in srgb, var(--brand-surface) 62%, #ffffff 38%);
  color: var(--brand-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.62rem;
  line-height: 1;
  padding: 0;
  z-index: 12;
}

.clear-input-btn:hover {
  background: rgba(var(--brand-primary-rgb), 0.14);
  border-color: rgba(var(--brand-primary-rgb), 0.35);
  color: var(--brand-primary-dark);
}

.clear-input-glyph {
  display: block;
  font-size: 0.92rem;
  font-weight: 400;
  line-height: 1;
  transform: translateY(-0.04rem);
}

.suggestion-item {
  width: 100%;
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--brand-border) 45%, #ffffff 55%);
  background: #ffffff;
  padding: 0.62rem 0.78rem;
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
  background: color-mix(in srgb, rgba(var(--brand-primary-rgb), 0.16) 100%, #ffffff 0%);
}

.suggestion-item.active {
  background: color-mix(in srgb, rgba(var(--brand-primary-rgb), 0.2) 100%, #ffffff 0%);
}

.suggestion-main {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
}

.suggestion-name {
  font-size: 0.92rem;
  color: var(--brand-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.suggestion-code {
  font-size: 0.75rem;
  color: var(--brand-primary-dark);
  background: rgba(var(--brand-primary-rgb), 0.12);
  border: 1px solid rgba(var(--brand-primary-rgb), 0.2);
  border-radius: 999px;
  padding: 0.13rem 0.42rem;
  white-space: nowrap;
}

.suggestions-empty {
  padding: 0.62rem 0.75rem;
  color: var(--brand-muted);
  font-size: 0.85rem;
  background: color-mix(in srgb, var(--brand-surface) 72%, #ffffff 28%);
}

.text-danger {
  color: #bb2748 !important;
}

@media (max-width: 520px) {
  .list-controls {
    padding: 0.78rem 0.7rem 0.65rem;
  }

  .region-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .panel-title {
    font-size: 1.12rem;
  }
}
</style>
