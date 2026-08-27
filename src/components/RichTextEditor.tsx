'use client';

import React, { useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RichTextEditorProps {
  value: string;           // stored as HTML
  onChange: (html: string) => void;
  placeholder?: string;
  maxLength?: number;      // character limit on plain-text content
  compact?: boolean;       // smaller toolbar + reduced padding (for section descriptions)
  label?: string;
  disabled?: boolean;
}

// ── Toolbar button ────────────────────────────────────────────────────────────

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={e => {
        e.preventDefault(); // keep editor focus
        onClick();
      }}
      title={title}
      className={`p-1.5 rounded text-sm transition-colors ${
        active
          ? 'text-white'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
      style={active ? { backgroundColor: 'var(--brand)' } : undefined}
    >
      {children}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write something…',
  maxLength,
  compact = false,
  label,
  disabled = false,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        horizontalRule: false,
        codeBlock: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline hover:text-blue-800',
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
    ],
    content: value,
    editable: !disabled,
    onUpdate({ editor }) {
      onChange(editor.isEmpty ? '' : editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: [
          'prose prose-sm max-w-none focus:outline-none rte-content',
          compact ? 'min-h-[60px] px-3 py-2 text-sm' : 'min-h-[100px] px-3 py-3 text-sm',
          disabled ? 'opacity-60 cursor-not-allowed' : '',
        ]
          .filter(Boolean)
          .join(' '),
        'data-placeholder': placeholder,
      },
    },
  });

  // Sync external value changes (e.g. draft restore or parent reset)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || '', false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // ── Link prompt ────────────────────────────────────────────────────────────
  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Enter URL', prev ?? 'https://');
    if (url === null) return; // user cancelled
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const plainLength = editor ? editor.getText().length : 0;
  const overLimit = maxLength !== undefined && plainLength > maxLength;

  if (!editor) return null;

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700">{label}</label>
      )}

      <div
        className={`border rounded-lg overflow-hidden transition-colors ${
          overLimit
            ? 'border-red-400'
            : 'border-gray-300 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500'
        } ${disabled ? 'bg-gray-50' : 'bg-white'}`}
      >
        {/* Toolbar — hidden in read-only mode */}
        {!disabled && (
          <div
            className={`flex items-center gap-0.5 border-b border-gray-200 bg-gray-50 flex-wrap ${
              compact ? 'px-2 py-1' : 'px-2 py-1.5'
            }`}
          >
            {/* Bold */}
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              active={editor.isActive('bold')}
              title="Bold"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
                <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
              </svg>
            </ToolbarButton>

            {/* Italic */}
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              active={editor.isActive('italic')}
              title="Italic"
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <line x1="19" y1="4" x2="10" y2="4" />
                <line x1="14" y1="20" x2="5" y2="20" />
                <line x1="15" y1="4" x2="9" y2="20" />
              </svg>
            </ToolbarButton>

            {/* Bullet list */}
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              active={editor.isActive('bulletList')}
              title="Bullet list"
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="9" y1="6" x2="20" y2="6" />
                <line x1="9" y1="12" x2="20" y2="12" />
                <line x1="9" y1="18" x2="20" y2="18" />
                <circle cx="4" cy="6" r="1" fill="currentColor" />
                <circle cx="4" cy="12" r="1" fill="currentColor" />
                <circle cx="4" cy="18" r="1" fill="currentColor" />
              </svg>
            </ToolbarButton>

            <div className="w-px h-4 bg-gray-300 mx-0.5" />

            {/* Link */}
            <ToolbarButton
              onClick={setLink}
              active={editor.isActive('link')}
              title="Insert / edit link"
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </ToolbarButton>

            {/* Hard break */}
            <ToolbarButton
              onClick={() => editor.chain().focus().setHardBreak().run()}
              active={false}
              title="Line break (Shift+Enter)"
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="9 10 4 15 9 20" />
                <path d="M20 4v7a4 4 0 0 1-4 4H4" />
              </svg>
            </ToolbarButton>
          </div>
        )}

        {/* Editor content area */}
        <EditorContent editor={editor} />
      </div>

      {/* Character count */}
      {maxLength !== undefined && (
        <p className={`text-xs text-right ${overLimit ? 'text-red-500' : 'text-gray-400'}`}>
          {plainLength}/{maxLength}
        </p>
      )}
    </div>
  );
}
