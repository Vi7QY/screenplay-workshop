<template>
  <div class="meta-panel">
    <div class="meta-topbar">
      <h2>剧本信息</h2>
      <button class="btn-save" @click="$emit('save')">💾 保存</button>
    </div>
    <div class="meta-section">
      <div class="field">
        <label>剧本标题</label>
        <input v-model="sp.title" placeholder="请输入剧本标题" @input="onTitleChange" />
      </div>
      <div class="field">
        <label>故事梗概</label>
        <textarea v-model="sp.outline" rows="6" placeholder="请输入故事梗概，简要介绍故事背景和主线……" @input="$emit('update')"></textarea>
      </div>
      <div class="field-row">
        <div class="field field-auto">
          <label>作品类型</label>
          <div class="radio-group">
            <label class="radio-label" :class="{active: ipType==='original'}">
              <input type="radio" v-model="ipType" value="original" @change="onIpTypeChange" /> 原创
            </label>
            <label class="radio-label" :class="{active: ipType==='adaptation'}">
              <input type="radio" v-model="ipType" value="adaptation" @change="onIpTypeChange" /> IP改编
            </label>
          </div>
        </div>
        <div class="field field-grow" v-if="ipType==='adaptation'">
          <label>原IP作品名称</label>
          <input v-model="ipName" placeholder="如：盗墓笔记" @input="onIpNameChange" />
        </div>
      </div>
      <div class="field field-ep">
        <label>总集数</label>
        <div class="ep-count-row">
          <input type="number" v-model.number="totalEpisodes" min="1" max="200" class="ep-count-input" @change="onEpCountChange" />
          <span class="ep-count-suffix">集</span>
        </div>
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
  </div>
</template>

<script>
import { ref, watch } from 'vue'
import { createCharacter } from '../model.js'
export default {
  props: { sp: Object, project: Object },
  emits: ['update', 'update-project', 'ep-count-change', 'save'],
  setup(props, { emit }) {
    const ipType = ref(props.project?.ipType || 'original')
    const ipName = ref(props.project?.ipName || '')
    const totalEpisodes = ref(props.project?.totalEpisodes || props.sp.episodes.length || 1)

    // 同步project变化
    watch(() => props.project, (p) => {
      if (p) {
        ipType.value = p.ipType || 'original'
        ipName.value = p.ipName || ''
        totalEpisodes.value = p.totalEpisodes || props.sp.episodes.length || 1
      }
    }, { deep: true })

    function onTitleChange() {
      emit('update')
      emit('update-project', { name: props.sp.title })
    }
    function onIpTypeChange() {
      emit('update-project', { ipType: ipType.value })
      if (ipType.value === 'original') {
        ipName.value = ''
        emit('update-project', { ipName: '' })
      }
    }
    function onIpNameChange() {
      emit('update-project', { ipName: ipName.value })
    }
    function onEpCountChange() {
      const n = Math.max(1, Math.min(200, totalEpisodes.value || 1))
      totalEpisodes.value = n
      emit('ep-count-change', n)
      emit('update-project', { totalEpisodes: n })
    }
    function addCharacter() {
      props.sp.characters.push(createCharacter())
      emit('update')
    }
    function removeCharacter(i) {
      props.sp.characters.splice(i, 1)
      emit('update')
    }
    return { ipType, ipName, totalEpisodes, onTitleChange, onIpTypeChange, onIpNameChange, onEpCountChange, addCharacter, removeCharacter }
  }
}
</script>

<style scoped>
.meta-panel{width:100%;max-width:100%;margin:0;padding:40px 48px 40px 48px;overflow-y:auto;height:100%;box-sizing:border-box}
.meta-topbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}
.meta-topbar h2{font-size:18px;font-weight:700;color:var(--text-primary);margin:0}
.btn-save{padding:8px 20px;font-size:13px;font-weight:600;background:var(--accent);color:#fff;border-radius:var(--radius)}
.btn-save:hover{background:#6a4bd6}
.meta-section{margin-bottom:32px;width:100%}
.meta-section h2{font-size:16px;font-weight:600;margin-bottom:12px;color:var(--text-primary)}
.section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.section-header h2{margin-bottom:0}
.field{margin-bottom:16px;width:100%}
.field label{display:block;font-size:12px;color:var(--text-secondary);margin-bottom:4px}
.field input,.field textarea{width:100%;padding:10px 14px;font-size:14px;line-height:1.6;box-sizing:border-box}
.field textarea{resize:vertical;min-height:120px}
.field-row{display:flex;gap:20px;align-items:flex-start;width:auto;max-width:600px}
.field-auto{flex:0 0 auto}
.field-grow{flex:1;min-width:200px}
.field-ep{width:200px}
.radio-group{display:flex;gap:8px;margin-top:4px}
.radio-label{display:flex;align-items:center;gap:4px;padding:6px 14px;font-size:13px;background:var(--bg-card);border:1px solid var(--bg-hover);border-radius:var(--radius);cursor:pointer;color:var(--text-secondary);transition:all 0.15s}
.radio-label.active{background:rgba(124,92,231,0.12);border-color:var(--accent);color:var(--accent)}
.radio-label input[type="radio"]{display:none}
.ep-count-row{display:flex;align-items:center;gap:6px}
.ep-count-input{width:80px;padding:8px 12px;font-size:16px;font-weight:600;text-align:center}
.ep-count-suffix{font-size:14px;color:var(--text-secondary)}
.btn-add{padding:5px 14px;font-size:12px;background:var(--accent);color:#fff;border-radius:var(--radius)}
.btn-add:hover{background:#6a4bd6}
.char-list{display:flex;flex-direction:column;gap:10px;width:100%}
.char-card{background:var(--bg-card);border:1px solid var(--bg-hover);border-radius:var(--radius);padding:10px 12px;width:100%;box-sizing:border-box}
.char-row{display:flex;gap:6px;align-items:center;margin-bottom:6px}
.char-row input,.char-row select{padding:4px 8px;font-size:13px}
.input-name{flex:1;min-width:80px}
.input-age{width:60px}
.char-row select{width:64px}
.btn-del{padding:2px 8px;background:transparent;color:var(--text-muted);font-size:14px;border-radius:var(--radius)}
.btn-del:hover{background:rgba(233,69,96,0.15);color:var(--accent2)}
.char-desc{width:100%;padding:6px 8px;font-size:13px;resize:vertical;box-sizing:border-box}
.empty{font-size:13px;color:var(--text-muted);padding:12px;width:100%}
</style>
