// 剧本数据模型与工具函数

// 分卡规则
export const CARD_RULES = [
  { name: '一卡', upTo: 3, label: '——一卡——' },
  { name: '二卡', upTo: 10, label: '——二卡——' },
  { name: '三卡', upTo: 30, label: '——三卡——' },
]

// 块类型定义
export const BLOCK_TYPES = {
  action:        { label: '动作描写', prefix: '▲', color: '#e94560', shortcut: 'dz', key: 'F3' },
  dialogue:      { label: '对白',     prefix: '',   color: '#45aaf2', shortcut: 'db', key: 'F4' },
  os:            { label: '内心独白', prefix: '',   color: '#f8a5c2', shortcut: 'os', key: '' },
  vo:            { label: '画外音',   prefix: '',   color: '#a55eea', shortcut: 'vo', key: '' },
  direction:     { label: '镜头指示', prefix: '【',  color: '#2ed573', shortcut: 'jt', key: 'F5', suffix: '】' },
  text:          { label: '正文',     prefix: '',   color: '#ccc',    shortcut: '',   key: '' },
}

let _uid = 0
export function uid() {
  return 'b' + Date.now().toString(36) + (++_uid).toString(36)
}

// 创建一个内容块
export function createBlock(type = 'text', content = '', extra = {}) {
  return { id: uid(), type, content, ...extra }
}

// 创建一个场次
export function createScene(episodeNum, sceneNum) {
  return {
    id: uid(),
    episodeNum,
    sceneNum,
    label: `${episodeNum}-${sceneNum}`,
    location: '',
    time: '日',
    inOut: '内',
    characters: [],
    blocks: [
      createBlock('action', ''),
    ],
  }
}

// 创建一集
export function createEpisode(num, sceneCount = 2) {
  const scenes = []
  for (let i = 1; i <= sceneCount; i++) {
    scenes.push(createScene(num, i))
  }
  return {
    id: uid(),
    num,
    title: `第${num}集`,
    chapterRef: '',
    scenes,
  }
}

// 创建角色
export function createCharacter(name = '', gender = '男', age = '', role = '角色', desc = '') {
  return { id: uid(), name, gender, age, role, desc }
}

// 创建默认剧本
export function createScreenplay() {
  return {
    title: '未命名剧本',
    outline: '',
    characters: [],
    episodes: [createEpisode(1, 2)],
    settings: {
      actionSymbol: '▲',
      sceneStyle: 'separate',
    },
  }
}

// 全局重编号：修复集/场次编号不同步的问题
export function renumberAll(sp) {
  sp.episodes.forEach((ep, ei) => {
    ep.num = ei + 1
    ep.title = `第${ei + 1}集`
    ep.scenes.forEach((sc, si) => {
      sc.episodeNum = ei + 1
      sc.sceneNum = si + 1
      sc.label = `${ei + 1}-${si + 1}`
      // 确保每个场次的characters是独立数组
      if (!Array.isArray(sc.characters)) sc.characters = []
    })
  })
}

// 获取某集属于哪个卡
export function getCardForEpisode(epNum) {
  for (const rule of CARD_RULES) {
    if (epNum <= rule.upTo) return rule
  }
  return null
}

// 判断某集是否是卡点（该卡的最后一集）
export function isCardBreak(epNum) {
  return CARD_RULES.some(r => r.upTo === epNum)
}

// 导出为纯文本
export function exportToText(sp) {
  let out = `${sp.title}\n\n`
  if (sp.outline) {
    out += `故事大纲：${sp.outline}\n\n`
  }
  if (sp.characters.length > 0) {
    out += `人物小传：\n`
    sp.characters.forEach(c => {
      out += `　　${c.name}（${c.role}）：${c.gender}，${c.age}岁，${c.desc}\n`
    })
    out += `\n`
  }

  sp.episodes.forEach(ep => {
    out += `\n　　${ep.title}${ep.chapterRef ? '-' + ep.chapterRef : ''}\n\n`

    ep.scenes.forEach(sc => {
      out += `　　${sc.label}\n\n`
      out += `　　地点：${sc.location || '[地点]'}，${sc.time}，${sc.inOut}\n\n`
      if (sc.characters.length > 0) {
        out += `　　人物：${sc.characters.join('，')}\n\n`
      }
      sc.blocks.forEach(b => {
        if (b.type === 'action') {
          out += `　　▲${b.content}\n\n`
        } else if (b.type === 'dialogue') {
          const paren = b.parenthetical ? `（${b.parenthetical}）` : ''
          out += `　　${b.character || '角色'}${paren}：${b.content}\n\n`
        } else if (b.type === 'os') {
          const paren = b.parenthetical ? `${b.parenthetical}` : 'OS'
          out += `　　${b.character || '角色'}（${paren}）：${b.content}\n\n`
        } else if (b.type === 'vo') {
          out += `　　${b.character || '角色'}（VO）：${b.content}\n\n`
        } else if (b.type === 'direction') {
          out += `　　【${b.content}】\n\n`
        } else {
          out += `　　${b.content}\n\n`
        }
      })
    })

    out += `　　（完）\n\n`

    if (isCardBreak(ep.num)) {
      const card = getCardForEpisode(ep.num)
      out += `${card.label}\n\n`
    }
  })
  return out
}

// 保存到 localStorage
export function saveToStorage(sp) {
  try {
    localStorage.setItem('screenplay_v2', JSON.stringify(sp))
    return true
  } catch { return false }
}

// 从 localStorage 加载
export function loadFromStorage() {
  try {
    const d = localStorage.getItem('screenplay_v2')
    return d ? JSON.parse(d) : null
  } catch { return null }
}
