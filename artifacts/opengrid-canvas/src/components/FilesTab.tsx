import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  File as FileIcon,
  Folder,
  Home as HomeIcon,
  RefreshCcw,
  Save,
  AlertCircle,
  Loader2,
  Search,
  FilePlus,
  FolderPlus,
  Trash2,
  Pencil,
  X,
} from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { dracula } from '@uiw/codemirror-theme-dracula';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { css as cssLang } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { keymap, EditorView } from '@codemirror/view';
import { apiFetch } from '../lib/api';

interface FilesTabProps {
  panelId: string;
  initialPath?: string;
}

interface Entry {
  name: string;
  path: string;
  type: 'file' | 'dir' | 'symlink';
  size: number;
  mtime: number;
}

interface ListResponse {
  path: string;
  parent: string | null;
  entries: Entry[];
  truncated: boolean;
  root: string;
}

interface ReadResponse {
  path: string;
  size: number;
  binary: boolean;
  content: string;
  mtime: number;
}

interface SearchResponse {
  path: string;
  query: string;
  results: Array<{ name: string; path: string; type: 'file' | 'dir' }>;
  visited: number;
  truncated: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getLangExtension(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return javascript({ jsx: true });
    case 'ts':
    case 'tsx':
      return javascript({ jsx: true, typescript: true });
    case 'json':
      return json();
    case 'css':
    case 'scss':
    case 'sass':
      return cssLang();
    case 'html':
    case 'htm':
    case 'xml':
    case 'svg':
      return html();
    case 'md':
    case 'mdx':
      return markdown();
    case 'py':
      return python();
    default:
      return null;
  }
}

