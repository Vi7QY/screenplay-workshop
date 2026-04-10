<template>
  <div class="editor-scroll" ref="scrollEl">
    <div class="editor-container">
      <template v-for="(ep, ei) in sp.episodes" :key="ep.id">
        <!-- 集标题 -->
        <div class="ep-title-row">
          <input class="ep-title-input" v-model="ep.title" @input="$emit('update')" />
          <input class="ep-chapter" v-model="ep.chapterRef" placeholder="章节(可选)" @input="$emit('update')" />
        </div>

        <template v-for="(sc, si) in ep.scenes" :key="sc.id">
          <!-- 场次头 -->
          <div class="scene-head" :data-scene-id="sc.id" @click="$emit('set-active', sc.id)">
            <div class="scene-head-top">
              <div class="scene-num">{{ ep.num }}-{{ si+1 }}</div>
              <button class="scene-del-btn" v-if="ep.scenes.length > 1" @click.stop="removeScene(ei,si)" title="删除此场次">✕</button>
            </div>
            <div class="scene-meta">
              <span class="meta-label">地点：</span>
              <input class="meta-input loc" v-model="sc.location" placeholder="地点名称" @input="$emit('update')" />
              <span class="meta-sep">，</span>
              <select class="meta-select" v-model="sc.time" @change="$emit('update')">
                <option>日</option><option>夜</option><option>黄昏</option><option>清晨</option>
              </select>
              <span class="meta-sep">，</span>
              <select class="meta-select" v-model="sc.inOut" @change="$emit('update')">
                <option>内</option><option>外</option><option>内外</option>
              </select>
            </div>
            <!-- 人物行 -->
            <div class="scene-chars">
              <span class="meta-label">人物：</span>
              <div class="char-tags">
                <span v-for="(ch, ci) in sc.characters" :key="ci" class="char-tag">
                  {{ ch }}<button class="tag-del" @click="removeSceneChar(ei,si,ci)">✕</button>
                </span>
                <div class="char-add-wrap">
                  <input
                    class="char-add-input"
                    v-model="charInput"
                    placeholder="+ 角色"
                    @keydown.enter.prevent="addSceneChar(ei,si)"
                    @focus="showCharSuggest=true"
                    @blur="hideCharSuggest"
                    list="char-suggest"
                  />
                  <datalist id="char-suggest">
                    <option v-for="c in characters" :key="c.id" :value="c.name" />
                  </datalist>
                </div>
              </div>
            </div>
          </div>

          <!-- 内容块列表 -->
          <div class="blocks-list">
            <div v-for="(block, bi) in sc.blocks" :key="block.id" class="block-row" :class="'bt-'+block.type">
              <div class="block-gutter">
                <span class="block-icon" :style="{color: typeColor(block.type)}">{{ typeIcon(block.type) }}</span>
              </div>

              <!-- 角色名(对白/OS/VO) -->
              <div v-if="block.type==='dialogue'||block.type==='os'||block.type==='vo'" class="block-char-wrap">
                <input class="block-char" v-model="block.character" placeholder="角色名" list="char-suggest" @input="$emit('update')" />
                <input v-if="block.type==='dialogue'||block.type==='os'" class="block-paren" v-model="block.parenthetical" :placeholder="block.type==='os'?'OS':'表情/语气'" @input="$emit('update')" />
                <span class="block-colon">：</span>
              </div>

              <!-- 内容 -->
              <div class="block-content">
                <textarea
                  class="block-ta"
                  :value="block.content"
                  :placeholder="pholder(block.type)"
                  rows="1"
                  @input="onBlockInput($event, ei, si, bi)"
                  @keydown="onBlockKey($event, ei, si, bi)"
                  @focus="$emit('set-active', sc.id)"
                  ref="blockTas"
                ></textarea>
              </div>

              <!-- 操作 -->
              <div class="block-ops">
                <select class="type-sel" :value="block.type" @change="changeBlockType(ei,si,bi,$event.target.value)">
                  <option value="action">▲ 动作</option>
                  <option value="dialogue">💬 对白</option>
                  <option value="os">🧠 OS</option>
                  <option value="vo">🎙 VO</option>
                  <option value="direction">🎬 镜头</option>
                  <option value="text">✏ 正文</option>
                </select>
                <button class="block-del" @click="removeBlock(ei,si,bi)" title="删除">✕</button>
              </div>
            </div>

            <!-- 添加新块按钮 -->
            <div class="add-block-row">
              <button v-for="bt in quickBtns" :key="bt.type" class="add-btn" :style="{'--c':bt.color}" @click="addBlock(ei,si,bt.type)">
                {{ bt.icon }} {{ bt.label }}
              </button>
            </div>
          </div>

          <!-- 场次间分隔 -->
          <div v-if="si < ep.scenes.length - 1" class="scene-divider"></div>
        </template>

        <!-- 添加场次按钮 -->
        <div class="add-scene-row">
          <button class="add-scene-btn" @click="addSceneInEp(ei)">+ 添加场次</button>
        </div>

        <!-- 集尾 -->
        <div class="ep-end">（完）</div>

        <!-- 分卡标记 -->
        <div v-if="isCardBreak(ep.num)" class="card-mark">{{ getCardLabel(ep.num) }}</div>

        <!-- 集间分隔 -->
        <div v-if="ei < sp.episodes.length - 1" class="ep-divider"></div>
      </template>

      <div class="bottom-pad"></div>
    </div>
  </div>
