/**
 * Rich-text document editor powered by Plate (Slate-based).
 * Features: inline formatting, headings, lists, blockquotes, code blocks,
 * floating toolbar on selection, slash command menu, markdown autoformat
 * shortcuts, and markdown round-tripping for storage.
 */
import React from 'react';
import {
  Plate,
  PlateContent,
  PlateElement,
  PlateLeaf,
  usePlateEditor,
  useEditorRef,
  useEditorSelection,
  useEditorReadOnly,
  toPlatePlugin,
} from '@udecode/plate/react';
import { createSlateEditor, createSlatePlugin, type Value } from '@udecode/plate';
import { BoldPlugin, ItalicPlugin, UnderlinePlugin, StrikethroughPlugin, CodePlugin } from '@udecode/plate-basic-marks/react';
import { HeadingPlugin } from '@udecode/plate-heading/react';
import { BlockquotePlugin } from '@udecode/plate-block-quote/react';
import { HorizontalRulePlugin } from '@udecode/plate-horizontal-rule/react';
import { CodeBlockPlugin, CodeLinePlugin, CodeSyntaxPlugin } from '@udecode/plate-code-block/react';
import { BulletedListPlugin, NumberedListPlugin, ListItemPlugin, ListItemContentPlugin, ListPlugin, TodoListPlugin } from '@udecode/plate-list/react';
import { AutoformatPlugin } from '@udecode/plate-autoformat/react';
import { MarkdownPlugin, deserializeMd, serializeMd } from '@udecode/plate-markdown';
import remarkGfm from 'remark-gfm';
import { TablePlugin, TableRowPlugin, TableCellPlugin, TableCellHeaderPlugin } from '@udecode/plate-table/react';
import {
  insertTableRow,
  insertTableColumn,
  deleteRow as deleteTableRow,
  deleteColumn as deleteTableColumn,
  deleteTable,
  setTableColSize,
  getTableAbove,
} from '@udecode/plate-table';
import { ColumnPlugin, ColumnItemPlugin } from '@udecode/plate-layout/react';
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  Strikethrough as StrikethroughIcon,
  Code as CodeIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Minus,
  FileCode2,
  Type,
  GripVertical,
  Plus,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Maximize2,
  Minimize2,
} from 'lucide-react';

// Pod handles image paste, upload, and rendering itself. Defining the small
// Slate image node locally avoids pulling Plate's unrelated video URL parser
// (and its unfixed ReDoS advisory) into the compiled desktop UI.
const ImagePlugin = toPlatePlugin(createSlatePlugin({
  key: 'img',
  node: {
    dangerouslyAllowAttributes: ['alt', 'width', 'height'],
    isElement: true,
    isVoid: true,
  },
  parsers: {
    html: {
      deserializer: {
        rules: [{ validNodeName: 'IMG' }],
        parse: ({ element, type }: { element: HTMLElement; type: string }) => ({
          type,
          url: element.getAttribute('src'),
        }),
      },
    },
  },
}));

/* ── Autoformat rules ── */

const autoformatRules = [
  // Marks
  { mode: 'mark' as const, type: 'bold', match: '**' },
  { mode: 'mark' as const, type: 'italic', match: '_' },
  { mode: 'mark' as const, type: 'italic', match: '*' },
  { mode: 'mark' as const, type: 'code', match: '`' },
  { mode: 'mark' as const, type: 'strikethrough', match: '~~' },
  // Blocks
  { mode: 'block' as const, type: 'h1', match: '# ' },
  { mode: 'block' as const, type: 'h2', match: '## ' },
  { mode: 'block' as const, type: 'h3', match: '### ' },
  { mode: 'block' as const, type: 'blockquote', match: '> ' },
  { mode: 'block' as const, type: 'hr', match: ['---', '***', '___'] },
  { mode: 'block' as const, type: 'ul', match: ['- ', '* '] },
  { mode: 'block' as const, type: 'ol', match: ['1. ', '1) '] },
];

/* ── Block wrapper with drag handle + add button ── */

/** Grip-click menu: block-type changes + utility actions */
const BLOCK_MENU_TYPES: { id: string; label: string; icon: React.ComponentType<{ size?: number }>; type: string }[] = [
  { id: 'p', label: 'Text', icon: Type, type: 'p' },
  { id: 'h1', label: 'Heading 1', icon: Heading1, type: 'h1' },
  { id: 'h2', label: 'Heading 2', icon: Heading2, type: 'h2' },
  { id: 'h3', label: 'Heading 3', icon: Heading3, type: 'h3' },
  { id: 'blockquote', label: 'Quote', icon: Quote, type: 'blockquote' },
];

