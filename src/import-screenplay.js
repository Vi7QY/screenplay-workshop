// 剧本导入模块：支持 TXT / DOCX / PDF 导入
import { uid, createBlock } from './model.js'

// ========== 文件读取 ==========

// 读取TXT文件
function readTxtFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsText(file, 'UTF-8')
  })
}

// 读取DOCX文件
async function readDocxFile(file) {
  const mammoth = await import('mammoth')
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.default.extractRawText({ arrayBuffer })
  return result.value
}

// 读取PDF文件
async function readPdfFile(file) {
  const pdfjsLib = await import('pdfjs-dist')
  // 使用内联worker避免跨域问题
  pdfjsLib.GlobalWorkerOptions.workerSrc = ''
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise
  let text = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items.map(item => item.str).join('')
    text += pageText + '\n'
  }
  return text
}

// 根据文件类型读取
export async function readFile(file) {
  const name = file.name.toLowerCase()
  if (name.endsWith('.txt')) return await readTxtFile(file)
  if (name.endsWith('.docx') || name.endsWith('.doc')) return await readDocxFile(file)
  if (name.endsWith('.pdf')) return await readPdfFile(file)
  throw new Error('不支持的文件格式，请上传 TXT、DOCX 或 PDF 文件')
}

// ========== 剧本解析 ==========