</template>

<script>
import { ref, nextTick, onMounted } from 'vue'
import { createBlock, createScene, BLOCK_TYPES, isCardBreak, getCardForEpisode } from '../model.js'

export default {
  props: { sp: Object, characters: Array },
  emits: ['update', 'set-active'],
  setup(props, { emit }) {
    const scrollEl = ref(null)
    const charInput = ref('')
    const showCharSuggest = ref(false)
    const blockTas = ref([])

    const quickBtns = [
      { type: 'action', icon: '▲', label: '动作', color: '#e94560' },
      { type: 'dialogue', icon: '💬', label: '对白', color: '#45aaf2' },
      { type: 'os', icon: '🧠', label: 'OS', color: '#f8a5c2' },
      { type: 'vo', icon: '🎙', label: 'VO', color: '#a55eea' },
      { type: 'direction', icon: '🎬', label: '镜头', color: '#2ed573' },
      { type: 'text', icon: '✏', label: '正文', color: '#ccc' },
    ]

    function typeColor(t) { return BLOCK_TYPES[t]?.color || '#ccc' }
    function typeIcon(t) {
      const m = { action:'▲', dialogue:'💬', os:'🧠', vo:'🎙', direction:'🎬', text:'✏' }
      return m[t] || '✏'
    }
    function pholder(t) {
      const m = {
        action: '动作/场景描写……',
        dialogue: '台词内容……',
        os: '内心独白……',
        vo: '画外音/旁白……',
        direction: '镜头指示，如：切镜头、闪入、特写……',
        text: '正文内容……(输入 dz=动作 db=对白 jt=镜头 os=独白 rw=人物行)',
      }
      return m[t] || ''
    }

    function addSceneChar(ei, si) {
      const v = charInput.value.trim()
      if (!v) return
      const sc = props.sp.episodes[ei].scenes[si]
      if (!sc.characters.includes(v)) sc.characters.push(v)
      charInput.value = ''
      emit('update')
    }
    function removeSceneChar(ei, si, ci) {
      props.sp.episodes[ei].scenes[si].characters.splice(ci, 1)
      emit('update')
    }
    function hideCharSuggest() { setTimeout(() => showCharSuggest.value = false, 200) }

    function addBlock(ei, si, type) {
      const sc = props.sp.episodes[ei].scenes[si]
      const extra = {}
      if (type === 'dialogue' || type === 'os' || type === 'vo') {
        extra.character = ''
        extra.parenthetical = ''
      }
      sc.blocks.push(createBlock(type, '', extra))
      emit('update')
      nextTick(() => focusLastBlock(ei, si))
    }

    function removeBlock(ei, si, bi) {
      const sc = props.sp.episodes[ei].scenes[si]
      if (sc.blocks.length <= 1) return
      sc.blocks.splice(bi, 1)
      emit('update')
    }

    function changeBlockType(ei, si, bi, newType) {
      const b = props.sp.episodes[ei].scenes[si].blocks[bi]
      b.type = newType
      if ((newType === 'dialogue' || newType === 'os' || newType === 'vo') && !b.character) {
        b.character = ''
        b.parenthetical = ''
      }
      emit('update')
    }

    function onBlockInput(e, ei, si, bi) {
      const ta = e.target
      const val = ta.value
      const block = props.sp.episodes[ei].scenes[si].blocks[bi]

      // 快捷命令检测（在正文块中）
      if (block.type === 'text') {
        const cmds = { 'dz': 'action', 'db': 'dialogue', 'jt': 'direction', 'os': 'os', 'vo': 'vo' }
        for (const [trigger, btype] of Object.entries(cmds)) {
          if (val.trim() === trigger) {
            block.type = btype
            block.content = ''
            if (btype === 'dialogue' || btype === 'os' || btype === 'vo') {
              block.character = ''
              block.parenthetical = ''
            }
            nextTick(() => {
              ta.value = ''
              autoResize(ta)
            })
            emit('update')
            return
          }
        }
        // rw = 添加人物行（跳到人物输入）
        if (val.trim() === 'rw') {
          block.content = ''
          nextTick(() => { ta.value = '' })
          // 聚焦到当前场次的角色输入
          const charInputEl = scrollEl.value?.querySelector(`[data-scene-id="${props.sp.episodes[ei].scenes[si].id}"] .char-add-input`)
          if (charInputEl) charInputEl.focus()
          emit('update')
          return
        }
      }

      block.content = val
      autoResize(ta)
      emit('update')
    }

    function onBlockKey(e, ei, si, bi) {
      const sc = props.sp.episodes[ei].scenes[si]

      // Enter：新建下一个同类型块
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        const curType = sc.blocks[bi].type
        const extra = {}
        if (curType === 'dialogue' || curType === 'os' || curType === 'vo') {
          extra.character = ''
          extra.parenthetical = ''
        }
        sc.blocks.splice(bi + 1, 0, createBlock('text', '', extra))
        emit('update')
        nextTick(() => focusBlock(ei, si, bi + 1))
        return
      }

      // Backspace 空块删除
      if (e.key === 'Backspace' && !sc.blocks[bi].content && sc.blocks.length > 1) {
        e.preventDefault()
        sc.blocks.splice(bi, 1)
        emit('update')
        nextTick(() => focusBlock(ei, si, Math.max(0, bi - 1)))
        return
      }

      // Alt+上下 移动块
      if (e.altKey && e.key === 'ArrowUp' && bi > 0) {
        e.preventDefault()
        const tmp = sc.blocks[bi]; sc.blocks[bi] = sc.blocks[bi-1]; sc.blocks[bi-1] = tmp
        emit('update')
        nextTick(() => focusBlock(ei, si, bi - 1))
        return
      }
      if (e.altKey && e.key === 'ArrowDown' && bi < sc.blocks.length - 1) {
        e.preventDefault()
        const tmp = sc.blocks[bi]; sc.blocks[bi] = sc.blocks[bi+1]; sc.blocks[bi+1] = tmp
        emit('update')
        nextTick(() => focusBlock(ei, si, bi + 1))
        return
      }
    }

    function autoResize(ta) {
      if (!ta) return
      ta.style.height = 'auto'
      ta.style.height = ta.scrollHeight + 'px'
    }

    function focusBlock(ei, si, bi) {
      const allTas = scrollEl.value?.querySelectorAll('.block-ta')
      if (!allTas) return
      let idx = 0
      for (let e = 0; e < props.sp.episodes.length; e++) {
        for (let s = 0; s < props.sp.episodes[e].scenes.length; s++) {
          for (let b = 0; b < props.sp.episodes[e].scenes[s].blocks.length; b++) {
            if (e === ei && s === si && b === bi) {
              const ta = allTas[idx]
              if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); autoResize(ta) }
              return
            }
            idx++
          }
        }
      }
    }

    function focusLastBlock(ei, si) {
      const sc = props.sp.episodes[ei].scenes[si]
      focusBlock(ei, si, sc.blocks.length - 1)
    }

    function getCardLabel(n) {
      const c = getCardForEpisode(n)
      return c ? c.label : ''
    }

    function addSceneInEp(ei) {
      const ep = props.sp.episodes[ei]
      const num = ep.scenes.length + 1
      ep.scenes.push(createScene(ep.num, num))
      // 重新编号所有场次label
      ep.scenes.forEach((s, i) => { s.sceneNum = i + 1; s.label = `${ep.num}-${i + 1}` })
      emit('update')
    }

    function removeScene(ei, si) {
      const ep = props.sp.episodes[ei]
      if (ep.scenes.length <= 1) return
      ep.scenes.splice(si, 1)
      ep.scenes.forEach((s, i) => { s.sceneNum = i + 1; s.label = `${ep.num}-${i + 1}` })
      emit('update')
    }

    onMounted(() => {
      nextTick(() => {
        scrollEl.value?.querySelectorAll('.block-ta').forEach(autoResize)
      })
    })

    return {
      scrollEl, charInput, showCharSuggest, blockTas, quickBtns,
      typeColor, typeIcon, pholder,
      addSceneChar, removeSceneChar, hideCharSuggest,
      addBlock, removeBlock, changeBlockType,
      onBlockInput, onBlockKey,
      isCardBreak, getCardLabel,
      addSceneInEp, removeScene,
    }
  }
}
</script>

