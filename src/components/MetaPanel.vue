<template>
  <div class="meta-panel">
    <div class="meta-section">
      <h2>剧本信息</h2>
      <div class="field">
        <label>剧本标题</label>
        <input v-model="sp.title" placeholder="请输入剧本标题" @input="$emit('update')" />
      </div>
      <div class="field">
        <label>故事大纲</label>
        <textarea v-model="sp.outline" rows="5" placeholder="请输入故事大纲，简要介绍故事背景和主线……" @input="$emit('update')"></textarea>
      </div>
    </div>

    <div class="meta-section">
      <div class="section-header">
        <h2>人物小传</h2>
        <button class="btn-add" @click="addCharacter">+ 添加角色</button>
      </div>
      <div class="char-list">
        <div v-for="(c, i) in sp.characters" :key="c.id" class="char-card">
          <div class="char-row">
            <input v-model="c.name" placeholder="角色名" class="input-name" @input="$emit('update')" />
            <select v-model="c.role" @change="$emit('update')">
              <option value="男主">男主</option>
              <option value="女主">女主</option>
              <option value="男配">男配</option>
              <option value="女配">女配</option>
              <option value="角色">角色</option>
              <option value="龙套">龙套</option>
            </select>
            <select v-model="c.gender" @change="$emit('update')">
              <option value="男">男</option>
              <option value="女">女</option>
            </select>
            <input v-model="c.age" placeholder="年龄" class="input-age" @input="$emit('update')" />
            <button class="btn-del" @click="removeCharacter(i)">✕</button>
          </div>
          <textarea v-model="c.desc" rows="2" placeholder="角色描述……" class="char-desc" @input="$emit('update')"></textarea>
        </div>
        <div v-if="sp.characters.length===0" class="empty">暂无角色，点击上方按钮添加</div>
      </div>
    </div>

    <div class="meta-section">
      <div class="section-header">
        <h2>集数管理</h2>
        <span class="hint">共 {{ sp.episodes.length }} 集 · 分卡：一卡(前3集) / 二卡(前10集) / 三卡(前30集)</span>
      </div>
      <div class="ep-grid">
        <div v-for="(ep, i) in sp.episodes" :key="ep.id" class="ep-chip" :class="{ 'card-break': isCard(ep.num) }">
          <span class="ep-num">{{ ep.title }}</span>
          <span class="ep-scenes">{{ ep.scenes.length }}场</span>
          <span v-if="getCardLabel(ep.num)" class="card-tag">{{ getCardLabel(ep.num) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { createCharacter, isCardBreak, getCardForEpisode } from '../model.js'
export default {
  props: { sp: Object },
  emits: ['update'],
  setup(props, { emit }) {
    function addCharacter() {
      props.sp.characters.push(createCharacter())
      emit('update')
    }
    function removeCharacter(i) {
      props.sp.characters.splice(i, 1)
      emit('update')
    }
    function isCard(n) { return isCardBreak(n) }
    function getCardLabel(n) {
      const c = getCardForEpisode(n)
      return c && c.upTo === n ? c.name : ''
    }
    return { addCharacter, removeCharacter, isCard, getCardLabel }
  }
}
</script>

<style scoped>
.meta-panel{max-width:800px;margin:0 auto;padding:32px 24px;overflow-y:auto;height:100%}
.meta-section{margin-bottom:32px}
.meta-section h2{font-size:16px;font-weight:600;margin-bottom:12px;color:var(--text-primary)}
.section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.section-header h2{margin-bottom:0}
.hint{font-size:11px;color:var(--text-muted)}
.field{margin-bottom:16px}
.field label{display:block;font-size:12px;color:var(--text-secondary);margin-bottom:4px}
.field input,.field textarea{width:100%;padding:8px 12px;font-size:14px;line-height:1.6}
.field textarea{resize:vertical}
.btn-add{padding:5px 14px;font-size:12px;background:var(--accent);color:#fff;border-radius:var(--radius)}
.btn-add:hover{background:#6a4bd6}
.char-list{display:flex;flex-direction:column;gap:10px}
.char-card{background:var(--bg-card);border:1px solid var(--bg-hover);border-radius:var(--radius);padding:10px 12px}
.char-row{display:flex;gap:6px;align-items:center;margin-bottom:6px}
.char-row input,.char-row select{padding:4px 8px;font-size:13px}
.input-name{flex:1;min-width:80px}
.input-age{width:60px}
.char-row select{width:64px}
.btn-del{padding:2px 8px;background:transparent;color:var(--text-muted);font-size:14px;border-radius:var(--radius)}
.btn-del:hover{background:rgba(233,69,96,0.15);color:var(--accent2)}
.char-desc{width:100%;padding:6px 8px;font-size:13px;resize:vertical}
.empty{font-size:13px;color:var(--text-muted);padding:12px}
.ep-grid{display:flex;flex-wrap:wrap;gap:8px}
.ep-chip{display:flex;align-items:center;gap:6px;padding:6px 12px;background:var(--bg-card);border:1px solid var(--bg-hover);border-radius:var(--radius);font-size:12px}
.ep-chip.card-break{border-color:var(--color-card)}
.ep-num{font-weight:600;color:var(--text-primary)}
.ep-scenes{color:var(--text-muted)}
.card-tag{padding:1px 6px;font-size:10px;background:var(--color-card);color:#fff;border-radius:3px}
</style>
