import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, BorderStyle } from 'docx'
import { saveAs } from 'file-saver'
import { isCardBreak, getCardForEpisode } from './model.js'

export async function exportDocx(sp) {
  const children = []

  // 标题
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [new TextRun({ text: sp.title, bold: true, size: 36, font: 'Microsoft YaHei' })],
  }))

  // 大纲
  if (sp.outline) {
    children.push(new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({ text: '故事大纲：', bold: true, size: 24, font: 'Microsoft YaHei' }),
        new TextRun({ text: sp.outline, size: 24, font: 'Microsoft YaHei' }),
      ],
    }))
    children.push(new Paragraph({ spacing: { after: 200 }, children: [] }))
  }

  // 人物小传
  if (sp.characters.length > 0) {
    children.push(new Paragraph({
      spacing: { after: 100 },
      children: [new TextRun({ text: '人物小传：', bold: true, size: 24, font: 'Microsoft YaHei' })],
    }))
    sp.characters.forEach(c => {
      children.push(new Paragraph({
        indent: { left: 480 },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: `${c.name}（${c.role}）：`, bold: true, size: 22, font: 'Microsoft YaHei' }),
          new TextRun({ text: `${c.gender}，${c.age}岁，${c.desc}`, size: 22, font: 'Microsoft YaHei' }),
        ],
      }))
    })
    children.push(new Paragraph({ spacing: { after: 300 }, children: [] }))
  }

  // 正文
  sp.episodes.forEach(ep => {
    // 集标题
    children.push(new Paragraph({
      spacing: { before: 300, after: 200 },
      indent: { left: 480 },
      children: [new TextRun({
        text: `${ep.title}${ep.chapterRef ? '-' + ep.chapterRef : ''}`,
        bold: true, size: 24, font: 'Microsoft YaHei'
      })],
    }))

    ep.scenes.forEach(sc => {
      // 场次号
      children.push(new Paragraph({
        spacing: { before: 200, after: 80 },
        indent: { left: 480 },
        children: [new TextRun({ text: sc.label, bold: true, size: 22, font: 'Microsoft YaHei' })],
      }))

      // 地点行
      children.push(new Paragraph({
        indent: { left: 480 },
        spacing: { after: 80 },
        children: [new TextRun({
          text: `地点：${sc.location || '[地点]'}，${sc.time}，${sc.inOut}`,
          size: 22, font: 'Microsoft YaHei'
        })],
      }))

      // 人物行
      if (sc.characters.length > 0) {
        children.push(new Paragraph({
          indent: { left: 480 },
          spacing: { after: 80 },
          children: [new TextRun({
            text: `人物：${sc.characters.join('，')}`,
            size: 22, font: 'Microsoft YaHei'
          })],
        }))
      }

      // 内容块
      sc.blocks.forEach(b => {
        const runs = []
        if (b.type === 'action') {
          runs.push(new TextRun({ text: `▲${b.content}`, size: 22, font: 'Microsoft YaHei' }))
        } else if (b.type === 'dialogue') {
          const paren = b.parenthetical ? `（${b.parenthetical}）` : ''
          runs.push(new TextRun({ text: `${b.character || '角色'}${paren}：`, bold: true, size: 22, font: 'Microsoft YaHei' }))
          runs.push(new TextRun({ text: b.content, size: 22, font: 'Microsoft YaHei' }))
        } else if (b.type === 'os') {
          const paren = b.parenthetical || 'OS'
          runs.push(new TextRun({ text: `${b.character || '角色'}（${paren}）：`, bold: true, size: 22, font: 'Microsoft YaHei' }))
          runs.push(new TextRun({ text: b.content, size: 22, font: 'Microsoft YaHei' }))
        } else if (b.type === 'vo') {
          runs.push(new TextRun({ text: `${b.character || '角色'}（VO）：`, bold: true, size: 22, font: 'Microsoft YaHei' }))
          runs.push(new TextRun({ text: b.content, size: 22, font: 'Microsoft YaHei' }))
        } else if (b.type === 'direction') {
          runs.push(new TextRun({ text: `【${b.content}】`, bold: true, size: 22, font: 'Microsoft YaHei' }))
        } else {
          runs.push(new TextRun({ text: b.content, size: 22, font: 'Microsoft YaHei' }))
        }

        children.push(new Paragraph({
          indent: { left: 480 },
          spacing: { after: 100 },
          children: runs,
        }))
      })
    })

    // 集尾
    children.push(new Paragraph({
      spacing: { before: 100, after: 100 },
      indent: { left: 480 },
      children: [new TextRun({ text: '（完）', size: 22, font: 'Microsoft YaHei' })],
    }))

    // 分卡
    if (isCardBreak(ep.num)) {
      const card = getCardForEpisode(ep.num)
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 200 },
        children: [new TextRun({ text: card.label, bold: true, size: 22, font: 'Microsoft YaHei', color: 'E94560' })],
      }))
    }
  })

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, right: 1200, bottom: 1440, left: 1200 },
        },
      },
      children,
    }],
  })

  const buffer = await Packer.toBlob(doc)
  saveAs(buffer, sp.title + '.docx')
}
