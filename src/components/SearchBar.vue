<template>
  <div class="search-bar" v-if="visible">
    <div class="search-row">
      <input
        ref="searchInput"
        v-model="query"
        placeholder="搜索..."
        class="search-input"
        @input="doSearch"
        @keydown.enter.prevent="nextMatch"
        @keydown.escape="close"
      />
      <span class="match-count" v-if="query">{{ matchIndex + 1 }}/{{ matches.length }}</span>
      <button class="s-btn" @click="prevMatch" title="上一个">▲</button>
      <button class="s-btn" @click="nextMatch" title="下一个">▼</button>
      <button class="s-btn" @click="showReplace=!showReplace" title="替换">⇄</button>
      <button class="s-btn close-btn" @click="close">✕</button>
    </div>
    <div class="replace-row" v-if="showReplace">
      <input
        v-model="replacement"
        placeholder="替换为..."
        class="search-input"
        @keydown.enter.prevent="replaceOne"
        @keydown.escape="close"
      />
      <button class="s-btn" @click="replaceOne">替换</button>
      <button class="s-btn" @click="replaceAll">全部替换</button>
    </div>
  </div>
</template>

<script>
import { ref, nextTick, watch } from 'vue'
export default {
  props: { visible: Boolean, sp: Object },
  emits: ['close', 'navigate', 'update'],
  setup(props, { emit }) {
    const query = ref('')
    const replacement = ref('')
    const showReplace = ref(false)
    const matches = ref([])
    const matchIndex = ref(0)
    const searchInput = ref(null)

    watch(() => props.visible, (v) => {
      if (v) nextTick(() => searchInput.value?.focus())
    })

    function doSearch() {
      matches.value = []
      matchIndex.value = 0
      if (!query.value || !props.sp) return
      const q = query.value.toLowerCase()
      props.sp.episodes.forEach((ep, ei) => {
        ep.scenes.forEach((sc, si) => {
          sc.blocks.forEach((b, bi) => {
            const content = (b.content || '').toLowerCase()
            if (content.includes(q)) {
              matches.value.push({ ei, si, bi, sceneId: sc.id, blockId: b.id })
            }
          })
        })
      })
    }

    function navigateTo(idx) {
      if (matches.value.length === 0) return
      matchIndex.value = idx
      const m = matches.value[idx]
      emit('navigate', m.sceneId)
    }

    function nextMatch() {
      if (matches.value.length === 0) { doSearch(); return }
      const next = (matchIndex.value + 1) % matches.value.length
      navigateTo(next)
    }

    function prevMatch() {
      if (matches.value.length === 0) return
      const prev = (matchIndex.value - 1 + matches.value.length) % matches.value.length
      navigateTo(prev)
    }

    function replaceOne() {
      if (matches.value.length === 0 || !query.value) return
      const m = matches.value[matchIndex.value]
      const block = props.sp.episodes[m.ei].scenes[m.si].blocks[m.bi]
      block.content = block.content.replace(new RegExp(escapeRegex(query.value), 'i'), replacement.value)
      emit('update')
      doSearch()
    }

    function replaceAll() {
      if (!query.value) return
      let count = 0
      const regex = new RegExp(escapeRegex(query.value), 'gi')
      props.sp.episodes.forEach(ep => {
        ep.scenes.forEach(sc => {
          sc.blocks.forEach(b => {
            if (b.content && regex.test(b.content)) {
              b.content = b.content.replace(regex, replacement.value)
              count++
            }
            regex.lastIndex = 0
          })
        })
      })
      emit('update')
      doSearch()
      if (count > 0) alert(`已替换 ${count} 处`)
    }

    function escapeRegex(s) {
      return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }

    function close() {
      query.value = ''
      replacement.value = ''
      matches.value = []
      showReplace.value = false
      emit('close')
    }

    return { query, replacement, showReplace, matches, matchIndex, searchInput, doSearch, nextMatch, prevMatch, replaceOne, replaceAll, close }
  }
}
</script>

<style scoped>
.search-bar{position:fixed;top:52px;right:16px;z-index:150;background:var(--bg-card);border:1px solid var(--bg-hover);border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,0.3);padding:8px 10px;min-width:340px}
.search-row,.replace-row{display:flex;align-items:center;gap:4px}
.replace-row{margin-top:6px}
.search-input{flex:1;padding:6px 10px;font-size:13px;background:var(--bg-editor);border:1px solid var(--bg-hover);border-radius:4px;color:var(--text-primary)}
.search-input:focus{border-color:var(--accent);outline:none}
.match-count{font-size:11px;color:var(--text-muted);min-width:40px;text-align:center}
.s-btn{padding:4px 8px;font-size:11px;background:transparent;color:var(--text-secondary);border-radius:3px}
.s-btn:hover{background:var(--bg-hover);color:var(--text-primary)}
.close-btn:hover{color:var(--accent2)}
</style>
