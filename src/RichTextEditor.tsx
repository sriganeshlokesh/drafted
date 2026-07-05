import { useEffect, useRef, type CSSProperties } from 'react'
import { useEditor, EditorContent, Extension } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Plugin } from '@tiptap/pm/state'
import { Hover } from './Hover'
import { toolbarBtn, toolbarBtnHover } from './styles'

interface Props {
  value: string
  onChange: (html: string) => void
}

// Intercepts multi-line plain-text paste and inserts it as a bullet list.
const SmartPaste = Extension.create({
  name: 'smartPaste',
  addProseMirrorPlugins() {
    const { editor } = this
    return [
      new Plugin({
        props: {
          handlePaste(_view, event) {
            const text = event.clipboardData?.getData('text/plain') ?? ''
            const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
            if (lines.length > 1) {
              event.preventDefault()
              const html = `<ul>${lines.map(l => `<li>${l}</li>`).join('')}</ul>`
              queueMicrotask(() => editor.commands.insertContent(html))
              return true
            }
            return false
          },
        },
      }),
    ]
  },
})

const activeBtnStyle: CSSProperties = { background: 'var(--c-toolbar-active, #eceaf6)', color: 'var(--accent,#5b50e0)' }

export function RichTextEditor({ value, onChange }: Props) {
  const lastEmitted = useRef<string>(value)

  const editor = useEditor({
    extensions: [StarterKit, SmartPaste],
    content: value || '<p></p>',
    onUpdate({ editor }) {
      const html = editor.getHTML()
      lastEmitted.current = html
      onChange(html)
    },
  })

  // Sync when value changes externally (e.g. localStorage load on mount).
  useEffect(() => {
    if (!editor) return
    if (value !== lastEmitted.current) {
      editor.commands.setContent(value || '<p></p>')
      lastEmitted.current = value
    }
  }, [editor, value])

  if (!editor) return null

  return (
    <div style={{ border: '1px solid var(--c-border, #e4e4e9)', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '7px 9px', borderBottom: '1px solid var(--c-toolbar-border, #efefef)', background: 'var(--c-toolbar-bg, #fafafa)' }}>
        <Hover
          as="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          style={{ ...toolbarBtn, fontWeight: 700, ...(editor.isActive('bold') ? activeBtnStyle : {}) }}
          hoverStyle={toolbarBtnHover}
        >B</Hover>
        <Hover
          as="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          style={{ ...toolbarBtn, fontStyle: 'italic', ...(editor.isActive('italic') ? activeBtnStyle : {}) }}
          hoverStyle={toolbarBtnHover}
        >I</Hover>
        <Hover
          as="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          style={{ ...toolbarBtn, ...(editor.isActive('bulletList') ? activeBtnStyle : {}) }}
          hoverStyle={toolbarBtnHover}
        >☰</Hover>
      </div>
      <EditorContent editor={editor} className="rich-editor" />
    </div>
  )
}