<style scoped>
.editor-scroll{flex:1;overflow-y:auto;padding:20px 0}
.editor-container{max-width:820px;margin:0 auto;padding:0 28px}

/* 集标题 */
.ep-title-row{display:flex;align-items:center;gap:10px;margin-bottom:16px;padding:8px 0}
.ep-title-input{font-size:18px;font-weight:700;background:transparent;border:none;border-bottom:2px solid var(--bg-hover);color:var(--text-primary);padding:4px 0;width:160px}
.ep-title-input:focus{border-bottom-color:var(--accent)}
.ep-chapter{font-size:13px;background:transparent;border:none;border-bottom:1px solid var(--bg-hover);color:var(--text-muted);padding:4px 0;width:120px}
.ep-chapter:focus{border-bottom-color:var(--accent)}

/* 场次头 */
.scene-head{background:var(--bg-card);border:1px solid var(--bg-hover);border-left:4px solid var(--color-scene);border-radius:var(--radius);padding:12px 16px;margin-bottom:8px}
.scene-head-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.scene-del-btn{padding:2px 8px;font-size:12px;background:transparent;color:var(--text-muted);border-radius:3px;opacity:0;transition:opacity var(--tr)}
.scene-head:hover .scene-del-btn{opacity:1}
.scene-del-btn:hover{background:rgba(233,69,96,0.15);color:var(--accent2)}
.scene-num{font-size:15px;font-weight:700;color:var(--color-scene);margin-bottom:8px}
.scene-meta{display:flex;align-items:center;gap:4px;margin-bottom:6px;font-size:13px}
.meta-label{color:var(--text-muted);flex-shrink:0}
.meta-input{padding:3px 8px;font-size:13px;background:var(--bg-editor);border:1px solid var(--bg-hover);border-radius:3px}
.meta-input.loc{width:200px}
.meta-select{padding:3px 4px;font-size:13px;background:var(--bg-editor);border:1px solid var(--bg-hover);border-radius:3px;color:var(--text-primary)}
.meta-sep{color:var(--text-muted)}
.scene-chars{display:flex;align-items:center;gap:4px;flex-wrap:wrap;font-size:13px}
.char-tags{display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.char-tag{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;font-size:12px;background:rgba(124,92,231,0.15);color:var(--accent);border-radius:12px}
.tag-del{padding:0 2px;background:transparent;color:var(--text-muted);font-size:10px;cursor:pointer}
.tag-del:hover{color:var(--accent2)}
.char-add-input{padding:2px 8px;font-size:12px;background:transparent;border:1px dashed var(--bg-hover);border-radius:12px;width:80px;color:var(--text-secondary)}
.char-add-input:focus{border-color:var(--accent);width:100px}

/* 块列表 */
.blocks-list{margin-bottom:12px}
.block-row{display:flex;align-items:flex-start;gap:6px;padding:4px 8px;margin:2px 0;border-radius:var(--radius);border-left:3px solid transparent;transition:all var(--tr)}
.block-row:hover{background:rgba(255,255,255,0.02)}
.bt-action{border-left-color:var(--color-action)}
.bt-dialogue{border-left-color:var(--color-dialogue)}
.bt-os{border-left-color:var(--color-os)}
.bt-vo{border-left-color:var(--color-vo)}
.bt-direction{border-left-color:var(--color-direction)}
.bt-text{border-left-color:rgba(255,255,255,0.06)}

.block-gutter{width:24px;padding-top:6px;text-align:center;flex-shrink:0;font-size:14px}

.block-char-wrap{display:flex;align-items:center;flex-shrink:0;padding-top:4px;gap:2px}
.block-char{width:70px;padding:2px 6px;font-size:13px;font-weight:600;background:transparent;border:none;border-bottom:1px solid rgba(255,255,255,0.1);color:var(--color-os);text-align:center}
.block-char:focus{border-bottom-color:var(--accent)}
.block-paren{width:80px;padding:2px 4px;font-size:12px;background:transparent;border:none;border-bottom:1px solid rgba(255,255,255,0.08);color:var(--text-muted);font-style:italic}
.block-paren:focus{border-bottom-color:var(--accent)}
.block-paren::before{content:'（'}
.block-colon{color:var(--text-muted);font-weight:600}

.block-content{flex:1;min-width:0}
.block-ta{width:100%;padding:4px 6px;font-size:14px;line-height:1.7;color:var(--text-primary);background:transparent;border:none;border-radius:0;resize:none;overflow:hidden;font-family:inherit}
.block-ta:focus{outline:none}
.block-ta::placeholder{color:var(--text-muted);font-style:italic}
.bt-action .block-ta{color:var(--color-action)}
.bt-direction .block-ta{color:var(--color-direction)}
.bt-os .block-ta{color:var(--color-os)}
.bt-vo .block-ta{color:var(--color-vo)}

.block-ops{display:flex;align-items:center;gap:3px;opacity:0;transition:opacity var(--tr);padding-top:4px;flex-shrink:0}
.block-row:hover .block-ops{opacity:1}
.type-sel{padding:2px 3px;font-size:10px;color:var(--text-muted);background:var(--bg-card);border:1px solid var(--bg-hover);border-radius:3px;max-width:80px}
.block-del{padding:2px 6px;background:transparent;color:var(--text-muted);font-size:12px;border-radius:3px}
.block-del:hover{background:rgba(233,69,96,0.15);color:var(--accent2)}

/* 添加块按钮 */
.add-block-row{display:flex;gap:4px;padding:6px 8px;flex-wrap:wrap}
.add-btn{padding:4px 10px;font-size:11px;color:var(--text-muted);background:transparent;border:1px dashed var(--bg-hover);border-radius:var(--radius)}
.add-btn:hover{background:var(--bg-hover);color:var(--c);border-color:var(--c)}

/* 分隔线 */
.scene-divider{height:1px;background:rgba(255,255,255,0.05);margin:16px 0}
.add-scene-row{display:flex;padding:8px 0;margin-top:4px}
.add-scene-btn{padding:5px 14px;font-size:12px;color:var(--color-scene);background:transparent;border:1px dashed var(--color-scene);border-radius:var(--radius);opacity:0.6;transition:all var(--tr)}
.add-scene-btn:hover{opacity:1;background:rgba(255,165,2,0.08)}
.ep-end{text-align:center;padding:12px 0;font-size:14px;color:var(--text-muted)}
.card-mark{text-align:center;padding:8px 0;font-size:13px;font-weight:600;color:var(--color-card);border-top:1px dashed var(--color-card);border-bottom:1px dashed var(--color-card);margin:8px 0}
.ep-divider{height:2px;background:linear-gradient(90deg,transparent,var(--bg-hover),transparent);margin:24px 0}
.bottom-pad{height:200px}
</style>
