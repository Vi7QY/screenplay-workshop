<template>
  <div class="nav-panel">
    <div class="nav-title">场景导航</div>
    <div v-for="(ep, ei) in episodes" :key="ep.id" class="ep-group">
      <div class="ep-header">
        <span class="ep-label" @click="$emit('select', ep.scenes[0]?.id)">{{ ep.title }}{{ ep.chapterRef ? '-'+ep.chapterRef : '' }}</span>
        <div class="ep-actions">
          <button class="nav-btn" title="添加场次" @click="$emit('add-scene', ei)">+场</button>
          <button class="nav-btn del" title="删除本集" @click="$emit('remove-ep', ei)">✕</button>
        </div>
      </div>
      <div v-for="sc in ep.scenes" :key="sc.id" class="sc-item" :class="{active: sc.id===activeSceneId}" @click="$emit('select', sc.id)">
        <span class="sc-dot"></span>
        <span class="sc-label">{{ sc.label }} {{ sc.location || '' }}</span>
      </div>
      <div v-if="isCardBreak(ep.num)" class="card-divider">{{ getCardLabel(ep.num) }}</div>
    </div>
  </div>
</template>

<script>
import { isCardBreak, getCardForEpisode } from '../model.js'
export default {
  props: { episodes: Array, activeSceneId: String },
  emits: ['select', 'add-scene', 'remove-ep'],
  setup() {
    function getCardLabel(n) {
      const c = getCardForEpisode(n)
      return c ? c.label : ''
    }
    return { isCardBreak, getCardLabel }
  }
}
</script>

<style scoped>
.nav-panel{padding:12px 0}
.nav-title{padding:0 14px 8px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted)}
.ep-group{margin-bottom:4px}
.ep-header{display:flex;align-items:center;justify-content:space-between;padding:6px 14px;cursor:pointer}
.ep-label{font-size:13px;font-weight:600;color:var(--text-primary)}
.ep-label:hover{color:var(--accent)}
.ep-actions{display:flex;gap:2px;opacity:0;transition:opacity var(--tr)}
.ep-header:hover .ep-actions{opacity:1}
.nav-btn{padding:2px 6px;font-size:11px;background:transparent;color:var(--text-muted);border-radius:3px}
.nav-btn:hover{background:var(--bg-hover);color:var(--text-primary)}
.nav-btn.del:hover{color:var(--accent2)}
.sc-item{display:flex;align-items:center;gap:8px;padding:4px 14px 4px 24px;cursor:pointer;font-size:12px;color:var(--text-secondary);border-radius:0;transition:all var(--tr)}
.sc-item:hover{background:var(--bg-hover);color:var(--text-primary)}
.sc-item.active{background:rgba(124,92,231,0.12);color:var(--accent)}
.sc-dot{width:6px;height:6px;border-radius:50%;background:var(--color-scene);flex-shrink:0}
.sc-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.card-divider{margin:6px 14px;padding:4px 0;text-align:center;font-size:11px;color:var(--color-card);border-top:1px dashed var(--color-card);border-bottom:1px dashed var(--color-card)}
</style>