export function FilesTab({ panelId, initialPath }: FilesTabProps) {
  void panelId;
  const [cwd, setCwd] = useState<string>(initialPath || '');
  const [root, setRoot] = useState<string>('');
  const [listing, setListing] = useState<ListResponse | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);

  const [editing, setEditing] = useState<ReadResponse | null>(null);
  const [draft, setDraft] = useState<string>('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const requestId = useRef(0);
  const openRequestId = useRef(0);
  const searchRequestId = useRef(0);
  const saveTargetRef = useRef<string | null>(null);
  const draftRef = useRef(draft);
  useEffect(() => { draftRef.current = draft; }, [draft]);

  const loadDir = useCallback(async (target: string) => {
    setListLoading(true);
    setListError(null);
    const reqId = ++requestId.current;
    try {
      // No target => server defaults to this session's workspace root.
      const url = target
        ? `/api/files/list?path=${encodeURIComponent(target)}`
        : `/api/files/list`;
      const r = await apiFetch(url);
      const data = (await r.json()) as ListResponse | { error: string };
      if (reqId !== requestId.current) return;
      if (!r.ok || 'error' in data) {
        setListError(('error' in data && data.error) || `HTTP ${r.status}`);
        setListing(null);
      } else {
        setListing(data);
        setCwd(data.path);
        if (data.root) setRoot(data.root);
      }
    } catch (err) {
      if (reqId !== requestId.current) return;
      setListError((err as Error).message);
    } finally {
      if (reqId === requestId.current) setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDir(cwd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search
  useEffect(() => {
    if (!searchOpen) return;
    const q = searchQ.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    const reqId = ++searchRequestId.current;
    setSearchLoading(true);
    const handle = window.setTimeout(async () => {
      try {
        const r = await apiFetch(
          `/api/files/search?path=${encodeURIComponent(cwd)}&q=${encodeURIComponent(q)}`,
        );
        const data = (await r.json()) as SearchResponse | { error: string };
        if (reqId !== searchRequestId.current) return;
        if (!r.ok || 'error' in data) {
          setSearchResults(null);
        } else {
          setSearchResults(data);
        }
      } catch {
        if (reqId === searchRequestId.current) setSearchResults(null);
      } finally {
        if (reqId === searchRequestId.current) setSearchLoading(false);
      }
    }, 220);
    return () => window.clearTimeout(handle);
  }, [searchQ, searchOpen, cwd]);

  const openFile = useCallback(async (entryPath: string) => {
    setEditError(null);
    setSaveOk(false);
    const reqId = ++openRequestId.current;
    try {
      const r = await apiFetch(`/api/files/read?path=${encodeURIComponent(entryPath)}`);
      const data = (await r.json()) as ReadResponse | { error: string };
      if (reqId !== openRequestId.current) return;
      if (!r.ok || 'error' in data) {
        setEditError(('error' in data && data.error) || `HTTP ${r.status}`);
        return;
      }
      if (data.binary) {
        setEditError('Binary file — cannot edit as text.');
        setEditing(data);
        setDraft('');
        setDirty(false);
        return;
      }
      setEditing(data);
      setDraft(data.content);
      setDirty(false);
    } catch (err) {
      if (reqId !== openRequestId.current) return;
      setEditError((err as Error).message);
    }
  }, []);

  const onEntryClick = (entry: Entry) => {
    if (entry.type === 'dir') {
      setSearchOpen(false);
      setSearchQ('');
      loadDir(entry.path);
    } else if (entry.type === 'file') {
      openFile(entry.path);
    }
  };

  const onSearchResultClick = (r: { name: string; path: string; type: 'file' | 'dir' }) => {
    if (r.type === 'dir') {
      setSearchOpen(false);
      setSearchQ('');
      loadDir(r.path);
    } else {
      openFile(r.path);
    }
  };

  const goUp = () => {
    if (listing?.parent) loadDir(listing.parent);
  };
  const goHome = () => loadDir(root || '');

  const closeEditor = () => {
    if (dirty && !confirm('Discard unsaved changes?')) return;
    setEditing(null);
    setDraft('');
    setDirty(false);
    setEditError(null);
    setSaveOk(false);
  };

  const save = useCallback(async () => {
    if (!editing || saving) return;
    const target = editing.path;
    const content = draftRef.current;
    saveTargetRef.current = target;
    setSaving(true);
    setEditError(null);
    setSaveOk(false);
    try {
      const r = await apiFetch('/api/files/write', {
        method: 'PUT',
        json: { path: target, content },
      });
      const data = (await r.json()) as { error?: string; size?: number; mtime?: number };
      if (saveTargetRef.current !== target) return;
      if (!r.ok) {
        setEditError(data.error || `HTTP ${r.status}`);
      } else {
        setDirty(false);
        setSaveOk(true);
        setEditing((prev) =>
          prev && prev.path === target
            ? { ...prev, size: data.size ?? prev.size, mtime: data.mtime ?? prev.mtime }
            : prev,
        );
        window.setTimeout(() => setSaveOk(false), 1500);
      }
    } catch (err) {
      if (saveTargetRef.current !== target) return;
      setEditError((err as Error).message);
    } finally {
      if (saveTargetRef.current === target) setSaving(false);
    }
  }, [editing, saving]);

  // Cmd/Ctrl+S at the window level (CodeMirror also has a keymap below)
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, save]);

  // ───────────────────────── CRUD actions ─────────────────────────
  const createFile = async () => {
    const name = window.prompt('New file name:');
    if (!name || name.includes('/')) return;
    const target = `${cwd}/${name}`;
    try {
      const r = await apiFetch('/api/files/write', { method: 'PUT', json: { path: target, content: '' } });
      if (!r.ok) {
        const d = (await r.json()) as { error?: string };
        setListError(d.error || `HTTP ${r.status}`);
        return;
      }
      await loadDir(cwd);
      openFile(target);
    } catch (err) {
      setListError((err as Error).message);
    }
  };

  const createFolder = async () => {
    const name = window.prompt('New folder name:');
    if (!name || name.includes('/')) return;
    const target = `${cwd}/${name}`;
    try {
      const r = await apiFetch('/api/files/mkdir', { method: 'POST', json: { path: target } });
      if (!r.ok) {
        const d = (await r.json()) as { error?: string };
        setListError(d.error || `HTTP ${r.status}`);
        return;
      }
      await loadDir(cwd);
    } catch (err) {
      setListError((err as Error).message);
    }
  };

  const deleteEntry = async (entry: Entry, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${entry.name}"${entry.type === 'dir' ? ' and all its contents' : ''}?`)) return;
    try {
      const r = await apiFetch('/api/files/delete', { method: 'DELETE', json: { path: entry.path } });
      if (!r.ok) {
        const d = (await r.json()) as { error?: string };
        setListError(d.error || `HTTP ${r.status}`);
        return;
      }
      await loadDir(cwd);
    } catch (err) {
      setListError((err as Error).message);
    }
  };

  const renameEntry = async (entry: Entry, e: React.MouseEvent) => {
    e.stopPropagation();
    const newName = window.prompt('Rename to:', entry.name);
    if (!newName || newName === entry.name || newName.includes('/')) return;
    const parent = entry.path.split('/').slice(0, -1).join('/');
    const to = `${parent}/${newName}`;
    try {
      const r = await apiFetch('/api/files/rename', { method: 'POST', json: { from: entry.path, to } });
      if (!r.ok) {
        const d = (await r.json()) as { error?: string };
        setListError(d.error || `HTTP ${r.status}`);
        return;
      }
      await loadDir(cwd);
    } catch (err) {
      setListError((err as Error).message);
    }
  };

  const editorExtensions = useMemo(() => {
    if (!editing) return [];
    const ext = [
      EditorView.lineWrapping,
      keymap.of([
        {
          key: 'Mod-s',
          preventDefault: true,
          run: () => {
            save();
            return true;
          },
        },
      ]),
    ];
    const lang = getLangExtension(editing.path);
    if (lang) ext.push(lang);
    return ext;
  }, [editing, save]);

  // ───────────────────────── Editor view ─────────────────────────
  if (editing) {
    const name = editing.path.split('/').pop() || editing.path;
    return (
      <div className="flex flex-col h-full bg-black text-white">
        <div
          className="flex-none flex items-center gap-1.5 px-2 h-9"
          style={{ background: '#0a0a0a', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <button
            onClick={closeEditor}
            className="w-7 h-7 flex items-center justify-center text-white/60 hover:text-white"
            title="Back to files"
            data-testid="button-files-back"
          >
            <ArrowLeft size={14} />
          </button>
          <span className="text-[12px] font-mono truncate flex-1 text-white/80">
            {name}
            {dirty && <span className="text-yellow-400 ml-1">●</span>}
          </span>
          <span className="text-[10px] font-mono text-white/30 shrink-0">
            {formatSize(new Blob([draft]).size)}
          </span>
          <button
            onClick={save}
            disabled={!dirty || saving || editing.binary}
            className="flex items-center gap-1 px-2 h-7 rounded text-[11px] font-mono bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 disabled:cursor-not-allowed"
            data-testid="button-files-save"
          >
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
            save
          </button>
        </div>

        {editError && (
          <div className="flex-none flex items-center gap-1.5 px-3 py-1.5 bg-red-950/40 border-b border-red-900/40">
            <AlertCircle size={11} className="text-red-400 shrink-0" />
            <span className="text-[11px] font-mono text-red-300 truncate">{editError}</span>
          </div>
        )}
        {saveOk && (
          <div className="flex-none px-3 py-1 bg-green-950/40 border-b border-green-900/40">
            <span className="text-[11px] font-mono text-green-300">saved ✓</span>
          </div>
        )}

        {editing.binary ? (
          <div className="flex-1 min-h-0 flex items-center justify-center text-[11px] font-mono text-white/30 p-6 text-center">
            Binary file ({formatSize(editing.size)}). Cannot edit as text.
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-hidden">
            <CodeMirror
              value={draft}
              height="100%"
              theme={dracula}
              extensions={editorExtensions}
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                highlightActiveLine: true,
                autocompletion: false,
                searchKeymap: true,
              }}
              onChange={(v) => {
                setDraft(v);
                setDirty(true);
              }}
              style={{ height: '100%', fontSize: 12 }}
              data-testid="codemirror-files-editor"
            />
          </div>
        )}
      </div>
    );
  }

  // ───────────────────────── Browser view ─────────────────────────
  // Show breadcrumb relative to the session workspace root — never expose the
  // host filesystem path (which contains the session id).
  type Crumb = { label: string; target: string };
  const crumbs: Crumb[] = [{ label: '~', target: root || '' }];
  if (root && cwd && cwd !== root && cwd.startsWith(root + '/')) {
    const rel = cwd.slice(root.length + 1).split('/');
    let acc = root;
    for (const seg of rel) {
      acc = `${acc}/${seg}`;
      crumbs.push({ label: seg, target: acc });
    }
  }
  return (
    <div className="flex flex-col h-full bg-black text-white">
      {/* Top nav bar */}
      <div
        className="flex-none flex items-center gap-1 px-2 h-9"
        style={{ background: '#0a0a0a', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <button
          onClick={goHome}
          className="w-7 h-7 flex items-center justify-center text-white/60 hover:text-white"
          title="Go to workspace"
          data-testid="button-files-home"
        >
          <HomeIcon size={13} />
        </button>
        <button
          onClick={goUp}
          disabled={!listing?.parent}
          className="w-7 h-7 flex items-center justify-center text-white/60 hover:text-white disabled:opacity-30"
          title="Up"
          data-testid="button-files-up"
        >
          <ArrowLeft size={13} />
        </button>
        <button
          onClick={() => loadDir(cwd)}
          className="w-7 h-7 flex items-center justify-center text-white/60 hover:text-white"
          title="Refresh"
          data-testid="button-files-refresh"
        >
          <RefreshCcw size={11} className={listLoading ? 'animate-spin' : ''} />
        </button>
        <div className="flex-1 min-w-0 overflow-x-auto whitespace-nowrap text-[11px] font-mono text-white/50 pl-1">
          {crumbs.map((c, i) => (
            <span key={i} className="inline-flex items-center">
              {i > 0 && <ChevronRight size={10} className="mx-0.5 text-white/20" />}
              <button
                onClick={() => c.target && loadDir(c.target)}
                className="hover:text-white/90"
              >
                {c.label}
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Action bar */}
      <div
        className="flex-none flex items-center gap-0.5 px-2 h-8 border-b border-white/[0.04]"
        style={{ background: '#0a0a0a' }}
      >
        <button
          onClick={createFile}
          className="flex items-center gap-1 px-2 h-6 rounded text-[10px] font-mono text-white/60 hover:text-white hover:bg-white/5"
          title="New file"
          data-testid="button-files-new-file"
        >
          <FilePlus size={11} /> file
        </button>
        <button
          onClick={createFolder}
          className="flex items-center gap-1 px-2 h-6 rounded text-[10px] font-mono text-white/60 hover:text-white hover:bg-white/5"
          title="New folder"
          data-testid="button-files-new-folder"
        >
          <FolderPlus size={11} /> folder
        </button>
        <div className="flex-1" />
        <button
          onClick={() => {
            setSearchOpen((v) => !v);
            if (searchOpen) setSearchQ('');
          }}
          className={`flex items-center gap-1 px-2 h-6 rounded text-[10px] font-mono hover:bg-white/5 ${
            searchOpen ? 'text-orange-400' : 'text-white/60 hover:text-white'
          }`}
          title="Search files"
          data-testid="button-files-search-toggle"
        >
          <Search size={11} /> search
        </button>
      </div>

      {searchOpen && (
        <div
          className="flex-none flex items-center gap-1.5 px-2 h-9 border-b border-white/[0.04]"
          style={{ background: '#0a0a0a' }}
        >
          <Search size={11} className="text-white/40 shrink-0" />
          <input
            autoFocus
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder={`search in ${cwd.split('/').pop() || '/'}…`}
            className="flex-1 h-7 bg-transparent text-[12px] font-mono text-white/90 placeholder:text-white/30 focus:outline-none"
            data-testid="input-files-search"
          />
          {searchLoading && <Loader2 size={11} className="animate-spin text-white/40" />}
          <button
            onClick={() => {
              setSearchOpen(false);
              setSearchQ('');
            }}
            className="w-6 h-6 flex items-center justify-center text-white/40 hover:text-white"
            data-testid="button-files-search-close"
          >
            <X size={11} />
          </button>
        </div>
      )}

      {listError && (
        <div className="flex-none flex items-center gap-1.5 px-3 py-1.5 bg-red-950/40 border-b border-red-900/40">
          <AlertCircle size={11} className="text-red-400 shrink-0" />
          <span className="text-[11px] font-mono text-red-300 truncate">{listError}</span>
        </div>
      )}

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {searchOpen && searchQ.trim() ? (
          <>
            {searchResults?.results.length === 0 && !searchLoading && (
              <div className="p-6 text-center text-[11px] font-mono text-white/30">
                no matches in {searchResults.path}
              </div>
            )}
            {searchResults?.results.map((r) => (
              <button
                key={r.path}
                onClick={() => onSearchResultClick(r)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 active:bg-white/10 border-b border-white/[0.03]"
                data-testid={`search-result-${r.type}-${r.name}`}
              >
                {r.type === 'dir' ? (
                  <Folder size={14} className="text-blue-400 shrink-0" />
                ) : (
                  <FileIcon size={14} className="text-white/40 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-mono text-white/80 truncate">{r.name}</div>
                  <div className="text-[9px] font-mono text-white/30 truncate">{r.path}</div>
                </div>
              </button>
            ))}
            {searchResults?.truncated && (
              <div className="px-3 py-2 text-[10px] font-mono text-amber-400/70 text-center">
                … too many matches, refine your query
              </div>
            )}
          </>
        ) : (
          <>
            {listing?.entries.length === 0 && !listLoading && (
              <div className="p-6 text-center text-[11px] font-mono text-white/30">
                empty directory
              </div>
            )}
            {listing?.entries.map((entry) => (
              <div
                key={entry.path}
                className="group w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 active:bg-white/10 border-b border-white/[0.03]"
                data-testid={`entry-${entry.type}-${entry.name}`}
              >
                <button
                  onClick={() => onEntryClick(entry)}
                  disabled={entry.type === 'symlink'}
                  className="flex-1 min-w-0 flex items-center gap-2 text-left disabled:opacity-40"
                >
                  {entry.type === 'dir' ? (
                    <Folder size={14} className="text-blue-400 shrink-0" />
                  ) : (
                    <FileIcon size={14} className="text-white/40 shrink-0" />
                  )}
                  <span className="flex-1 min-w-0 truncate text-[12px] font-mono text-white/80">
                    {entry.name}
                    {entry.type === 'dir' && '/'}
                  </span>
                  {entry.type === 'file' && (
                    <span className="text-[10px] font-mono text-white/30 shrink-0">
                      {formatSize(entry.size)}
                    </span>
                  )}
                </button>
                <button
                  onClick={(e) => renameEntry(entry, e)}
                  className="w-7 h-7 flex items-center justify-center text-white/30 hover:text-white opacity-0 group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                  style={{ opacity: 1 }}
                  title="Rename"
                  data-testid={`button-rename-${entry.name}`}
                >
                  <Pencil size={11} />
                </button>
                <button
                  onClick={(e) => deleteEntry(entry, e)}
                  className="w-7 h-7 flex items-center justify-center text-white/30 hover:text-red-400"
                  title="Delete"
                  data-testid={`button-delete-${entry.name}`}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
            {listing?.truncated && (
              <div className="px-3 py-2 text-[10px] font-mono text-amber-400/70 text-center">
                … truncated (too many entries)
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