export function parseScreenplay(rawText) {
  const lines = rawText.split(/\r?\n/)
  const sp = {
    title: '导入的剧本',
    outline: '',
    characters: [],
    episodes: [],
    settings: { actionSymbol: '\u25B2', sceneStyle: 'separate' },
  }

  let currentEp = null
  let currentSc = null
  let epNum = 0
  let inOutline = false
  let inCharSection = false

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.trim()
    if (!line) {
      if (inOutline) inOutline = false
      continue
    }

    // 匹配标题行：《xxx》或 剧本名称/标题：xxx
    const titleMatch = line.match(/^[《「](.+?)[》」]$/) || line.match(/^(?:剧本名称|剧本标题|标题|名称)[：:]\s*(.+)/)
    if (titleMatch && sp.episodes.length === 0 && !currentEp) {
      sp.title = titleMatch[1] || titleMatch[2] || line
      continue
    }

    // 匹配故事梗概/大纲
    const outlineMatch = line.match(/^(?:故事梗概|故事大纲|剧情简介|简介|梗概)[：:]\s*(.*)/)
    if (outlineMatch) {
      sp.outline = outlineMatch[1] || ''
      inOutline = true
      inCharSection = false
      continue
    }
    if (inOutline && !line.match(/^(?:第\s*\d|人物|角色|EP)/)) {
      sp.outline += (sp.outline ? '\n' : '') + line
      continue
    }

    // 匹配人物小传区域
    const charSectionMatch = line.match(/^(?:人物小传|主要角色|角色介绍|人物介绍)[：:]?\s*$/)
    if (charSectionMatch) {
      inCharSection = true
      inOutline = false
      continue
    }

    // 在人物小传区域内解析角色
    if (inCharSection) {
      // 格式1：角色名（角色类型）：描述  或  角色名-角色类型：描述
      const charMatch = line.match(/^([^\s（(：:—\-]{1,8})\s*[（(]?\s*(男主|女主|男配|女配|角色|龙套)?\s*[）)]?\s*[：:—\-]\s*(.*)/)
      if (charMatch) {
        sp.characters.push({
          id: 'c' + Date.now().toString(36) + (++epNum * 100 + i).toString(36),
          name: charMatch[1].trim(),
          gender: '男',
          age: '',
          role: charMatch[2] || '角色',
          desc: charMatch[3] || '',
        })
        continue
      }
      // 遇到集标题则退出人物小传区域
      if (line.match(/^(?:第\s*\d|EP)/i)) {
        inCharSection = false
      } else {
        continue
      }
    }

    inOutline = false
    inCharSection = false

    // 匹配集标题：第X集、第X话、EP.X 等
    const epMatch = line.match(/^(?:第\s*(\d+)\s*[集话]|EP\.?\s*(\d+)|第\s*([一二三四五六七八九十百千\d]+)\s*[集话])/i)
    if (epMatch) {
      epNum++
      const num = parseInt(epMatch[1] || epMatch[2]) || epNum
      currentEp = {
        id: uid(),
        num: num,
        title: line,
        chapterRef: '',
        scenes: [],
      }
      sp.episodes.push(currentEp)
      currentSc = null
      continue
    }

    // 匹配场次标题：X-X、场次X、场X 等
    const scMatch = line.match(/^(\d+)\s*[-–—]\s*(\d+)/) || line.match(/^场次?\s*(\d+)/i)
    if (scMatch) {
      if (!currentEp) {
        epNum++
        currentEp = { id: uid(), num: epNum, title: `第${epNum}集`, chapterRef: '', scenes: [] }
        sp.episodes.push(currentEp)
      }
      const scNum = currentEp.scenes.length + 1
      currentSc = {
        id: uid(),
        episodeNum: currentEp.num,
        sceneNum: scNum,
        label: line.length > 10 ? `${currentEp.num}-${scNum}` : line,
        location: '',
        time: '日',
        inOut: '内',
        characters: [],
        blocks: [],
      }
      currentEp.scenes.push(currentSc)
      continue
    }

    // 匹配地点行：地点：XXX，日/夜，内/外
    const locMatch = line.match(/^地点[：:]\s*(.+)/)
    if (locMatch && currentSc) {
      const parts = locMatch[1].split(/[，,]/).map(s => s.trim())
      currentSc.location = parts[0] || ''
      if (parts[1]) {
        if (/夜/.test(parts[1])) currentSc.time = '夜'
        else if (/黄昏/.test(parts[1])) currentSc.time = '黄昏'
        else if (/清晨/.test(parts[1])) currentSc.time = '清晨'
        else currentSc.time = '日'
      }
      if (parts[2]) {
        if (/外/.test(parts[2]) && /内/.test(parts[2])) currentSc.inOut = '内外'
        else if (/外/.test(parts[2])) currentSc.inOut = '外'
        else currentSc.inOut = '内'
      }
      continue
    }

    // 匹配人物行：人物：XXX，XXX
    const charMatch = line.match(/^人物[：:]\s*(.+)/)
    if (charMatch && currentSc) {
      currentSc.characters = charMatch[1].split(/[，,、\s]+/).map(s => s.trim()).filter(Boolean)
      continue
    }

    // 确保有容器
    if (!currentEp) {
      epNum++
      currentEp = { id: uid(), num: epNum, title: `第${epNum}集`, chapterRef: '', scenes: [] }
      sp.episodes.push(currentEp)
    }
    if (!currentSc) {
      const scNum = currentEp.scenes.length + 1
      currentSc = {
        id: uid(), episodeNum: currentEp.num, sceneNum: scNum,
        label: `${currentEp.num}-${scNum}`, location: '', time: '日', inOut: '内',
        characters: [], blocks: [],
      }
      currentEp.scenes.push(currentSc)
    }

    // 匹配动作描写：▲XXX 或 △XXX
    if (/^[▲△]/.test(line)) {
      currentSc.blocks.push(createBlock('action', line.replace(/^[▲△]\s*/, '')))
      continue
    }

    // 匹配镜头指示：【XXX】
    const dirMatch = line.match(/^【(.+?)】$/)
    if (dirMatch) {
      currentSc.blocks.push(createBlock('direction', dirMatch[1]))
      continue
    }

    // 匹配对白/OS/VO：角色名（括注）：台词  或  角色名：台词
    const dlgMatch = line.match(/^([^\s（(：:]{1,8})\s*(?:[（(]([^）)]*)[）)])?\s*[：:]\s*(.*)/)
    if (dlgMatch) {
      const charName = dlgMatch[1].trim()
      const paren = (dlgMatch[2] || '').trim()
      const content = dlgMatch[3].trim()

      // 判断是OS还是VO还是普通对白
      if (/^OS$/i.test(paren) || /内心/i.test(paren)) {
        currentSc.blocks.push(createBlock('os', content, { character: charName, parenthetical: paren || 'OS' }))
      } else if (/^VO$/i.test(paren) || /画外/i.test(paren) || /旁白/i.test(paren)) {
        currentSc.blocks.push(createBlock('vo', content, { character: charName, parenthetical: '' }))
      } else {
        currentSc.blocks.push(createBlock('dialogue', content, { character: charName, parenthetical: paren }))
      }
      continue
    }

    // 跳过"（完）"等标记
    if (/^[（(]完[）)]$/.test(line)) continue
    if (/^——[一二三]卡——$/.test(line)) continue

    // 其余内容作为正文
    currentSc.blocks.push(createBlock('text', line))
  }

  // 后处理：确保每个场次至少有一个block
  sp.episodes.forEach(ep => {
    ep.scenes.forEach(sc => {
      if (sc.blocks.length === 0) {
        sc.blocks.push(createBlock('action', ''))
      }
    })
  })

  // 如果没有解析到任何集，创建默认结构
  if (sp.episodes.length === 0) {
    sp.episodes.push({
      id: uid(), num: 1, title: '第1集', chapterRef: '',
      scenes: [{
        id: uid(), episodeNum: 1, sceneNum: 1, label: '1-1',
        location: '', time: '日', inOut: '内', characters: [],
        blocks: [createBlock('text', rawText.substring(0, 500))],
      }]
    })
  }

  // 提取标题（用第一行非空内容或文件名）
  const firstLine = lines.find(l => l.trim() && !l.trim().match(/^第\s*\d+/))
  if (firstLine && firstLine.trim().length < 30) {
    sp.title = firstLine.trim()
  }

  return sp
}