function BlockMenu({ editor, element, position, onClose }: {
  editor: any;
  element: any;
  position: { top: number; left: number };
  onClose: () => void;
}) {
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const setType = (type: string) => {
    const path = editor.findPath(element);
    if (path) editor.setNodes({ type } as any, { at: path });
    onClose();
  };

  const duplicateBlock = () => {
    const path = editor.findPath(element);
    if (!path) { onClose(); return; }
    const node = editor.node(path);
    if (node) {
      const nextPath = [...path.slice(0, -1), path[path.length - 1] + 1];
      editor.insertNodes(JSON.parse(JSON.stringify(node[0])), { at: nextPath });
    }
    onClose();
  };

  const deleteBlock = () => {
    const path = editor.findPath(element);
    if (path) editor.removeNodes({ at: path });
    onClose();
  };

  const moveUp = () => {
    const path = editor.findPath(element);
    if (!path || path[path.length - 1] === 0) { onClose(); return; }
    const prevPath = [...path.slice(0, -1), path[path.length - 1] - 1];
    editor.moveNodes({ at: path, to: prevPath });
    onClose();
  };

  const moveDown = () => {
    const path = editor.findPath(element);
    if (!path) { onClose(); return; }
    const nextPath = [...path.slice(0, -1), path[path.length - 1] + 2];
    try { editor.moveNodes({ at: path, to: nextPath }); } catch {}
    onClose();
  };

  // Clamp position within viewport
  const menuWidth = 200;
  const menuHeight = 340;
  const padding = 12;
  let top = position.top;
  let left = position.left;
  if (top + menuHeight > window.innerHeight - padding) top = window.innerHeight - menuHeight - padding;
  if (top < padding) top = padding;
  if (left + menuWidth > window.innerWidth - padding) left = window.innerWidth - menuWidth - padding;
  if (left < padding) left = padding;

  return (
    <div ref={menuRef} className="plate-block-menu" style={{ top, left }}>
      <div className="plate-block-menu-section">Turn into</div>
      {BLOCK_MENU_TYPES.map(item => {
        const Icon = item.icon;
        const isActive = element.type === item.type;
        return (
          <button
            key={item.id}
            className={`plate-block-menu-item ${isActive ? 'active' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); setType(item.type); }}
          >
            <Icon size={15} />
            <span>{item.label}</span>
          </button>
        );
      })}
      <div className="plate-block-menu-divider" />
      <button className="plate-block-menu-item" onMouseDown={(e) => { e.preventDefault(); duplicateBlock(); }}>
        <Copy size={15} /> <span>Duplicate</span>
      </button>
      <button className="plate-block-menu-item" onMouseDown={(e) => { e.preventDefault(); moveUp(); }}>
        <ArrowUp size={15} /> <span>Move up</span>
      </button>
      <button className="plate-block-menu-item" onMouseDown={(e) => { e.preventDefault(); moveDown(); }}>
        <ArrowDown size={15} /> <span>Move down</span>
      </button>
      <div className="plate-block-menu-divider" />
      <button className="plate-block-menu-item plate-block-menu-danger" onMouseDown={(e) => { e.preventDefault(); deleteBlock(); }}>
        <Trash2 size={15} /> <span>Delete</span>
      </button>
    </div>
  );
}

/* Shared drag state — lives outside React so all BlockWrappers can coordinate */
const SCROLL_EDGE = 60;   // px from container edge to start scrolling
const SCROLL_MAX = 12;    // max px per frame at the very edge

const dragState = {
  active: false,
  fromPath: null as number[] | null,
  indicator: null as HTMLDivElement | null,
  scrollContainer: null as HTMLElement | null,
  scrollRaf: 0,
  lastMouseY: 0,

  getOrCreateIndicator(): HTMLDivElement {
    if (!this.indicator) {
      const el = document.createElement('div');
      el.className = 'plate-drop-indicator';
      el.style.display = 'none';
      document.body.appendChild(el);
      this.indicator = el;
    }
    return this.indicator;
  },

  showAt(rect: DOMRect, position: 'above' | 'below') {
    const el = this.getOrCreateIndicator();
    const y = position === 'above' ? rect.top : rect.bottom;
    el.style.display = 'block';
    el.style.top = `${y - 1}px`;
    el.style.left = `${rect.left}px`;
    el.style.width = `${rect.width}px`;
  },

  hide() {
    if (this.indicator) this.indicator.style.display = 'none';
  },

  /** Start the auto-scroll loop. Call once when drag begins. */
  startAutoScroll(container: HTMLElement) {
    this.scrollContainer = container;
    const tick = () => {
      if (!this.active || !this.scrollContainer) return;
      const rect = this.scrollContainer.getBoundingClientRect();
      const y = this.lastMouseY;

      if (y < rect.top + SCROLL_EDGE && this.scrollContainer.scrollTop > 0) {
        // Near top edge — scroll up
        const proximity = Math.max(0, 1 - (y - rect.top) / SCROLL_EDGE);
        this.scrollContainer.scrollTop -= Math.ceil(SCROLL_MAX * proximity);
      } else if (y > rect.bottom - SCROLL_EDGE) {
        // Near bottom edge — scroll down
        const proximity = Math.max(0, 1 - (rect.bottom - y) / SCROLL_EDGE);
        this.scrollContainer.scrollTop += Math.ceil(SCROLL_MAX * proximity);
      }

      this.scrollRaf = requestAnimationFrame(tick);
    };
    this.scrollRaf = requestAnimationFrame(tick);
  },

  stopAutoScroll() {
    if (this.scrollRaf) {
      cancelAnimationFrame(this.scrollRaf);
      this.scrollRaf = 0;
    }
    this.scrollContainer = null;
  },

  cleanup() {
    this.active = false;
    this.fromPath = null;
    this.hide();
    this.stopAutoScroll();
    // Remove dragging class from all rows
    document.querySelectorAll('.plate-block-dragging').forEach(el => el.classList.remove('plate-block-dragging'));
    document.body.classList.remove('plate-is-dragging');
  },
};

function BlockWrapper({ element, children: innerContent }: { element: any; children: React.ReactNode }) {
  const editor = useEditorRef() as any;
  const readOnly = useEditorReadOnly();
  const [menuPos, setMenuPos] = React.useState<{ top: number; left: number } | null>(null);
  const rowRef = React.useRef<HTMLDivElement>(null);
  const gripDownPos = React.useRef<{ x: number; y: number; time: number } | null>(null);
  const isDraggingRef = React.useRef(false);

  if (readOnly) return <>{innerContent}</>;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const path = editor.findPath(element);
    if (!path) return;
    const nextPath = [...path.slice(0, -1), path[path.length - 1] + 1];
    editor.insertNodes({ type: 'p', children: [{ text: '' }] } as any, { at: nextPath });
    setTimeout(() => {
      try {
        editor.select(editor.start(nextPath));
        (rowRef.current?.closest('.plate-editor-content') as HTMLElement | null)?.focus();
      } catch {}
    }, 0);
  };

  /* ── Mouse-based drag reorder ── */
  const handleGripMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const path = editor.findPath(element);
    if (!path) return;

    gripDownPos.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    isDraggingRef.current = false;

    const startDrag = () => {
      isDraggingRef.current = true;
      dragState.active = true;
      dragState.fromPath = [...path];
      rowRef.current?.classList.add('plate-block-dragging');
      document.body.classList.add('plate-is-dragging');
      // Find the scrollable ancestor and begin auto-scroll
      const scrollEl = rowRef.current?.closest('.docs-content-inner') as HTMLElement
        ?? rowRef.current?.closest('[style*="overflow"]') as HTMLElement
        ?? document.scrollingElement as HTMLElement;
      if (scrollEl) dragState.startAutoScroll(scrollEl);
    };

    const onMouseMove = (ev: MouseEvent) => {
      dragState.lastMouseY = ev.clientY;

      if (!isDraggingRef.current) {
        // Start drag after 4px movement
        const dx = ev.clientX - gripDownPos.current!.x;
        const dy = ev.clientY - gripDownPos.current!.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) startDrag();
        else return;
      }

      // Find which top-level block row the cursor is over
      const slateEditor = rowRef.current?.closest('[data-slate-editor]');
      const els = slateEditor ? slateEditor.querySelectorAll(':scope > .plate-block-row') : document.querySelectorAll('.plate-block-row');
      let closest: { el: Element; pos: 'above' | 'below' } | null = null;
      let minDist = Infinity;

      els.forEach(el => {
        if (el === rowRef.current) return; // skip self
        const rect = el.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const dist = Math.abs(ev.clientY - midY);
        if (dist < minDist) {
          minDist = dist;
          closest = { el, pos: ev.clientY < midY ? 'above' : 'below' };
        }
      });

      if (closest) {
        const rect = (closest as any).el.getBoundingClientRect();
        dragState.showAt(rect, (closest as any).pos);
      } else {
        dragState.hide();
      }
    };

    const onMouseUp = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      if (!isDraggingRef.current) {
        // Short click → open menu
        const elapsed = Date.now() - (gripDownPos.current?.time ?? 0);
        if (elapsed < 300) {
          const btn = rowRef.current?.querySelector('.plate-block-drag') as HTMLElement;
          if (btn) {
            const rect = btn.getBoundingClientRect();
            setMenuPos({ top: rect.bottom + 4, left: rect.left });
          }
        }
        gripDownPos.current = null;
        return;
      }

      // Execute the move
      const fromPath = dragState.fromPath;
      if (fromPath) {
        // Find target block row under cursor
        const slateEditorEl = rowRef.current?.closest('[data-slate-editor]');
        const els = slateEditorEl ? slateEditorEl.querySelectorAll(':scope > .plate-block-row') : document.querySelectorAll('.plate-block-row');
        let targetEl: Element | null = null;
        let minDist = Infinity;

        els.forEach(el => {
          if (el === rowRef.current) return;
          const rect = el.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          const dist = Math.abs(ev.clientY - midY);
          if (dist < minDist) {
            minDist = dist;
            targetEl = el;
          }
        });

        const target = targetEl as Element | null;
        if (target) {
          // Find the element's path by walking top-level rows
          const allRows = Array.from(els);
          const targetIndex = allRows.indexOf(target);
          const fromIndex = fromPath[fromPath.length - 1];
          const targetRect = target.getBoundingClientRect();
          const insertAbove = ev.clientY < targetRect.top + targetRect.height / 2;

          if (targetIndex >= 0 && targetIndex !== fromIndex) {
            try {
              let toIdx: number;
              if (insertAbove) {
                toIdx = fromIndex < targetIndex ? targetIndex - 1 : targetIndex;
              } else {
                toIdx = fromIndex < targetIndex ? targetIndex : targetIndex + 1;
              }
              editor.moveNodes({ at: fromPath, to: [toIdx] });
            } catch (err) {
              console.warn('Block move failed:', err);
            }
          }
        }
      }

      dragState.cleanup();
      gripDownPos.current = null;
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div
      ref={rowRef}
      className="plate-block-row"
    >
      <div className="plate-block-controls" contentEditable={false}>
        <button className="plate-block-btn" onMouseDown={handleAdd} title="Add block below">
          <Plus size={14} />
        </button>
        <button
          className="plate-block-btn plate-block-drag"
          onMouseDown={handleGripMouseDown}
          title="Drag to reorder · Click for options"
        >
          <GripVertical size={14} />
        </button>
      </div>
      <div className="plate-block-content">{innerContent}</div>
      {menuPos && <BlockMenu editor={editor} element={element} position={menuPos} onClose={() => setMenuPos(null)} />}
    </div>
  );
}

/* ── Custom element renderers ── */

function HeadingElement({ attributes, children, element }: any) {
  const level = element.type === 'h1' ? 1 : element.type === 'h2' ? 2 : 3;
  const Tag = `h${level}` as 'h1' | 'h2' | 'h3';
  return (
    <BlockWrapper element={element}>
      <Tag {...attributes} className={`plate-heading plate-h${level}`}>{children}</Tag>
    </BlockWrapper>
  );
}

function BlockquoteElement({ attributes, children, element }: any) {
  return (
    <BlockWrapper element={element}>
      <blockquote {...attributes} className="plate-blockquote">{children}</blockquote>
    </BlockWrapper>
  );
}

function HrElement({ attributes, children, element }: any) {
  return (
    <BlockWrapper element={element}>
      <div {...attributes} contentEditable={false} className="plate-hr-wrap"><hr className="plate-hr" />{children}</div>
    </BlockWrapper>
  );
}

function CodeBlockElement({ attributes, children, element }: any) {
  return (
    <BlockWrapper element={element}>
      <pre {...attributes} className="plate-code-block"><code>{children}</code></pre>
    </BlockWrapper>
  );
}

function CodeLineElement({ attributes, children }: any) {
  return <div {...attributes} className="plate-code-line">{children}</div>;
}

function ListElement({ attributes, children, element }: any) {
  const Tag = element.type === 'ol' ? 'ol' : 'ul';
  return (
    <BlockWrapper element={element}>
      <Tag {...attributes} className={`plate-list plate-${element.type}`}>{children}</Tag>
    </BlockWrapper>
  );
}

function TodoItemElement({ attributes, children, element }: any) {
  const editor = useEditorRef() as any;
  const checked = !!element.checked;
  return (
    <BlockWrapper element={element}>
      <div {...attributes} className={`plate-todo-item ${checked ? 'plate-todo-checked' : ''}`}>
        <span contentEditable={false} className="plate-todo-checkbox-wrap">
          <input
            type="checkbox"
            className="plate-todo-checkbox"
            checked={checked}
            onChange={(e) => {
              const path = editor.findPath(element);
              if (path) {
                editor.setNodes({ checked: e.target.checked } as any, { at: path });
              }
            }}
          />
        </span>
        <span className="plate-todo-text">{children}</span>
      </div>
    </BlockWrapper>
  );
}

function ListItemElement({ attributes, children }: any) {
  return <li {...attributes} className="plate-li">{children}</li>;
}

/* ── Table elements ── */
function TableElement({ attributes, children }: any) {
  return (
    <div className="plate-table-wrap">
      <table {...attributes} className="plate-table">
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function TableRowElement({ attributes, children }: any) {
  return <tr {...attributes} className="plate-tr">{children}</tr>;
}
function TableCellElement({ attributes, children, element }: any) {
  const ref = React.useRef<HTMLTableCellElement>(null);
  // Determine column index from sibling position so the resize handle can
  // address the correct column via setTableColSize.
  const [colIndex, setColIndex] = React.useState(0);
  React.useEffect(() => {
    const td = ref.current;
    if (!td) return;
    const parent = td.parentElement;
    if (parent) setColIndex(Array.from(parent.children).indexOf(td));
  }, [element]);
  const resize = useColumnResize(ref as any, colIndex, false);
  return (
    <td {...attributes} ref={ref} className="plate-td">
      {children}
      <span className="plate-col-resize" onMouseDown={resize.onMouseDown} aria-hidden="true" />
    </td>
  );
}
function TableCellHeaderElement({ attributes, children, element }: any) {
  const ref = React.useRef<HTMLTableCellElement>(null);
  const [colIndex, setColIndex] = React.useState(0);
  React.useEffect(() => {
    const th = ref.current;
    if (!th) return;
    const parent = th.parentElement;
    if (parent) setColIndex(Array.from(parent.children).indexOf(th));
  }, [element]);
  const resize = useColumnResize(ref as any, colIndex, true);
  return (
    <th {...attributes} ref={ref} className="plate-th">
      {children}
      <span className="plate-col-resize" onMouseDown={resize.onMouseDown} aria-hidden="true" />
    </th>
  );
}

/* ── Image element ──
   Renders the image with resize handles, alignment options, and a delete
   action. Width is stored on the element as a percent ('50%') or 'full'
   so it survives markdown round-trip (encoded via the markdown serializer
   for ![alt](url){width=...}). Alignment is element.align: 'left' | 'center'
   | 'right' (default 'center'). */
function ImageElement({ attributes, children, element }: any) {
  const editor = useEditorRef() as any;
  const readOnly = useEditorReadOnly();
  const url: string = element.url ?? '';
  const alt: string = element.alt ?? '';
  const widthPct: number = typeof element.width === 'number' ? element.width : 60;
  const align: 'left' | 'center' | 'right' = element.align ?? 'center';
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const [showControls, setShowControls] = React.useState(false);
  // Live width during drag — overrides element.width so the user sees the
  // image scale in real time. Cleared (set to null) once mouseup commits
  // the final value to the node tree.
  const [dragWidth, setDragWidth] = React.useState<number | null>(null);

  // Robust path lookup: Plate v48 exposes editor.api.findPath, but we fall
  // back to indexOf on editor.children for top-level nodes if that's missing.
  const findPath = (): number[] | null => {
    try {
      const ed: any = editor;
      if (typeof ed?.api?.findPath === 'function') {
        const p = ed.api.findPath(element);
        if (p) return p as number[];
      }
      // Fallback for top-level blocks
      const idx = (editor.children as any[]).indexOf(element);
      return idx >= 0 ? [idx] : null;
    } catch { return null; }
  };

  const patchElement = (patch: Record<string, unknown>) => {
    const path = findPath();
    if (!path) return;
    try {
      const ed: any = editor;
      if (typeof ed?.tf?.setNodes === 'function') ed.tf.setNodes(patch, { at: path });
      else ed.setNodes(patch, { at: path });
    } catch (err) {
      console.warn('[plate-image] setNodes failed', err);
    }
  };

  const removeImage = () => {
    const path = findPath();
    if (!path) return;
    try {
      const ed: any = editor;
      if (typeof ed?.tf?.removeNodes === 'function') ed.tf.removeNodes({ at: path });
      else ed.removeNodes({ at: path });
    } catch (err) {
      console.warn('[plate-image] removeNodes failed', err);
    }
  };

  // Resize via the bottom-right grip. During drag we only mutate local state
  // (cheap, immediate visual feedback). On mouseup we commit one setNodes call,
  // so the value survives serialization and React only reconciles once.
  const onResizeMouseDown = (e: React.MouseEvent) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const startX = e.clientX;
    const startPct = widthPct;
    const parentWidth = wrap.getBoundingClientRect().width || 1;
    let lastPct = startPct;
    const onMove = (mv: MouseEvent) => {
      const dx = mv.clientX - startX;
      const next = Math.max(15, Math.min(100, startPct + (dx / parentWidth) * 100));
      lastPct = Math.round(next);
      setDragWidth(lastPct);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (lastPct !== startPct) patchElement({ width: lastPct });
      setDragWidth(null);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const align_style =
    align === 'left'   ? { alignSelf: 'flex-start' as const } :
    align === 'right'  ? { alignSelf: 'flex-end'   as const } :
                         { alignSelf: 'center'     as const };

  const effectiveWidth = dragWidth ?? widthPct;

  return (
    <div
      {...attributes}
      ref={wrapRef}
      className={`plate-image-wrap plate-image-align-${align}`}
      contentEditable={false}
      onMouseEnter={() => !readOnly && setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {url ? (
        <div
          ref={boxRef}
          className="plate-image-box"
          style={{ width: `${effectiveWidth}%`, ...align_style }}
        >
          <img src={url} alt={alt} className="plate-image" draggable={false} />
          {showControls && !readOnly && (
            <>
              <span className="plate-image-resize" onMouseDown={onResizeMouseDown} title="Drag to resize" />
              <div className="plate-image-controls" onMouseDown={(e) => e.preventDefault()}>
                <button className={`plate-image-ctl${align === 'left' ? ' is-active' : ''}`}   title="Align left"   onClick={() => patchElement({ align: 'left' })}><AlignLeft size={12} /></button>
                <button className={`plate-image-ctl${align === 'center' ? ' is-active' : ''}`} title="Align center" onClick={() => patchElement({ align: 'center' })}><AlignCenter size={12} /></button>
                <button className={`plate-image-ctl${align === 'right' ? ' is-active' : ''}`}  title="Align right"  onClick={() => patchElement({ align: 'right' })}><AlignRight size={12} /></button>
                <span className="plate-image-ctl-sep" />
                {widthPct === 100 ? (
                  <button
                    className="plate-image-ctl is-active"
                    title="Restore previous size"
                    onClick={() => patchElement({ width: element.prevWidth ?? 60 })}
                  ><Minimize2 size={12} /></button>
                ) : (
                  <button
                    className="plate-image-ctl"
                    title="Full width"
                    onClick={() => patchElement({ width: 100, prevWidth: widthPct })}
                  ><Maximize2 size={12} /></button>
                )}
                <button className="plate-image-ctl destructive" title="Delete image" onClick={removeImage}>
                  <Trash2 size={12} />
                </button>
              </div>
              {dragWidth !== null && (
                <div className="plate-image-size-badge">{effectiveWidth}%</div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="plate-image-placeholder">Image (no source)</div>
      )}
      {/* Slate void elements still need to render children for selection */}
      <span style={{ display: 'none' }}>{children}</span>
    </div>
  );
}

/* ── Column layout elements ──
   2- or 3-column block. The ColumnPlugin handles drag-resize internally
   in later Plate versions; we render a CSS grid with equal widths for now. */
function ColumnElement({ attributes, children, element }: any) {
  const count = Array.isArray(element?.children) ? element.children.length : 2;
  return (
    <div
      {...attributes}
      className="plate-column-group"
      style={{ ['--columns' as any]: count }}
    >
      {children}
    </div>
  );
}
function ColumnItemElement({ attributes, children }: any) {
  return <div {...attributes} className="plate-column-item">{children}</div>;
}

function ParagraphElement({ attributes, children, element }: any) {
  return (
    <BlockWrapper element={element}>
      <p {...attributes} className="plate-p">{children}</p>
    </BlockWrapper>
  );
}

/* ── Leaf renderers (marks) ── */

function BoldLeaf({ attributes, children }: any) {
  return <strong {...attributes}>{children}</strong>;
}

function ItalicLeaf({ attributes, children }: any) {
  return <em {...attributes}>{children}</em>;
}

function UnderlineLeaf({ attributes, children }: any) {
  return <u {...attributes}>{children}</u>;
}

function StrikethroughLeaf({ attributes, children }: any) {
  return <s {...attributes}>{children}</s>;
}

function CodeLeaf({ attributes, children }: any) {
  return <code {...attributes} className="plate-inline-code">{children}</code>;
}

/* ── Slash Command Menu ── */

interface SlashCommandContext {
  /** PIN/API token forwarded to upload endpoints used by `/image` etc. */
  authToken?: string;
}

interface SlashCommand {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number }>;
  keywords: string[];
  action: (editor: any, ctx?: SlashCommandContext) => void;
}

const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'text',
    label: 'Text',
    description: 'Plain paragraph text',
    icon: Type,
    keywords: ['paragraph', 'normal', 'text', 'plain'],
    action: (editor) => {
      editor.setNodes({ type: 'p' });
    },
  },
  {
    id: 'h1',
    label: 'Heading 1',
    description: 'Large section heading',
    icon: Heading1,
    keywords: ['heading', 'title', 'h1', 'large'],
    action: (editor) => {
      editor.setNodes({ type: 'h1' });
    },
  },
  {
    id: 'h2',
    label: 'Heading 2',
    description: 'Medium section heading',
    icon: Heading2,
    keywords: ['heading', 'subtitle', 'h2', 'medium'],
    action: (editor) => {
      editor.setNodes({ type: 'h2' });
    },
  },
  {
    id: 'h3',
    label: 'Heading 3',
    description: 'Small section heading',
    icon: Heading3,
    keywords: ['heading', 'h3', 'small'],
    action: (editor) => {
      editor.setNodes({ type: 'h3' });
    },
  },
  {
    id: 'ul',
    label: 'Bulleted List',
    description: 'Unordered bullet list',
    icon: List,
    keywords: ['bullet', 'unordered', 'list', 'ul'],
    action: (editor) => {
      editor.tf.toggle.bulletedList();
    },
  },
  {
    id: 'ol',
    label: 'Numbered List',
    description: 'Ordered numbered list',
    icon: ListOrdered,
    keywords: ['numbered', 'ordered', 'list', 'ol'],
    action: (editor) => {
      editor.tf.toggle.numberedList();
    },
  },
  {
    id: 'checklist',
    label: 'Checklist',
    description: 'To-do checklist with checkboxes',
    icon: ListChecks,
    keywords: ['todo', 'check', 'checklist', 'task'],
    action: (editor) => {
      editor.setNodes({ type: 'action_item', checked: false } as any);
    },
  },
  {
    id: 'blockquote',
    label: 'Quote',
    description: 'Block quotation',
    icon: Quote,
    keywords: ['quote', 'blockquote', 'callout'],
    action: (editor) => {
      editor.setNodes({ type: 'blockquote' });
    },
  },
  {
    id: 'code_block',
    label: 'Code Block',
    description: 'Fenced code block',
    icon: FileCode2,
    keywords: ['code', 'codeblock', 'pre', 'snippet', 'fenced'],
    action: (editor) => {
      // Replace current block with a code_block containing a code_line
      const text = editor.string(editor.selection?.anchor.path.slice(0, 1) ?? [0]);
      editor.removeNodes();
      editor.insertNodes({
        type: 'code_block',
        children: [{ type: 'code_line', children: [{ text: text || '' }] }],
      });
    },
  },
  {
    id: 'hr',
    label: 'Divider',
    description: 'Horizontal divider line',
    icon: Minus,
    keywords: ['divider', 'horizontal', 'rule', 'line', 'separator', 'hr'],
    action: (editor) => {
      editor.insertNodes([
        { type: 'hr', children: [{ text: '' }] },
        { type: 'p', children: [{ text: '' }] },
      ]);
    },
  },
  {
    id: 'table',
    label: 'Table',
    description: '3×3 table — drop in rows/cols via right-click later',
    icon: Type,
    keywords: ['table', 'grid', 'rows', 'columns'],
    action: (editor) => {
      const cell = (text = '') => ({ type: 'td', children: [{ type: 'p', children: [{ text }] }] });
      const headerCell = (text = '') => ({ type: 'th', children: [{ type: 'p', children: [{ text }] }] });
      const row = (cells: any[]) => ({ type: 'tr', children: cells });
      editor.insertNodes({
        type: 'table',
        children: [
          row([headerCell('Header 1'), headerCell('Header 2'), headerCell('Header 3')]),
          row([cell(), cell(), cell()]),
          row([cell(), cell(), cell()]),
        ],
      });
    },
  },
  {
    id: 'image',
    label: 'Image',
    description: 'Upload an image (or just paste / drag one in)',
    icon: Plus,
    keywords: ['image', 'img', 'picture', 'photo', 'upload'],
    action: (editor, ctx) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
          const form = new FormData();
          form.append('file', file);
          const res = await fetch('/pod/files/inline', {
            method: 'POST',
            body: form,
            headers: ctx?.authToken ? { authorization: `Bearer ${ctx.authToken}` } : undefined,
          });
          if (!res.ok) throw new Error(`Upload ${res.status}`);
          const { url } = await res.json() as { url: string };
          editor.insertNodes({ type: 'img', url, alt: file.name.replace(/\.[^.]+$/, ''), children: [{ text: '' }] });
        } catch (err) {
          console.error('[plate] image upload failed', err);
        }
      };
      input.click();
    },
  },
  {
    id: 'columns-2',
    label: '2-column layout',
    description: 'Side-by-side blocks (e.g. image + text)',
    icon: Type,
    keywords: ['columns', 'column', 'side', 'layout', 'grid', '2'],
    action: (editor) => {
      const emptyCol = () => ({ type: 'column', children: [{ type: 'p', children: [{ text: '' }] }] });
      editor.insertNodes({
        type: 'column_group',
        children: [emptyCol(), emptyCol()],
      });
    },
  },
  {
    id: 'columns-3',
    label: '3-column layout',
    description: 'Three side-by-side blocks',
    icon: Type,
    keywords: ['columns', 'column', 'three', 'layout', 'grid', '3'],
    action: (editor) => {
      const emptyCol = () => ({ type: 'column', children: [{ type: 'p', children: [{ text: '' }] }] });
      editor.insertNodes({
        type: 'column_group',
        children: [emptyCol(), emptyCol(), emptyCol()],
      });
    },
  },
];

function SlashCommandMenu({ editor, onClose, ctx }: { editor: any; onClose: () => void; ctx?: SlashCommandContext }) {
  const [query, setQuery] = React.useState('');
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Position the menu near the cursor
  React.useEffect(() => {
    const domSelection = window.getSelection();
    if (!domSelection || domSelection.rangeCount === 0) {
      onClose();
      return;
    }
    const range = domSelection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const padding = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // On narrow screens use a slimmer menu
    const menuWidth = Math.min(280, vw - padding * 2);
    const menuHeight = 340;

    let top = rect.bottom + 4;
    let left = rect.left;

    // Flip above if not enough room below
    if (top + menuHeight > vh - padding) {
      top = rect.top - menuHeight - 4;
    }
    // If still off-screen (tiny viewport), clamp to top
    if (top < padding) top = padding;

    // Clamp left so menu stays fully within viewport
    if (left + menuWidth > vw - padding) {
      left = vw - menuWidth - padding;
    }
    if (left < padding) left = padding;

    setPosition({ top, left });

    // Focus the hidden input for keyboard control
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const filtered = React.useMemo(() => {
    if (!query) return SLASH_COMMANDS;
    const q = query.toLowerCase();
    return SLASH_COMMANDS.filter(cmd =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.description.toLowerCase().includes(q) ||
      cmd.keywords.some(k => k.includes(q))
    );
  }, [query]);

  React.useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const execute = (cmd: SlashCommand) => {
    // Delete the slash character that triggered the menu
    editor.deleteBackward('character');
    cmd.action(editor, ctx);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => (i + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) execute(filtered[selectedIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // Close on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  if (!position) return null;

  return (
    <div ref={menuRef} className="slash-command-menu" style={{ top: position.top, left: position.left }}>
      <div className="slash-command-search">
        <input
          ref={inputRef}
          className="slash-command-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Filter..."
          autoComplete="off"
        />
      </div>
      <div className="slash-command-list">
        {filtered.length === 0 ? (
          <div className="slash-command-empty">No matching blocks</div>
        ) : (
          filtered.map((cmd, i) => {
            const Icon = cmd.icon;
            return (
              <button
                key={cmd.id}
                className={`slash-command-item ${i === selectedIndex ? 'selected' : ''}`}
                onMouseEnter={() => setSelectedIndex(i)}
                onMouseDown={(e) => { e.preventDefault(); execute(cmd); }}
              >
                <span className="slash-command-icon"><Icon size={18} /></span>
                <span className="slash-command-text">
                  <span className="slash-command-label">{cmd.label}</span>
                  <span className="slash-command-desc">{cmd.description}</span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ── Floating Toolbar ── */

function FloatingToolbar() {
  const editor = useEditorRef() as any;
  const selection = useEditorSelection();
  const readOnly = useEditorReadOnly();
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null);
  const toolbarRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (readOnly || !selection) {
      setPosition(null);
      return;
    }

    const timer = setTimeout(() => {
      const domSelection = window.getSelection();
      if (!domSelection || domSelection.isCollapsed || domSelection.rangeCount === 0) {
        setPosition(null);
        return;
      }

      const range = domSelection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      if (rect.width === 0 && rect.height === 0) {
        setPosition(null);
        return;
      }

      // Measure the actual toolbar if available, otherwise estimate
      const toolbarEl = toolbarRef.current;
      const toolbarWidth = toolbarEl?.offsetWidth ?? 220;
      const toolbarHeight = toolbarEl?.offsetHeight ?? 38;
      const padding = 12;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Prefer above selection; flip below if no room
      let top = rect.top - toolbarHeight - 8;
      if (top < padding) {
        top = rect.bottom + 8;
      }
      // If still off-screen bottom, clamp
      if (top + toolbarHeight > vh - padding) {
        top = vh - toolbarHeight - padding;
      }

      // Centre on selection midpoint, then clamp within viewport
      let left = rect.left + rect.width / 2;
      const halfToolbar = toolbarWidth / 2;
      if (left - halfToolbar < padding) {
        left = halfToolbar + padding;
      } else if (left + halfToolbar > vw - padding) {
        left = vw - halfToolbar - padding;
      }

      setPosition({ top, left });
    }, 100);

    return () => clearTimeout(timer);
  }, [selection, readOnly]);

  if (!position) return null;

  const toggleMark = (key: string) => {
    const isActive = editor.getMarks()?.[key];
    if (isActive) {
      editor.removeMark(key);
    } else {
      editor.addMark(key, true);
    }
  };

  const isMarkActive = (key: string) => !!editor.getMarks()?.[key];

  return (
    <div
      ref={toolbarRef}
      className="plate-floating-toolbar"
      style={{ top: position.top, left: position.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <button className={`plate-toolbar-btn ${isMarkActive('bold') ? 'active' : ''}`} onMouseDown={(e) => { e.preventDefault(); toggleMark('bold'); }} title="Bold">
        <BoldIcon size={15} />
      </button>
      <button className={`plate-toolbar-btn ${isMarkActive('italic') ? 'active' : ''}`} onMouseDown={(e) => { e.preventDefault(); toggleMark('italic'); }} title="Italic">
        <ItalicIcon size={15} />
      </button>
      <button className={`plate-toolbar-btn ${isMarkActive('underline') ? 'active' : ''}`} onMouseDown={(e) => { e.preventDefault(); toggleMark('underline'); }} title="Underline">
        <UnderlineIcon size={15} />
      </button>
      <button className={`plate-toolbar-btn ${isMarkActive('strikethrough') ? 'active' : ''}`} onMouseDown={(e) => { e.preventDefault(); toggleMark('strikethrough'); }} title="Strikethrough">
        <StrikethroughIcon size={15} />
      </button>
      <span className="plate-toolbar-sep" />
      <button className={`plate-toolbar-btn ${isMarkActive('code') ? 'active' : ''}`} onMouseDown={(e) => { e.preventDefault(); toggleMark('code'); }} title="Inline code">
        <CodeIcon size={15} />
      </button>
    </div>
  );
}

/* ── Markdown round-trip helpers ── */

function createEditorForSerialization() {
  return createSlateEditor({
    plugins: [
      HeadingPlugin,
      BlockquotePlugin,
      HorizontalRulePlugin,
      CodeBlockPlugin,
      CodeLinePlugin,
      ListPlugin,
      BulletedListPlugin,
      NumberedListPlugin,
      ListItemPlugin,
      ListItemContentPlugin,
      TodoListPlugin,
      BoldPlugin,
      ItalicPlugin,
      UnderlinePlugin,
      StrikethroughPlugin,
      CodePlugin,
      // These must mirror the main editor's plugin set — without them the
      // markdown round-trip silently drops blocks of the corresponding type
      // (a pasted table renders fine on screen, then disappears on save
      //  because serializeMd has no rule for the unknown node).
      TablePlugin,
      TableRowPlugin,
      TableCellPlugin,
      TableCellHeaderPlugin,
      ImagePlugin,
      ColumnPlugin,
      ColumnItemPlugin,
      // GFM enables tables, strikethrough, autolinks, task lists in the
      // markdown <-> Slate round-trip. Without it, pipe-syntax tables in
      // wiki bodies render as raw paragraphs.
      MarkdownPlugin.configure({ options: { remarkPlugins: [remarkGfm] } }),
    ],
  });
}

export function markdownToPlateValue(markdown: string): Value {
  try {
    const editor = createEditorForSerialization();
    const nodes = deserializeMd(editor, markdown);
    return (nodes && nodes.length > 0) ? nodes as Value : [{ type: 'p', children: [{ text: '' }] }];
  } catch (err) {
    console.warn('Failed to deserialize markdown:', err);
    return [{ type: 'p', children: [{ text: markdown }] }];
  }
}

export function plateValueToMarkdown(value: Value): string {
  try {
    const editor = createEditorForSerialization();
    return serializeMd(editor, { value });
  } catch (err) {
    console.warn('Failed to serialize to markdown:', err);
    return value.map((n: any) => {
      if (n.children) return n.children.map((c: any) => c.text ?? '').join('');
      return n.text ?? '';
    }).join('\n');
  }
}

/* ── Table editing toolbar ──
   Appears when the cursor is inside a table cell. Provides add/delete row +
   column + delete table operations. Column-width drag handles are rendered
   per-cell in TableCellElement, not here. */

function TableToolbar() {
  const editor = useEditorRef() as any;
  const selection = useEditorSelection();
  const readOnly = useEditorReadOnly();
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (readOnly || !selection) { setPosition(null); return; }
    // Slate API: find a <table> ancestor for the current selection
    const tableEntry = getTableAbove(editor as any, { at: selection.anchor.path });
    if (!tableEntry) { setPosition(null); return; }

    const timer = setTimeout(() => {
      try {
        const domNode = (editor as any).api?.toDOMNode?.(tableEntry[0]) as HTMLElement | null;
        const rect = domNode?.getBoundingClientRect();
        if (!rect) { setPosition(null); return; }
        const toolbarH = ref.current?.offsetHeight ?? 36;
        let top = rect.top - toolbarH - 6;
        if (top < 8) top = rect.bottom + 6;
        const left = rect.left;
        setPosition({ top, left });
      } catch { setPosition(null); }
    }, 50);

    return () => clearTimeout(timer);
  }, [selection, readOnly, editor]);

  if (!position) return null;

  const run = (fn: () => void) => () => {
    try { fn(); } catch (err) { console.warn('[table-toolbar]', err); }
  };

  return (
    <div
      ref={ref}
      className="plate-table-toolbar"
      style={{ top: position.top, left: position.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <button className="plate-table-tb-btn" title="Add row above" onClick={run(() => insertTableRow(editor as any, { fromRow: undefined, disableSelect: false, header: false, at: undefined } as any))}>
        <ArrowUp size={13} />
      </button>
      <button className="plate-table-tb-btn" title="Add row below" onClick={run(() => insertTableRow(editor as any))}>
        <ArrowDown size={13} />
      </button>
      <span className="plate-table-tb-sep" />
      <button className="plate-table-tb-btn" title="Add column left" onClick={run(() => insertTableColumn(editor as any, { before: true } as any))}>
        <ArrowUp size={13} style={{ transform: 'rotate(-90deg)' }} />
      </button>
      <button className="plate-table-tb-btn" title="Add column right" onClick={run(() => insertTableColumn(editor as any))}>
        <ArrowDown size={13} style={{ transform: 'rotate(-90deg)' }} />
      </button>
      <span className="plate-table-tb-sep" />
      <button className="plate-table-tb-btn" title="Delete row" onClick={run(() => deleteTableRow(editor as any))}>
        <Trash2 size={13} /> R
      </button>
      <button className="plate-table-tb-btn" title="Delete column" onClick={run(() => deleteTableColumn(editor as any))}>
        <Trash2 size={13} /> C
      </button>
      <span className="plate-table-tb-sep" />
      <button className="plate-table-tb-btn destructive" title="Delete table" onClick={run(() => deleteTable(editor as any))}>
        <Trash2 size={13} />
      </button>
    </div>
  );
}

/* ── Column resize handles ──
   Render a small grip on the right edge of each header cell. mousedown +
   mousemove + setTableColSize for live width updates.
   Active only on header row to avoid stacked handles per column. */
function useColumnResize(cellRef: React.RefObject<HTMLElement>, columnIndex: number, isHeader: boolean) {
  const editor = useEditorRef();

  const onMouseDown = React.useCallback((e: React.MouseEvent) => {
    if (!isHeader) return;
    const cell = cellRef.current;
    if (!cell) return;
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startWidth = cell.getBoundingClientRect().width;
    const tableEl = cell.closest('table') as HTMLTableElement | null;
    if (!tableEl) return;

    const onMove = (mv: MouseEvent) => {
      const dx = mv.clientX - startX;
      const newWidth = Math.max(60, startWidth + dx);
      // Update via Plate transform so it survives serialization
      try {
        const tableEntry = getTableAbove(editor as any);
        if (tableEntry) {
          setTableColSize(editor as any, { colIndex: columnIndex, width: newWidth } as any);
        }
      } catch {/* fall back to inline style only */}
      // Visual preview while dragging
      cell.style.width = `${newWidth}px`;
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [cellRef, columnIndex, isHeader, editor]);

  return { onMouseDown };
}

/* ── Main Editor Component ── */

interface PlateDocEditorProps {
  /** Initial markdown content */
  initialContent: string;
  /** Called with markdown string when content changes (debounced) */
  onChange: (markdown: string) => void;
  /** Read-only mode */
  readOnly?: boolean;
  /** Auto-focus the editor on mount (e.g. after creating a new doc) */
  autoFocus?: boolean;
  /** PIN/API token forwarded to /pod/files/inline uploads (image paste, drop, slash) */
  authToken?: string;
}

export function PlateDocEditor({ initialContent, onChange, readOnly = false, autoFocus = false, authToken }: PlateDocEditorProps) {
  const initialValue = React.useMemo(() => markdownToPlateValue(initialContent), [initialContent]);
  const [showSlashMenu, setShowSlashMenu] = React.useState(false);

  const editor = usePlateEditor({
    value: initialValue,
    plugins: [
      HeadingPlugin,
      BlockquotePlugin.configure({
        render: { node: BlockquoteElement },
      }),
      HorizontalRulePlugin.configure({
        render: { node: HrElement },
      }),
      CodeBlockPlugin.configure({
        render: { node: CodeBlockElement },
      }),
      CodeLinePlugin.configure({
        render: { node: CodeLineElement },
      }),
      CodeSyntaxPlugin,
      ListPlugin,
      BulletedListPlugin.configure({
        render: { node: ListElement },
      }),
      NumberedListPlugin.configure({
        render: { node: ListElement },
      }),
      ListItemPlugin.configure({
        render: { node: ListItemElement },
      }),
      ListItemContentPlugin,
      TodoListPlugin.configure({
        render: { node: TodoItemElement },
      }),
      BoldPlugin.configure({
        render: { leaf: BoldLeaf },
      }),
      ItalicPlugin.configure({
        render: { leaf: ItalicLeaf },
      }),
      UnderlinePlugin.configure({
        render: { leaf: UnderlineLeaf },
      }),
      StrikethroughPlugin.configure({
        render: { leaf: StrikethroughLeaf },
      }),
      CodePlugin.configure({
        render: { leaf: CodeLeaf },
      }),
      AutoformatPlugin.configure({
        options: { rules: autoformatRules },
      }),
      // Tables (paste from Google Docs / Notion / ChatGPT preserves structure)
      TablePlugin.configure({
        render: { node: TableElement },
      }),
      TableRowPlugin.configure({
        render: { node: TableRowElement },
      }),
      TableCellPlugin.configure({
        render: { node: TableCellElement },
      }),
      TableCellHeaderPlugin.configure({
        render: { node: TableCellHeaderElement },
      }),
      // Images (paste from clipboard + drag/drop file upload below)
      ImagePlugin.configure({
        render: { node: ImageElement },
      }),
      // Column layout (Notion-style 2/3-column blocks via slash command)
      ColumnPlugin.configure({
        render: { node: ColumnElement },
      }),
      ColumnItemPlugin.configure({
        render: { node: ColumnItemElement },
      }),
      // GFM enables tables, strikethrough, autolinks, task lists in the
      // markdown <-> Slate round-trip. Without it, pipe-syntax tables in
      // wiki bodies render as raw paragraphs.
      MarkdownPlugin.configure({ options: { remarkPlugins: [remarkGfm] } }),
    ],
    override: {
      components: {
        p: ParagraphElement,
        h1: HeadingElement,
        h2: HeadingElement,
        h3: HeadingElement,
      },
    },
  }) as any;

  // Place cursor at the very start when autoFocus is on
  React.useEffect(() => {
    if (autoFocus && editor) {
      try {
        const start = editor.start([0, 0]);
        editor.select(start);
        const el = document.querySelector('.plate-editor-content') as HTMLElement | null;
        el?.focus();
      } catch {}
    }
  }, [autoFocus, editor]);

  // Debounced save
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const handleChange = React.useCallback(({ value }: { value: Value }) => {
    if (readOnly) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const md = plateValueToMarkdown(value);
      onChange(md);
    }, 800);
  }, [onChange, readOnly]);

  React.useEffect(() => {
    return () => clearTimeout(saveTimer.current);
  }, []);

  // ── Paste handler: clipboard images → upload + insert image block ──
  // (Tables and other HTML structures flow through Plate's built-in
  //  deserializer — the TablePlugin + MarkdownPlugin combination now
  //  preserves <table> structure that previously degraded to flat text.)
  const handlePaste = React.useCallback(async (event: React.ClipboardEvent) => {
    if (readOnly) return;
    const items = Array.from(event.clipboardData?.items ?? []);
    const imageItem = items.find((it) => it.type.startsWith('image/'));
    if (!imageItem) return; // not an image — let Plate handle text/html
    event.preventDefault();
    const blob = imageItem.getAsFile();
    if (!blob) return;
    // Convert to data URL → POST to /pod/files/inline/base64 → insert <img> block
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = () => reject(new Error('FileReader failed'));
        fr.readAsDataURL(blob);
      });
      const res = await fetch('/pod/files/inline/base64', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ data_url: dataUrl }),
      });
      if (!res.ok) throw new Error(`Upload ${res.status}`);
      const { url } = await res.json() as { url: string };
      editor.insertNodes({ type: 'img', url, alt: '', children: [{ text: '' }] } as any);
    } catch (err) {
      console.error('[plate] image paste failed', err);
    }
  }, [editor, readOnly]);

  // ── Drag-drop file upload (images only) ──
  const [isDragOver, setIsDragOver] = React.useState(false);
  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    if (readOnly) return;
    if (Array.from(e.dataTransfer?.items ?? []).some((it) => it.kind === 'file' && it.type.startsWith('image/'))) {
      e.preventDefault();
      setIsDragOver(true);
    }
  }, [readOnly]);
  const handleDragLeave = React.useCallback(() => { setIsDragOver(false); }, []);
  const handleDrop = React.useCallback(async (e: React.DragEvent) => {
    if (readOnly) return;
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;
    e.preventDefault();
    for (const file of files) {
      try {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch('/pod/files/inline', {
          method: 'POST',
          body: form,
          headers: authToken ? { authorization: `Bearer ${authToken}` } : undefined,
        });
        if (!res.ok) throw new Error(`Upload ${res.status}`);
        const { url } = await res.json() as { url: string };
        editor.insertNodes({ type: 'img', url, alt: file.name.replace(/\.[^.]+$/, ''), children: [{ text: '' }] } as any);
      } catch (err) {
        console.error('[plate] image drop failed', err);
      }
    }
  }, [editor, readOnly]);

  // Listen for "/" keypress to trigger slash menu
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !showSlashMenu) {
      // Check if the cursor is at the start of an empty block or after a space
      const { selection } = editor;
      if (selection) {
        const [node] = editor.node(selection.anchor.path) as any;
        const text = node?.text ?? '';
        // Show slash menu if line is empty or cursor is right after we type /
        if (text === '' || selection.anchor.offset === text.length) {
          // Let the "/" character be inserted first, then show the menu
          setTimeout(() => setShowSlashMenu(true), 0);
        }
      }
    }
  }, [editor, showSlashMenu]);

  const handleAddAtEnd = () => {
    const lastIdx = editor.children.length;
    const path = [lastIdx];
    editor.insertNodes({ type: 'p', children: [{ text: '' }] } as any, { at: path });
    setTimeout(() => {
      try {
        editor.select(editor.start(path));
        const el = document.querySelector('.plate-editor-content') as HTMLElement | null;
        el?.focus();
      } catch {}
    }, 0);
  };

  return (
    <div className="plate-editor-wrap">
      <Plate editor={editor} onChange={handleChange}>
        <FloatingToolbar />
        <TableToolbar />
        {showSlashMenu && (
          <SlashCommandMenu
            editor={editor}
            onClose={() => setShowSlashMenu(false)}
            ctx={{ authToken }}
          />
        )}
        <PlateContent
          className={`plate-editor-content${isDragOver ? ' is-drag-over' : ''}`}
          readOnly={readOnly}
          autoFocus={autoFocus}
          placeholder="What's on your mind.."
          spellCheck
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        />
        {!readOnly && (
          <div className="plate-empty-zone" onClick={handleAddAtEnd} />
        )}
      </Plate>
    </div>
  );
}
