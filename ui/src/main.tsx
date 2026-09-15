import React from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  Bell,
  BookOpen,
  Brain,
  ChevronDown,
  ChevronUp,
  Clock,
  Cloud,
  Database,
  Eraser,
  Eye,
  FileText,
  Filter,
  Folder,
  FolderOpen,
  FolderTree,
  CodeXml,
  ChevronRight,
  GitBranch,
  HardDrive,
  Inbox,
  KeyRound,
  Layers,
  Link,
  ListFilter,
  Lock,
  Mail,
  MessageSquare,
  Moon,
  Sun,
  SunMoon,
  MoreVertical,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Sidebar,
  Plug,
  Plus,
  RotateCcw,
  RefreshCw,
  Scan,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Swords,
  Upload,
  User,
  Cpu,
  X,
  Zap,
  Pencil,
  Bot,
  CloudUpload,
  DownloadCloud,
  Hash,
  Building2,
  Briefcase,
  Users,
  Tag,
  Globe,
  FolderPlus,
  FilePlus,
  CheckCircle2,
  AlertCircle,
  FolderInput,
  ArrowRight,
  ArrowLeft,
  Loader2,
  FileQuestion,
  TriangleAlert,
  Copy,
  History,
  SlidersHorizontal,
  Trash2,
  GripVertical,
  Info,
  Palette,
  Server,
  Monitor,
  Maximize2,
  Minimize2,
  Mic,
  Paperclip,
  CalendarDays,
  LibraryBig,
  Download,
  ChevronLeft,
  Star,
  ExternalLink,
  Lightbulb,
  Wrench,
  CheckSquare,
  Link2,
  Link2Off,
  Type,
  Crosshair,
  Target,
  TrendingUp,
  Compass,
  GitMerge,
  Sparkles as SparklesIcon,
  Check,
  ChevronDown as ChevronDownIcon,
  Radio,
} from 'lucide-react';
import { selectConnectedAnalyticsNodes, topByMetric, type ForceLayoutResponse, type TopologyAnalysis } from './graph-analytics';
import {
  countGraphNodeTypes,
  fitGraphNodesToViewport,
  graphNeighborhoodIds,
  graphRequestUrl,
  graphTopologyKey,
  layoutGraphData,
  normalizeGraphEdge,
  selectVisibleGraphLabelIds,
  sourceErrorMessage,
  type ApiGraphEdge,
  type ApiGraphResponse,
  type GraphEdge,
  type GraphEpistemic,
  type GraphMeta,
  type GraphNode,
  type GraphNodeType,
} from './graph-contract';
import { drawGraphCanvas, drawGraphMinimap, hitTestGraphNode } from './graph-canvas';
import {
  ALL_GRAPH_EPISTEMIC,
  ATTENTION_EPISTEMIC,
  CURRENT_TRUTH_EPISTEMIC,
  DEFAULT_GRAPH_DISPLAY_OPTIONS,
  formatGraphCount,
  graphKnowledgeView,
  lensSettingsEdited,
  normalizeGraphDisplayOptions,
  scalePercent,
  toggleGraphEpistemicFacet,
  type GraphDisplayOptions,
  type GraphKnowledgeView,
} from './graph-settings';
import {
  GRAPH_HOVER_CARD_DELAY_MS,
  updateGraphHoverIntent,
  type GraphHoverIntent,
} from './graph-hover-intent';
import type { OrbitCameraView } from './orbit-controls';
import { BUILTIN_LENSES, getLensById, loadActiveLensId, persistActiveLensId, type Lens, type LensId } from './lenses';
import { DOC_KINDS, opensInDocs } from './content-routing';
import {
  activitySourceItems,
  resolveActivityDestination,
  type ActivityDestination,
} from './activity-navigation';
import { activityReflectionResult } from './activity-reflection';
import { activityAttentionEvents, activityAttentionPresentation, type ActivityAttentionAction } from './activity-events';
import { activityConflictFromEvent } from './activity-conflicts';
import {
  ACTIVITY_CARD_ESTIMATED_HEIGHT,
  ACTIVITY_CARD_GAP,
  activityTimelineColorAt,
  computeActivityTimelineLayout,
} from './activity-layout';
import { documentContentFields } from './document-content';
import { createOperationId } from './operation-id';
import { normalizeReflectionCadence, reflectionIntervalSeconds } from './onboarding-flow';
import { configuredPinLength, DEFAULT_PIN_LENGTH, isCompletePin } from './pin-entry';
import { askPod, localAskPodSearchTerms, suggestedPromptsForScope, looksLikeAskQuery, type AskPodScope, type AskPodResult } from './ask-pod-client';
import { podLoadErrorMessage } from './pod-load-error';
import {
  connectionRequestDetails,
  type ConnectionManagementTab,
} from './connection-request';
import {
  DEFAULT_WORKSPACE_EMOJI,
  WORKSPACE_EMOJI_OPTIONS,
  workspaceEmojiLabel,
  workspaceRequestErrorMessage,
} from './workspace-emoji';
import {
  MAX_EXTRACT_FILE_BYTES,
  MAX_IMPORT_FILE_BYTES,
  SUPPORTED_IMPORT_EXTENSIONS,
  importFormatForFilename,
  type ImportProcessingMode,
} from '../../src/shared/import-formats';
import { McpHealthBanner } from './components/integrations/McpHealthBanner';
import { AgentsView } from './components/AgentsView';
import { LearningsView } from './components/LearningsView';
import { AgentGrantsPanel } from './components/integrations/AgentGrantsPanel';
import { CalendarConnectionModal } from './components/integrations/CalendarConnectionModal';
import { DriveConnectionModal } from './components/integrations/DriveConnectionModal';
import { EmailConnectionModal } from './components/integrations/EmailConnectionModal';
import { IntegrationConnectionModal } from './components/integrations/IntegrationConnectionModal';
import { OnboardingWizardExpanded, type ExpandedConfig } from './components/OnboardingWizardExpanded';
import { PodLoader } from './components/PodLoader';
import { ConflictResolver } from './components/ConflictResolver';
import { ProfileView } from './components/WikiViews';
/** App logo paths — official brand SVGs served from /brand/apps/ */
const APP_LOGO_URLS: Record<string, string> = {
  'notion': '/brand/apps/notion.svg',
  'obsidian': '/brand/apps/obsidian.svg',
  'coda': '/brand/apps/coda.svg',
  'apple-notes': '/brand/apps/apple-notes.svg',
  'confluence': '/brand/apps/confluence.svg',
  'evernote': '/brand/apps/evernote.svg',
};
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import './styles.css';

// The rich editor and its Slate/Plate dependency graph are only needed after
// a user opens Journal or a document. Keep them out of the cockpit's startup
// bundle while preserving the same editor behavior once loaded.
const PlateDocEditor = React.lazy(async () => {
  const module = await import('@/components/plate-editor');
  return { default: module.PlateDocEditor };
});

/* ── Cockpit auth wrapper ──────────────────────────────────────────────────
 *
 * The Electron preload script exposes the per-install API token on
 * window.coffeePod.token. This wrapper attaches it as a Bearer token to every
 * same-origin fetch so the cockpit keeps working when the local Pod server
 * enforces COFFEE_POD_API_TOKEN. In Vite dev mode (no Electron preload) the
 * token is undefined and the wrapper is a no-op, matching the dev server's
 * permissive auth.
 *
 * Cross-origin fetches (e.g. external thumbnail URLs) are passed through
 * untouched — we never want to leak the token off-host.
 */
declare global {
  interface Window {
    coffeePod?: {
      token?: string | null;
      packagedShell?: boolean;
      openInDefaultApp?: (filename: string, content: string) => Promise<unknown>;
      chooseBackupDestination?: (suggestedName: string) => Promise<{ outputDir: string; filename: string } | null>;
      chooseBackupSource?: () => Promise<string | null>;
      restart?: () => Promise<unknown>;
    };
  }
}

(function installAuthFetchWrapper() {
  const token = typeof window !== 'undefined' ? window.coffeePod?.token : null;
  const origFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    let requestUrl: URL;
    try {
      requestUrl = typeof input === 'string' || input instanceof URL
        ? new URL(input.toString(), window.location.origin)
        : new URL((input as Request).url, window.location.origin);
      if (requestUrl.origin !== window.location.origin) {
        return origFetch(input, init);
      }
    } catch {
      return origFetch(input, init);
    }
    const baseHeaders = init?.headers
      ?? (typeof input !== 'string' && !(input instanceof URL) ? (input as Request).headers : undefined);
    const headers = new Headers(baseHeaders);
    if (token && !headers.has('Authorization') && !headers.has('authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    const workspaceId = localStorage.getItem('coffee-pod-active-workspace-id');
    if (workspaceId && requestUrl.pathname !== '/pod/workspaces' && !headers.has('x-pod-workspace-id')) {
      headers.set('x-pod-workspace-id', workspaceId);
    }
    return origFetch(input, { ...init, headers });
  };
})();

type NavKey = 'activity' | 'memories' | 'docs' | 'journal' | 'skills' | 'connections';
type WavesProcess = 'observe' | 'recall' | 'reflect' | 'revise' | 'forget' | 'dream' | 'access';
type WavesProcessLoose = WavesProcess | (string & {});  // accept any string from backend

interface PodObject {
  id: string;
  collection_id: string;
  kind: string;
  title: string;
  created_at: string;
  updated_at: string;
  created_origin?: string | null;
  last_modified_by?: string | null;
  sync_status?: string | null;
  processing_state?: string | null;
  summary?: string | null;
  version?: number;
  hash_algorithm?: string;
  hash_value?: string;
  sensitive?: boolean;
  archived_at?: string | null;
  deleted_at?: string | null;
  reflection_claim_count?: number;
  needs_review?: boolean;
  backlink_count?: number;
  scope?: string | null;
  confidence?: string | null;
  related_to?: string[];
  source?: { app?: string; external_id?: string; url?: string };
  content?: unknown;
  metadata?: Record<string, unknown> | null;
  origin?: string;
  tags?: string[];
  sort_order?: number;
  /** Identifier of the LLM (or compiler) that produced this row when origin
   *  is agent-derived (reflected / agent-edited). Free-form string, e.g.
   *  "claude-sonnet-4-6", "gpt-4o", "smartware-compiler". null for user-authored. */
  authored_by?: string | null;
}

interface PodCollection {
  id: string;
  name: string;
  parent_id?: string | null;
  sort_order?: number;
  description?: string;
  updated_at: string;
}

interface PodQueryContextPayload {
  kind: 'map_selection' | 'doc_selection' | 'memory_selection';
  node_ids?: string[];
  object_ids?: string[];
  entity_ids?: string[];
  edges?: Array<{ id: string; source: string; target: string; label?: string }>;
  labels?: string[];
}

interface AskPodContext {
  title: string;
  subtitle?: string;
  chips: string[];
  payload: PodQueryContextPayload;
}

interface AskPodSource {
  marker?: string;
  id: string;
  type: 'claim' | 'observation' | 'object' | 'external' | 'profile' | 'lesson' | 'conversation' | 'expertise';
  title: string;
  text?: string;
  snippet?: string;
  object_id?: string;
  entity_id?: string;
  claim_id?: string;
  observation_id?: string;
  observation_ids?: string[];
  profile_id?: 'self';
  url?: string;
  source?: {
    app?: string | null;
    external_id?: string | null;
    observed_at?: string | null;
  };
  provenance?: {
    observation_ids?: string[];
    actor_ids?: string[];
  };
  resolver?: {
    method: 'GET' | 'POST';
    path: string;
  };
}

interface AskPodExpert {
  actor_id: string;
  actor_name?: string | null;
  reason: string;
  confidence: number;
  demonstrated_by: {
    resolutions: number;
    notable_bursts: number;
    validated_lessons: number;
    successful_applications: number;
  };
  evidence: AskPodSource[];
}

interface AskPodStep {
  id: string;
  label: string;
  status: 'done' | 'error' | 'skipped';
  count?: number;
}

interface AIChatMessage {
  role: 'user' | 'ai';
  text: string;
  createdAt: string;
  sources?: AskPodSource[];
  experts?: AskPodExpert[];
  steps?: AskPodStep[];
  context?: AskPodContext | null;
  local?: boolean;
  error?: boolean;
}

interface AskPodConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: AIChatMessage[];
}

const ASK_POD_HISTORY_KEY = 'coffee-pod-ask-history-v1';

function createAskPodConversation(): AskPodConversation {
  const now = new Date().toISOString();
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `ask-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: 'New conversation',
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

function loadAskPodConversations(): AskPodConversation[] {
  try {
    const stored = JSON.parse(localStorage.getItem(ASK_POD_HISTORY_KEY) ?? '[]');
    if (!Array.isArray(stored)) return [];
    return stored.filter((conversation): conversation is AskPodConversation =>
      typeof conversation?.id === 'string'
      && typeof conversation?.title === 'string'
      && Array.isArray(conversation?.messages),
    ).map(conversation => ({
      ...conversation,
      createdAt: conversation.createdAt ?? new Date().toISOString(),
      updatedAt: conversation.updatedAt ?? conversation.createdAt ?? new Date().toISOString(),
      messages: conversation.messages.map(message => ({
        ...message,
        createdAt: message.createdAt ?? conversation.createdAt ?? new Date().toISOString(),
      })),
    }));
  } catch {
    return [];
  }
}

function askPodConversationTitle(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.length > 48 ? `${compact.slice(0, 47)}…` : compact || 'New conversation';
}

interface ActivityEvent {
  id: string;
  type: string;
  process: WavesProcessLoose;
  actor_id: string;
  observed_at: string;
  captured_at?: string;
  scope: string;
  title: string;
  detail?: string;
  subProcess?: string;
  content?: unknown;
  source_app?: string;
  source_id?: string;
  collection?: string;
  visibility?: 'private' | 'workspace' | 'public';
  sensitive?: boolean;
  pod_object_id?: string;
  pod_object_version?: number;
  revise_reason?: 'changed' | 'wrong' | 'extraction_error' | 'duplicate';
  redaction_reason?: 'sensitive' | 'requested_by_user' | 'extraction_error' | 'policy_violation';
  requires_attention?: boolean;
  resolved_at?: string | null;
  dismissed_at?: string | null;
  severity?: 'info' | 'warning' | 'error' | 'critical' | string;
  attention_reason?: string;
  attention_action_label?: string;
  attention_action?: ActivityAttentionAction;
}

interface PodSkill {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  source: 'coffee' | 'skills.sh' | 'skillsmp' | 'clawhub' | 'github' | 'local' | 'manual';
  source_slug: string | null;
  scope: string;
  status: 'approved' | 'installed' | 'review' | 'possible' | 'disabled' | 'flagged';
  trust_score: number;
  trust_level: 'high' | 'medium' | 'caution' | 'blocked';
  permissions: string[];
  grant_id: string | null;
  actor_id: string | null;
  equipped_to: string[];
  agent_bindings: Array<{
    skill_id: string;
    agent_id: string;
    status: 'pending' | 'active' | 'disabled';
    grant_id: string | null;
  }>;
  portability: 'local' | 'exportable' | 'synced';
  runs: number;
  failures: number;
  last_run: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown> | null;
  revision_count: number;
  current_revision: PodSkillRevision | null;
  pending_revision: PodSkillRevision | null;
  revisions: PodSkillRevision[];
  deployments: PodSkillDeployment[];
  review_facets?: {
    source: string;
    permissions: string[];
    local_files: boolean;
    network: boolean;
    shell: boolean;
    runtime: { runs: number; failures: number; last_run: string | null };
    user_approval: boolean;
  };
}

interface PodSkillRevision {
  id: string;
  skill_id: string;
  revision_number: number;
  version: string;
  status: 'draft' | 'approved' | 'superseded' | 'rejected';
  content_hash: string;
  content: string | null;
  files: Record<string, string> | null;
  origin: PodSkill['source'];
  source_ref: string | null;
  created_by: string;
  summary: string;
  created_at: string;
  approved_at: string | null;
}

interface PodSkillDeployment {
  id: string;
  skill_id: string;
  agent_id: string;
  desired_revision_id: string | null;
  installed_revision_id: string | null;
  status: 'pending' | 'ready' | 'synced' | 'drifted' | 'blocked';
  adapter: string;
  target_path: string | null;
  installed_hash: string | null;
  last_error: string | null;
  last_checked_at: string | null;
  updated_at: string;
}

interface PodPluginComponent {
  revision_id: string;
  component_type: 'skill' | 'mcp_server' | 'extension';
  component_key: string;
  status: 'valid' | 'invalid' | 'unsupported';
  detail: Record<string, unknown>;
}

interface PodPluginRevision {
  id: string;
  plugin_id: string;
  revision_number: number;
  version: string;
  status: 'draft' | 'approved' | 'superseded' | 'rejected';
  package_hash: string;
  schema_uri: string;
  manifest: Record<string, unknown>;
  files: Record<string, { encoding: 'utf8' | 'base64'; size: number; sha256: string }>;
  inspection: {
    valid: boolean;
    specification: string;
    issues: Array<{ severity: 'error' | 'warning'; code: string; message: string; path?: string }>;
    risk: {
      local_executables: number;
      remote_connections: number;
      literal_header_keys: string[];
      binary_files: number;
      total_bytes: number;
    };
  };
  components: PodPluginComponent[];
  source_ref: string | null;
  created_by: string;
  created_at: string;
  approved_at: string | null;
}

interface PodPlugin {
  kind: 'plugin';
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  source: 'local' | 'github' | 'manual';
  source_ref: string | null;
  status: 'review' | 'approved' | 'disabled' | 'flagged';
  schema_version: string;
  trust_score: number;
  trust_level: 'high' | 'medium' | 'caution' | 'blocked';
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown> | null;
  revision_count: number;
  current_revision: PodPluginRevision | null;
  pending_revision: PodPluginRevision | null;
  revisions: PodPluginRevision[];
}

/* ── Import System Types ── */
type ImportMode = 'upload' | 'app';
type ImportStep = 'select' | 'staging' | 'confirm' | 'importing' | 'results';
type StagingGroup = 'ready' | 'needs-review' | 'unsupported' | 'too-large' | 'duplicate';
type ProcessingDepth = ImportProcessingMode;

interface StagedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  mimeType: string;
  group: StagingGroup;
  groupDetail?: string;
  selected: boolean;
  folderPath?: string;
  processing: ProcessingDepth;
  /** Reference to the actual browser File object for upload */
  file?: File;
}

interface ImportAppSource {
  id: string;
  name: string;
  description: string;
  status: 'available' | 'coming-soon' | 'requires-export';
  cta: string;
  fileTypes?: string[];
}

interface ImportHistoryEntry {
  id: string;
  date: string;
  source: string;
  files: number;
  destination: string;
  status: 'completed' | 'partial' | 'failed';
  errors?: number;
}

interface ImportFileOutcome {
  id: string;
  title: string;
  filename: string;
  extraction_status: string;
  processing_state: string;
  warnings: string[];
}

interface ImportResultSummary {
  imported: number;
  failed: number;
  files: ImportFileOutcome[];
  error?: string;
}

const SUPPORTED_EXTENSIONS = [...SUPPORTED_IMPORT_EXTENSIONS];

const IMPORT_APP_SOURCES: ImportAppSource[] = [
  { id: 'local-folder', name: 'Local folder', description: 'Pick any folder on your computer to import', status: 'available', cta: 'Select folder' },
  { id: 'obsidian', name: 'Obsidian', description: 'Markdown vaults and folder structure', status: 'available', cta: 'Select vault' },
  { id: 'notion', name: 'Notion', description: 'Markdown or HTML files from an extracted workspace export', status: 'requires-export', cta: 'Choose files' },
  { id: 'evernote', name: 'Evernote', description: 'ENEX notebook archive import', status: 'coming-soon', cta: 'Coming soon' },
  { id: 'apple-notes', name: 'Apple Notes', description: 'Notes and attachments', status: 'coming-soon', cta: 'Coming soon' },
  { id: 'chatgpt', name: 'ChatGPT', description: 'Conversation history from your account archive', status: 'coming-soon', cta: 'Coming soon' },
  { id: 'claude', name: 'Claude', description: 'Conversation history from your account archive', status: 'coming-soon', cta: 'Coming soon' },
];

const IMPORT_FILE_TYPES = ['.csv', '.md', '.docx', '.html'].map((ext) => {
  const format = importFormatForFilename(`file${ext}`)!;
  return { ext, label: format.label, available: format.extractor !== 'none' };
});

const SAMPLE_IMPORT_HISTORY: ImportHistoryEntry[] = [
  { id: 'imp-1', date: '2d ago', source: 'Obsidian Vault', files: 23, destination: 'Imports / Obsidian', status: 'completed' },
  { id: 'imp-2', date: '1w ago', source: 'Local upload', files: 5, destination: 'Inbox', status: 'completed' },
  { id: 'imp-3', date: '2w ago', source: 'Notion export', files: 12, destination: 'Imports', status: 'partial', errors: 2 },
];

const mainNav: Array<{ key: NavKey; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { key: 'activity', label: 'Activity', icon: Activity },
  { key: 'memories', label: 'Memory', icon: Brain },
  { key: 'docs', label: 'Docs', icon: FileText },
  { key: 'journal', label: 'Journal', icon: BookOpen },
  { key: 'skills', label: 'Capabilities', icon: Layers },
  { key: 'connections', label: 'Connections', icon: Plug },
];

/* ── Sample data ── */

const sampleObjects: PodObject[] = ([
  {
    id: 'coffee:meeting:staging-smoke-meeting',
    collection_id: 'coffee',
    kind: 'coffee.meeting',
    title: 'Pod staging smoke test',
    updated_at: new Date().toISOString(),
    source: { app: 'coffee', external_id: 'staging-smoke-meeting' },
    origin: 'synced',
    content: { notes: 'Validate Coffee can sync meetings into a user-owned Pod.' },
  },
  {
    id: 'project-coffee-pod',
    collection_id: 'projects',
    kind: 'project',
    title: 'Pod',
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    source: { app: 'coffee-pod' },
    origin: 'synced',
    content: { summary: 'Generic user-owned data and memory substrate.' },
  },
  {
    id: 'doc-handoff',
    collection_id: 'docs',
    kind: 'document',
    title: 'CTO handoff',
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
    source: { app: 'local' },
    origin: 'written',
    backlink_count: 4,
    content: { status: 'ready', summary: 'Handoff notes covering auth migration, infra ownership, and Q4 roadmap priorities.' },
  },
  {
    id: 'entity-stevie',
    collection_id: 'people',
    kind: 'person',
    title: 'Stevie Ghiassi',
    updated_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    source: { app: 'coffee' },
    origin: 'synced',
    content: { role: 'Founder', org: 'Coffee', notes: 'Primary owner of this Pod.' },
  },
  {
    id: 'claim-auth-q4',
    collection_id: 'claims',
    kind: 'claim',
    title: 'Auth migration moved to Q4',
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    source: { app: 'coffee', external_id: 'meeting-2024-05' },
    origin: 'reflected',
    backlink_count: 3,
    content: { confidence: 0.87, basis: 'Meeting notes from May sync', status: 'active' },
  },
  {
    id: 'decision-local-first',
    collection_id: 'decisions',
    kind: 'decision',
    title: 'Local-first architecture for Pod',
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    source: { app: 'local' },
    origin: 'written',
    backlink_count: 5,
    content: { rationale: 'Privacy, offline support, user ownership', status: 'final', stakeholders: ['Stevie', 'CTO'] },
  },
  {
    id: 'page-architecture',
    collection_id: 'pages',
    kind: 'page',
    title: 'Pod Architecture',
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    source: { app: 'system:compiler' },
    origin: 'reflected',
    backlink_count: 7,
    summary: 'Synthesized architecture overview covering layers, protocol, and security model.',
    content: { confidence: 0.92, sections: ['Overview', 'Layers', 'Protocol', 'Security'], compiled_from: 12 },
  },
  {
    id: 'task-gdrive-sync',
    collection_id: 'tasks',
    kind: 'task',
    title: 'Implement Google Drive two-way sync',
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    source: { app: 'coffee' },
    origin: 'synced',
    content: { status: 'in-progress', priority: 'high', assignee: 'Stevie' },
  },
  {
    id: 'obs-slack-thread',
    collection_id: 'observations',
    kind: 'observation',
    title: 'Slack thread: API rate limiting discussion',
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 10).toISOString(),
    source: { app: 'slack', external_id: 'thread-4521' },
    origin: 'synced',
    backlink_count: 2,
    content: { channel: '#engineering', participants: ['Stevie', 'Alex', 'Jordan'], key_points: ['Need 429 handling', 'Exponential backoff preferred'] },
  },
  {
    id: 'entity-coffee-pod',
    collection_id: 'entities',
    kind: 'entity',
    title: 'Pod (product)',
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    source: { app: 'system:compiler' },
    origin: 'reflected',
    content: { type: 'product', description: 'User-owned memory substrate', related: ['Smartware', 'Electron', 'Google Drive'] },
  },
  {
    id: 'source-gdrive',
    collection_id: 'sources',
    kind: 'source',
    title: 'Google Drive — Product folder',
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    source: { app: 'google-drive', url: 'https://drive.google.com/...' },
    origin: 'imported',
    content: { files_synced: 23, last_sync: '2h ago', status: 'connected' },
  },
  {
    id: 'file-product-brief',
    collection_id: 'files',
    kind: 'file',
    title: 'Product Brief Q4.pdf',
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    source: { app: 'google-drive' },
    origin: 'imported',
    content: { fileType: 'pdf', size: '2.4 MB', extractedText: true, entities: 3, claims: 5 },
  },
  {
    id: 'file-arch-diagram',
    collection_id: 'files',
    kind: 'file',
    title: 'Architecture Diagram.png',
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    source: { app: 'local' },
    origin: 'imported',
    content: { fileType: 'png', size: '890 KB' },
  },
  {
    id: 'source-codex',
    collection_id: 'sources',
    kind: 'source',
    title: 'Codex — Pod workspace',
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString(),
    source: { app: 'codex' },
    origin: 'synced',
    content: { status: 'connected', last_sync: '1h ago' },
  },
  {
    id: 'doc-journal-may',
    collection_id: 'docs',
    kind: 'document',
    title: 'May 2026 Journal',
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    source: { app: 'local' },
    origin: 'written' as const,
    content: { status: 'draft' },
  },
  {
    id: 'doc-meeting-notes',
    collection_id: 'docs',
    kind: 'document',
    title: 'Product planning notes',
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    source: { app: 'coffee' },
    origin: 'synced' as const,
    content: { status: 'final' },
  },
  {
    id: 'doc-api-design',
    collection_id: 'docs',
    kind: 'document',
    title: 'API design principles',
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    source: { app: 'local' },
    origin: 'written' as const,
    content: { status: 'ready' },
  },
  {
    id: 'page-weekly-summary',
    collection_id: 'pages',
    kind: 'page',
    title: 'Weekly summary — May W2',
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 14).toISOString(),
    source: { app: 'system:compiler' },
    origin: 'reflected' as const,
    content: { confidence: 0.88, compiled_from: 8 },
  },
  {
    id: 'doc-onboarding',
    collection_id: 'docs',
    kind: 'document',
    title: 'Onboarding guide',
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    source: { app: 'local' },
    origin: 'agent-edited' as const,
    content: { status: 'review' },
  },
] satisfies Array<Omit<PodObject, 'created_at'>>).map((object) => ({
  ...object,
  created_at: object.updated_at,
}));

/** Sample collections — only meaningful user-facing folders.
 *  Object kinds (people, claims, tasks, etc.) are handled by Smart Views, not folders. */
const sampleCollections: PodCollection[] = [
  { id: 'projects', name: 'Projects', description: 'Long-lived work areas.', updated_at: new Date().toISOString() },
  { id: 'docs', name: 'Documents', description: 'Imported files and notes.', updated_at: new Date().toISOString() },
  { id: 'archive', name: 'Archive', description: 'Archived documents.', updated_at: new Date().toISOString() },
];

interface PodRuntime {
  pod_id: string;
  pod_name: string;
  pod_name_override: string | null;
  owner_display_name: string | null;
  owner_avatar_data_url: string | null;
  owner_id: string;
  pod_url: string;
  data_dir: string;
  auth_required: boolean;
  onboarding_complete: boolean;
  onboarding_version: number | null;
  mode: 'desktop' | 'local' | 'hosted';
  editable: Record<string, boolean>;
}

interface PodWorkspace {
  id: string;
  name: string;
  emoji: string;
  scope: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

const sampleActivity: ActivityEvent[] = [
  { id: 'evt-1', type: 'object_upserted', process: 'observe', actor_id: 'coffee:desktop', observed_at: new Date().toISOString(), captured_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(), scope: 'workspace', title: 'New meeting notes ingested', detail: 'Pod staging smoke test — synced from calendar', source_app: 'Google Calendar', collection: 'Pod', visibility: 'workspace', pod_object_id: 'obj_meeting_notes_1' },
  { id: 'evt-2', type: 'page_compiled', process: 'reflect', actor_id: 'system:compiler', observed_at: new Date(Date.now() - 1000 * 60 * 3).toISOString(), scope: 'workspace', title: 'Synthesizing project context', detail: 'Compiling 3 recent observations into project page', subProcess: 'Consolidating', collection: 'Pod' },
  { id: 'evt-3', type: 'dream_cycle', process: 'dream', actor_id: 'system:dreamer', observed_at: new Date(Date.now() - 1000 * 60 * 8).toISOString(), scope: 'personal', title: 'Background reflection cycle', detail: 'Checking for stale claims across 12 pages', subProcess: 'Staleness check' },
  { id: 'evt-4', type: 'maintenance_scan', process: 'dream', actor_id: 'system:maintenance', observed_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(), scope: 'workspace', title: 'Dreaming pass reviewed project updates', detail: 'Deployment frequency increased 3x this week', collection: 'Projects' },
  { id: 'evt-5', type: 'search_result', process: 'recall', actor_id: 'coffee:companion', observed_at: new Date(Date.now() - 1000 * 60 * 23).toISOString(), scope: 'personal', title: 'Retrieved context for query', detail: '"What did we decide about auth?" — 4 sources found' },
  { id: 'evt-6', type: 'claim_revised', process: 'revise', actor_id: 'system:compiler', observed_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(), scope: 'workspace', title: 'Claim updated on CTO handoff', detail: 'Timeline revised from Q3 to Q4 based on new meeting notes', collection: 'Decisions', pod_object_id: 'obj_claim_cto_handoff', pod_object_version: 3, revise_reason: 'changed' },
  { id: 'evt-7', type: 'memory_archived', process: 'forget', actor_id: 'system:decay', observed_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(), scope: 'personal', title: 'Archived stale observation', detail: 'Old Slack thread from 3 months ago tombstoned', source_app: 'Slack', redaction_reason: 'sensitive' },
  { id: 'evt-8', type: 'permission_change', process: 'access', actor_id: 'coffee:admin', observed_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), scope: 'workspace', title: 'Skill permission updated', detail: 'rust-reviewer granted write:comments scope' },
  { id: 'evt-21', type: 'claim_admitted', process: 'revise', actor_id: 'system:admission', observed_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), scope: 'workspace', title: 'Claims admitted to canonical', detail: '3 observations promoted to L1, 1 flagged for manual review', pod_object_id: 'obj_obs_meeting_notes' },
  { id: 'evt-9', type: 'file_observed', process: 'observe', actor_id: 'coffee:drive', observed_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), scope: 'workspace', title: 'Google Doc synced', detail: 'Product roadmap Q2 — detected 2 new sections', source_app: 'Google Drive', collection: 'Documents' },
  { id: 'evt-10', type: 'dream_cycle', process: 'dream', actor_id: 'system:dreamer', observed_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), scope: 'workspace', title: 'Contradiction scan complete', detail: 'Found 1 conflict between meeting notes and roadmap', subProcess: 'Contradiction check', collection: 'Pod' },
  { id: 'evt-11', type: 'page_compiled', process: 'reflect', actor_id: 'system:compiler', observed_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), scope: 'personal', title: 'Extracting entities from notes', detail: '3 new people, 2 projects identified', subProcess: 'Extracting', source_app: 'Obsidian' },
  { id: 'evt-12', type: 'maintenance_scan', process: 'dream', actor_id: 'system:maintenance', observed_at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), scope: 'workspace', title: 'Dreaming pass flagged scope drift', detail: 'Pod project expanding beyond original brief', collection: 'Pod' },
  { id: 'evt-13', type: 'search_result', process: 'recall', actor_id: 'coffee:companion', observed_at: new Date(Date.now() - 1000 * 60 * 60 * 7).toISOString(), scope: 'personal', title: 'Context retrieved for meeting prep', detail: 'Pulled 6 relevant claims for 1:1 with CTO', collection: 'People' },
  { id: 'evt-14', type: 'claim_revised', process: 'revise', actor_id: 'system:compiler', observed_at: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(), scope: 'workspace', title: 'Page confidence updated', detail: 'Pod architecture page: 87% → 92% confidence', collection: 'Pod' },
  { id: 'evt-15', type: 'permission_change', process: 'access', actor_id: 'coffee:admin', observed_at: new Date(Date.now() - 1000 * 60 * 60 * 10).toISOString(), scope: 'workspace', title: 'New skill requesting access', detail: 'slack-digest wants read:slack, write:notes — pending review' },
  { id: 'evt-16', type: 'memory_archived', process: 'forget', actor_id: 'system:decay', observed_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(), scope: 'personal', title: 'Batch archive complete', detail: '7 observations older than 90 days moved to cold storage' },
  { id: 'evt-17', type: 'dream_cycle', process: 'dream', actor_id: 'system:dreamer', observed_at: new Date(Date.now() - 1000 * 60 * 60 * 14).toISOString(), scope: 'workspace', title: 'Gap analysis running', detail: 'Scanning for missing connections between projects', subProcess: 'Gap detection', collection: 'Projects' },
  { id: 'evt-18', type: 'object_upserted', process: 'observe', actor_id: 'coffee:desktop', observed_at: new Date(Date.now() - 1000 * 60 * 60 * 16).toISOString(), scope: 'personal', title: 'New conversation captured', detail: 'Slack DM with designer about UI refresh', source_app: 'Slack', collection: 'Pod', sensitive: true, visibility: 'private' },
  { id: 'evt-19', type: 'page_compiled', process: 'reflect', actor_id: 'system:compiler', observed_at: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(), scope: 'workspace', title: 'Index rebuilt', detail: 'Full-text search index updated with 23 new entries', subProcess: 'Indexing' },
  { id: 'evt-20', type: 'maintenance_scan', process: 'dream', actor_id: 'system:maintenance', observed_at: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(), scope: 'personal', title: 'Dreaming pass found a recurring theme', detail: '"Technical debt" mentioned in 5 separate conversations this week', collection: 'Projects' },
];

/* ── Pod icon (PNG with SVG fallback) ── */

function PodAIIcon({ size = 20 }: { size?: number }) {
  const [usePng, setUsePng] = React.useState(true);
  if (usePng) {
    return <img src="/brand/pod-icon-pink.png" alt="" width={size} height={size} style={{ display: 'block', width: size, height: size, objectFit: 'contain' }} onError={() => setUsePng(false)} />;
  }
  const sparkle = (cx: number, cy: number, rx: number, ry: number) =>
    `M${cx} ${cy - ry} Q${cx + rx * 0.12} ${cy - ry * 0.12} ${cx + rx} ${cy} Q${cx + rx * 0.12} ${cy + ry * 0.12} ${cx} ${cy + ry} Q${cx - rx * 0.12} ${cy + ry * 0.12} ${cx - rx} ${cy} Q${cx - rx * 0.12} ${cy - ry * 0.12} ${cx} ${cy - ry} Z`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="10" width="84" height="7" rx="3.5" fill="currentColor" />
      <path d="M12 22 L18 88 Q19 94 26 94 L74 94 Q81 94 82 88 L88 22 Z" fill="currentColor" />
      <path d={sparkle(44, 52, 13, 16)} fill="var(--bg-0, #111)" />
      <path d={sparkle(62, 38, 8, 10)} fill="var(--bg-0, #111)" />
    </svg>
  );
}

function PodLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="120" rx="22" fill="#FE006B"/>
      <rect x="18" y="34" width="84" height="14" rx="2" fill="white"/>
      <path d="M18 56 L18 62 C18 90, 36 108, 60 108 C84 108, 102 90, 102 62 L102 56 Z" fill="white"/>
    </svg>
  );
}

function OwnerAvatar(props: { src?: string | null; name: string; size?: number; className?: string }) {
  const size = props.size ?? 32;
  if (props.src) {
    return <img src={props.src} alt={`${props.name} profile`} className={props.className ?? 'owner-avatar'} width={size} height={size} />;
  }
  return (
    <span className={props.className ?? 'owner-avatar owner-avatar-fallback'} style={{ width: size, height: size }}>
      {props.name.trim().charAt(0).toUpperCase() || <User size={Math.round(size * 0.55)} />}
    </span>
  );
}

/* ── Helpers ── */

// Brand asset registry: any slug in this set is rendered from
// `/brand/apps/<slug>.svg` via brandImg(). To onboard a new brand:
//   1. drop the SVG at ui/public/brand/apps/<slug>.svg
//   2. add the slug here
// Every surface that calls sourceAppIcon() or a *Logo wrapper that delegates
// to brandImg() picks it up automatically. Do NOT inline brand SVGs in new
// components — always go through this path.
const BRAND_ASSETS = new Set<string>([
  'apple-notes',
  'clawhub',
  'coda',
  'codex',
  'confluence',
  'evernote',
  'notion',
  'obsidian',
  'skillsmp',
  'skillssh',
  'google-calendar',
  'google-drive',
  'gmail',
  'linear',
  // To onboard a new brand: drop ui/public/brand/apps/<slug>.svg,
  // then add the slug here.
]);

function brandImg(slug: string, size: number, alt?: string): React.ReactNode | null {
  if (!BRAND_ASSETS.has(slug)) return null;
  return (
    <img
      src={`/brand/apps/${slug}.svg`}
      width={size}
      height={size}
      alt={alt ?? slug}
      style={{ objectFit: 'contain', display: 'inline-block', verticalAlign: 'middle' }}
    />
  );
}

// Sync events (`google_drive_sync`, `google_calendar_sync`, etc.) don't carry
// `source_app` on the row, so the activity card icon was always falsy. Derive
// the source from the event type as a fallback.
function inferSourceFromEvent(type?: string, actorId?: string): string | undefined {
  if (type) {
    const t = type.toLowerCase();
    if (t.startsWith('gmail') || t.includes('email_sync')) return 'gmail';
    if (t.startsWith('icloud_mail')) return 'icloud-mail';
    if (t.startsWith('google_drive')) return 'google-drive';
    if (t.startsWith('google_calendar')) return 'google-calendar';
    if (t.startsWith('slack')) return 'slack';
    if (t.startsWith('github')) return 'github';
    if (t.startsWith('gitlab')) return 'gitlab';
    if (t.startsWith('notion')) return 'notion';
    if (t.startsWith('linear')) return 'linear';
    if (t.startsWith('obsidian')) return 'obsidian';
  }
  if (actorId) {
    const a = actorId.toLowerCase();
    if (a.includes('gmail')) return 'gmail';
    if (a.includes('icloud-mail')) return 'icloud-mail';
    if (a.includes('google-drive') || a.includes('google_drive') || a === 'coffee:drive') return 'google-drive';
    if (a.includes('google-calendar') || a.includes('google_calendar')) return 'google-calendar';
    if (a.includes('slack')) return 'slack';
    if (a.includes('github')) return 'github';
    if (a.includes('gitlab')) return 'gitlab';
    if (a.includes('notion')) return 'notion';
    if (a.includes('linear')) return 'linear';
  }
  return undefined;
}

function sourceAppIcon(app: string, size = 12): React.ReactNode {
  const s = size;
  const key = app.toLowerCase().replace(/-/g, ' ').replace(/_/g, ' ');
  const slug = key.replace(/ /g, '-');
  const asset = brandImg(slug, s, app);
  if (asset) return asset;
  switch (key) {
    case 'google calendar':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <rect x="1" y="1" width="22" height="22" rx="4" fill="#4285F4"/>
          <rect x="1" y="15" width="8" height="8" fill="#1A73E8"/>
          <rect x="15" y="1" width="8" height="14" fill="#34A853"/>
          <rect x="5" y="15" width="14" height="8" fill="#FBBC04"/>
          <path d="M15 15h8v4a4 4 0 01-4 4h-4v-8z" fill="#EA4335"/>
          <rect x="5" y="5" width="14" height="14" rx="1" fill="white"/>
        </svg>
      );
    case 'google drive':
      return (
        <svg width={s} height={s} viewBox="0 0 24 22" fill="none">
          <path d="M8.5 1L1 14h7.5L16 1z" fill="#0F9D58"/>
          <path d="M15.5 1L23 14h-7.5L8 1z" fill="#FBBC04"/>
          <path d="M1 14l2.5 7h17l2.5-7z" fill="#4285F4"/>
        </svg>
      );
    case 'slack':
      return (
        <svg width={s} height={s} viewBox="0 0 48 48" fill="none">
          <path d="M10 28a4 4 0 01-4 4 4 4 0 010-8h4v4zm2 0a4 4 0 018 0v10a4 4 0 01-8 0V28z" fill="#E01E5A"/>
          <path d="M20 10a4 4 0 01-4-4 4 4 0 018 0v4h-4zm0 2a4 4 0 010 8H10a4 4 0 010-8h10z" fill="#36C5F0"/>
          <path d="M38 20a4 4 0 014-4 4 4 0 010 8h-4v-4zm-2 0a4 4 0 01-8 0V10a4 4 0 018 0v10z" fill="#2EB67D"/>
          <path d="M28 38a4 4 0 014 4 4 4 0 01-8 0v-4h4zm0-2a4 4 0 010-8h10a4 4 0 010 8H28z" fill="#ECB22E"/>
        </svg>
      );
    case 'gmail':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M2 6a2 2 0 012-2h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" fill="#fff"/>
          <path d="M2 6l10 7 10-7" stroke="#EA4335" strokeWidth="1.5" fill="none"/>
          <path d="M2 6v12h3V9.5l7 5 7-5V18h3V6l-10 7L2 6z" fill="#EA4335" opacity="0.12"/>
          <path d="M2 6l10 7" stroke="#EA4335" strokeWidth="1.8" strokeLinecap="round"/>
          <path d="M22 6l-10 7" stroke="#EA4335" strokeWidth="1.8" strokeLinecap="round"/>
          <rect x="2" y="4" width="20" height="16" rx="2" stroke="#D93025" strokeWidth="1.2" fill="none"/>
        </svg>
      );
    case 'icloud mail':
      return <Mail size={s} aria-hidden="true" />;
    case 'github':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836a9.59 9.59 0 012.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z"/>
        </svg>
      );
    case 'gitlab':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M12 21.35L1.8 14.2l1.9-5.85L5.6 2.5l1.9 5.85h9l1.9-5.85 1.9 5.85 1.9 5.85z" fill="#FC6D26"/>
          <path d="M12 21.35l-4.5-3.2h9z" fill="#E24329"/>
          <path d="M1.8 14.2L12 21.35l-4.5-3.2H3.7z" fill="#FCA326"/>
          <path d="M22.2 14.2L12 21.35l4.5-3.2h3.8z" fill="#FCA326"/>
          <path d="M3.7 8.35L1.8 14.2l5.7-4.05z" fill="#E24329"/>
          <path d="M20.3 8.35l1.9 5.85-5.7-4.05z" fill="#E24329"/>
        </svg>
      );
    case 'notion':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <rect x="3" y="2" width="18" height="20" rx="3" fill="#fff" stroke="#333" strokeWidth="1.2"/>
          <path d="M7 7h6.5M7 11h10M7 15h8" stroke="#333" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
      );
    case 'linear':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M3.5 13.5l7 7a9.5 9.5 0 01-7-7z" fill="#5E6AD2"/>
          <path d="M2.2 10.3l11.5 11.5a9.5 9.5 0 002.1-1.1L3.3 8.2a9.5 9.5 0 00-1.1 2.1z" fill="#5E6AD2"/>
          <path d="M4 7.3l12.8 12.8a9.5 9.5 0 001.5-1.5L5.5 5.8A9.5 9.5 0 004 7.3z" fill="#5E6AD2"/>
          <path d="M6.6 5l12.3 12.3c.5-.6.9-1.2 1.2-1.9L8.5 3.8A9.3 9.3 0 006.6 5z" fill="#5E6AD2"/>
          <path d="M9.8 3.3l10.8 10.8c.3-.7.4-1.5.5-2.3L12.1 2.8c-.8.1-1.6.3-2.3.5z" fill="#5E6AD2"/>
          <path d="M13.8 2.6l7.5 7.5A9.5 9.5 0 0013.8 2.6z" fill="#5E6AD2"/>
        </svg>
      );
    case 'obsidian':
      return (
        <svg width={s} height={s} viewBox="0 0 48 48" fill="none">
          <path d="M24 4L8 18l6 26 10-8 10 8 6-26z" fill="#7C3AED"/>
          <path d="M24 4L14 20l10 20 10-20z" fill="#A78BFA" opacity="0.6"/>
        </svg>
      );
    case 'coffee':
      return <img src="/brand/coffee-logo.png" width={s} height={s} style={{ objectFit: 'contain' }} alt="Coffee" />;
    case 'codex':
      return <img src="/brand/apps/codex.svg" width={s} height={s} style={{ objectFit: 'contain' }} alt="Codex" />;
    case 'system:compiler':
    case 'system compiler':
    case 'coffee pod':
      return <img src="/brand/pod-icon-pink.png" width={s} height={s} style={{ objectFit: 'contain' }} alt="Pod" />;
    default:
      return <Globe size={s} />;
  }
}

/** Resolve a raw actor_id into a display label + role. Per Smartware v1.6.16
 *  §4: actor_id can be `person:*`, `agent:*`, `substrate:*` or system tokens.
 *  Falls back to the raw id capitalized so unknown actors stay legible. */
type ActorRole = 'user' | 'agent' | 'substrate' | 'system' | 'unknown';
interface ActorIdentity { id: string; label: string; role: ActorRole }

function displayActor(rawId: string | null | undefined): ActorIdentity | null {
  if (!rawId) return null;
  const id = String(rawId);
  const lower = id.toLowerCase();
  const ownerId = localStorage.getItem('coffee-pod-owner-id');
  const ownerName = localStorage.getItem('coffee-pod-owner-display-name');
  // Well-known tokens
  if (id === ownerId || lower === 'user' || lower === 'person-local' || lower === 'me') {
    return { id, label: ownerName || 'You', role: 'user' };
  }
  if (lower === 'substrate' || lower.startsWith('substrate:')) {
    return { id, label: 'Substrate', role: 'substrate' };
  }
  if (lower === 'smartware-compiler' || lower === 'system:compiler' || lower === 'system compiler') {
    return { id, label: 'Smartware', role: 'system' };
  }
  if (lower === 'seed') {
    return { id, label: 'Seed import', role: 'system' };
  }
  // Prefix-typed ids: agent:hermes → "Hermes" (agent)
  if (lower.startsWith('agent:')) {
    const name = id.slice('agent:'.length);
    return { id, label: name.charAt(0).toUpperCase() + name.slice(1), role: 'agent' };
  }
  if (lower.startsWith('person:')) {
    const name = id.slice('person:'.length);
    return { id, label: name.charAt(0).toUpperCase() + name.slice(1), role: 'user' };
  }
  if (lower.startsWith('system:') || lower.startsWith('sync:')) {
    const name = id.split(':')[1] ?? id;
    return { id, label: name.charAt(0).toUpperCase() + name.slice(1), role: 'system' };
  }
  // Fallback — just capitalize first letter, classify as unknown
  return { id, label: id.charAt(0).toUpperCase() + id.slice(1), role: 'unknown' };
}

/** Format source app name for display: google-drive → Google Drive */
function formatSourceName(raw: string): string {
  if (!raw) return '';
  const map: Record<string, string> = {
    'coffee': 'Coffee',
    'coffee-pod': 'Pod',
    'gmail': 'Email · Google',
    'icloud-mail': 'Email · iCloud',
    'google-drive': 'Google Drive',
    'google-calendar': 'Google Calendar',
    'github': 'GitHub',
    'gitlab': 'GitLab',
    'slack': 'Slack',
    'notion': 'Notion',
    'linear': 'Linear',
    'obsidian': 'Obsidian',
    'codex': 'Codex',
    'local': 'Local',
    'system:compiler': 'Pod by Coffee',
  };
  return map[raw.toLowerCase()] ?? raw.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function formatActorName(raw: string): string {
  if (!raw) return '';
  const map: Record<string, string> = {
    'system:compiler': 'Pod by Coffee',
    'system:dreamer': 'Pod Dreamer',
    'system:decay': 'Pod Decay',
    'system:maintenance': 'Pod Maintenance',
    'system:admission': 'Pod Admission',
    'coffee:desktop': 'Coffee Desktop',
    'coffee:companion': 'Coffee Companion',
    'coffee:drive': 'Coffee Drive',
    'coffee:admin': 'Admin',
    'person-local': 'You',
  };
  return map[raw] ?? raw.split(/[:\-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function relativeTime(value: string): string {
  if (!value) return 'Never';
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return 'Unknown';
  const delta = Date.now() - ts;
  const minutes = Math.max(1, Math.round(delta / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function authHeaders(token?: string): HeadersInit {
  return token ? { authorization: `Bearer ${token}` } : {};
}

async function getJson<T>(path: string, token: string): Promise<T> {
  const response = await fetch(path, { headers: authHeaders(token) });
  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('coffee-pod-session-expired'));
    throw new Error(`${path} 401 session expired`);
  }
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  return response.json() as Promise<T>;
}

async function postJson<T>(path: string, token: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { ...authHeaders(token), 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('coffee-pod-session-expired'));
    throw new Error(`${path} 401 session expired`);
  }
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(parsed?.message ?? `${path} ${response.status}`);
  return parsed as T;
}

async function profileImageDataUrl(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a PNG, JPEG, or WebP image.');
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const candidate = new Image();
      candidate.onload = () => resolve(candidate);
      candidate.onerror = () => reject(new Error('That image could not be opened.'));
      candidate.src = objectUrl;
    });
    const edge = Math.min(image.naturalWidth, image.naturalHeight);
    if (!edge) throw new Error('That image has no visible pixels.');
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('The image editor is unavailable.');
    const sourceX = Math.round((image.naturalWidth - edge) / 2);
    const sourceY = Math.round((image.naturalHeight - edge) / 2);
    context.drawImage(image, sourceX, sourceY, edge, edge, 0, 0, 512, 512);
    const dataUrl = canvas.toDataURL('image/webp', 0.86);
    if (dataUrl.length > 1_000_000) throw new Error('The resized image is still too large.');
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function asObjectRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function normalizeLookupKey(value: string): string {
  return value.trim().toLowerCase();
}

function getObjectRelatedTitles(object: Pick<PodObject, 'metadata' | 'related_to'>): string[] {
  const metadata = asObjectRecord(object.metadata);
  const references = asObjectRecord(metadata?.['references']);
  const titles = object.related_to?.length
    ? object.related_to
    : asStringArray(references?.['related_to']).length > 0
      ? asStringArray(references?.['related_to'])
      : asStringArray(metadata?.['related_to']);
  return Array.from(new Set(titles.map((title) => title.trim()).filter(Boolean)));
}

function normalizeConfidence(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value >= 0 && value <= 1) return `${Math.round(value * 100)}%`;
  return `${Math.round(value)}%`;
}

function normalizePodObject(raw: PodObject): PodObject {
  const metadata = asObjectRecord(raw.metadata);
  const content = asObjectRecord(raw.content);
  const source = raw.source ?? { app: (raw as any).source_app, external_id: (raw as any).source_external_id, url: (raw as any).source_url };
  return {
    ...raw,
    metadata,
    source,
    related_to: getObjectRelatedTitles({ metadata, related_to: raw.related_to }),
    scope: typeof raw.scope === 'string' ? raw.scope : typeof metadata?.['scope'] === 'string' ? String(metadata['scope']) : null,
    confidence: normalizeConfidence(raw.confidence ?? content?.['confidence'] ?? metadata?.['confidence']) ?? undefined,
  };
}

/* ── Nav button with collapsed tooltip ── */

function NavButton({ item, active, collapsed, onClick }: {
  item: { key: string; label: string; icon: React.ComponentType<{ size?: number }> };
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  const ref = React.useRef<HTMLButtonElement>(null);
  const [tooltipStyle, setTooltipStyle] = React.useState<React.CSSProperties>({});
  const [hovered, setHovered] = React.useState(false);

  const showTooltip = collapsed && hovered;

  React.useEffect(() => {
    if (showTooltip && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setTooltipStyle({
        top: rect.top + rect.height / 2,
        left: rect.right + 10,
      });
    }
  }, [showTooltip]);

  const Icon = item.icon;
  return (
    <button
      ref={ref}
      className={`nav-item ${active ? 'active' : ''}`}
      data-nav={item.key}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Icon size={20} />
      <span className="nav-label">{item.label}</span>
      {showTooltip && (
        <span className="nav-tooltip visible" style={tooltipStyle}>{item.label}</span>
      )}
    </button>
  );
}

/* ── Custom Dropdown ── */
export interface AppSelectOption { value: string; label: string; group?: string; swatch?: string }
export function AppDropdown({ value, options, onChange, className, placeholder, portalled = true }: { value: string; options: AppSelectOption[]; onChange: (v: string) => void; className?: string; placeholder?: string; portalled?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) &&
          menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);
  /* Position the menu with fixed positioning so it escapes overflow:hidden
     containers (e.g. the Ask Pod panel). Flip upward when there's no room below. */
  const [menuPos, setMenuPos] = React.useState<{ top: number; left: number; minWidth: number; flip: boolean } | null>(null);
  React.useLayoutEffect(() => {
    if (!open || !portalled || !ref.current) { setMenuPos(null); return; }
    const rect = ref.current.getBoundingClientRect();
    const menuH = Math.min(260, options.length * 32 + 8);
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const flip = spaceBelow < menuH && rect.top > spaceBelow;
    const top = flip ? rect.top - menuH - 4 : rect.bottom + 4;
    const minWidth = rect.width;
    // Keep the menu within the viewport horizontally
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - minWidth - 8));
    setMenuPos({ top: Math.max(8, top), left, minWidth, flip });
  }, [open, options.length, portalled]);
  const selected = options.find(o => o.value === value);
  const groups = new Map<string, AppSelectOption[]>();
  for (const o of options) { const g = o.group ?? ''; if (!groups.has(g)) groups.set(g, []); groups.get(g)!.push(o); }
  const menu = (
    <div
      className={`app-dropdown-menu ${portalled ? 'app-dropdown-menu-portal' : ''} ${className ?? ''}`}
      ref={menuRef}
      style={portalled && menuPos ? { position: 'fixed', top: menuPos.top, left: menuPos.left, minWidth: menuPos.minWidth } : undefined}
    >
      {Array.from(groups.entries()).map(([group, items], gi) => (
        <React.Fragment key={gi}>
          {group && <div className="app-dropdown-group">{group}</div>}
          {items.map(o => (
            <button key={o.value} className={`app-dropdown-item ${o.value === value ? 'selected' : ''}`} onMouseDown={e => e.preventDefault()} onClick={() => { onChange(o.value); setOpen(false); }} type="button">
              {o.swatch && <span className="app-dropdown-swatch" style={{ background: o.swatch }} />}
              <span>{o.label}</span>
              {o.value === value && <CheckCircle2 size={12} className="app-dropdown-check" />}
            </button>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
  return (
    <div className={`app-dropdown ${className ?? ''}`} ref={ref}>
      <button className="app-dropdown-trigger" onMouseDown={e => e.preventDefault()} onClick={() => setOpen(!open)} type="button">
        {selected?.swatch && <span className="app-dropdown-swatch" style={{ background: selected.swatch }} />}
        <span className="app-dropdown-label">{selected?.label ?? placeholder ?? '— none —'}</span>
        <ChevronDown size={12} className={`app-dropdown-chevron ${open ? 'open' : ''}`} />
      </button>
      {open && (portalled ? menuPos && createPortal(menu, document.body) : menu)}
    </div>
  );
}

/* ── Custom Date Picker ── */
function AppDateInput({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const popupRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) &&
          popupRef.current && !popupRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);
  /* Position the popup relative to the trigger using fixed positioning so it escapes overflow containers. */
  const [popupPos, setPopupPos] = React.useState<{ top: number; left: number } | null>(null);
  React.useEffect(() => {
    if (!open || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const popupH = 300; // approximate height of calendar popup
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const top = spaceBelow >= popupH ? rect.bottom + 4 : rect.top - popupH - 4;
    const left = Math.min(rect.left, window.innerWidth - 260);
    setPopupPos({ top: Math.max(4, top), left: Math.max(4, left) });
  }, [open]);
  const parsed = value ? new Date(value + 'T00:00:00') : null;
  const [viewYear, setViewYear] = React.useState(parsed?.getFullYear() ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = React.useState(parsed?.getMonth() ?? new Date().getMonth());
  React.useEffect(() => {
    if (!open) return;
    const d = value ? new Date(value + 'T00:00:00') : new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }, [open, value]);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const offset = (firstDay + 6) % 7;
  const monthLabel = new Date(viewYear, viewMonth).toLocaleString('default', { month: 'long', year: 'numeric' });
  const prevMonth = () => { if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); } else setViewMonth(viewMonth - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); } else setViewMonth(viewMonth + 1); };
  const pick = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    onChange(`${viewYear}-${m}-${d}`);
    setOpen(false);
  };
  const display = parsed ? parsed.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
  return (
    <div className={`app-datepicker ${className ?? ''}`} ref={ref}>
      <button className="app-datepicker-trigger" onClick={() => setOpen(!open)} type="button">
        <span className={`app-datepicker-label ${!value ? 'empty' : ''}`}>{display || 'dd/mm/yyyy'}</span>
        <CalendarDays size={12} className="app-datepicker-icon" />
      </button>
      {open && popupPos && createPortal(
        <div className="app-datepicker-popup" ref={popupRef} style={{ position: 'fixed', top: popupPos.top, left: popupPos.left }}>
          <div className="app-datepicker-header">
            <button className="app-datepicker-nav" onClick={prevMonth} type="button"><ChevronLeft size={14} /></button>
            <span className="app-datepicker-month">{monthLabel}</span>
            <button className="app-datepicker-nav" onClick={nextMonth} type="button"><ChevronRight size={14} /></button>
          </div>
          <div className="app-datepicker-weekdays">
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => <span key={d}>{d}</span>)}
          </div>
          <div className="app-datepicker-grid">
            {Array.from({ length: offset }).map((_, i) => <span key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isToday = iso === new Date().toISOString().slice(0, 10);
              return (
                <button key={day} type="button" className={`app-datepicker-day ${iso === value ? 'selected' : ''} ${isToday ? 'today' : ''}`} onClick={() => pick(day)}>{day}</button>
              );
            })}
          </div>
          {value && <button className="app-datepicker-clear" onClick={() => { onChange(''); setOpen(false); }} type="button">Clear</button>}
        </div>,
        document.body
      )}
    </div>
  );
}

/* ── Legacy wrapper ── */
function AppSelect({ value, options, onChange, className, portalled }: { value: string; options: AppSelectOption[]; onChange: (v: string) => void; className?: string; portalled?: boolean }) {
  return <AppDropdown value={value} options={options} onChange={onChange} className={className} portalled={portalled} />;
}

/* ═══════════════════════════════════════
   Resizable Table Columns
   ═══════════════════════════════════════ */

interface ColDef {
  key: string;
  minWidth: number;    // px
  initWidth: number;   // px (0 = flex "1fr")
}

function useColumnResize(storageKey: string, cols: ColDef[]) {
  const [widths, setWidths] = React.useState<number[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`pod:col:${storageKey}`) ?? '[]');
      if (Array.isArray(saved) && saved.length === cols.length) return saved;
    } catch { /* ignore */ }
    return cols.map(c => c.initWidth);
  });

  const persist = React.useCallback((next: number[]) => {
    localStorage.setItem(`pod:col:${storageKey}`, JSON.stringify(next));
  }, [storageKey]);

  const gridTemplate = React.useMemo(() =>
    // Use minmax(0, ...) so columns can shrink below their content-min when
    // the viewport narrows or the detail pane opens. Without this, a long
    // chip would push the grid wider than its container and rows wrap.
    widths.map((w) => w === 0 ? 'minmax(0, 1fr)' : `minmax(0, ${w}px)`).join(' '),
    [widths],
  );

  /** Resolve a flex (0) column to its current rendered pixel width */
  const resolveWidth = React.useCallback((colIndex: number, measuredPx: number) => {
    setWidths(prev => {
      if (prev[colIndex] !== 0) return prev;
      const next = [...prev];
      next[colIndex] = measuredPx;
      return next;
    });
  }, []);

  const onResize = React.useCallback((colIndex: number, delta: number) => {
    setWidths(prev => {
      const next = [...prev];
      const col = cols[colIndex];
      const current = prev[colIndex] || col.initWidth || col.minWidth;
      next[colIndex] = Math.max(col.minWidth, current + delta);
      persist(next);
      return next;
    });
  }, [cols, persist]);

  return { widths, gridTemplate, onResize, resolveWidth };
}

function ColResizeHandle({ colIndex, onResize, onResolve }: {
  colIndex: number;
  onResize: (colIndex: number, delta: number) => void;
  onResolve?: (colIndex: number, measuredPx: number) => void;
}) {
  const startXRef = React.useRef(0);
  const accRef = React.useRef(0);

  const handlePointerDown = React.useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const parent = (e.currentTarget as HTMLElement).parentElement;
    if (parent && onResolve) {
      onResolve(colIndex, parent.getBoundingClientRect().width);
    }
    startXRef.current = e.clientX;
    accRef.current = 0;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    el.classList.add('dragging');

    const onMove = (ev: PointerEvent) => {
      const delta = ev.clientX - startXRef.current;
      const step = delta - accRef.current;
      accRef.current = delta;
      onResize(colIndex, step);
    };
    const onUp = (ev: PointerEvent) => {
      ev.stopPropagation();
      el.classList.remove('dragging');
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      // Suppress the click that would bubble to the sort button
      const suppressClick = (ce: Event) => { ce.stopPropagation(); ce.preventDefault(); };
      el.parentElement?.addEventListener('click', suppressClick, { capture: true, once: true });
      setTimeout(() => el.parentElement?.removeEventListener('click', suppressClick, { capture: true }), 50);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  }, [colIndex, onResize, onResolve]);

  return <div className="col-resize-handle" onPointerDown={handlePointerDown} onClick={e => e.stopPropagation()} />;
}

/* ═══════════════════════════════════════
   Skeleton loading components
   ═══════════════════════════════════════ */

function Skeleton({ width, height = 12, rounded, style }: {
  width?: string | number; height?: number; rounded?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={`skel-bone ${rounded ? 'skel-rounded' : ''}`}
      style={{ width: width ?? '100%', height, ...style }}
    />
  );
}

/** Table skeleton — mimics the docs/list table with header + N rows */
function TableSkeleton({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="skel-table">
      <div className="skel-table-head">
        {Array.from({ length: cols }, (_, i) => (
          <span key={i} className="skel-table-hcell">
            <Skeleton width={i === 0 ? '60%' : '50%'} height={10} />
          </span>
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="skel-table-row" style={{ animationDelay: `${r * 60}ms` }}>
          {Array.from({ length: cols }, (_, c) => (
            <span key={c} className="skel-table-cell">
              <Skeleton width={c === 0 ? `${70 + (r % 3) * 10}%` : `${40 + (c * 10) % 30}%`} height={11} />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Card grid skeleton — mimics the skills/grid browse view */
function GridSkeleton({ cards = 9 }: { cards?: number }) {
  return (
    <div className="skel-grid">
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className="skel-card" style={{ animationDelay: `${i * 50}ms` }}>
          <Skeleton width="70%" height={14} style={{ marginBottom: 10 }} />
          <Skeleton width="100%" height={10} style={{ marginBottom: 6 }} />
          <Skeleton width="85%" height={10} style={{ marginBottom: 14 }} />
          <div className="skel-card-footer">
            <Skeleton width={50} height={10} rounded />
            <Skeleton width={30} height={10} rounded />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Progressive-render hook: shows `pageSize` items initially, then auto-loads
 * more batches when a sentinel element scrolls into view. Resets to the first
 * page whenever the source array identity changes (new filter, sort, etc.).
 */
/** Walk up the DOM to find the nearest scrollable ancestor. */
function findScrollParent(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
    node = node.parentElement;
  }
  return null;
}

function useProgressiveRender<T>(items: T[], pageSize = 50) {
  const [visibleCount, setVisibleCount] = React.useState(pageSize);
  const observerRef = React.useRef<IntersectionObserver | null>(null);
  const itemsLenRef = React.useRef(items.length);
  itemsLenRef.current = items.length;

  // Reset to first page when the data set actually changes. Depend on
  // items.length (a stable value) rather than the array reference — callers
  // rebuild the array every render, so depending on `items` would reset the
  // page count on every render and prevent "load more" from ever sticking.
  React.useEffect(() => {
    setVisibleCount(pageSize);
  }, [items.length, pageSize]);

  // Callback ref — observes sentinel as soon as it mounts, using
  // the nearest scrollable ancestor as the observer root so it works
  // inside overflow containers (docs-table-body, db-list-body, etc.).
  const sentinelRef = React.useCallback((el: HTMLDivElement | null) => {
    if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }
    if (!el) return;
    const scrollRoot = findScrollParent(el);
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount(prev => Math.min(prev + pageSize, itemsLenRef.current));
        }
      },
      { root: scrollRoot, rootMargin: '200px' },
    );
    obs.observe(el);
    observerRef.current = obs;
  }, [pageSize]);

  const visible = React.useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);
  const hasMore = visibleCount < items.length;

  return { visible, hasMore, sentinelRef, total: items.length, showing: visible.length };
}

/* ═══════════════════════════════════════
   AI Chat Panel
   ═══════════════════════════════════════ */

const SUGGESTED_PROMPTS = [
  'What happened yesterday?',
  'Are there any conflicting memories?',
  'Summarise my recent notes',
  'What connections am I missing?',
];

function AIChatFilterPopover({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const raf = requestAnimationFrame(() => document.addEventListener('mousedown', handler));
    return () => { cancelAnimationFrame(raf); document.removeEventListener('mousedown', handler); };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="ai-filter-popover-backdrop">
      <div ref={ref} className="ai-filter-popover">
        <div className="ai-filter-popover-header">
          <span className="ai-filter-popover-title">{title}</span>
          <button className="ai-filter-popover-close" onMouseDown={(e) => { e.preventDefault(); onClose(); }}>
            <X size={14} />
          </button>
        </div>
        <div className="ai-filter-popover-body">
          {children}
        </div>
      </div>
    </div>
  );
}

function MiniCalendar({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const today = new Date();
  const selected = value ? new Date(value + 'T00:00:00') : null;
  const [viewYear, setViewYear] = React.useState(selected?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = React.useState(selected?.getMonth() ?? today.getMonth());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7; // Monday-start
  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  const prev = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const next = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };

  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const fmt = (d: number) => `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const isToday = (d: number) => d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
  const isSelected = (d: number) => value === fmt(d);

  return (
    <div className="mini-cal">
      <span className="mini-cal-label">{label}</span>
      <div className="mini-cal-header">
        <button onMouseDown={e => { e.preventDefault(); prev(); }}><ChevronDown size={12} style={{ transform: 'rotate(90deg)' }} /></button>
        <span className="mini-cal-month">{monthLabel}</span>
        <button onMouseDown={e => { e.preventDefault(); next(); }}><ChevronDown size={12} style={{ transform: 'rotate(-90deg)' }} /></button>
      </div>
      <div className="mini-cal-weekdays">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="mini-cal-grid">
        {cells.map((d, i) => d ? (
          <button key={i} className={`mini-cal-day ${isToday(d) ? 'today' : ''} ${isSelected(d) ? 'selected' : ''}`} onMouseDown={e => { e.preventDefault(); onChange(fmt(d)); }}>
            {d}
          </button>
        ) : <span key={i} />)}
      </div>
    </div>
  );
}

/** Lightweight markdown renderer: bold, code, links, bullets, paragraphs */
function renderSimpleMarkdown(text: string): string {
  // Escape HTML
  let html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Inline formatting
  html = html
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/(^|[^"'])(https?:\/\/[^\s<)]+)/gm, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');

  // Convert bullet lines into list items
  const lines = html.split('\n');
  const out: string[] = [];
  let inList = false;
  for (const line of lines) {
    const bullet = line.match(/^\s*[•\-\*]\s+(.*)/);
    if (bullet) {
      if (!inList) { out.push('<ul class="ai-md-list">'); inList = true; }
      out.push(`<li>${bullet[1]}</li>`);
    } else {
      if (inList) { out.push('</ul>'); inList = false; }
      if (line.trim() === '') {
        out.push('<div class="ai-md-gap"></div>');
      } else {
        out.push(`<p class="ai-md-p">${line}</p>`);
      }
    }
  }
  if (inList) out.push('</ul>');
  return out.join('');
}

function AIChatPanel({ open, onClose, collections, authToken, objects, activeContext, onClearContext, onOpenConnections, onOpenSource }: { open: boolean; onClose: () => void; collections: PodCollection[]; authToken: string; objects: PodObject[]; activeContext?: AskPodContext | null; onClearContext?: () => void; onOpenConnections?: () => void; onOpenSource?: (source: AskPodSource) => void }) {
  const [conversations, setConversations] = React.useState<AskPodConversation[]>(() => {
    const stored = loadAskPodConversations();
    return stored.length > 0 ? stored : [createAskPodConversation()];
  });
  const [activeConversationId, setActiveConversationId] = React.useState(() => conversations[0].id);
  const activeConversation = conversations.find(conversation => conversation.id === activeConversationId) ?? conversations[0];
  const messages = activeConversation?.messages ?? [];
  const setMessages = React.useCallback((update: React.SetStateAction<AIChatMessage[]>) => {
    setConversations(previous => previous.map(conversation => {
      if (conversation.id !== activeConversationId) return conversation;
      const nextMessages = typeof update === 'function'
        ? update(conversation.messages)
        : update;
      const firstUserMessage = nextMessages.find(message => message.role === 'user');
      return {
        ...conversation,
        title: firstUserMessage ? askPodConversationTitle(firstUserMessage.text) : 'New conversation',
        updatedAt: new Date().toISOString(),
        messages: nextMessages,
      };
    }));
  }, [activeConversationId]);
  const [input, setInput] = React.useState('');
  const [expanded, setExpanded] = React.useState(false);
  const [inputFocused, setInputFocused] = React.useState(false);
  const [showMemoryFilter, setShowMemoryFilter] = React.useState(false);
  const [showTimeframe, setShowTimeframe] = React.useState(false);
  const [selectedScope, setSelectedScope] = React.useState<string | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = React.useState<string | null>(null);
  const [customDateFrom, setCustomDateFrom] = React.useState('');
  const [customDateTo, setCustomDateTo] = React.useState('');
  const [showCustomDate, setShowCustomDate] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [thinkingPhase, setThinkingPhase] = React.useState(0);
  const [selectedModel, setSelectedModel] = React.useState<'auto' | 'fast' | 'deep'>('auto');
  const [expandedEvidenceId, setExpandedEvidenceId] = React.useState<string | null>(null);
  const [showHistory, setShowHistory] = React.useState(false);
  const [historySearch, setHistorySearch] = React.useState('');
  const [copiedMessage, setCopiedMessage] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  // Track popover state in a ref so the blur timeout reads the latest value (avoids stale closure)
  const popoverOpenRef = React.useRef(false);
  popoverOpenRef.current = showTimeframe || showMemoryFilter;

  React.useEffect(() => {
    const nonEmpty = conversations.filter(conversation => conversation.messages.length > 0);
    localStorage.setItem(ASK_POD_HISTORY_KEY, JSON.stringify(nonEmpty));
  }, [conversations]);

  // Reset state when panel closes
  React.useEffect(() => {
    if (!open) { setExpanded(false); setInputFocused(false); setShowMemoryFilter(false); setShowTimeframe(false); setShowCustomDate(false); setShowHistory(false); }
  }, [open]);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const startNewConversation = () => {
    if (sending) return;
    const conversation = createAskPodConversation();
    setConversations(previous => [conversation, ...previous.filter(item => item.messages.length > 0)]);
    setActiveConversationId(conversation.id);
    setInput('');
    setShowHistory(false);
    setExpandedEvidenceId(null);
    onClearContext?.();
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const openConversation = (id: string) => {
    if (sending) return;
    setActiveConversationId(id);
    setShowHistory(false);
    setExpandedEvidenceId(null);
    onClearContext?.();
  };

  const deleteConversation = (id: string) => {
    if (sending) return;
    setConversations(previous => {
      const remaining = previous.filter(conversation => conversation.id !== id);
      if (id !== activeConversationId) return remaining.length > 0 ? remaining : [createAskPodConversation()];
      const next = remaining[0] ?? createAskPodConversation();
      setActiveConversationId(next.id);
      return remaining.length > 0 ? remaining : [next];
    });
  };

  const copyMessage = async (message: AIChatMessage, key: string) => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopiedMessage(key);
      window.setTimeout(() => setCopiedMessage(current => current === key ? null : current), 1600);
    } catch {
      setCopiedMessage(null);
    }
  };

  /** Build the scope string from selected scope + timeframe filters */
  const buildScope = (): string | undefined => {
    if (selectedScope === 'personal' || selectedScope === 'workspace') return selectedScope;
    return 'all';
  };

  /** Translate the selected timeframe chip into explicit ISO date bounds
   *  (half-open [start, end)). Returns null when no timeframe is active or
   *  "All time" is selected. Computed in the user's local timezone. */
  const buildTimeframe = (): { date_start: string; date_end: string; timeframe_label: string } | null => {
    if (!selectedTimeframe || selectedTimeframe === 'all') return null;
    const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
    const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
    const now = new Date();
    const today0 = startOfDay(now);
    const tomorrow0 = addDays(today0, 1);
    if (selectedTimeframe === 'custom') {
      if (!customDateFrom || !customDateTo) return null;
      const start = new Date(customDateFrom + 'T00:00:00');
      const end = addDays(new Date(customDateTo + 'T00:00:00'), 1); // inclusive end day
      return { date_start: start.toISOString(), date_end: end.toISOString(), timeframe_label: `${customDateFrom} → ${customDateTo}` };
    }
    const ranges: Record<string, { start: Date; end: Date; label: string }> = {
      today: { start: today0, end: tomorrow0, label: 'Today' },
      yesterday: { start: addDays(today0, -1), end: today0, label: 'Yesterday' },
      '7d': { start: addDays(today0, -7), end: tomorrow0, label: 'Last 7 days' },
      '30d': { start: addDays(today0, -30), end: tomorrow0, label: 'Last 30 days' },
      '90d': { start: addDays(today0, -90), end: tomorrow0, label: 'Last 3 months' },
    };
    const r = ranges[selectedTimeframe];
    if (!r) return null;
    return { date_start: r.start.toISOString(), date_end: r.end.toISOString(), timeframe_label: r.label };
  };

  /** Call /pod/query with the user's message */
  const queryPod = async (queryText: string) => {
    setSending(true);
    setThinkingPhase(0);
    const queryContext = activeContext ?? null;
    setMessages(prev => [...prev, { role: 'user', text: queryText, createdAt: new Date().toISOString(), context: queryContext }]);
    setInput('');
    // Tick through thinking phases on a timer so the user sees progress
    const phaseTimer = setInterval(() => setThinkingPhase(p => Math.min(p + 1, 4)), 1200);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['authorization'] = `Bearer ${authToken}`;
      const timeframe = buildTimeframe();
      const res = await fetch('/pod/query', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: queryText,
          actor_id: 'person-local',
          history: messages.slice(-8).map(message => ({
            role: message.role === 'ai' ? 'assistant' : 'user',
            content: message.text.slice(0, 1200),
          })),
          scope: buildScope(),
          include_observations: true,
          include_external_mcp: true,
          use_llm: true,
          model_mode: selectedModel,
          context: queryContext?.payload,
          ...(timeframe ?? {}),
        }),
      });
      if (!res.ok) throw new Error(`Query failed: ${res.status}`);
      const data = await res.json();

      // Format response from claims + observations
      const claims = data.claims ?? data.results ?? [];
      const observations = data.observations ?? [];
      const conversations = Array.isArray(data.conversations) ? data.conversations : [];
      const retrievedSources: AskPodSource[] = Array.isArray(data.sources) ? data.sources : [];
      const citedSources: AskPodSource[] = Array.isArray(data.citations) ? data.citations : [];
      const experts: AskPodExpert[] = Array.isArray(data.experts) ? data.experts : [];
      const steps: AskPodStep[] | undefined = Array.isArray(data.steps) ? data.steps : undefined;

      let responseText = typeof data.answer === 'string' && data.answer.trim().length > 0 ? data.answer.trim() : '';
      const sources = responseText ? citedSources : retrievedSources;
      if (claims.length > 0) {
        const claimLines = claims.map((c: any) => {
          if (c.entity_id && sources.length === 0) sources.push({ id: c.entity_id, type: 'claim', title: c.entity_name ?? c.entity_id, entity_id: c.entity_id });
          return `• ${c.entity_name ?? c.subject ?? 'Unknown'}: ${c.predicate ?? ''} ${c.object ?? c.value ?? ''} (${Math.round((c.confidence ?? c.score ?? 0) * 100)}% confidence)`;
        }).join('\n');
        if (!responseText) {
          responseText = claimLines;
        }
      }
      if (observations.length > 0) {
        const observationLines = observations.slice(0, 5).map((o: any) => {
          if ((o.id || o.object_id) && sources.length === 0) sources.push({ id: o.object_id ?? o.id, type: 'observation', title: o.title ?? o.source_app ?? 'Observation', object_id: o.object_id });
          return `• ${o.title ?? o.summary ?? o.content?.toString().slice(0, 100) ?? 'Observation'}`;
        }).join('\n');
        if (!responseText) {
          responseText = `📋 Related observations:\n${observationLines}`;
        }
      }
      if (!responseText && conversations.length > 0) {
        const conversationLines = conversations.slice(0, 3).map((conversation: any) => {
          const answer = typeof conversation.resolution === 'string' && conversation.resolution.trim()
            ? conversation.resolution.trim()
            : conversation.summary;
          return `• **${conversation.title ?? 'Past conversation'}** — ${answer}`;
        }).join('\n');
        responseText = `I found this in a past conversation:\n\n${conversationLines}`;
      }
      if (!responseText) {
        responseText = "I couldn't find anything matching that query. Try rephrasing or broadening your search scope.";
      }
      setMessages(prev => [...prev, {
        role: 'ai',
        text: responseText,
        createdAt: new Date().toISOString(),
        sources: sources.length > 0 ? sources : undefined,
        experts: experts.length > 0 ? experts : undefined,
        steps,
        context: queryContext,
      }]);
    } catch {
      const words = localAskPodSearchTerms(queryText);
      const snippetOf = (o: PodObject): string => {
        if (o.summary) return o.summary;
        if (o.content && typeof o.content === 'object') {
          const c = o.content as Record<string, unknown>;
          for (const k of ['summary', 'description', 'notes', 'rationale', 'detail', 'key_points', 'basis']) {
            if (typeof c[k] === 'string' && (c[k] as string).trim()) return (c[k] as string).trim();
          }
        }
        return '';
      };
      const contextObjectIds = new Set(queryContext?.payload.object_ids ?? []);
      const objectPool = contextObjectIds.size > 0 ? objects.filter(o => contextObjectIds.has(o.id)) : objects;
      const scored = objectPool.map(o => {
        const haystack = [o.title, o.kind, snippetOf(o), ...(o.tags ?? [])].join(' ').toLowerCase();
        const hits = words.filter(w => haystack.includes(w)).length;
        return { obj: o, snippet: snippetOf(o), score: hits };
      }).filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 6);

      let response: string;
      if (scored.length > 0) {
        const lines = scored.map(({ obj, snippet }) => {
          const desc = snippet && snippet !== obj.title ? ` — ${snippet.slice(0, 100)}` : '';
          return `• **${obj.title}**${desc}`;
        });
        response = `I couldn't reach Pod just now, but I found a few possible matches in the memories already loaded:\n\n${lines.join('\n')}`;
      } else {
        response = `I couldn't reach Pod just now, and the memories already loaded in this window don't answer that.\n\nTry again in a moment. If this is something you'd like Pod to remember, tell me once it's back.`;
      }

      setMessages(prev => [...prev, {
        role: 'ai',
        text: response,
        createdAt: new Date().toISOString(),
        local: true,
        context: queryContext,
        sources: scored.map(({ obj, snippet }) => ({ id: `object:${obj.id}`, type: 'object', title: obj.title, object_id: obj.id, snippet })),
        steps: [
          ...(queryContext ? [{ id: 'context', label: 'Read selected context', status: 'done' as const, count: objectPool.length }] : []),
          { id: 'local', label: 'Search memories already loaded', status: 'done' as const, count: scored.length },
        ],
      }]);
    } finally {
      clearInterval(phaseTimer);
      setThinkingPhase(0);
      setSending(false);
    }
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    queryPod(trimmed);
  };

  const handlePromptClick = (prompt: string) => {
    if (sending) return;
    queryPod(prompt);
  };

  /** Attach file into the inbox via the standard Pod upload route. */
  const handleAttachFile = async (file: File) => {
    const formData = new FormData();
    formData.append('actor_id', localStorage.getItem('coffee-pod-owner-id') ?? 'person-local');
    formData.append('collection_id', 'inbox');
    formData.append('file', file);
    setMessages(prev => [...prev, { role: 'user', text: `📎 Attached: ${file.name}`, createdAt: new Date().toISOString() }]);
    try {
      const headers: Record<string, string> = {};
      if (authToken) headers['authorization'] = `Bearer ${authToken}`;
      const res = await fetch('/pod/upload', { method: 'POST', headers, body: formData });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'ai', text: `✅ "${file.name}" uploaded and ingested.${data.object_id ? ` Object ID: ${data.object_id}` : ''}`, createdAt: new Date().toISOString() }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'ai', text: `⚠️ Failed to upload: ${err.message}`, createdAt: new Date().toISOString() }]);
    }
  };

  /** Treat a clipboard image like a file chosen with the attachment button. */
  const handlePasteImage = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const imageItem = Array.from(event.clipboardData.items).find(item => item.type.startsWith('image/'));
    if (!imageItem) return;
    const pastedFile = imageItem.getAsFile();
    if (!pastedFile) return;
    event.preventDefault();
    const extension = pastedFile.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
    const file = pastedFile.name && pastedFile.name.includes('.')
      ? pastedFile
      : new File([pastedFile], `pasted-image-${Date.now()}.${extension}`, { type: pastedFile.type });
    void handleAttachFile(file);
  };

  /** Open a source doc in the main content area (keep Ask Pod open as side pane) */
  const handleSourceClick = (source: AskPodSource) => {
    if (source.url && !source.object_id && !source.entity_id) {
      window.open(source.url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!source.object_id && !source.entity_id && source.text) {
      setExpandedEvidenceId(current => current === source.id ? null : source.id);
      return;
    }
    // Collapse expanded mode so Ask Pod becomes side pane, doc loads in main area
    if (expanded) setExpanded(false);
    onOpenSource?.(source);
  };

  const showControls = expanded || inputFocused || input.trim().length > 0 || showTimeframe || showMemoryFilter || selectedTimeframe !== null || selectedScope !== null;

  const TIMEFRAME_OPTIONS = [
    { id: 'today', label: 'Today', desc: 'Since midnight' },
    { id: 'yesterday', label: 'Yesterday', desc: 'Previous day' },
    { id: '7d', label: 'Last 7 days', desc: 'Past week' },
    { id: '30d', label: 'Last 30 days', desc: 'Past month' },
    { id: '90d', label: 'Last 3 months', desc: 'Past quarter' },
    { id: 'all', label: 'All time', desc: 'Everything' },
  ];

  const SCOPE_OPTIONS: { id: string; label: string; icon: React.ComponentType<{ size?: number }>; desc?: string }[] = [
    { id: '__all__', label: 'All memories', icon: LibraryBig, desc: 'Your Pod and every connected app' },
    { id: 'personal', label: 'Private memory', icon: Lock, desc: 'Only your personal Pod memory' },
    { id: 'workspace', label: 'Shared workspace', icon: Users, desc: 'Knowledge shared with your workspace' },
  ];

  const timeframeLabel = selectedTimeframe === 'custom'
    ? `${customDateFrom || '…'} → ${customDateTo || '…'}`
    : TIMEFRAME_OPTIONS.find(t => t.id === selectedTimeframe)?.label;

  const sourceIcon = (source: AskPodSource): React.ReactNode => {
    if (source.source?.app === 'gmail' || source.source?.app === 'icloud-mail') return <Mail size={12} />;
    if (source.type === 'object') return <FileText size={12} />;
    if (source.type === 'claim') return <Brain size={12} />;
    if (source.type === 'observation') return <Eye size={12} />;
    if (source.type === 'profile') return <User size={12} />;
    if (source.type === 'conversation') return <MessageSquare size={12} />;
    if (source.type === 'lesson') return <Lightbulb size={12} />;
    if (source.type === 'expertise') return <Users size={12} />;
    return <ExternalLink size={12} />;
  };

  const sourceTitle = (source: AskPodSource): string => {
    if (source.source?.app !== 'gmail' && source.source?.app !== 'icloud-mail') return source.title;
    return /^email\s*·/i.test(source.title) ? source.title : `Email · ${source.title}`;
  };

  const sourceKind = (source: AskPodSource): string => {
    if (source.source?.app === 'gmail' || source.source?.app === 'icloud-mail') return 'Email message';
    if (source.type === 'conversation') return 'Learned from a conversation';
    if (source.type === 'lesson') return 'Learned from a later run';
    return 'Supporting memory';
  };

  const expertLabel = (expert: AskPodExpert): string => {
    if (expert.actor_name?.trim()) return expert.actor_name.trim();
    return expert.actor_id.replace(/^(person|agent|user):/, '').replace(/[-_]+/g, ' ');
  };

  const visibleConversations = conversations
    .filter(conversation => conversation.messages.length > 0)
    .filter(conversation => {
      const needle = historySearch.trim().toLowerCase();
      return !needle || conversation.title.toLowerCase().includes(needle)
        || conversation.messages.some(message => message.text.toLowerCase().includes(needle));
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const formatMessageTime = (value?: string) => {
    const date = value ? new Date(value) : new Date();
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
  };

  const formatConversationDate = (value: string) => {
    const date = new Date(value);
    const today = new Date();
    const sameDay = date.toDateString() === today.toDateString();
    return new Intl.DateTimeFormat(undefined, sameDay
      ? { hour: 'numeric', minute: '2-digit' }
      : { month: 'short', day: 'numeric' }).format(date);
  };

  return (
    <div className={`ai-chat-panel ${open ? 'open' : ''} ${expanded ? 'expanded' : ''}`}>
      <div className="ai-chat-header">
        <PodAIIcon size={18} />
        <span className="ai-chat-title">Ask Pod</span>
        <button className="ai-chat-header-action" onClick={startNewConversation} title="New conversation" disabled={sending}>
          <Plus size={15} />
        </button>
        <button className={`ai-chat-header-action ${showHistory ? 'active' : ''}`} onClick={() => {
          setShowHistory(value => !value);
          setShowTimeframe(false);
          setShowMemoryFilter(false);
        }} title="Conversation history" disabled={sending}>
          <History size={15} />
        </button>
        <button className="ai-chat-expand" onClick={() => setExpanded(e => !e)} title={expanded ? 'Collapse' : 'Expand'}>
          {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
        <button className="ai-chat-close" aria-label="Close Ask Pod" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      {activeContext && (
        <div className="ai-chat-context-strip">
          <div className="ai-chat-context-main">
            <span className="ai-chat-context-kicker">{activeContext.title}</span>
            {activeContext.subtitle && <span className="ai-chat-context-subtitle">{activeContext.subtitle}</span>}
          </div>
          <div className="ai-chat-context-chips">
            {activeContext.chips.slice(0, 3).map(chip => <span key={chip} className="ai-chat-context-chip">{chip}</span>)}
          </div>
          <button className="ai-chat-context-clear" onClick={onClearContext} title="Clear context"><X size={12} /></button>
        </div>
      )}
      <div className="ai-chat-body">
      <div className={`ai-chat-main ${showHistory ? 'show-history' : ''}`}>
      {showHistory && (
        <div className="ai-chat-history" aria-label="Conversation history">
          <div className="ai-chat-history-top">
            <strong>Conversations</strong>
            <button onClick={startNewConversation}><Plus size={13} /> New</button>
          </div>
          <label className="ai-chat-history-search">
            <Search size={13} />
            <input value={historySearch} onChange={event => setHistorySearch(event.target.value)} placeholder="Search conversations" autoFocus />
          </label>
          <div className="ai-chat-history-list">
            {visibleConversations.length === 0 ? (
              <div className="ai-chat-history-empty">No conversations found.</div>
            ) : visibleConversations.map(conversation => (
              <div key={conversation.id} className={`ai-chat-history-row ${conversation.id === activeConversationId ? 'active' : ''}`}>
                <button className="ai-chat-history-open" onClick={() => openConversation(conversation.id)}>
                  <span className="ai-chat-history-copy">
                    <strong>{conversation.title}</strong>
                    <small>{conversation.messages.at(-1)?.text}</small>
                  </span>
                  <time dateTime={conversation.updatedAt}>{formatConversationDate(conversation.updatedAt)}</time>
                </button>
                <button className="ai-chat-history-delete" onClick={() => deleteConversation(conversation.id)} title="Delete conversation" aria-label={`Delete ${conversation.title}`}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="ai-chat-messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="ai-chat-empty">
            <PodAIIcon size={32} />
            <p>Ask me anything about your memories, connections, or ideas.</p>
            <div className="ai-chat-suggestions">
              {SUGGESTED_PROMPTS.map(prompt => (
                <button
                  key={prompt}
                  className="ai-chat-suggestion"
                  onClick={() => handlePromptClick(prompt)}
                >
                  <Sparkles size={12} />
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => {
          const messageKey = `${activeConversationId}-${i}`;
          return (
          <div key={messageKey} className={`ai-chat-msg ${msg.role}`}>
            {msg.role === 'ai' && msg.steps && msg.steps.length > 0 && (
              <div className="ai-chat-step-list">
                <div className="ai-chat-reasoning-row"><Brain size={13} /> What I checked</div>
                {msg.steps.map(step => (
                  <div key={step.id} className={`ai-chat-step-row ${step.status}`}>
                    {step.status === 'done' ? <CheckCircle2 size={13} /> : step.status === 'error' ? <AlertCircle size={13} /> : <Clock size={13} />}
                    <span>{step.label}</span>
                    {typeof step.count === 'number' && <strong>{step.count}</strong>}
                  </div>
                ))}
              </div>
            )}
            <div className="ai-chat-msg-body" dangerouslySetInnerHTML={{ __html: renderSimpleMarkdown(msg.text) }} />
            {msg.experts && msg.experts.length > 0 && (
              <div className="ai-chat-expertise" aria-label="People with demonstrated expertise">
                <div className="ai-chat-expertise-heading">
                  <Users size={12} />
                  <span>Who knows</span>
                  <small>from demonstrated work</small>
                </div>
                <div className="ai-chat-expertise-list">
                  {msg.experts.slice(0, 3).map(expert => (
                    <div key={expert.actor_id} className="ai-chat-expert">
                      <span className="ai-chat-expert-mark">{expertLabel(expert).slice(0, 1).toUpperCase()}</span>
                      <span className="ai-chat-expert-copy">
                        <strong>{expertLabel(expert)}</strong>
                        <small>{expert.reason.replace(/^Demonstrated by\s*/i, '').replace(/\.$/, '')}</small>
                      </span>
                      <span className="ai-chat-expert-proof" title={`${expert.evidence.length} cited proof item${expert.evidence.length === 1 ? '' : 's'}`}>
                        {expert.evidence.length}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {msg.sources && msg.sources.length > 0 && (
              <div className="ai-chat-source-tray">
                {msg.sources.slice(0, 8).map((s, j) => (
                  <button
                    key={`${s.id}-${j}`}
                    className={`ai-chat-source-chip ${s.type}`}
                    onClick={() => handleSourceClick(s)}
                    title={sourceTitle(s)}
                    aria-expanded={expandedEvidenceId === s.id}
                  >
                    <span className="ai-chat-source-icon">{sourceIcon(s)}</span>
                    <span className="ai-chat-source-title">{sourceTitle(s)}</span>
                  </button>
                ))}
              </div>
            )}
            {msg.sources?.map(source => expandedEvidenceId === source.id && source.text ? (
              <div key={`detail-${source.id}`} className={`ai-chat-evidence-detail ${source.type}`}>
                <div className="ai-chat-evidence-detail-head">
                  <span>{sourceKind(source)}</span>
                  <small>{source.provenance?.observation_ids?.length ?? 0} cited message{source.provenance?.observation_ids?.length === 1 ? '' : 's'}</small>
                </div>
                <p>{source.text}</p>
              </div>
            ) : null)}
            {msg.local && msg.role === 'ai' && (
              <div className="ai-chat-local-badge"><Search size={12} /> Pod was unreachable, so I searched the memories already loaded.</div>
            )}
            <div className="ai-chat-msg-meta">
              <time dateTime={msg.createdAt} title={new Date(msg.createdAt).toLocaleString()}>{formatMessageTime(msg.createdAt)}</time>
              <button onClick={() => copyMessage(msg, messageKey)} title="Copy message" aria-label="Copy message">
                {copiedMessage === messageKey ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedMessage === messageKey ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        )})}
        {sending && (() => {
          const phases = [
            'Searching memories…',
            'Querying knowledge graph…',
            'Scanning observations…',
            'Weighing the evidence…',
            'Pulling the answer together…',
          ];
          return (
            <div className="ai-chat-msg ai ai-thinking-msg">
              <PodLoader label={phases[Math.min(thinkingPhase, phases.length - 1)]} />
            </div>
          );
        })()}
      </div>

      {/* ── Timeframe popover ── */}
      <AIChatFilterPopover open={showTimeframe} onClose={() => { setShowTimeframe(false); setShowCustomDate(false); }} title="Timeframe">
        {showCustomDate ? (
          <div className="ai-filter-custom-date">
            <button className="ai-filter-back" onMouseDown={(e) => { e.preventDefault(); setShowCustomDate(false); }}>
              <ChevronDown size={12} style={{ transform: 'rotate(90deg)' }} /> Presets
            </button>
            <div className="ai-filter-cal-row">
              <MiniCalendar label="From" value={customDateFrom} onChange={setCustomDateFrom} />
              <MiniCalendar label="To" value={customDateTo} onChange={setCustomDateTo} />
            </div>
            <button
              className="ai-filter-date-apply"
              disabled={!customDateFrom || !customDateTo}
              onMouseDown={(e) => {
                e.preventDefault();
                if (customDateFrom && customDateTo) {
                  setSelectedTimeframe('custom');
                  setShowTimeframe(false);
                  setShowCustomDate(false);
                }
              }}
            >
              Apply
            </button>
          </div>
        ) : (
          <div className="ai-filter-popover-grid">
            {TIMEFRAME_OPTIONS.map(opt => (
              <button
                key={opt.id}
                className={`ai-filter-popover-option ${selectedTimeframe === opt.id ? 'active' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setSelectedTimeframe(opt.id);
                  setShowTimeframe(false);
                }}
              >
                <span className="ai-filter-popover-option-label">{opt.label}</span>
                <span className="ai-filter-popover-option-desc">{opt.desc}</span>
              </button>
            ))}
            <button
              className={`ai-filter-popover-option ${selectedTimeframe === 'custom' ? 'active' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); setShowCustomDate(true); }}
            >
              <span className="ai-filter-popover-option-label">Custom range</span>
              <span className="ai-filter-popover-option-desc">Pick dates</span>
            </button>
          </div>
        )}
      </AIChatFilterPopover>

      {/* ── Memory scope popover ── */}
      <AIChatFilterPopover open={showMemoryFilter} onClose={() => setShowMemoryFilter(false)} title="Search scope">
        <div className="ai-filter-popover-list">
          {SCOPE_OPTIONS.map(opt => {
            const Icon = opt.icon;
            const isActive = selectedScope === opt.id || (!selectedScope && opt.id === '__all__');
            return (
              <button
                key={opt.id}
                className={`ai-filter-popover-list-item ${isActive ? 'active' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setSelectedScope(opt.id === '__all__' ? null : opt.id);
                  setShowMemoryFilter(false);
                }}
              >
                <span className="ai-filter-popover-list-icon"><Icon size={16} /></span>
                <span className="ai-filter-popover-list-text">
                  <span className="ai-filter-popover-list-label">{opt.label}</span>
                  {opt.desc && <span className="ai-filter-popover-list-desc">{opt.desc}</span>}
                </span>
                {isActive && <CheckCircle2 size={14} className="ai-filter-popover-list-check" />}
              </button>
            );
          })}
        </div>
      </AIChatFilterPopover>

      <div className={`ai-chat-input-wrap ${showControls ? 'active' : ''}`}>
        {showControls && (
          <div className="ai-chat-filters" onMouseDown={e => e.preventDefault()}>
            <button
              className={`ai-chat-filter-chip ${selectedTimeframe ? 'has-value' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); setShowTimeframe(v => !v); setShowMemoryFilter(false); }}
            >
              <CalendarDays size={12} />
              <span>{selectedTimeframe ? timeframeLabel : 'Add timeframe'}</span>
              {selectedTimeframe && (
                <span className="ai-chat-filter-clear" onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); setSelectedTimeframe(null); setCustomDateFrom(''); setCustomDateTo(''); }}>
                  <X size={10} />
                </span>
              )}
            </button>

            <button
              className={`ai-chat-filter-chip ${selectedScope ? 'has-value' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); setShowMemoryFilter(v => !v); setShowTimeframe(false); }}
            >
              <LibraryBig size={12} />
              <span>{selectedScope ? SCOPE_OPTIONS.find(s => s.id === selectedScope)?.label : 'All memories'}</span>
              <ChevronDown size={10} />
            </button>
          </div>
        )}

        <div className="ai-chat-input-row">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onPaste={handlePasteImage}
            onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setTimeout(() => {
              // Don't collapse controls if a popover is open (use ref for latest value)
              if (!popoverOpenRef.current) setInputFocused(false);
            }, 200)}
            placeholder={activeContext ? 'Ask about this context...' : 'Ask Pod...'}
            disabled={sending}
          />
          {showControls && (
            <button className="ai-chat-send" onClick={handleSend} disabled={!input.trim() || sending}>
              {sending ? <Loader2 size={14} className="ai-chat-spinner" /> : <ArrowUp size={14} />}
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.markdown,.txt,.log,.json,.csv,.tsv,.html,.htm,.xml,.yaml,.yml,.toml,.pdf,.doc,.docx,image/png,image/jpeg,image/gif,image/webp,image/avif"
          style={{ display: 'none' }}
          onChange={e => { if (e.target.files?.[0]) { handleAttachFile(e.target.files[0]); e.target.value = ''; } }}
        />
        {showControls && (
          <div className="ai-chat-controls">
            <button className="ai-chat-control-btn" title="Attach file" onMouseDown={e => { e.preventDefault(); fileInputRef.current?.click(); }}>
              <Paperclip size={14} />
            </button>
            <button className="ai-chat-control-btn" title="Voice input — coming soon" onMouseDown={e => e.preventDefault()} disabled>
              <Mic size={14} />
            </button>
            <div className="ai-chat-model-wrap">
              <Sparkles size={12} className="ai-chat-model-icon" />
              <AppDropdown
                className="ai-chat-model-dropdown"
                value={selectedModel}
                onChange={v => setSelectedModel(v as typeof selectedModel)}
                options={[
                  { value: 'auto', label: 'Auto' },
                  { value: 'fast', label: 'Fast' },
                  { value: 'deep', label: 'Deep' },
                ]}
              />
            </div>
          </div>
        )}
      </div>
      </div>{/* end ai-chat-main */}
      </div>{/* end ai-chat-body */}
    </div>
  );
}

/* ═══════════════════════════════════════
   App Shell
   ═══════════════════════════════════════ */

function AppBootScreen() {
  return (
    <div className="pod-onboarding-boot">
      <PodLoader className="pod-loader--boot" label="Opening your Pod…" size={72} />
    </div>
  );
}

function WorkspaceEmojiPicker(props: {
  value: string;
  onChange: (emoji: string) => void;
  label: string;
}) {
  const selectedLabel = workspaceEmojiLabel(props.value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="workspace-emoji-trigger"
          aria-label={props.label}
          title={`${props.label}: ${selectedLabel}`}
        >
          <span className="workspace-emoji-trigger-value" aria-hidden="true">{props.value}</span>
          <ChevronDown size={12} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="workspace-emoji-picker"
        align="start"
        sideOffset={6}
        collisionPadding={12}
      >
        <DropdownMenuLabel className="workspace-emoji-picker-label">Choose an icon</DropdownMenuLabel>
        <DropdownMenuGroup className="workspace-emoji-grid">
          {WORKSPACE_EMOJI_OPTIONS.map(option => {
            const selected = option.emoji === props.value;
            return (
              <DropdownMenuItem
                key={option.emoji}
                className={`workspace-emoji-option${selected ? ' selected' : ''}`}
                aria-label={`${option.label}${selected ? ', selected' : ''}`}
                title={option.label}
                onSelect={() => props.onChange(option.emoji)}
              >
                <span aria-hidden="true">{option.emoji}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function WorkspaceCreateDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string, emoji: string) => Promise<PodWorkspace>;
}) {
  const [name, setName] = React.useState('');
  const [emoji, setEmoji] = React.useState(DEFAULT_WORKSPACE_EMOJI);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!props.open) return;
    setName('');
    setEmoji(DEFAULT_WORKSPACE_EMOJI);
    setError(null);
  }, [props.open]);

  async function submit() {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await props.onCreate(name.trim(), emoji.trim() || DEFAULT_WORKSPACE_EMOJI);
      props.onOpenChange(false);
    } catch (createError) {
      setError(workspaceRequestErrorMessage(createError, 'Workspace could not be created.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="workspace-create-dialog">
        <DialogHeader>
          <DialogTitle>New workspace</DialogTitle>
          <DialogDescription>Create a separate place for its documents, memories, and activity.</DialogDescription>
        </DialogHeader>
        {error && <div className="settings-inline-error">{error}</div>}
        <div className="workspace-create-fields">
          <label>
            <span>Icon</span>
            <WorkspaceEmojiPicker value={emoji} onChange={setEmoji} label="Choose workspace icon" />
          </label>
          <label>
            <span>Name</span>
            <input
              className="settings-input"
              value={name}
              onChange={event => setName(event.target.value)}
              onKeyDown={event => { if (event.key === 'Enter') void submit(); }}
              placeholder="e.g. Client work"
              maxLength={60}
              autoFocus
            />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={saving || !name.trim()}>
            {saving ? 'Creating…' : 'Create workspace'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function App() {
  const [authToken, setAuthToken] = React.useState(() => sessionStorage.getItem('coffee-pod-session-token') ?? '');
  const needsAuth = false; // Auth gating removed — PIN-session handles access
  /* ── PIN lock state ── */
  const [pinLocked, setPinLocked] = React.useState(true);    // Assume locked until we check
  const [pinEnabled, setPinEnabled] = React.useState(false);  // Is a PIN configured?
  const [pinLength, setPinLength] = React.useState(DEFAULT_PIN_LENGTH);
  const [pinChecking, setPinChecking] = React.useState(true); // Loading status
  const [onboardingChecking, setOnboardingChecking] = React.useState(true);
  const [onboardingRequired, setOnboardingRequired] = React.useState(false);
  const [firstRunConfig, setFirstRunConfig] = React.useState<Partial<ExpandedConfig> | null>(null);
  const [shellRuntime, setShellRuntime] = React.useState<PodRuntime | null>(null);
  const [workspaces, setWorkspaces] = React.useState<PodWorkspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = React.useState(
    () => localStorage.getItem('coffee-pod-active-workspace-id') ?? 'default',
  );
  const [workspaceEditorOpen, setWorkspaceEditorOpen] = React.useState(false);

  const loadWorkspaces = React.useCallback(async (): Promise<PodWorkspace[]> => {
    const data = await getJson<{ workspaces: PodWorkspace[] }>('/pod/workspaces', authToken);
    setWorkspaces(data.workspaces);
    const storedId = localStorage.getItem('coffee-pod-active-workspace-id');
    const selected = data.workspaces.find(workspace => workspace.id === storedId)
      ?? data.workspaces.find(workspace => workspace.is_default)
      ?? data.workspaces[0];
    if (selected) {
      localStorage.setItem('coffee-pod-active-workspace-id', selected.id);
      setActiveWorkspaceId(selected.id);
    }
    return data.workspaces;
  }, [authToken, activeWorkspaceId]);

  React.useEffect(() => {
    const existingToken = sessionStorage.getItem('coffee-pod-session-token');
    if (existingToken) {
      fetch('/pod/session/status', { headers: { authorization: `Bearer ${existingToken}` } })
        .then(r => r.json())
        .then(data => {
          setPinEnabled(data.has_pin);
          setPinLength(configuredPinLength(data.pin_length));
          if (data.valid) {
            setPinLocked(false);
            setAuthToken(existingToken);
          } else {
            setPinLocked(data.has_pin);
            sessionStorage.removeItem('coffee-pod-session-token');
            setAuthToken('');
          }
        })
        .catch(() => { setPinEnabled(false); setPinLocked(false); })
        .finally(() => setPinChecking(false));
    } else {
      fetch('/pod/pin/status').then(r => r.json()).then(data => {
        setPinEnabled(data.has_pin);
        setPinLength(configuredPinLength(data.pin_length));
        setPinLocked(data.has_pin);
      }).catch(() => {
        setPinEnabled(false);
        setPinLocked(false);
      }).finally(() => setPinChecking(false));
    }
  }, []);
  React.useEffect(() => {
    if (pinChecking || (pinEnabled && pinLocked)) return;
    void loadWorkspaces().catch(() => {
      setWorkspaces([]);
      localStorage.setItem('coffee-pod-active-workspace-id', 'default');
      setActiveWorkspaceId('default');
    });
  }, [loadWorkspaces, pinChecking, pinEnabled, pinLocked]);
  React.useEffect(() => {
    if (pinChecking || (pinEnabled && pinLocked)) return;
    let cancelled = false;
    (async () => {
      try {
        const runtime = await getJson<PodRuntime>('/pod/runtime', authToken);
        if (cancelled) return;
        setShellRuntime(runtime);
        localStorage.setItem('coffee-pod-owner-id', runtime.owner_id);
        if (runtime.owner_display_name) localStorage.setItem('coffee-pod-owner-display-name', runtime.owner_display_name);
        if (runtime.onboarding_complete) {
          setOnboardingRequired(false);
          setFirstRunConfig(null);
          return;
        }
        const config = await loadOnboardingCurrentConfig(authToken);
        if (cancelled) return;
        setFirstRunConfig(config);
        setOnboardingRequired(true);
      } catch {
        // A backend startup race should never trap the user behind setup.
        if (!cancelled) setOnboardingRequired(false);
      } finally {
        if (!cancelled) setOnboardingChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [authToken, pinChecking, pinEnabled, pinLocked]);
  const handlePinUnlock = React.useCallback((sessionToken?: string) => {
    if (sessionToken) {
      sessionStorage.setItem('coffee-pod-session-token', sessionToken);
      setAuthToken(sessionToken);
    }
    setPinLocked(false);
  }, []);
  const handlePinChanged = React.useCallback(() => {
    fetch('/pod/pin/status').then(r => r.json()).then(data => {
      setPinEnabled(data.has_pin);
      setPinLength(configuredPinLength(data.pin_length));
      if (!data.has_pin) {
        sessionStorage.removeItem('coffee-pod-session-token');
        setAuthToken('');
        setPinLocked(false);
      }
    }).catch(() => {});
  }, []);
  // Listen for session expiry events from fetch helpers
  React.useEffect(() => {
    const handler = async () => {
      if (!pinEnabled) return;
      // A stale in-flight request (carrying an old token from before a
      // re-login or backend restart) can 401 right AFTER a fresh, valid login.
      // Don't tear down the session on that single 401 — re-validate the
      // CURRENT token first; only log out if it's genuinely invalid. This
      // prevents the "enter PIN → immediately logged out" loop.
      const token = sessionStorage.getItem('coffee-pod-session-token');
      if (token) {
        try {
          const r = await fetch('/pod/session/status', { headers: { authorization: `Bearer ${token}` } });
          const d = await r.json();
          if (d?.valid) return; // current session is fine — ignore the stale 401
        } catch { /* network error — fall through to logout */ }
      }
      sessionStorage.removeItem('coffee-pod-session-token');
      sessionStorage.removeItem('coffee-pod-pin-unlocked');
      setAuthToken('');
      setPinLocked(true);
    };
    window.addEventListener('coffee-pod-session-expired', handler);
    return () => window.removeEventListener('coffee-pod-session-expired', handler);
  }, [pinEnabled]);
  const [active, setActive] = React.useState<NavKey>(() => {
    const stored = localStorage.getItem('smartware-last-tab');
    return stored === 'memories' || stored === 'docs' || stored === 'journal' || stored === 'skills' || stored === 'connections' ? stored : 'activity';
  });
  const [themeMode, setThemeMode] = React.useState<'dark' | 'light' | 'auto'>(() => {
    return (localStorage.getItem('coffee-pod-theme-mode') as 'dark' | 'light' | 'auto' | null) ?? 'auto';
  });
  const resolvedTheme = themeMode === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeMode;
  // Keep legacy `theme` variable pointing to the resolved value for all downstream consumers
  const theme = resolvedTheme;
  const setTheme = (t: 'dark' | 'light') => setThemeMode(t);
  const [query, setQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<Array<{ entity_id: string; entity_name: string; score: number; _type?: 'object' | 'entity'; claim?: { predicate: string; object: string; epistemic: string; confidence: number } }>>([]);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [searchFilter, setSearchFilter] = React.useState<'all' | 'docs' | 'entities' | 'activity'>('all');
  const searchRef = React.useRef<HTMLDivElement>(null);
  const searchModalRef = React.useRef<HTMLDivElement>(null);
  const [objects, setObjects] = React.useState<PodObject[]>([]);
  const [collections, setCollections] = React.useState<PodCollection[]>([]);
  const [events, setEvents] = React.useState<ActivityEvent[]>([]);
  const [skills, setSkills] = React.useState<PodSkill[]>([]);
  const [plugins, setPlugins] = React.useState<PodPlugin[]>([]);

  const [apiState, setApiState] = React.useState<'live' | 'error' | 'checking'>('checking');
  const [apiError, setApiError] = React.useState<string | null>(null);
  const [showImportModal, setShowImportModal] = React.useState(false);
  const [importInitialFolder, setImportInitialFolder] = React.useState<string | undefined>();
  const [importInitialMode, setImportInitialMode] = React.useState<ImportMode | undefined>();
  const [showAccountMenu, setShowAccountMenu] = React.useState(false);
  const mobileAccountRef = React.useRef<HTMLDivElement>(null);
  const sidebarAccountRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!showAccountMenu) return;
    const handler = (e: MouseEvent) => {
      if (mobileAccountRef.current?.contains(e.target as Node)) return;
      if (sidebarAccountRef.current?.contains(e.target as Node)) return;
      setShowAccountMenu(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showAccountMenu]);
  const [showAddMenu, setShowAddMenu] = React.useState(false);
  const [showAIChat, setShowAIChat] = React.useState(false);
  const [activeAskContext, setActiveAskContext] = React.useState<AskPodContext | null>(null);
  const [showSettings, setShowSettings] = React.useState(false);
  const [settingsInitialSection, setSettingsInitialSection] = React.useState<string | undefined>(undefined);
  const [memoryDestination, setMemoryDestination] = React.useState<{ section: MemorySectionId; requestId: number }>({ section: 'list', requestId: 0 });
  const [connectionsDestination, setConnectionsDestination] = React.useState<{ tab: ConnectionManagementTab; requestId: number }>({ tab: 'sources', requestId: 0 });
  const [searchSelectedDocId, setSearchSelectedDocId] = React.useState<string | null>(null);
  const [searchSelectedListId, setSearchSelectedListId] = React.useState<string | null>(null);
  const [searchSelectedCollectionId, setSearchSelectedCollectionId] = React.useState<string | null>(null);
  const [createDocRequestId, setCreateDocRequestId] = React.useState(0);
  const [createFolderRequestId, setCreateFolderRequestId] = React.useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(() => localStorage.getItem('coffee-pod-sidebar-default') === 'collapsed');
  const [sidebarCollapsedDefault, setSidebarCollapsedDefault] = React.useState(() => localStorage.getItem('coffee-pod-sidebar-default') === 'collapsed');
  const switchWorkspace = React.useCallback((workspaceId: string) => {
    if (!workspaces.some(workspace => workspace.id === workspaceId)) return;
    localStorage.setItem('coffee-pod-active-workspace-id', workspaceId);
    setActiveWorkspaceId(workspaceId);
    setObjects([]);
    setCollections([]);
    setEvents([]);
    setSearchResults([]);
    setSearchOpen(false);
    setShowAIChat(false);
    setActiveAskContext(null);
    setShowAccountMenu(false);
  }, [workspaces]);
  const createWorkspace = React.useCallback(async (name: string, emoji = DEFAULT_WORKSPACE_EMOJI): Promise<PodWorkspace> => {
    const response = await postJson<{ workspace: PodWorkspace }>('/pod/workspaces', authToken, { name, emoji });
    const next = [...workspaces, response.workspace];
    setWorkspaces(next);
    localStorage.setItem('coffee-pod-active-workspace-id', response.workspace.id);
    setActiveWorkspaceId(response.workspace.id);
    setObjects([]);
    setCollections([]);
    setEvents([]);
    setSearchResults([]);
    setShowAIChat(false);
    setActiveAskContext(null);
    return response.workspace;
  }, [authToken, workspaces]);
  const updateWorkspace = React.useCallback(async (workspaceId: string, values: { name?: string; emoji?: string }): Promise<PodWorkspace> => {
    const response = await fetch(`/pod/workspaces/${encodeURIComponent(workspaceId)}`, {
      method: 'PATCH',
      headers: { ...authHeaders(authToken), 'content-type': 'application/json' },
      body: JSON.stringify(values),
    });
    const body = await response.json() as { workspace?: PodWorkspace; message?: string };
    if (!response.ok || !body.workspace) throw new Error(body.message ?? 'Workspace could not be updated.');
    setWorkspaces(previous => previous.map(workspace => workspace.id === workspaceId ? body.workspace! : workspace));
    return body.workspace;
  }, [authToken, activeWorkspaceId]);
  const removeWorkspace = React.useCallback(async (workspaceId: string): Promise<void> => {
    const response = await fetch(`/pod/workspaces/${encodeURIComponent(workspaceId)}`, {
      method: 'DELETE',
      headers: authHeaders(authToken),
    });
    const body = await response.json().catch(() => ({})) as { message?: string };
    if (!response.ok) throw new Error(body.message ?? 'Workspace could not be deleted.');
    const remaining = workspaces.filter(workspace => workspace.id !== workspaceId);
    setWorkspaces(remaining);
    if (activeWorkspaceId === workspaceId) {
      const fallback = remaining.find(workspace => workspace.is_default) ?? remaining[0];
      if (fallback) switchWorkspace(fallback.id);
    }
  }, [activeWorkspaceId, authToken, switchWorkspace, workspaces]);
  const openMemorySection = React.useCallback((section: MemorySectionId) => {
    setMemoryDestination(previous => ({ section, requestId: previous.requestId + 1 }));
    setActive('memories');
  }, []);
  const openSettingsSection = React.useCallback((section?: string) => {
    setSettingsInitialSection(section);
    setShowSettings(true);
  }, []);
  const openConnections = React.useCallback((tab: ConnectionManagementTab = 'sources') => {
    setConnectionsDestination(previous => ({ tab, requestId: previous.requestId + 1 }));
    setActive('connections');
  }, []);
  const openMemoryObject = React.useCallback((id: string) => {
    const object = objects.find(candidate => candidate.id === id);
    const opensAsDocument = !!object && opensInDocs(object.kind, !!findCustomType(object.kind));
    setSearchSelectedDocId(opensAsDocument ? id : null);
    setSearchSelectedListId(opensAsDocument ? null : id);
    setSearchSelectedCollectionId(null);
    setActive(opensAsDocument ? 'docs' : 'memories');
  }, [objects]);
  const openMemoryCollection = React.useCallback((id: string) => {
    setSearchSelectedDocId(null);
    setSearchSelectedListId(null);
    setSearchSelectedCollectionId(id);
    setActive('docs');
  }, []);
  const openNewDoc = React.useCallback(() => {
    setSearchSelectedDocId(null);
    setSearchSelectedCollectionId(null);
    setCreateDocRequestId(previous => previous + 1);
    setActive('docs');
  }, []);
  const openNewFolder = React.useCallback(() => {
    setSearchSelectedDocId(null);
    setCreateFolderRequestId(previous => previous + 1);
    setActive('docs');
  }, []);
  React.useEffect(() => { localStorage.setItem('coffee-pod-sidebar-default', sidebarCollapsedDefault ? 'collapsed' : 'expanded'); }, [sidebarCollapsedDefault]);
  React.useEffect(() => {
    const openSettings = (e: Event) => {
      const section = (e as CustomEvent)?.detail?.section;
      setSettingsInitialSection(section || undefined);
      setShowSettings(true);
    };
    window.addEventListener('pod:open-settings', openSettings);
    return () => window.removeEventListener('pod:open-settings', openSettings);
  }, []);
  // Track system preference changes for auto mode
  const [, forceUpdate] = React.useState(0);
  React.useEffect(() => {
    if (themeMode !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => forceUpdate(n => n + 1);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [themeMode]);
  React.useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('coffee-pod-theme-mode', themeMode);
  }, [theme, themeMode]);
  React.useEffect(() => { localStorage.setItem('smartware-last-tab', active); }, [active]);

  const refreshData = React.useCallback(async () => {
    try {
      const [objectData, collectionData, activityData, skillsData, pluginsData] = await Promise.all([
        // Quick fix for the WWII demo dataset (~1,900 children of "World War II"):
        // 500 was leaving most folders looking empty because their objects fell
        // past the limit. Real fix is backend-driven folder fetching — when a
        // folder is opened, request only that collection's objects — so this
        // doesn't grow forever. Tracked as TODO.
        getJson<{ objects: PodObject[] }>('/pod/objects?limit=5000', authToken),
        getJson<{ collections: PodCollection[] }>('/pod/collections', authToken),
        getJson<{ events: ActivityEvent[] }>('/pod/events?limit=100', authToken).catch(() => ({ events: [] })),
        getJson<{ skills: PodSkill[] }>('/pod/skills', authToken).catch(() => ({ skills: [] })),
        getJson<{ plugins: PodPlugin[] }>('/pod/plugins', authToken).catch(() => ({ plugins: [] })),
      ]);
      const normalizedObjects = objectData.objects.map((obj) => normalizePodObject(obj));
      setObjects(normalizedObjects);
      setCollections(collectionData.collections);
      setSkills(skillsData.skills);
      setPlugins(pluginsData.plugins);
      setEvents(activityData.events);
      setApiError(null);
      setApiState('live');
    } catch (error) {
      setApiError(podLoadErrorMessage(error));
      setApiState('error');
    }
  }, [authToken, activeWorkspaceId]);

  React.useEffect(() => {
    refreshData();
  }, [refreshData]);

  // ── Live sync with connected integrations ──
  const [syncing, setSyncing] = React.useState(false);
  const syncingRef = React.useRef(false);
  const [lastSyncResult, setLastSyncResult] = React.useState<{ count: number; at: number } | null>(null);

  // Cheap, isolated events refresh. The full refreshData() also refetches
  // /pod/objects (~2.4MB), which is too heavy to run on every sync tick.
  // The Activity feed only needs /pod/events, so split it out.
  const refreshEvents = React.useCallback(async () => {
    try {
      const data = await getJson<{ events: ActivityEvent[] }>('/pod/events?limit=100', authToken);
      setEvents(data.events);
    } catch { /* silent — keep last good list */ }
  }, [authToken, activeWorkspaceId]);

  // Refresh the Activity feed whenever the user opens the tab so they don't
  // see a stale list while sync ticks are quietly writing new events.
  React.useEffect(() => {
    if (active === 'activity') {
      refreshEvents();
    }
  }, [active, refreshEvents]);

  const triggerSync = React.useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const res = await fetch('/pod/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders(authToken) },
        body: '{}',
      });
      if (res.ok) {
        const data = await res.json() as { synced: number };
        setLastSyncResult({ count: data.synced, at: Date.now() });
        // Always refresh the Activity feed — compile/observe/reflect may have
        // written events even if sync itself reports synced=0. Heavy
        // refreshData (re-fetches /pod/objects) only when sync actually
        // brought in new data.
        refreshEvents();
        if (data.synced > 0) refreshData();
      }
    } catch { /* silent */ }
    syncingRef.current = false;
    setSyncing(false);
  }, [authToken, refreshData, refreshEvents]);

  // Auto-sync every 5 minutes
  React.useEffect(() => {
    // Initial sync after a short delay
    const initial = setTimeout(() => triggerSync(), 5000);
    const interval = setInterval(() => triggerSync(), 5 * 60 * 1000);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, [triggerSync]);

  // Debounced search
  React.useEffect(() => {
    if (query.trim().length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await getJson<{ objects: PodObject[]; entities: typeof searchResults }>(`/pod/search?q=${encodeURIComponent(query.trim())}&limit=10`, authToken);
        const objectResults = (res.objects ?? []).map(o => ({
          entity_id: o.id,
          entity_name: o.title,
          score: 1,
          claim: { predicate: o.kind, object: o.collection_id ?? 'unknown', epistemic: o.origin ?? 'observed', confidence: 1 },
          _type: 'object' as const,
        }));
        const entityResults = (res.entities ?? []).map(e => ({ ...e, _type: 'entity' as const }));
        setSearchResults([...entityResults, ...objectResults]);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, authToken]);

  // Close search on outside click + keyboard shortcuts
  React.useEffect(() => {
    if (!searchOpen) return;
    const clickHandler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (searchRef.current?.contains(t) || searchModalRef.current?.contains(t)) return;
      setSearchOpen(false);
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') { setSearchOpen(false); setQuery(''); } };
    document.addEventListener('mousedown', clickHandler);
    document.addEventListener('keydown', keyHandler);
    return () => { document.removeEventListener('mousedown', clickHandler); document.removeEventListener('keydown', keyHandler); };
  }, [searchOpen]);

  // Global "/" shortcut to open search modal
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement) && !(e.target as HTMLElement)?.closest?.('[contenteditable]')) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  function handleLock() {
    if (pinEnabled) {
      // Re-lock: destroy server session and show PIN screen
      const token = sessionStorage.getItem('coffee-pod-session-token');
      if (token) {
        fetch('/pod/session/lock', {
          method: 'POST',
          headers: { authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
      sessionStorage.removeItem('coffee-pod-session-token');
      sessionStorage.removeItem('coffee-pod-pin-unlocked');
      setAuthToken('');
      setPinLocked(true);
    }
  }

  async function markOnboardingComplete(values: Record<string, unknown>): Promise<void> {
    const response = await fetch('/pod/settings/pod.onboarding', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...authHeaders(authToken) },
      body: JSON.stringify({ values }),
    });
    if (!response.ok) throw new Error(`Pod could not save onboarding (${response.status}).`);
  }

  async function handleFirstRunComplete(config: ExpandedConfig): Promise<void> {
    const results = await persistOnboardingConfig(config, authToken);
    const failures = results.filter(result => !result.ok);
    if (failures.length > 0) {
      throw new Error(failures.map(result => `${result.field}: ${result.message}`).join(' · '));
    }
    setOnboardingRequired(false);
    setFirstRunConfig(null);
    setShellRuntime(previous => previous ? { ...previous, owner_display_name: config.display_name.trim() } : previous);
    void getJson<PodRuntime>('/pod/runtime', authToken).then(setShellRuntime).catch(() => {});
  }

  async function handleFirstRunSkip(): Promise<void> {
    await markOnboardingComplete({ completed: true, version: 1, skipped: true, completed_at: new Date().toISOString() });
    setOnboardingRequired(false);
    setFirstRunConfig(null);
    void getJson<PodRuntime>('/pod/runtime', authToken).then(setShellRuntime).catch(() => {});
  }

  const shellDisplayName = shellRuntime?.owner_display_name ?? 'Pod owner';
  const shellPodName = shellRuntime?.pod_name_override ?? shellRuntime?.pod_name ?? 'My Pod';
  const shellAvatar = shellRuntime?.owner_avatar_data_url;
  const activeWorkspace = workspaces.find(workspace => workspace.id === activeWorkspaceId)
    ?? workspaces.find(workspace => workspace.is_default)
    ?? null;

  /* ── Gate: PIN lock → then auth check ── */
  if (pinChecking) {
    return <AppBootScreen />;
  }
  if (pinLocked && pinEnabled) {
    return <PINLockScreen pinLength={pinLength} onUnlock={(token) => handlePinUnlock(token)} />;
  }
  if (onboardingChecking) {
    return <AppBootScreen />;
  }
  if (onboardingRequired && firstRunConfig) {
    return (
      <div className="pod-onboarding-first-run">
        <OnboardingWizardExpanded
          initialConfig={firstRunConfig}
          onComplete={handleFirstRunComplete}
          onSkip={handleFirstRunSkip}
        />
      </div>
    );
  }
  return (
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* ── Top Bar ── */}
      <header className="topbar">
        {/* Mobile-only Pod menu (visible ≤768px) */}
        <div className="topbar-mobile-account-wrap" ref={mobileAccountRef}>
          <button className="topbar-mobile-account" onClick={() => setShowAccountMenu(!showAccountMenu)} aria-label="Open Pod menu">
            <OwnerAvatar src={shellAvatar} name={shellDisplayName} size={30} className="topbar-mobile-avatar owner-avatar" />
          </button>
          {showAccountMenu && (
            <div className="topbar-mobile-dropdown">
              <div className="workspace-menu-section">
                <div className="workspace-menu-account-header">
                  <OwnerAvatar src={shellAvatar} name={shellDisplayName} size={28} />
                  <span>
                    <strong>{shellDisplayName}</strong>
                    <small>{shellPodName}</small>
                  </span>
                </div>
                {workspaces.map(workspace => (
                  <button
                    key={workspace.id}
                    className={`workspace-menu-item${workspace.id === activeWorkspaceId ? ' active' : ''}`}
                    onClick={() => switchWorkspace(workspace.id)}
                  >
                    <span className="workspace-menu-emoji">{workspace.emoji}</span>
                    <span>{workspace.name}</span>
                  </button>
                ))}
                <button className="workspace-menu-item workspace-menu-add" onClick={() => { setShowAccountMenu(false); setWorkspaceEditorOpen(true); }}>
                  <Plus size={14} />
                  <span>New workspace</span>
                </button>
              </div>
              <div className="workspace-menu-divider" />
              <div className="workspace-menu-section">
                <div className="workspace-menu-theme">
                  <span className="workspace-menu-theme-label">Theme</span>
                  <div className="theme-segment">
                    {(['light', 'auto', 'dark'] as const).map(m => (
                      <button key={m} className={`theme-segment-btn${themeMode === m ? ' active' : ''}`} aria-label={`${m.charAt(0).toUpperCase() + m.slice(1)} theme`} onClick={() => setThemeMode(m)}>
                        {m === 'light' ? <Sun size={14} /> : m === 'dark' ? <Moon size={14} /> : <Monitor size={14} />}
                      </button>
                    ))}
                  </div>
                </div>
                {pinEnabled && (
                  <button className="workspace-menu-item destructive" onClick={() => { setShowAccountMenu(false); handleLock(); }}>
                    <Lock size={16} />
                    <span>Lock Pod</span>
                  </button>
                )}
                <button className="workspace-menu-item" onClick={() => { setShowAccountMenu(false); setShowSettings(true); }}>
                  <Settings size={16} />
                  <span>Settings</span>
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="topbar-center" ref={searchRef}>
          <div className="search-wrap" onClick={() => setSearchOpen(true)}>
            <Search size={16} />
            <span className="search-placeholder">{query || 'Search your mind...'}</span>
            <button className="search-ai-btn" onClick={(e) => { e.stopPropagation(); setShowAIChat(prev => !prev); }}>
              <PodAIIcon size={16} />
              <span className="ask-ai-label">Ask Pod</span>
            </button>
          </div>
          {searchOpen && createPortal(
            <div className="search-modal" ref={searchModalRef}>
              <div className="search-modal-input-row">
                <Search size={16} className="search-modal-icon" />
                <input
                  className="search-modal-input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search your mind..."
                  autoFocus
                />
                {query && (
                  <button className="search-modal-clear" onClick={() => setQuery('')}>
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="search-modal-filters">
                <button className={`search-filter-tab${searchFilter === 'all' ? ' active' : ''}`} onClick={() => setSearchFilter('all')}>All</button>
                <button className={`search-filter-tab${searchFilter === 'docs' ? ' active' : ''}`} onClick={() => setSearchFilter('docs')}><FileText size={12} /> Docs</button>
                <button className={`search-filter-tab${searchFilter === 'entities' ? ' active' : ''}`} onClick={() => setSearchFilter('entities')}><Brain size={12} /> Entities</button>
                <button className={`search-filter-tab${searchFilter === 'activity' ? ' active' : ''}`} onClick={() => setSearchFilter('activity')}><Activity size={12} /> Activity</button>
              </div>
              <div className="search-modal-body">
                {query.startsWith('/') ? (() => {
                  const cmdQuery = query.slice(1).toLowerCase();
                  const commands = [
                    { id: 'new-doc', label: 'New Doc', desc: 'Create a blank document', icon: FilePlus, action: () => { setSearchOpen(false); setQuery(''); openNewDoc(); } },
                    { id: 'new-folder', label: 'New Folder', desc: 'Create a folder in Docs', icon: FolderPlus, action: () => { setSearchOpen(false); setQuery(''); openNewFolder(); } },
                    { id: 'import', label: 'Import', desc: 'Import files or documents', icon: Upload, action: () => { setSearchOpen(false); setQuery(''); setImportInitialFolder(undefined); setImportInitialMode(undefined); setShowImportModal(true); } },
                    { id: 'activity', label: 'Activity', desc: 'See what Pod has been doing', icon: Activity, action: () => { setSearchOpen(false); setQuery(''); setActive('activity'); } },
                    { id: 'memory', label: 'Memory', desc: 'Browse everything Pod remembers', icon: Brain, action: () => { setSearchOpen(false); setQuery(''); openMemorySection('list'); } },
                    { id: 'docs', label: 'Docs', desc: 'Write and organise your knowledge', icon: FileText, action: () => { setSearchOpen(false); setQuery(''); setActive('docs'); } },
                    { id: 'profile', label: 'About you', desc: 'Review what Pod carries into answers', icon: User, action: () => { setSearchOpen(false); setQuery(''); openMemorySection('profile'); } },
                    { id: 'learnings', label: 'Learnings', desc: 'Review what Pod has learned', icon: Lightbulb, action: () => { setSearchOpen(false); setQuery(''); openMemorySection('learnings'); } },
                    { id: 'journal', label: 'Journal', desc: 'Open your journal', icon: BookOpen, action: () => { setSearchOpen(false); setQuery(''); setActive('journal'); } },
                    { id: 'capabilities', label: 'Capabilities', desc: 'Manage Skills and Agent Plugins', icon: Layers, action: () => { setSearchOpen(false); setQuery(''); setActive('skills'); } },
                    { id: 'connections', label: 'Connections', desc: 'Manage data connections, agents, and models', icon: Plug, action: () => { setSearchOpen(false); setQuery(''); openConnections(); } },
                    { id: 'settings', label: 'Settings', desc: 'Open Pod settings', icon: Settings, action: () => { setSearchOpen(false); setQuery(''); openSettingsSection(); } },
                  ];
                  const filtered = cmdQuery ? commands.filter(c => c.label.toLowerCase().includes(cmdQuery) || c.desc.toLowerCase().includes(cmdQuery)) : commands;
                  return filtered.length === 0 ? (
                    <div className="search-results-empty">No commands matching "/{cmdQuery}"</div>
                  ) : (
                    <>
                      <div className="search-results-label">Commands</div>
                      {filtered.map(cmd => {
                        const Icon = cmd.icon;
                        return (
                          <button key={cmd.id} className="search-result-item" onClick={cmd.action}>
                            <span className="search-result-icon-wrap"><Icon size={14} /></span>
                            <div className="search-result-body">
                              <span className="search-result-name">/{cmd.label.toLowerCase()}</span>
                              <span className="search-result-detail">{cmd.desc}</span>
                            </div>
                          </button>
                        );
                      })}
                    </>
                  );
                })() : query.trim().length < 2 ? (
                  <div className="search-results-empty">Start typing to search…</div>
                ) : searchLoading ? (
                  <div className="search-results-empty"><Loader2 size={16} className="spin" /> Searching…</div>
                ) : (() => {
                  const filtered = searchFilter === 'all' ? searchResults
                    : searchFilter === 'docs' ? searchResults.filter(r => {
                      if (r._type !== 'object') return false;
                      const object = objects.find(candidate => candidate.id === r.entity_id);
                      return !!object && opensInDocs(object.kind, !!findCustomType(object.kind));
                    })
                    : searchFilter === 'entities' ? searchResults.filter(r => r._type === 'entity')
                    : [];
                  return filtered.length === 0 ? (
                    <div className="search-results-empty">No results for "{query}"</div>
                  ) : (
                    <>
                      <div className="search-results-label">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</div>
                      {filtered.map((r, i) => (
                        <button key={r.entity_id + i} className="search-result-item" onClick={() => {
                          setSearchOpen(false);
                          setQuery('');
                          if (r._type === 'object') openMemoryObject(r.entity_id);
                          else setActive('memories');
                        }}>
                          <span className="search-result-icon-wrap">
                            {r._type === 'entity' ? <Brain size={14} /> : <FileText size={14} />}
                          </span>
                          <div className="search-result-body">
                            <span className="search-result-name">{r.entity_name}</span>
                            {r.claim && <span className="search-result-detail">{r._type === 'entity' ? `${r.claim.predicate}: ${r.claim.object}` : `${r.claim.predicate} · ${r.claim.object}`}</span>}
                          </div>
                          <span className="search-result-badge">{r._type === 'entity' ? r.claim?.epistemic ?? 'inferred' : 'Doc'}</span>
                        </button>
                      ))}
                    </>
                  );
                })()}
              </div>
              <div className="search-modal-footer">
                <span className="search-hint">Type <kbd>/</kbd> to view commands</span>
              </div>
            </div>,
            document.body,
          )}
        </div>

        {!showAIChat && (
          <div className={`topbar-right ${showAddMenu ? 'expanded' : ''}`}>
            <button
              className={`sync-btn ${syncing ? 'syncing' : ''}`}
              onClick={triggerSync}
              disabled={syncing}
              title={lastSyncResult ? `Last sync: ${lastSyncResult.count} items` : 'Sync connected apps'}
            >
              <RefreshCw size={15} className={syncing ? 'spin' : ''} />
            </button>
            <div className="add-actions">
              <button className="add-action-btn" onClick={() => {
                setShowAddMenu(false);
                openNewDoc();
              }}>
                <FileText size={15} />
                <span>Doc</span>
              </button>
              <button className="add-action-btn" onClick={() => { setShowAddMenu(false); openConnections(); }}>
                <Link size={15} />
                <span>Connection</span>
              </button>
              <button className="add-action-btn" onClick={() => { setShowAddMenu(false); setImportInitialFolder(undefined); setImportInitialMode(undefined); setShowImportModal(true); }}>
                <Upload size={15} />
                <span>Import</span>
              </button>
            </div>
            <button className="upload-button" onClick={() => setShowAddMenu(!showAddMenu)} title="Add new">
              <Plus size={18} style={{ transition: 'transform 0.25s ease', transform: showAddMenu ? 'rotate(45deg)' : 'none' }} />
            </button>
          </div>
        )}
      </header>

      {/* ── Left Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-tile">
            <img src="/brand/pod-icon-tile.png" alt="Pod" className="sidebar-logo-icon" />
            {sidebarCollapsed && (
              <button className="sidebar-logo-toggle" onClick={() => setSidebarCollapsed(false)} title="Expand sidebar">
                <PanelLeftOpen size={14} />
              </button>
            )}
          </div>
          <span className="sidebar-logo-text">Pod <span className="sidebar-logo-by">by Coffee</span></span>
          {!sidebarCollapsed && (
            <button className="sidebar-collapse-top" onClick={() => setSidebarCollapsed(true)} title="Collapse sidebar">
              <PanelLeftClose size={14} />
            </button>
          )}
        </div>
        <nav className="nav-list">
          {mainNav.map((item) => (
            <NavButton
              key={item.key}
              item={item}
              active={active === item.key}
              collapsed={sidebarCollapsed}
              onClick={() => item.key === 'memories' ? openMemorySection('list') : item.key === 'connections' ? openConnections() : setActive(item.key)}
            />
          ))}
        </nav>
        <div ref={sidebarAccountRef} className={`sidebar-bottom ${showAccountMenu ? 'expanded' : ''}`}>
          <div className="workspace-menu">
            <div className="workspace-menu-section">
              <div className="workspace-menu-account-header">
                <OwnerAvatar src={shellAvatar} name={shellDisplayName} size={28} />
                <span>
                  <strong>{shellDisplayName}</strong>
                  <small>{shellPodName}</small>
                </span>
              </div>
              {workspaces.map(workspace => (
                <button
                  key={workspace.id}
                  className={`workspace-menu-item${workspace.id === activeWorkspaceId ? ' active' : ''}`}
                  data-tooltip={workspace.name}
                  onClick={() => switchWorkspace(workspace.id)}
                >
                  <span className="workspace-menu-emoji">{workspace.emoji}</span>
                  <span>{workspace.name}</span>
                </button>
              ))}
              <button className="workspace-menu-item workspace-menu-add" data-tooltip="New workspace" onClick={() => { setShowAccountMenu(false); setWorkspaceEditorOpen(true); }}>
                <Plus size={14} />
                <span>New workspace</span>
              </button>
            </div>
            <div className="workspace-menu-divider" />
            <div className="workspace-menu-section">
              <div className="workspace-menu-theme" data-tooltip="Theme" onMouseEnter={(e) => {
                if (!sidebarCollapsed) return;
                const pop = e.currentTarget.querySelector('.theme-hover-popout') as HTMLElement;
                if (!pop) return;
                const r = e.currentTarget.getBoundingClientRect();
                pop.style.display = 'flex';
                pop.style.left = `${r.right + 8}px`;
                const ideal = Math.round(r.top + r.height / 2 - pop.offsetHeight / 2);
                pop.style.top = `${Math.min(ideal, window.innerHeight - pop.offsetHeight - 8)}px`;
              }} onMouseLeave={(e) => {
                const pop = e.currentTarget.querySelector('.theme-hover-popout') as HTMLElement;
                if (pop) pop.style.display = '';
              }}>
                <span className="workspace-menu-theme-label">Theme</span>
                <div className="theme-segment">
                  {(['light', 'auto', 'dark'] as const).map(m => (
                    <button key={m} className={`theme-segment-btn${themeMode === m ? ' active' : ''}`} aria-label={`${m.charAt(0).toUpperCase() + m.slice(1)} theme`} onClick={() => setThemeMode(m)}>
                      {m === 'light' ? <Sun size={14} /> : m === 'dark' ? <Moon size={14} /> : <Monitor size={14} />}
                    </button>
                  ))}
                </div>
                <div className="theme-hover-popout">
                  <div className="theme-segment">
                    {(['light', 'auto', 'dark'] as const).map(m => (
                      <button key={m} className={`theme-segment-btn${themeMode === m ? ' active' : ''}`} aria-label={`${m.charAt(0).toUpperCase() + m.slice(1)} theme`} onClick={() => setThemeMode(m)}>
                        {m === 'light' ? <Sun size={14} /> : m === 'dark' ? <Moon size={14} /> : <Monitor size={14} />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {pinEnabled && (
                <button className="workspace-menu-item destructive" data-tooltip="Lock Pod" onClick={() => { setShowAccountMenu(false); handleLock(); }}>
                  <Lock size={16} />
                  <span>Lock Pod</span>
                </button>
              )}
              <button className="workspace-menu-item" data-tooltip="Settings" onClick={() => { setShowAccountMenu(false); setShowSettings(true); }}>
                <Settings size={16} />
                <span>Settings</span>
              </button>
            </div>
          </div>
          <div className="account-switcher-row">
            <button className="account-switcher" onClick={() => setShowAccountMenu(prev => !prev)} aria-label="Open Pod menu">
              <OwnerAvatar src={shellAvatar} name={shellDisplayName} size={32} className="account-switcher-avatar owner-avatar" />
              <div className="account-switcher-meta">
                <span className="account-name">{activeWorkspace?.name ?? 'Main'}</span>
                <span className="account-email">{shellPodName}</span>
              </div>
              <ChevronDown size={14} style={{ transition: 'transform 0.25s ease', transform: showAccountMenu ? 'rotate(180deg)' : 'none' }} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className={"app-body-wrap"}>
        <div className="app-body">
          <main className="main" key={activeWorkspaceId}>
            <div className="main-scroll">
              {apiState === 'error' && (
                <div className="pod-api-error" role="alert">
                  <AlertTriangle size={18} />
                  <div className="pod-api-error-copy">
                    <strong>Couldn&apos;t load your Pod data</strong>
                    <span>{apiError}</span>
                  </div>
                  <button type="button" onClick={() => void refreshData()}>Try again</button>
                </div>
              )}
              {active === 'activity' && (
                <ActivityView
                  events={events}
                  objects={objects}
                  authToken={authToken}
                  ownerActorId={localStorage.getItem('coffee-pod-owner-id') ?? 'person-local'}
                  onOpenConnections={openConnections}
                  onOpenImport={() => {
                    setImportInitialFolder(undefined);
                    setImportInitialMode(undefined);
                    setShowImportModal(true);
                  }}
                  onNavigateObject={openMemoryObject}
                  onNavigateCollection={openMemoryCollection}
                  onNavigateReflectionClaims={() => openMemorySection('list')}
                  onNavigateReflectionPages={() => {
                    setSearchSelectedDocId(null);
                    setSearchSelectedCollectionId('wiki');
                    setActive('docs');
                  }}
                  onAttentionResolved={refreshEvents}
                  onAttentionAction={(event, action) => {
                    if (action === 'connection') {
                      openConnections('sources');
                    } else if (action === 'access') {
                      const surface = `${event.type} ${event.title}`.toLowerCase();
                      if (surface.includes('skill')) setActive('skills');
                      else openConnections('agents');
                    }
                  }}
                />
              )}
              {active === 'memories' && <MemoriesView
                objects={objects}
                collections={collections}
                authToken={authToken}
                ownerActorId={localStorage.getItem('coffee-pod-owner-id') ?? 'person-local'}
                initialSection={memoryDestination.section}
                sectionRequestId={memoryDestination.requestId}
                initialListId={searchSelectedListId}
                onClearInitialList={() => setSearchSelectedListId(null)}
                onAskPodContext={(context) => { setActiveAskContext(context); setShowAIChat(true); }}
                onOpenDocument={(id) => {
                  setSearchSelectedDocId(id);
                  setSearchSelectedCollectionId(null);
                  setActive('docs');
                }}
                onRefresh={refreshData}
                onMoveDoc={(id, collectionId) => { setObjects(prev => prev.map(o => o.id === id ? { ...o, collection_id: collectionId ?? 'inbox', archived_at: collectionId === 'archive' ? new Date().toISOString() : null } : o)); }}
                onPatchObject={(id, patch) => setObjects(prev => prev.map(o => o.id === id ? { ...o, ...patch } : o))}
              />}
              {active === 'docs' && <DocsView
                objects={objects}
                collections={collections}
                authToken={authToken}
                ready={apiState !== 'checking'}
                initialDocId={searchSelectedDocId}
                initialCollectionId={searchSelectedCollectionId}
                createDocRequestId={createDocRequestId}
                createFolderRequestId={createFolderRequestId}
                onClearInitialDoc={() => setSearchSelectedDocId(null)}
                onClearInitialCollection={() => setSearchSelectedCollectionId(null)}
                onClearCreateDocRequest={() => setCreateDocRequestId(0)}
                onClearCreateFolderRequest={() => setCreateFolderRequestId(0)}
                onOpenImport={(folder) => { setImportInitialFolder(folder); setImportInitialMode(undefined); setShowImportModal(true); }}
                onRefresh={refreshData}
                onDeleteDoc={async (id, forget) => {
                  try {
                    await fetch(`/pod/objects/${encodeURIComponent(id)}?forget=${forget}`, { method: 'DELETE', headers: { ...authHeaders(authToken), 'content-type': 'application/json' }, body: JSON.stringify({ actor_id: 'person-local' }) });
                  } finally {
                    setObjects(prev => prev.filter(o => o.id !== id));
                  }
                }}
                onMoveDoc={(id, collectionId) => { setObjects(prev => prev.map(o => o.id === id ? { ...o, collection_id: collectionId ?? 'inbox', archived_at: collectionId === 'archive' ? new Date().toISOString() : null } : o)); }}
                onPatchObject={(id, patch) => setObjects(prev => {
                  const exists = prev.some(o => o.id === id);
                  if (exists) return prev.map(o => o.id === id ? { ...o, ...patch } : o);
                  return [...prev, { id, collection_id: 'inbox', kind: 'page', title: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...patch } as PodObject];
                })}
                onAddObject={obj => setObjects(prev => [...prev, obj])}
                onAddCollection={col => setCollections(prev => [...prev, col])}
              />}
              {active === 'journal' && <JournalView authToken={authToken} objects={objects} collections={collections} onRefresh={refreshData} onPatchObject={(id, patch) => setObjects(prev => {
                const exists = prev.some(o => o.id === id);
                if (exists) return prev.map(o => o.id === id ? { ...o, ...patch } : o);
                return [...prev, { id, collection_id: 'journal', kind: 'journal', title: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...patch } as PodObject];
              })} />}
              {active === 'skills' && <CapabilitiesView
                skills={skills}
                plugins={plugins}
                authToken={authToken}
                onCapabilitiesChanged={async () => {
                  try {
                    const [skillData, pluginData] = await Promise.all([
                      getJson<{ skills: PodSkill[] }>('/pod/skills', authToken),
                      getJson<{ plugins: PodPlugin[] }>('/pod/plugins', authToken),
                    ]);
                    setSkills(skillData.skills);
                    setPlugins(pluginData.plugins);
                  } catch {}
                }}
              />}
              {active === 'connections' && <ConnectionsView
                token={authToken}
                theme={theme}
                onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                onOpenImport={() => { setImportInitialFolder(undefined); setImportInitialMode('app'); setShowImportModal(true); }}
                collections={collections}
                skills={skills}
                initialTab={connectionsDestination.tab}
                tabRequestId={connectionsDestination.requestId}
                onSkillsChanged={async () => {
                  try {
                    const data = await getJson<{ skills: PodSkill[] }>('/pod/skills', authToken);
                    setSkills(data.skills);
                  } catch {}
                }}
              />}
            </div>
          </main>
        </div>
        <AIChatPanel key={activeWorkspaceId} open={showAIChat} onClose={() => setShowAIChat(false)} collections={collections} authToken={authToken} objects={objects} activeContext={activeAskContext} onClearContext={() => setActiveAskContext(null)} onOpenConnections={() => { setShowAIChat(false); openConnections(); }} onOpenSource={(source) => {
          // Navigate the main content area to the doc — keep Ask Pod open as side pane
          if (source.object_id) {
            openMemoryObject(source.object_id);
          } else if (source.entity_id) {
            openMemoryObject(source.entity_id);
          } else if (source.profile_id) {
            openMemorySection('profile');
          } else if (source.url) {
            window.open(source.url, '_blank', 'noopener,noreferrer');
          }
        }} />
        {showAIChat && <div className="ai-chat-backdrop" onClick={() => setShowAIChat(false)} />}
      </div>

      {/* ── Import Modal ── */}
      {showImportModal && <ImportModal authToken={authToken} onClose={() => { setShowImportModal(false); setImportInitialMode(undefined); }} onImportComplete={refreshData} onAddObjects={objs => setObjects(prev => [...prev, ...objs])} initialFolder={importInitialFolder} initialMode={importInitialMode} collections={collections} />}

      <WorkspaceCreateDialog
        open={workspaceEditorOpen}
        onOpenChange={setWorkspaceEditorOpen}
        onCreate={createWorkspace}
      />

      {/* ── Settings Modal ── */}
      {showSettings && (
        <SettingsModal
          authToken={authToken}
          theme={themeMode}
          onThemeChange={setThemeMode}
          sidebarCollapsedDefault={sidebarCollapsedDefault}
          onSidebarCollapsedDefaultChange={setSidebarCollapsedDefault}
          onLockPod={() => { setShowSettings(false); handleLock(); }}
          onPinChanged={handlePinChanged}
          onOpenConnections={() => {
            setShowSettings(false);
            setSettingsInitialSection(undefined);
            openConnections('models');
          }}
          onRuntimeChanged={setShellRuntime}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onWorkspaceCreate={createWorkspace}
          onWorkspaceUpdate={updateWorkspace}
          onWorkspaceDelete={removeWorkspace}
          onWorkspaceSwitch={switchWorkspace}
          initialSection={settingsInitialSection}
          onClose={() => { setShowSettings(false); setSettingsInitialSection(undefined); }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   Login Screen
   ═══════════════════════════════════════ */

function CoffeeLogo({ height = 16 }: { height?: number }) {
  return (
    <img
      src="/brand/coffee-logo-text.png"
      alt="Coffee"
      style={{ height, display: 'inline-block', verticalAlign: 'middle' }}
    />
  );
}

/* ── PIN Lock Screen ── */
function PINLockScreen(props: { pinLength: number; onUnlock: (sessionToken?: string) => void }) {
  const [pin, setPin] = React.useState('');
  const [error, setError] = React.useState('');
  const [hint, setHint] = React.useState<string | null>(null);
  const [shaking, setShaking] = React.useState(false);
  const [verifying, setVerifying] = React.useState(false);
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  const handleDigit = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = pin.split('');
    next[index] = value;
    const newPin = next.join('').slice(0, props.pinLength);
    setPin(newPin);
    setError('');

    if (value && index < props.pinLength - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    if (isCompletePin(newPin, props.pinLength)) {
      void submitPin(newPin);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isCompletePin(pin, props.pinLength)) {
      e.preventDefault();
      submitPin(pin);
      return;
    }
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const next = pin.split('');
      next[index - 1] = '';
      setPin(next.join(''));
    }
  };

  const submitPin = async (pinValue: string) => {
    if (verifying) return;
    setVerifying(true);
    try {
      const res = await fetch('/pod/pin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinValue }),
      });
      const data = await res.json();
      if (data.success) {
        sessionStorage.setItem('coffee-pod-pin-unlocked', '1');
        props.onUnlock(data.session_token ?? undefined);
      } else {
        setError('Wrong PIN');
        if (data.show_hint && data.hint) setHint(data.hint);
        setShaking(true);
        setTimeout(() => { setShaking(false); setPin(''); inputRefs.current[0]?.focus(); }, 500);
      }
    } catch {
      setError('Could not verify');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <main className="pin-shell">
      <section className={`pin-panel${shaking ? ' pin-shake' : ''}`}>
        <div className="pin-brand">
          <div className="pin-logo">
            <img src="/brand/pod-icon-white.png" alt="Pod" className="pin-logo-dark" width={72} height={76} />
            <img src="/brand/pod-icon-pink.png" alt="Pod" className="pin-logo-light" width={72} height={76} />
          </div>
          <h1 className="pin-title">Welcome back</h1>
          <p className="pin-subtitle">Enter your PIN to unlock</p>
        </div>

        <div className="pin-divider"><span>DEVICE PIN</span></div>

        <div className="pin-dots">
          {Array.from({ length: props.pinLength }).map((_, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              className={`pin-dot-input${pin[i] ? ' filled' : ''}${error ? ' error' : ''}`}
              value={pin[i] ?? ''}
              onChange={(e) => handleDigit(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              autoFocus={i === 0}
              autoComplete="off"
            />
          ))}
        </div>

        {error && <p className="pin-error">{error}</p>}
        {hint && (
          <div className="pin-hint">
            <Info size={14} />
            <span>Hint: {hint}</span>
          </div>
        )}

        <button
          className="pin-submit"
          disabled={!isCompletePin(pin, props.pinLength) || verifying}
          onClick={() => submitPin(pin)}
        >
          {verifying ? 'Verifying…' : 'Unlock'}
        </button>

        <p className="pin-footer">
          Forgot your PIN? Run <code>coffee-pod reset-pin</code> in terminal
        </p>
      </section>
    </main>
  );
}

/* ── PIN Setup Screen (used in Settings) ── */
function PINSetup(props: { hasPin: boolean; authToken?: string; onChanged?: () => void }) {
  const [mode, setMode] = React.useState<'idle' | 'set' | 'remove'>('idle');
  const [pin, setPin] = React.useState('');
  const [confirmPin, setConfirmPin] = React.useState('');
  const [currentPin, setCurrentPin] = React.useState('');
  const [hint, setHint] = React.useState('');
  const [error, setError] = React.useState('');
  const [step, setStep] = React.useState<'current' | 'new' | 'confirm' | 'hint'>('new');

  React.useEffect(() => {
    if (mode === 'set' && props.hasPin) setStep('current');
    else if (mode === 'set') setStep('new');
    else if (mode === 'remove') setStep('current');
  }, [mode, props.hasPin]);

  const handleSet = async () => {
    if (pin !== confirmPin) { setError('PINs don\'t match'); return; }
    if (pin.length < 4) { setError('PIN must be 4–6 digits'); return; }
    try {
      const body: any = { pin, hint: hint.trim() || undefined };
      if (props.hasPin) body.current_pin = currentPin;
      const res = await fetch('/pod/pin/set', {
        method: 'POST',
        headers: { ...authHeaders(props.authToken), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        if (res.status === 401) { setError('Session expired — please reload the app'); return; }
        const text = await res.text();
        try { const d = JSON.parse(text); setError(d.error === 'wrong_pin' ? 'Current PIN is incorrect' : d.message || `Failed (${res.status})`); } catch { setError(`Server error ${res.status}`); }
        return;
      }
      setMode('idle'); setPin(''); setConfirmPin(''); setCurrentPin(''); setHint(''); setError('');
      props.onChanged?.();
    } catch (err) { setError(err instanceof Error ? err.message : 'Network error'); }
  };

  const handleRemove = async () => {
    try {
      const res = await fetch('/pod/pin', {
        method: 'DELETE',
        headers: { ...authHeaders(props.authToken), 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: currentPin }),
      });
      if (!res.ok) {
        if (res.status === 401) { setError('Session expired — please reload the app'); return; }
        const text = await res.text();
        try { const d = JSON.parse(text); setError(d.error === 'wrong_pin' ? 'PIN is incorrect' : d.message || `Failed (${res.status})`); } catch { setError(`Server error ${res.status}`); }
        return;
      }
      setMode('idle'); setCurrentPin(''); setError('');
      props.onChanged?.();
    } catch (err) { setError(err instanceof Error ? err.message : 'Network error'); }
  };

  if (mode === 'idle') {
    return (
      <div className="pin-setup-idle">
        <div className="pin-setup-status">
          <Lock size={18} />
          <span>{props.hasPin ? 'PIN lock is enabled' : 'No PIN lock set'}</span>
        </div>
        <div className="pin-setup-actions">
          <button className="pin-setup-btn" onClick={() => setMode('set')}>
            {props.hasPin ? 'Change PIN' : 'Set PIN'}
          </button>
          {props.hasPin && (
            <button className="pin-setup-btn danger" onClick={() => setMode('remove')}>Remove PIN</button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pin-setup-form">
      <h4 className="pin-setup-heading">{mode === 'remove' ? 'Remove PIN' : props.hasPin ? 'Change PIN' : 'Set a PIN'}</h4>

      {(step === 'current' && (mode === 'set' || mode === 'remove')) && (
        <div className="pin-setup-field">
          <label>Current PIN</label>
          <input type="password" inputMode="numeric" maxLength={6} value={currentPin} onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" autoFocus onKeyDown={(e) => { if (e.key === 'Enter' && currentPin.length >= 4) { mode === 'remove' ? handleRemove() : setStep('new'); } }} />
          {mode === 'remove' ? (
            <div className="pin-setup-row">
              <button className="pin-setup-btn danger" onClick={handleRemove} disabled={currentPin.length < 4}>Remove</button>
              <button className="pin-setup-btn secondary" onClick={() => { setMode('idle'); setError(''); }}>Cancel</button>
            </div>
          ) : (
            <button className="pin-setup-btn" onClick={() => { setStep('new'); }} disabled={currentPin.length < 4}>Next</button>
          )}
        </div>
      )}

      {step === 'new' && mode === 'set' && (
        <div className="pin-setup-field">
          <label>New PIN (4–6 digits)</label>
          <input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" autoFocus onKeyDown={(e) => { if (e.key === 'Enter' && pin.length >= 4) setStep('confirm'); }} />
          <button className="pin-setup-btn" onClick={() => setStep('confirm')} disabled={pin.length < 4}>Next</button>
        </div>
      )}

      {step === 'confirm' && mode === 'set' && (
        <div className="pin-setup-field">
          <label>Confirm PIN</label>
          <input type="password" inputMode="numeric" maxLength={6} value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" autoFocus onKeyDown={(e) => { if (e.key === 'Enter' && confirmPin.length >= 4) setStep('hint'); }} />
          <button className="pin-setup-btn" onClick={() => setStep('hint')} disabled={confirmPin.length < 4}>Next</button>
        </div>
      )}

      {step === 'hint' && mode === 'set' && (
        <div className="pin-setup-field">
          <label>Hint (optional — shown after 3 wrong attempts)</label>
          <input type="text" value={hint} onChange={(e) => setHint(e.target.value)} placeholder="e.g. My bike lock code" maxLength={120} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleSet(); }} />
          <div className="pin-setup-row">
            <button className="pin-setup-btn" onClick={handleSet}>Save PIN</button>
            <button className="pin-setup-btn secondary" onClick={() => { setHint(''); handleSet(); }}>Skip & Save</button>
          </div>
        </div>
      )}

      {error && <p className="pin-setup-error">{error}</p>}
      {mode === 'set' && step !== 'current' && (
        <button className="pin-setup-btn secondary" onClick={() => { setMode('idle'); setError(''); setPin(''); setConfirmPin(''); setHint(''); }}>Cancel</button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   Upload Modal
   ═══════════════════════════════════════ */

/* ═══════════════════════════════════════
   Import Modal — Reusable import flow
   ═══════════════════════════════════════ */

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function classifyFile(file: File): StagingGroup {
  const format = importFormatForFilename(file.name);
  if (file.size > MAX_IMPORT_FILE_BYTES) return 'too-large';
  if (!format) return 'unsupported';
  if (file.size > MAX_EXTRACT_FILE_BYTES || format.extractor === 'none') return 'needs-review';
  return 'ready';
}

function groupLabel(g: StagingGroup): string {
  switch (g) {
    case 'ready': return 'Ready to Import';
    case 'needs-review': return 'Needs Review';
    case 'unsupported': return 'Unsupported';
    case 'too-large': return 'Too Large';
    case 'duplicate': return 'Duplicates';
  }
}

function groupIcon(g: StagingGroup) {
  switch (g) {
    case 'ready': return CheckCircle2;
    case 'needs-review': return AlertCircle;
    case 'unsupported': return FileQuestion;
    case 'too-large': return TriangleAlert;
    case 'duplicate': return Copy;
  }
}

const STEP_LABELS: { key: ImportStep; label: string }[] = [
  { key: 'select', label: 'Select' },
  { key: 'staging', label: 'Review' },
  { key: 'confirm', label: 'Confirm' },
  { key: 'results', label: 'Complete' },
];

function ImportModal(props: { onClose: () => void; authToken?: string; onImportComplete?: () => void; onAddObjects?: (objects: PodObject[]) => void; initialFolder?: string; initialMode?: ImportMode; collections?: PodCollection[] }) {
  // Upload endpoints require auth. Failures remain visible and retryable.
  const uploadHeaders = (): HeadersInit => (props.authToken ? { authorization: `Bearer ${props.authToken}` } : {});
  type SimpleStep = 'pick' | 'importing' | 'done';
  const [step, setStep] = React.useState<SimpleStep>('pick');
  const [mode, setMode] = React.useState<ImportMode>(props.initialMode ?? 'upload');
  const [dragOver, setDragOver] = React.useState(false);
  const [stagedFiles, setStagedFiles] = React.useState<StagedFile[]>([]);
  const [destination, setDestination] = React.useState(props.initialFolder ?? 'inbox');
  const [processing, setProcessing] = React.useState<ProcessingDepth>('extract');
  const [importProgress, setImportProgress] = React.useState(0);
  const [importResults, setImportResults] = React.useState<ImportResultSummary | null>(null);
  const [appImportLabel, setAppImportLabel] = React.useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const folderInputRef = React.useRef<HTMLInputElement>(null);
  const exportInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') props.onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const addFiles = (fileList: FileList | File[]) => {
    const newFiles: StagedFile[] = Array.from(fileList).map((f, i) => {
      const ext = '.' + (f.name.split('.').pop()?.toLowerCase() ?? '');
      const group = classifyFile(f);
      const format = importFormatForFilename(f.name);
      return {
        id: `file-${Date.now()}-${i}`,
        name: f.name,
        size: f.size,
        extension: ext,
        mimeType: f.type || 'application/octet-stream',
        group,
        groupDetail: group === 'unsupported' ? `${ext} not supported` :
                     group === 'too-large' ? `Larger than ${formatFileSize(MAX_IMPORT_FILE_BYTES)}` :
                     format?.extractor === 'none' ? 'The original will be stored without searchable text' :
                     group === 'needs-review' ? `The original will be stored; extraction is limited to ${formatFileSize(MAX_EXTRACT_FILE_BYTES)}` :
                     undefined,
        selected: group === 'ready' || group === 'needs-review',
        folderPath: (f as any).webkitRelativePath || undefined,
        processing: 'extract' as ProcessingDepth,
        file: f,
      };
    });
    setStagedFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (id: string) => setStagedFiles(prev => prev.filter(f => f.id !== id));
  const selectedFiles = stagedFiles.filter(f => f.selected);
  const totalSize = selectedFiles.reduce((s, f) => s + f.size, 0);

  // Destination options: Inbox + user collections (excluding archive)
  const folderOptions = React.useMemo(() => {
    const opts: Array<{ id: string; label: string }> = [{ id: 'inbox', label: 'Inbox' }];
    if (props.collections) {
      for (const c of props.collections) {
        if (c.id === 'inbox' || c.id === 'archive') continue;
        opts.push({ id: c.id, label: c.name });
      }
    }
    opts.push({ id: 'archive', label: 'Archive' });
    return opts;
  }, [props.collections]);

  const startImport = async () => {
    setStep('importing');
    setImportProgress(0);

    const filesToUpload = selectedFiles.filter(f => f.file);
    if (filesToUpload.length === 0) {
      setImportResults({ imported: 0, failed: 0, files: [] });
      setStep('done');
      return;
    }

    const formData = new FormData();
    formData.append('actor_id', localStorage.getItem('coffee-pod-owner-id') ?? 'person-local');
    formData.append('collection_id', destination);
    formData.append('processing_mode', processing);
    for (const staged of filesToUpload) formData.append('files', staged.file!);

    setImportProgress(10);
    const timer = setInterval(() => setImportProgress(prev => Math.min(prev + 5, 85)), 500);

    try {
      const res = await fetch('/pod/upload', { method: 'POST', headers: uploadHeaders(), body: formData });
      clearInterval(timer);
      setImportProgress(100);

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? `Import failed (HTTP ${res.status})`);
      const outcomes = Array.isArray(data.imported) ? data.imported as ImportFileOutcome[] : [];
      setImportResults({
        imported: outcomes.length,
        failed: Number(data.failed ?? data.errors ?? 0),
        files: outcomes,
      });
      if (outcomes.length > 0) props.onImportComplete?.();
    } catch (error) {
      clearInterval(timer);
      setImportProgress(100);
      setImportResults({
        imported: 0,
        failed: filesToUpload.length,
        files: [],
        error: error instanceof Error ? error.message : String(error),
      });
    }
    setStep('done');
  };

  /** Handle "Select folder" for Obsidian — uses folder picker via hidden input with webkitdirectory */
  const handleFolderSelect = async (files: FileList) => {
    // webkitdirectory gives us all files with webkitRelativePath
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    // Extract folder name from the first file's relative path
    const firstPath = (fileArray[0] as any).webkitRelativePath ?? fileArray[0].name;
    const folderName = firstPath.split('/')[0] || 'Folder';

    setAppImportLabel(folderName);
    setStep('importing');
    setImportProgress(10);

    // Filter to supported files and upload them
    const supported = fileArray.filter(f => {
      const ext = '.' + (f.name.split('.').pop()?.toLowerCase() ?? '');
      return SUPPORTED_EXTENSIONS.includes(ext);
    });

    if (supported.length === 0) {
      setImportResults({ imported: 0, failed: 0, files: [] });
      setStep('done');
      return;
    }

    const formData = new FormData();
    formData.append('actor_id', localStorage.getItem('coffee-pod-owner-id') ?? 'person-local');
    formData.append('collection_id', destination);
    formData.append('processing_mode', processing);
    for (const f of supported) formData.append('files', f);

    const timer = setInterval(() => setImportProgress(prev => Math.min(prev + 3, 85)), 600);

    try {
      const res = await fetch('/pod/upload', { method: 'POST', headers: uploadHeaders(), body: formData });
      clearInterval(timer);
      setImportProgress(100);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? `Import failed (HTTP ${res.status})`);
      const outcomes = Array.isArray(data.imported) ? data.imported as ImportFileOutcome[] : [];
      setImportResults({
        imported: outcomes.length,
        failed: Number(data.failed ?? data.errors ?? 0),
        files: outcomes,
      });
      if (outcomes.length > 0) props.onImportComplete?.();
    } catch (error) {
      clearInterval(timer);
      setImportProgress(100);
      setImportResults({
        imported: 0,
        failed: supported.length,
        files: [],
        error: error instanceof Error ? error.message : String(error),
      });
    }
    setStep('done');
  };

  /** Handle "Choose export" for Notion/Evernote — user picks exported zip/files */
  const handleExportSelect = async (files: FileList) => {
    const fileArray = Array.from(files).filter(f => {
      const ext = '.' + (f.name.split('.').pop()?.toLowerCase() ?? '');
      return SUPPORTED_EXTENSIONS.includes(ext);
    });
    if (fileArray.length === 0) return;

    setStep('importing');
    setImportProgress(10);

    const formData = new FormData();
    formData.append('actor_id', localStorage.getItem('coffee-pod-owner-id') ?? 'person-local');
    formData.append('collection_id', destination);
    formData.append('processing_mode', processing);
    for (const f of fileArray) formData.append('files', f);

    const timer = setInterval(() => setImportProgress(prev => Math.min(prev + 4, 85)), 500);

    try {
      const res = await fetch('/pod/upload', { method: 'POST', headers: uploadHeaders(), body: formData });
      clearInterval(timer);
      setImportProgress(100);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? `Import failed (HTTP ${res.status})`);
      const outcomes = Array.isArray(data.imported) ? data.imported as ImportFileOutcome[] : [];
      setImportResults({
        imported: outcomes.length,
        failed: Number(data.failed ?? data.errors ?? 0),
        files: outcomes,
      });
      if (outcomes.length > 0) props.onImportComplete?.();
    } catch (error) {
      clearInterval(timer);
      setImportProgress(100);
      setImportResults({
        imported: 0,
        failed: fileArray.length,
        files: [],
        error: error instanceof Error ? error.message : String(error),
      });
    }
    setStep('done');
  };

  const handleAppAction = (src: ImportAppSource) => {
    if (src.status === 'coming-soon') return;
    if (src.id === 'obsidian' || src.id === 'local-folder') {
      setAppImportLabel(src.id === 'obsidian' ? 'Obsidian vault' : 'Local folder');
      folderInputRef.current?.click();
    } else if (src.status === 'requires-export') {
      setAppImportLabel(src.name);
      exportInputRef.current?.click();
    }
  };

  const destLabel = folderOptions.find(f => f.id === destination)?.label ?? destination;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) props.onClose(); }}>
      <DialogContent
        showCloseButton={false}
        className="import-modal import-modal-minimal max-w-lg p-0 gap-0"
        /* Never auto-dismiss on an outside click. Closing is only via the X
           button, Cancel, or a completed import (all of which call
           props.onClose directly). Escape still closes via onOpenChange. */
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >

        {/* ── Pick files ── */}
        {step === 'pick' && (
          <>
            <div className="import-minimal-header">
              <h2>Import</h2>
              <button className="import-minimal-close" onClick={props.onClose}><X size={16} /></button>
            </div>

            {/* Mode tabs */}
            <div className="import-mode-tabs">
              <button className={`import-mode-tab ${mode === 'upload' ? 'active' : ''}`} onClick={() => setMode('upload')}>
                <Upload size={14} /> Files
              </button>
              <button className={`import-mode-tab ${mode === 'app' ? 'active' : ''}`} onClick={() => setMode('app')}>
                <FolderInput size={14} /> Apps
              </button>
            </div>

            <div className="import-minimal-body">
              {mode === 'upload' ? (
                <>
                  {/* Drop zone */}
                  <div
                    className={`import-minimal-drop ${dragOver ? 'drag-over' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept={SUPPORTED_EXTENSIONS.join(',')}
                      style={{ display: 'none' }}
                      onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }}
                    />
                    <Upload size={24} strokeWidth={1.5} />
                    <span>Drop files or browse</span>
                  </div>

                  {/* File list */}
                  {stagedFiles.length > 0 && (
                    <div className="import-minimal-files">
                      {stagedFiles.map(f => (
                        <div key={f.id} className={`import-minimal-file ${f.group !== 'ready' && f.group !== 'needs-review' ? 'error' : ''}`}>
                          <FileText size={14} />
                          <span className="import-minimal-fname">{f.name}</span>
                          <span className="import-minimal-fsize" title={f.groupDetail}>
                            {f.groupDetail ?? formatFileSize(f.size)}
                          </span>
                          <button className="import-minimal-fremove" onClick={() => removeFile(f.id)}><X size={12} /></button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Options row: destination + processing */}
                  {stagedFiles.length > 0 && (
                    <>
                      <div className="import-minimal-options">
                        <div className="import-minimal-destination">
                          <span className="import-minimal-dest-label">Save to</span>
                          <AppSelect
                            className="import-minimal-dest-select"
                            value={destination}
                            onChange={v => setDestination(v)}
                            portalled={false}
                            options={folderOptions.map(opt => ({ value: opt.id, label: opt.label }))}
                          />
                        </div>
                        <div className="import-minimal-destination">
                          <span className="import-minimal-dest-label">Processing</span>
                          <AppSelect
                            className="import-minimal-dest-select"
                            value={processing}
                            onChange={v => setProcessing(v as ProcessingDepth)}
                            portalled={false}
                            options={[
                              { value: 'store', label: 'Store only' },
                              { value: 'extract', label: 'Extract text' },
                              { value: 'reflect', label: 'Extract + Reflect' },
                            ]}
                          />
                        </div>
                      </div>

                      {/* AI cost estimate — only when reflect is selected */}
                      {processing === 'reflect' && (() => {
                        const textBytes = selectedFiles.reduce((s, f) => s + f.size, 0);
                        const estTokens = Math.ceil(textBytes / 4); // ~4 bytes per token
                        const inputCost = (estTokens / 1_000_000) * 3;   // $3/M input tokens
                        const outputTokens = Math.ceil(estTokens * 0.15); // ~15% output ratio
                        const outputCost = (outputTokens / 1_000_000) * 15; // $15/M output tokens
                        const totalCost = inputCost + outputCost;
                        const formatTokens = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
                        return (
                          <div className="import-cost-estimate">
                            <Sparkles size={13} />
                            <div className="import-cost-details">
                              <span className="import-cost-line">
                                Est. <strong>~{formatTokens(estTokens)}</strong> input tokens · <strong>~{formatTokens(outputTokens)}</strong> output tokens
                              </span>
                              <span className="import-cost-total">
                                Projected cost: <strong>${totalCost < 0.01 ? '<0.01' : totalCost.toFixed(2)}</strong>
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  )}
                </>
              ) : (
                /* App sources */
                <div className="import-app-sources">
                  {/* Hidden inputs for folder and export file pickers */}
                  <input
                    ref={folderInputRef}
                    type="file"
                    {...{ webkitdirectory: '', directory: '' } as any}
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => { if (e.target.files?.length) handleFolderSelect(e.target.files); e.target.value = ''; }}
                  />
                  <input
                    ref={exportInputRef}
                    type="file"
                    multiple
                    accept={SUPPORTED_EXTENSIONS.join(',')}
                    style={{ display: 'none' }}
                    onChange={(e) => { if (e.target.files?.length) handleExportSelect(e.target.files); e.target.value = ''; }}
                  />
                  {IMPORT_APP_SOURCES.map(src => {
                    const logoUrl = APP_LOGO_URLS[src.id];
                    return (
                      <div key={src.id} className={`import-app-row ${src.status === 'coming-soon' ? 'disabled' : ''}`}>
                        <div className="import-app-icon">
                          {logoUrl ? <img src={logoUrl} alt={src.name} width={22} height={22} /> : <FolderInput size={18} />}
                        </div>
                        <div className="import-app-info">
                          <span className="import-app-name">{src.name}</span>
                          <span className="import-app-desc">{src.description}</span>
                        </div>
                        <button
                          className={`import-app-cta ${src.status === 'coming-soon' ? 'disabled' : ''}`}
                          disabled={src.status === 'coming-soon'}
                          onClick={() => handleAppAction(src)}
                        >
                          {src.cta}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="import-minimal-footer">
              <button className="import-minimal-cancel" onClick={props.onClose}>Cancel</button>
              {mode === 'upload' && selectedFiles.length > 0 && (
                <button className="import-minimal-go" onClick={startImport}>
                  Import {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''}
                </button>
              )}
            </div>
          </>
        )}

        {/* ── Importing ── */}
        {step === 'importing' && (
          <div className="import-minimal-progress">
            <Loader2 size={28} className="import-spinner" />
            <p>Importing {appImportLabel || `${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''}`}…</p>
            <div className="import-minimal-bar">
              <div className="import-minimal-bar-fill" style={{ width: `${importProgress}%` }} />
            </div>
          </div>
        )}

        {/* ── Done ── */}
        {step === 'done' && importResults && (
          <div className="import-minimal-done">
            {importResults.error ? <AlertCircle size={32} /> : <CheckCircle2 size={32} />}
            <h3>{importResults.imported} file{importResults.imported !== 1 ? 's' : ''} imported</h3>
            {importResults.failed > 0 && <p className="import-minimal-fail">{importResults.failed} failed</p>}
            {importResults.error && <p className="import-minimal-fail">{importResults.error}</p>}
            {!importResults.error && <p className="import-minimal-dest-note">Added to {destLabel}</p>}
            {importResults.files.length > 0 && (
              <div className="import-minimal-files">
                {importResults.files.map((file) => (
                  <div
                    key={file.id}
                    className={`import-minimal-file ${file.extraction_status === 'failed' ? 'error' : ''}`}
                    title={file.warnings?.join('\n') || undefined}
                  >
                    <FileText size={14} />
                    <span className="import-minimal-fname">{file.filename || file.title}</span>
                    <span className="import-minimal-fsize">
                      {file.processing_state === 'needs_ocr'
                        ? 'Needs OCR'
                        : file.processing_state === 'metadata_only'
                          ? 'Stored only'
                          : file.processing_state === 'reflecting'
                            ? 'Reflecting'
                            : file.processing_state}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="import-minimal-done-actions">
              <button className="import-minimal-cancel" onClick={() => { setStagedFiles([]); setStep('pick'); setImportResults(null); }}>Import more</button>
              <button className="import-minimal-go" onClick={props.onClose}>Done</button>
            </div>
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════
   Graph View — Knowledge graph explorer
   ═══════════════════════════════════════ */

/* ── Graph data types ── */

type NodeType = GraphNodeType;

// Cosmograph-inspired palette — vibrant, glowing against a dark navy background.
const NODE_COLORS: Record<NodeType, { fill: string; stroke: string; glow: string }> = {
  entity:   { fill: '#94A3B8', stroke: '#CBD5E1', glow: 'rgba(148,163,184,.28)' },  // unknown semantic type
  concept:  { fill: '#5CB8EC', stroke: '#8CD0F5', glow: 'rgba(92,184,236,.35)' },   // sky blue
  decision: { fill: '#ECB85C', stroke: '#F5D08C', glow: 'rgba(236,184,92,.30)' },   // warm gold
  project:  { fill: '#C77DFF', stroke: '#D9A8FF', glow: 'rgba(199,125,255,.35)' },  // violet (hubs)
  person:   { fill: '#FF6B9D', stroke: '#FF9DBF', glow: 'rgba(255,107,157,.30)' },  // coral pink
  tool:     { fill: '#5C7CEC', stroke: '#8CA0F5', glow: 'rgba(92,124,236,.35)' },   // electric blue
  organisation: { fill: '#F97316', stroke: '#FDBA74', glow: 'rgba(249,115,22,.30)' },
  event:    { fill: '#22D3EE', stroke: '#A5F3FC', glow: 'rgba(34,211,238,.30)' },
  agent:    { fill: '#A78BFA', stroke: '#DDD6FE', glow: 'rgba(167,139,250,.32)' },
  preference: { fill: '#F472B6', stroke: '#FBCFE8', glow: 'rgba(244,114,182,.30)' },
  artifact: { fill: '#5CECC6', stroke: '#8CF5DA', glow: 'rgba(92,236,198,.28)' },
  collection: { fill: '#64748B', stroke: '#CBD5E1', glow: 'rgba(100,116,139,.28)' },
};

const FOCUS_NODE_TYPES: readonly NodeType[] = [
  'decision',
  'person',
  'project',
  'organisation',
  'concept',
  'tool',
  'agent',
  'preference',
  'entity',
  'event',
  'artifact',
  'collection',
];
const PRIMARY_FOCUS_NODE_TYPES: readonly NodeType[] = FOCUS_NODE_TYPES.slice(0, 4);
const NODE_TYPE_LABELS: Record<NodeType, string> = {
  decision: 'Decisions',
  person: 'People',
  project: 'Projects',
  concept: 'Topics',
  entity: 'Other',
  tool: 'Tools',
  organisation: 'Organizations',
  event: 'Events',
  agent: 'Agents',
  preference: 'Preferences',
  artifact: 'Source records',
  collection: 'Collections',
};
const NODE_TYPE_SECTIONS: Record<NodeType, 'Knowledge' | 'Activity' | 'Evidence' | 'Structure'> = {
  decision: 'Knowledge',
  person: 'Knowledge',
  project: 'Knowledge',
  organisation: 'Knowledge',
  concept: 'Knowledge',
  tool: 'Knowledge',
  agent: 'Knowledge',
  preference: 'Knowledge',
  entity: 'Knowledge',
  event: 'Activity',
  artifact: 'Evidence',
  collection: 'Structure',
};
const EPISTEMIC_LABELS: Record<GraphEpistemic, string> = {
  fact: 'Facts',
  inference: 'Possibilities',
  opinion: 'Opinions',
  stale: 'May be out of date',
  contested: 'Conflicting information',
  mixed: 'A mix of information',
  unclassified: 'Not sorted yet',
};

// Obsidian focus pattern — when a local-graph focus is active, everything OUTSIDE the
// reachable neighbourhood collapses to a single muted gray (no type colour, no label).
const MUTED_NODE_FILL = 'rgba(148, 158, 175, 0.5)';
const MUTED_LABEL_FILL = 'rgba(148, 158, 175, 0.4)';

const EDGE_LAYER_STYLE: Record<GraphEdge['layer'], { stroke: string; activeStroke: string; width: number; opacity: number; dash?: string }> = {
  structural: { stroke: 'rgba(148,163,184,0.24)', activeStroke: 'rgba(203,213,225,0.75)', width: 0.45, opacity: 0.18 },
  canonical: { stroke: 'rgba(92,236,198,0.52)', activeStroke: 'rgba(190,255,238,0.95)', width: 0.8, opacity: 0.38 },
  derived: { stroke: 'rgba(167,139,250,0.55)', activeStroke: 'rgba(216,200,255,0.95)', width: 0.65, opacity: 0.32, dash: '3 4' },
  annotation: { stroke: 'rgba(254,0,107,0.82)', activeStroke: 'rgba(255,178,211,1)', width: 1.25, opacity: 0.76, dash: '7 3' },
};

const NODE_TYPE_ICONS: Record<NodeType, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>> = {
  entity:   Lightbulb,
  concept:  Brain,
  decision: GitBranch,
  project:  Folder,
  person:   User,
  tool:     Wrench,
  organisation: Building2,
  event: CalendarDays,
  agent: Bot,
  preference: Star,
  artifact: FileText,
  collection: FolderTree,
};

/** H3 — community palette. Pre-perceptually-tuned for dark backgrounds. */
const COMMUNITY_PALETTE: Array<{ fill: string; stroke: string }> = [
  { fill: '#8B5CF6', stroke: '#C4B5FD' }, // violet
  { fill: '#38BDF8', stroke: '#BAE6FD' }, // sky
  { fill: '#34D399', stroke: '#A7F3D0' }, // emerald
  { fill: '#F59E0B', stroke: '#FCD34D' }, // amber
  { fill: '#FB7185', stroke: '#FECACA' }, // rose
  { fill: '#A855F7', stroke: '#D8B4FE' }, // purple
  { fill: '#22D3EE', stroke: '#A5F3FC' }, // cyan
  { fill: '#FBBF24', stroke: '#FDE68A' }, // yellow
  { fill: '#F472B6', stroke: '#FBCFE8' }, // pink
  { fill: '#4ADE80', stroke: '#BBF7D0' }, // green
  { fill: '#60A5FA', stroke: '#BFDBFE' }, // blue
  { fill: '#FB923C', stroke: '#FED7AA' }, // orange
];

function communityColors(idx: number): { fill: string; stroke: string } {
  return COMMUNITY_PALETTE[idx % COMMUNITY_PALETTE.length];
}

/** Render answer text with inline citation pills. Pills hover-pulse the matched graph node. */
function renderAnswerWithCitations(
  answer: string,
  citations: AskPodResult['citations'],
  handlers: { onCitationHover: (id: string | null) => void; onCitationClick: (id: string) => void },
): React.ReactNode {
  if (citations.length === 0) return <>{answer}</>;
  const sorted = [...citations].sort((a, b) => a.start - b.start);
  const out: React.ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  for (const c of sorted) {
    if (c.start > cursor) out.push(<React.Fragment key={`t-${key++}`}>{answer.slice(cursor, c.start)}</React.Fragment>);
    out.push(
      <button
        key={`c-${key++}`}
        className="graph-citation-pill"
        onMouseEnter={() => c.nodeId && handlers.onCitationHover(c.nodeId)}
        onMouseLeave={() => handlers.onCitationHover(null)}
        onClick={() => {
          if (c.nodeId) handlers.onCitationClick(c.nodeId);
          else if (c.url) window.open(c.url, '_blank', 'noopener,noreferrer');
        }}
        title={`Source: ${c.label}${c.nodeId ? ' · Click to jump on the graph' : ''}`}
      >
        {answer.slice(c.start, c.end)}
      </button>
    );
    cursor = c.end;
  }
  if (cursor < answer.length) out.push(<React.Fragment key={`t-${key++}`}>{answer.slice(cursor)}</React.Fragment>);
  return <>{out}</>;
}

function getNodeKind(node: GraphNode): string | undefined {
  return node.properties?.find(p => p.key === 'kind')?.value;
}

function isDocNode(node: GraphNode): boolean {
  if (!node.id.startsWith('obj:')) return false;
  const k = getNodeKind(node);
  return !!k && DOC_KINDS.has(k);
}

function objectIdFromNode(node: GraphNode): string | undefined {
  if (node.id.startsWith('obj:')) return node.id.slice(4);
  return undefined;
}

export interface OpenInMemoriesPayload {
  label: string;
  nodeId: string;
  kind?: string;
  objectId?: string;
}

/* ── Empty graph fallback ── */
const EMPTY_GRAPH: { nodes: GraphNode[]; edges: GraphEdge[] } = { nodes: [], edges: [] };

/* Orbit 3D view — heavy three.js bundle, loaded only when the user opens it. */
const GraphOrbit = React.lazy(() => import('./GraphOrbit'));

const POSITIONS_STORAGE_KEY = 'cp:graph:positions:v1';
const DISPLAY_STORAGE_KEY = 'cp:graph:display:v3';
const LEGACY_DISPLAY_STORAGE_KEY = 'cp:graph:display:v2';

function graphLabelText(label: string, preserveFullLabel: boolean): string {
  return preserveFullLabel || label.length <= 36 ? label : `${label.slice(0, 35)}…`;
}

function loadSavedPositions(): Record<string, { x: number; y: number }> {
  try {
    const raw = localStorage.getItem(POSITIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function loadSavedDisplayOptions(): GraphDisplayOptions {
  try {
    const raw = localStorage.getItem(DISPLAY_STORAGE_KEY) ?? localStorage.getItem(LEGACY_DISPLAY_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_GRAPH_DISPLAY_OPTIONS };
    const saved = JSON.parse(raw) as Record<string, unknown> & { showCrossRefs?: boolean };
    // The old "cross references" toggle mixed canonical and inferred links. Keep
    // existing preferences only when the new, explicit setting has been saved.
    const { showCrossRefs: _legacy, ...current } = saved;
    return normalizeGraphDisplayOptions(current);
  } catch {
    return { ...DEFAULT_GRAPH_DISPLAY_OPTIONS };
  }
}

/** Phase F — Inline editor that appears when alt-drag lands on a target node. */
function LinkEditor(props: {
  src: GraphNode; tgt: GraphNode; x: number; y: number;
  onSave: (p: { label?: string; relation?: string; direction?: 'one-way' | 'two-way'; note?: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [relation, setRelation] = React.useState<string>('supports');
  const [label, setLabel] = React.useState<string>('');
  const [direction, setDirection] = React.useState<'one-way' | 'two-way'>('one-way');
  const [note, setNote] = React.useState<string>('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const W = 320, H = 280;
  const left = Math.min(Math.max(8, props.x - W / 2), window.innerWidth - W - 8);
  const top = Math.min(Math.max(8, props.y - H - 16), window.innerHeight - H - 8);
  return (
    <div className="graph-link-editor" style={{ left, top }}>
      <div className="graph-link-editor-header">
        <span className="graph-link-editor-from">{props.src.label}</span>
        <span className="graph-link-editor-arrow">{direction === 'two-way' ? '↔' : '→'}</span>
        <span className="graph-link-editor-to">{props.tgt.label}</span>
      </div>
      <div className="graph-link-editor-body">
        <label className="graph-link-editor-row">
          <span>Relation</span>
          <select value={relation} onChange={e => setRelation(e.target.value)}>
            <option value="supports">supports</option>
            <option value="contradicts">contradicts</option>
            <option value="depends-on">depends-on</option>
            <option value="causes">causes</option>
            <option value="is-part-of">is-part-of</option>
            <option value="see-also">see-also</option>
            <option value="custom">custom…</option>
          </select>
        </label>
        {relation === 'custom' && (
          <label className="graph-link-editor-row">
            <span>Custom relation</span>
            <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. inspired" autoFocus />
          </label>
        )}
        <label className="graph-link-editor-row">
          <span>Direction</span>
          <div className="graph-link-editor-direction">
            <button
              className={direction === 'one-way' ? 'active' : ''}
              onClick={() => setDirection('one-way')}
              type="button"
            >→ one-way</button>
            <button
              className={direction === 'two-way' ? 'active' : ''}
              onClick={() => setDirection('two-way')}
              type="button"
            >↔ two-way</button>
          </div>
        </label>
        <label className="graph-link-editor-row">
          <span>Note (optional)</span>
          <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="" />
        </label>
      </div>
      {error && <div className="graph-link-editor-error" role="alert">{error}</div>}
      <div className="graph-link-editor-actions">
        <button className="graph-link-editor-cancel" onClick={props.onCancel} disabled={saving}>Cancel</button>
        <button
          className="graph-link-editor-save"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            setError(null);
            try {
              await props.onSave({
                label: relation === 'custom' ? (label.trim() || 'related') : relation,
                relation: relation === 'custom' ? 'custom' : relation,
                direction,
                note: note.trim() || undefined,
              });
            } catch (saveError) {
              setError(saveError instanceof Error ? saveError.message : String(saveError));
            } finally {
              setSaving(false);
            }
          }}
        >{saving ? 'Saving…' : 'Create link'}</button>
      </div>
    </div>
  );
}

class GraphErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error('GraphView crash:', error, info.componentStack); }
  render() {
    if (this.state.error) {
      return (
        <div className="graph-view" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: 'var(--fg-3)', maxWidth: 400 }}>
            <Network size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Map failed to load</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>{this.state.error.message}</div>
            <button style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border-2)', background: 'var(--bg-2)', color: 'var(--fg-2)', cursor: 'pointer' }} onClick={() => this.setState({ error: null })}>Retry</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function GraphView(props: { onOpenInMemories?: (payload: OpenInMemoriesPayload) => void; onAskPodContext?: (context: AskPodContext) => void; authToken?: string; ownerActorId: string; active?: boolean; memoryViewMode?: React.ReactNode; memoryHeaderActionsTarget?: HTMLElement | null; memoryPaneTarget?: HTMLElement | null }) {
  // Helper bound to current closure — used by both the detail-panel title button and double-click
  function emitOpen(node: GraphNode) {
    props.onOpenInMemories?.({
      label: node.label,
      nodeId: node.id,
      kind: getNodeKind(node),
      objectId: objectIdFromNode(node),
    });
  }
  const svgRef = React.useRef<SVGSVGElement>(null);
  const sceneRef = React.useRef<SVGGElement>(null);
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const graphCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const canvasPaintRef = React.useRef<(viewport: { pan: { x: number; y: number }; zoom: number }) => void>(() => {});
  const fitZoomRef = React.useRef(0.36);
  const [nodes, setNodes] = React.useState<GraphNode[]>(EMPTY_GRAPH.nodes);
  const [edges, setEdges] = React.useState<GraphEdge[]>(EMPTY_GRAPH.edges);
  const [graphMeta, setGraphMeta] = React.useState<GraphMeta>({});
  const [graphProjectionMode, setGraphProjectionMode] = React.useState<'overview' | 'complete'>('overview');
  const [graphLoading, setGraphLoading] = React.useState(true);
  const [graphError, setGraphError] = React.useState<string | null>(null);
  const [graphRetryKey, setGraphRetryKey] = React.useState(0);
  const [edgeMutationError, setEdgeMutationError] = React.useState<string | null>(null);
  const [deletingEdgeId, setDeletingEdgeId] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = React.useState<Set<string>>(new Set());

  // Q1: search
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchExpanded, setSearchExpanded] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (searchExpanded) searchInputRef.current?.focus();
  }, [searchExpanded]);

  // Q3: hover object card
  const [hoverCard, setHoverCard] = React.useState<{ id: string; clientX: number; clientY: number } | null>(null);
  const hoverTimerRef = React.useRef<number | null>(null);
  const hoverIntentRef = React.useRef<GraphHoverIntent | null>(null);

  React.useEffect(() => () => {
    if (hoverTimerRef.current !== null) window.clearTimeout(hoverTimerRef.current);
  }, []);

  // Q4: display options (persisted)
  const [displayOptions, setDisplayOptions] = React.useState<GraphDisplayOptions>(loadSavedDisplayOptions);
  // displayPanelOpen removed — its toggles moved into the ⋯ overflow menu (Phase A redesign).

  React.useEffect(() => {
    try { localStorage.setItem(DISPLAY_STORAGE_KEY, JSON.stringify(displayOptions)); } catch {}
  }, [displayOptions]);

  // Q5: drag persistence — saved positions keyed by node id
  const savedPositionsRef = React.useRef<Record<string, { x: number; y: number }>>(loadSavedPositions());

  function persistPosition(id: string, x: number, y: number) {
    savedPositionsRef.current[id] = { x, y };
    try { localStorage.setItem(POSITIONS_STORAGE_KEY, JSON.stringify(savedPositionsRef.current)); } catch {}
  }

  // Lens — drives stable layout, colour, size, document filtering and relationship evidence together.
  const [activeLensId, setActiveLensId] = React.useState<LensId>(() => loadActiveLensId());
  const activeLens: Lens = React.useMemo(() => getLensById(activeLensId), [activeLensId]);
  React.useEffect(() => { persistActiveLensId(activeLensId); }, [activeLensId]);

  // Underlying mode state — derived from the active lens but kept as state so the rendering
  // pipeline can stay simple. An effect syncs settings when the lens changes.
  const [layoutMode, setLayoutMode] = React.useState<'hub-spoke' | 'force'>(activeLens.settings.layout);
  const [colorMode, setColorMode] = React.useState<'type' | 'community'>(activeLens.settings.color);
  const [sizeMode, setSizeMode] = React.useState<'fixed' | 'betweenness'>(activeLens.settings.size);
  const [communities, setCommunities] = React.useState<Record<string, number>>({});
  const [betweenness, setBetweenness] = React.useState<Record<string, number>>({});
  const [gapDefinitions, setGapDefinitions] = React.useState<TopologyAnalysis['gaps']>([]);
  const [analyticsLoading, setAnalyticsLoading] = React.useState(false);

  // Lens menu and contextual settings panel state.
  const [lensMenuOpen, setLensMenuOpen] = React.useState(false);
  const [settingsPanelOpen, setSettingsPanelOpen] = React.useState(false);

  // On-demand right pane — 'detail' (selected node) | 'ask' (Ask Pod) | null (free canvas).
  // Default state keeps the canvas edge-to-edge; panes are summoned by intent.
  const [rightPane, setRightPane] = React.useState<'detail' | 'ask' | null>(null);
  // When a node was opened from inside the Ask thread, closing it returns to Ask.
  const cameFromAskRef = React.useRef(false);

  // Left filter rail — collapsible, same gesture as Pod's main sidebar. Persisted.
  const [railCollapsed, setRailCollapsed] = React.useState<boolean>(() => {
    try { return localStorage.getItem('cp:graph:rail-collapsed:v1') === '1'; } catch { return false; }
  });
  const [typeFiltersExpanded, setTypeFiltersExpanded] = React.useState(false);
  const [filterDetailsOpen, setFilterDetailsOpen] = React.useState(false);
  React.useEffect(() => {
    try { localStorage.setItem('cp:graph:rail-collapsed:v1', railCollapsed ? '1' : '0'); } catch {}
  }, [railCollapsed]);

  // The map opens on compiled understanding. Evidence is an explicit deeper view.
  const [activeEpistemicFilters, setActiveEpistemicFilters] = React.useState<Set<GraphEpistemic>>(
    new Set(CURRENT_TRUTH_EPISTEMIC),
  );
  const allEpistemicActive = activeEpistemicFilters.size === ALL_GRAPH_EPISTEMIC.length;
  const knowledgeView = graphKnowledgeView(activeEpistemicFilters, displayOptions.showDerivedAssociations);

  function selectKnowledgeView(view: GraphKnowledgeView) {
    setActiveEpistemicFilters(new Set(view === 'current' ? CURRENT_TRUTH_EPISTEMIC : ALL_GRAPH_EPISTEMIC));
    setDisplayOptions(options => ({ ...options, showDerivedAssociations: view === 'evidence' }));
    setShowOnlyOrphans(false);
  }

  function toggleEpistemicFilter(
    epistemic: GraphEpistemic,
    group: readonly GraphEpistemic[],
    emptyFallback: readonly GraphEpistemic[],
  ) {
    setActiveEpistemicFilters(active => toggleGraphEpistemicFacet(active, epistemic, group, emptyFallback));
    setDisplayOptions(options => ({ ...options, showDerivedAssociations: false }));
    setShowOnlyOrphans(false);
  }

  // View mode — flat SVG canvas or the 3D Orbit view.
  const [viewMode, setViewMode] = React.useState<'2d' | 'orbit'>('2d');
  // Imperative zoom handle into the Orbit camera (see GraphOrbitHandle).
  const orbitRef = React.useRef<{ zoomBy: (factor: number) => void; fitToView: () => void } | null>(null);
  const orbitCameraViewRef = React.useRef<OrbitCameraView | null>(null);

  // Time playback has two explicit axes: represented-world validity and the
  // time Pod recorded the memory. Artifact edits remain separate metadata.
  const [timeCursor, setTimeCursor] = React.useState(100);
  const [timePlaying, setTimePlaying] = React.useState(false);
  const [timeAxis, setTimeAxis] = React.useState<'valid' | 'recorded'>('valid');

  function nodeExistsAt(node: GraphNode, cutoff: number): boolean {
    if (timeAxis === 'recorded') {
      const recorded = Date.parse(node.recorded_at ?? node.created_at ?? '');
      return !Number.isFinite(recorded) || recorded <= cutoff;
    }
    const intervals = node.valid_intervals?.length
      ? node.valid_intervals
      : [{ from: node.valid_at ?? node.created_at ?? '', to: node.invalid_at ?? null }];
    return intervals.some(interval => {
      const from = Date.parse(interval.from);
      const to = interval.to ? Date.parse(interval.to) : Infinity;
      return (!Number.isFinite(from) || from <= cutoff)
        && (!Number.isFinite(to) || cutoff < to);
    });
  }

  // Time domain follows the selected axis. Validity answers "true then";
  // recorded time answers "known by then".
  // NOTE: declared before filteredNodes, which reads timeCutoff.
  const timeDomain = React.useMemo(() => {
    let min = Infinity, max = -Infinity;
    for (const n of nodes) {
      if (n.role !== 'node') continue;
      const start = timeAxis === 'valid'
        ? n.valid_at ?? n.created_at
        : n.recorded_at ?? n.created_at;
      if (!start) continue;
      const t = Date.parse(start);
      if (!Number.isFinite(t)) continue;
      if (t < min) min = t;
      if (t > max) max = t;
    }
    return min < max ? { min, max } : null;
  }, [nodes, timeAxis]);

  const timeCutoff = timeDomain
    ? timeDomain.min + (timeDomain.max - timeDomain.min) * (timeCursor / 100)
    : null;

  // Playback: sweep the cursor forward, then stop at "now".
  React.useEffect(() => {
    if (!timePlaying) return;
    const handle = window.setInterval(() => {
      setTimeCursor(c => {
        if (c >= 100) { setTimePlaying(false); return 100; }
        return Math.min(100, c + 2);
      });
    }, 120);
    return () => window.clearInterval(handle);
  }, [timePlaying]);

  // Right-click context menu
  const [contextMenu, setContextMenu] = React.useState<{ x: number; y: number; nodeId: string } | null>(null);

  // Phase C — Ask Pod conversation (in-memory thread, scoped to this map session).
  interface AskMessage {
    id: string;
    role: 'user' | 'pod';
    text: string;
    pending?: boolean;
    error?: string;
    citations?: AskPodResult['citations'];
    provider?: string;
    model?: string;
  }
  const [askThread, setAskThread] = React.useState<AskMessage[]>([]);
  const [askInput, setAskInput] = React.useState('');
  const [askSending, setAskSending] = React.useState(false);
  // Cited node id currently being hovered in the answer (pulses on the canvas).
  const [highlightedCitationNodeId, setHighlightedCitationNodeId] = React.useState<string | null>(null);

  // Phase E — Trace path (ordered waypoints).
  const [tracedPath, setTracedPath] = React.useState<string[]>([]);

  // Phase F — Manual link creation (shift-drag preview line).
  const [pendingLink, setPendingLink] = React.useState<{ sourceId: string; toX: number; toY: number } | null>(null);
  const [linkEditor, setLinkEditor] = React.useState<{ sourceId: string; targetId: string; x: number; y: number } | null>(null);

  // H8 — cluster collapse
  const [collapsedClusters, setCollapsedClusters] = React.useState<Set<string>>(new Set());

  // Ref so the lens-apply effect can read the current node list without re-firing on drags.
  const nodesRef = React.useRef(nodes);
  nodesRef.current = nodes;

  function applyLensSettings(lens: Lens) {
    const s = lens.settings;
    setLayoutMode(s.layout);
    setColorMode(s.color);
    setSizeMode(s.size);
    setShowOnlyDocs(s.docsOnly);
    setDisplayOptions(options => ({ ...options, showDerivedAssociations: s.showDerivedAssociations }));
    // Auto-collapse: collapse clusters with ≥ N members (reads current nodes via ref).
    if (s.autoCollapseAbove > 0) {
      const groups = new Map<string, number>();
      for (const n of nodesRef.current) {
        if (n.role === 'node' && n.cluster) {
          groups.set(n.cluster, (groups.get(n.cluster) ?? 0) + 1);
        }
      }
      const next = new Set<string>();
      for (const [k, count] of groups) {
        if (count >= s.autoCollapseAbove) next.add(k);
      }
      setCollapsedClusters(next);
    } else {
      setCollapsedClusters(new Set());
    }
  }

  // Apply lens settings whenever the active lens changes.
  React.useEffect(() => {
    applyLensSettings(activeLens);
  }, [activeLensId]);  // eslint-disable-line react-hooks/exhaustive-deps

  // H2 — local-graph focus mode
  const [focusNodeId, setFocusNodeId] = React.useState<string | null>(null);
  const [focusDepth, setFocusDepth] = React.useState(1);

  // Docs-only filter — restricts the graph to nodes whose underlying object is a viewable doc.
  const [showOnlyDocs, setShowOnlyDocs] = React.useState(false);
  // Maintenance shortcut — isolates memories with no relationships at all.
  const [showOnlyOrphans, setShowOnlyOrphans] = React.useState(false);

  const lensEdited = lensSettingsEdited(activeLens.settings, {
    layout: layoutMode,
    color: colorMode,
    size: sizeMode,
    docsOnly: showOnlyDocs,
    showDerivedAssociations: displayOptions.showDerivedAssociations,
  });

  function resetGraphDisplay() {
    setDisplayOptions(options => ({
      ...DEFAULT_GRAPH_DISPLAY_OPTIONS,
      showOrphans: options.showOrphans,
      showDerivedAssociations: options.showDerivedAssociations,
    }));
  }

  // Cached layouts so we can swap between hub-spoke and force layouts without recomputing.
  const originalLayoutRef = React.useRef<Record<string, { x: number; y: number }>>({});
  const forceLayoutRef = React.useRef<Record<string, { x: number; y: number }> | null>(null);
  const forceRunIdRef = React.useRef(0);
  const [forceLayoutRunning, setForceLayoutRunning] = React.useState(false);

  // Analytics intentionally considers only asserted relations and owner annotations.
  // Structural membership and inferred similarity do not establish semantic influence.
  const analyticsEdges = React.useMemo(
    () => edges.filter(edge => edge.layer === 'canonical' || edge.layer === 'annotation'),
    [edges],
  );
  const analyticsNodes = React.useMemo(
    () => selectConnectedAnalyticsNodes(
      nodes.filter(node => node.role !== 'cluster' && node.role !== 'relationship'),
      analyticsEdges,
    ),
    [nodes, analyticsEdges],
  );
  const analyticsTopology = graphTopologyKey(analyticsNodes, analyticsEdges);

  // The dependency is a topology-only key, so node drags and force-layout position
  // updates cannot retrigger Louvain or betweenness.
  React.useEffect(() => {
    if (analyticsNodes.length === 0) {
      setCommunities({});
      setBetweenness({});
      setGapDefinitions([]);
      return;
    }
    setAnalyticsLoading(true);
    const worker = new Worker(new URL('./graph-analytics.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<{ ok: true; analysis: TopologyAnalysis } | { ok: false; error: string }>) => {
      if (event.data.ok) {
        setCommunities(event.data.analysis.communities);
        setBetweenness(event.data.analysis.betweenness);
        setGapDefinitions(event.data.analysis.gaps);
      } else {
        console.warn('Analytics failed:', event.data.error);
        setCommunities({});
        setBetweenness({});
        setGapDefinitions([]);
      }
      setAnalyticsLoading(false);
      worker.terminate();
    };
    worker.onerror = (event) => {
      console.warn('Analytics failed:', event.message);
      setCommunities({});
      setBetweenness({});
      setGapDefinitions([]);
      setAnalyticsLoading(false);
      worker.terminate();
    };
    worker.postMessage({ nodes: analyticsNodes, edges: analyticsEdges });
    return () => worker.terminate();
    // analyticsNodes/analyticsEdges are current whenever their topology key changes;
    // omitting their position-only identities is the point of this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyticsTopology]);

  const layoutEdges = React.useMemo(
    () => edges.filter(edge => edge.layer !== 'derived' || displayOptions.showDerivedAssociations),
    [edges, displayOptions.showDerivedAssociations],
  );
  const layoutTopology = graphTopologyKey(nodes, layoutEdges);

  // Force sliders or semantic topology changes invalidate the cached layout.
  React.useEffect(() => {
    forceLayoutRef.current = null;
  }, [
    displayOptions.forceGravity,
    displayOptions.forcePreventOverlap,
    displayOptions.forceRepel,
    displayOptions.forceSeparateClusters,
    displayOptions.nodeScale,
    betweenness,
    layoutTopology,
    sizeMode,
  ]);

  // H1 — switch layout mode (hub-spoke ↔ force).
  React.useEffect(() => {
    const runId = ++forceRunIdRef.current;
    if (nodes.length === 0) {
      setForceLayoutRunning(false);
      return;
    }
    if (layoutMode === 'force') {
      const cached = forceLayoutRef.current;
      if (cached) {
        setNodes(prev => prev.map(n => cached[n.id] ? { ...n, x: cached[n.id].x, y: cached[n.id].y } : n));
        setForceLayoutRunning(false);
        return;
      }

      setForceLayoutRunning(true);
      let worker: Worker | null = null;
      // Debounce slider input; the actual layout stays off the UI thread.
      const handle = window.setTimeout(() => {
        worker = new Worker(new URL('./graph-layout.worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (event: MessageEvent<ForceLayoutResponse>) => {
          if (runId !== forceRunIdRef.current) return;
          if (event.data.ok) {
            const positions = event.data.positions;
            forceLayoutRef.current = positions;
            setNodes(prev => prev.map(n => positions[n.id]
              ? { ...n, x: positions[n.id].x, y: positions[n.id].y }
              : n));
          } else {
            console.warn('Force layout failed:', event.data.error);
          }
          setForceLayoutRunning(false);
          worker?.terminate();
        };
        worker.onerror = (event) => {
          if (runId === forceRunIdRef.current) {
            console.warn('Force layout failed:', event.message);
            setForceLayoutRunning(false);
          }
          worker?.terminate();
        };
        worker.postMessage({
          nodes: nodes.map(node => {
            const base = node.role === 'cluster' ? 8 : 2.8;
            const influenceScale = sizeMode === 'betweenness' && node.role === 'node'
              ? Math.min(3, 1 + (betweenness[node.id] ?? 0) * 8)
              : 1;
            return {
              id: node.id,
              x: node.x,
              y: node.y,
              size: base * influenceScale * displayOptions.nodeScale,
            };
          }),
          edges: layoutEdges,
          iterations: 220,
          force: {
            repel: displayOptions.forceRepel,
            gravity: displayOptions.forceGravity,
            preventOverlap: displayOptions.forcePreventOverlap,
            separateClusters: displayOptions.forceSeparateClusters,
          },
        });
      }, 180);
      return () => {
        window.clearTimeout(handle);
        worker?.terminate();
      };
    } else {
      setForceLayoutRunning(false);
      // hub-spoke — restore from original layout, then re-apply user drags.
      const orig = originalLayoutRef.current;
      const drags = savedPositionsRef.current;
      setNodes(prev => prev.map(n => {
        const base = orig[n.id];
        if (!base) return n;
        const final = drags[n.id] ?? base;
        return { ...n, x: final.x, y: final.y };
      }));
    }
  }, [
    layoutMode,
    layoutTopology,
    displayOptions.forceRepel,
    displayOptions.forceGravity,
    displayOptions.forcePreventOverlap,
    displayOptions.forceSeparateClusters,
    displayOptions.nodeScale,
    betweenness,
    sizeMode,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch real graph data from Pod API
  React.useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    let timedOut = false;
    (async () => {
      let timeoutId: number | undefined;
      try {
        setGraphLoading(true);
        setGraphError(null);
        setEdgeMutationError(null);
        // Large pods (the WW2 demo corpus is ~3k objects) need well past the old
        // 3s budget. A timeout is now shown honestly and can be retried.
        timeoutId = window.setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, 20000);
        const res = await fetch(graphRequestUrl(focusNodeId
          ? {
              view: 'neighborhood',
              root: focusNodeId,
              depth: focusDepth,
            }
          : { view: graphProjectionMode }), {
          headers: props.authToken ? { authorization: `Bearer ${props.authToken}` } : {},
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Graph request failed (${res.status})`);
        const data = await res.json() as ApiGraphResponse;
        if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
          throw new Error('Graph response was missing nodes or edges');
        }

        if (cancelled) return;
        setGraphMeta(data.meta ?? {});

        if (data.nodes.length === 0) {
          setNodes([]);
          setEdges([]);
          setGraphError('No knowledge data yet. Import documents or observe activity to build the graph.');
          return;
        }

        const laid = layoutGraphData(data.nodes, data.edges);
        // Cache the canonical hub-spoke positions so we can return to them after a force layout.
        const orig: Record<string, { x: number; y: number }> = {};
        for (const n of laid.nodes) orig[n.id] = { x: n.x, y: n.y };
        originalLayoutRef.current = orig;
        forceLayoutRef.current = null; // invalidate cached force layout when data changes
        // Q5: apply saved drag positions
        const saved = savedPositionsRef.current;
        const positioned = laid.nodes.map(n => saved[n.id] ? { ...n, x: saved[n.id].x, y: saved[n.id].y } : n);
        setNodes(positioned);
        setEdges(laid.edges);
        setGraphError(null);

        // Auto-fit: compute bounding box and set zoom/pan to show all nodes
        requestAnimationFrame(() => {
          const svg = svgRef.current;
          if (!svg || positioned.length === 0) return;
          const rect = svg.getBoundingClientRect();
          const pad = 60;
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const n of positioned) { minX = Math.min(minX, n.x); minY = Math.min(minY, n.y); maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y); }
          const graphW = maxX - minX || 1;
          const graphH = maxY - minY || 1;
          const fitZoom = Math.min((rect.width - pad * 2) / graphW, (rect.height - pad * 2) / graphH, 1);
          const fitX = (rect.width - graphW * fitZoom) / 2 - minX * fitZoom;
          const fitY = (rect.height - graphH * fitZoom) / 2 - minY * fitZoom;
          fitZoomRef.current = fitZoom;
          setZoom(fitZoom);
          setPan({ x: fitX, y: fitY });
        });
      } catch (err) {
        if (!cancelled) {
          setNodes([]);
          setEdges([]);
          setGraphMeta({});
          const message = timedOut
            ? 'The knowledge graph request timed out.'
            : err instanceof Error ? err.message : String(err);
          setGraphError(message);
        }
      } finally {
        if (timeoutId !== undefined) window.clearTimeout(timeoutId);
        if (!cancelled) setGraphLoading(false);
      }
    })();
    return () => { cancelled = true; controller.abort(); };
  }, [props.authToken, graphRetryKey, graphProjectionMode, focusDepth, focusNodeId]);

  async function createAnnotationEdge(
    source: string,
    target: string,
    payload: { label?: string; relation?: string; direction?: 'one-way' | 'two-way'; note?: string },
  ): Promise<void> {
    const res = await fetch('/pod/graph/edges', {
      method: 'POST',
      headers: { ...authHeaders(props.authToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source,
        target,
        label: payload.label,
        relation: payload.relation,
        direction: payload.direction === 'two-way' ? 'undirected' : 'directed',
        note: payload.note,
      }),
    });
    if (!res.ok) throw new Error(`Could not save link (${res.status})`);
    const data = await res.json() as { edge?: ApiGraphEdge };
    if (!data.edge) throw new Error('The server did not return the saved link');
    const edge = normalizeGraphEdge(data.edge);
    if (edge.layer !== 'annotation') throw new Error('The server returned an invalid annotation link');
    setEdges(previous => [...previous.filter(item => item.id !== edge.id), edge]);
    setEdgeMutationError(null);
  }

  async function deleteAnnotationEdge(edge: GraphEdge): Promise<void> {
    if (edge.layer !== 'annotation' || deletingEdgeId) return;
    setDeletingEdgeId(edge.id);
    setEdgeMutationError(null);
    try {
      const res = await fetch(`/pod/graph/edges/${encodeURIComponent(edge.id)}`, {
        method: 'DELETE',
        headers: authHeaders(props.authToken),
      });
      if (!res.ok) throw new Error(`Could not delete link (${res.status})`);
      setEdges(previous => previous.filter(item => item.id !== edge.id));
    } catch (error) {
      setEdgeMutationError(error instanceof Error ? error.message : String(error));
    } finally {
      setDeletingEdgeId(null);
    }
  }
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const [connectionsExpanded, setConnectionsExpanded] = React.useState(false);
  const [dragging, setDragging] = React.useState<{ id: string; offsetX: number; offsetY: number; originX: number; originY: number } | null>(null);
  const [pan, setPan] = React.useState({ x: 20, y: 30 });
  const [zoom, setZoom] = React.useState(0.36);
  const viewportRef = React.useRef({ pan, zoom });
  const preFocusViewportRef = React.useRef<{
    pan: { x: number; y: number };
    zoom: number;
    fitZoom: number;
  } | null>(null);
  const pendingViewportRef = React.useRef<{ pan: { x: number; y: number }; zoom: number } | null>(null);
  const viewportFrameRef = React.useRef<number | null>(null);
  const viewportCommitTimerRef = React.useRef<number | null>(null);
  const [isPanning, setIsPanning] = React.useState(false);
  const [panStart, setPanStart] = React.useState({ x: 0, y: 0, px: 0, py: 0 });
  const minimapRef = React.useRef<SVGSVGElement>(null);
  const minimapCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const [minimapDragging, setMinimapDragging] = React.useState(false);
  const [canvasSize, setCanvasSize] = React.useState({ width: 800, height: 500 });
  const ALL_TYPES = Object.keys(NODE_COLORS) as NodeType[];
  const [activeTypeFilters, setActiveTypeFilters] = React.useState<Set<NodeType>>(new Set(ALL_TYPES));
  const allTypesActive = activeTypeFilters.size === ALL_TYPES.length;

  function paintViewport(next: { pan: { x: number; y: number }; zoom: number }) {
    canvasPaintRef.current(next);
    sceneRef.current?.setAttribute('transform', `translate(${next.pan.x},${next.pan.y}) scale(${next.zoom})`);
    svgRef.current?.style.setProperty('--graph-inverse-zoom', String(1 / next.zoom));
  }

  function renderViewport(next: { pan: { x: number; y: number }; zoom: number }) {
    viewportRef.current = next;
    pendingViewportRef.current = next;
    if (viewportFrameRef.current != null) return;
    viewportFrameRef.current = window.requestAnimationFrame(() => {
      viewportFrameRef.current = null;
      const pending = pendingViewportRef.current;
      pendingViewportRef.current = null;
      if (pending) paintViewport(pending);
    });
  }

  function commitViewport(next = viewportRef.current) {
    viewportRef.current = next;
    pendingViewportRef.current = null;
    if (viewportFrameRef.current != null) {
      window.cancelAnimationFrame(viewportFrameRef.current);
      viewportFrameRef.current = null;
    }
    paintViewport(next);
    setPan(next.pan);
    setZoom(next.zoom);
  }

  function scheduleViewportCommit() {
    if (viewportCommitTimerRef.current != null) window.clearTimeout(viewportCommitTimerRef.current);
    viewportCommitTimerRef.current = window.setTimeout(() => {
      viewportCommitTimerRef.current = null;
      commitViewport();
    }, 120);
  }

  React.useLayoutEffect(() => {
    const next = { pan, zoom };
    viewportRef.current = next;
    paintViewport(next);
  }, [pan, zoom, graphLoading, viewMode]);

  React.useEffect(() => () => {
    if (viewportFrameRef.current != null) window.cancelAnimationFrame(viewportFrameRef.current);
    if (viewportCommitTimerRef.current != null) window.clearTimeout(viewportCommitTimerRef.current);
  }, []);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const update = () => setCanvasSize({ width: canvas.clientWidth || 800, height: canvas.clientHeight || 500 });
    const observer = new ResizeObserver(update);
    observer.observe(canvas);
    update();
    return () => observer.disconnect();
  }, [graphLoading]);

  function toggleTypeFilter(type: NodeType) {
    setActiveTypeFilters(prev => {
      const next = new Set(prev);
      if (allTypesActive) {
        // If all are active, clicking one means "show only this one"
        return new Set([type]);
      }
      if (next.has(type)) {
        next.delete(type);
        // If none would remain, reset to all
        if (next.size === 0) return new Set(ALL_TYPES);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  const orphanNodeIds = React.useMemo(() => {
    const connectedNodeIds = new Set<string>();
    for (const edge of layoutEdges) {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    }
    return new Set(
      nodes
        .filter(node => node.role === 'node' && !connectedNodeIds.has(node.id))
        .map(node => node.id),
    );
  }, [layoutEdges, nodes]);

  const facetFilteredNodes = React.useMemo(() => {
    // First pass: non-relationship nodes that match the type filter
    const typeFiltered = new Set(
      nodes.filter(n => n.role !== 'relationship' && activeTypeFilters.has(n.type)).map(n => n.id)
    );
    // Second pass: include relationship nodes only if both connected nodes are visible
    let result = nodes.filter(n => {
      if (n.role === 'relationship') {
        const connEdges = layoutEdges.filter(e => e.source === n.id || e.target === n.id);
        return connEdges.some(e => typeFiltered.has(e.source) || typeFiltered.has(e.target));
      }
      return activeTypeFilters.has(n.type);
    });
    // Time playback — validity and recording are distinct axes.
    if (timeCutoff != null) {
      result = result.filter(n => {
        if (n.role !== 'node') return true;
        return nodeExistsAt(n, timeCutoff);
      });
    }
    // Trust facet — unasserted Pod objects remain explicitly unclassified.
    if (!allEpistemicActive) {
      result = result.filter(n =>
        n.role === 'cluster' || n.role === 'relationship' || activeEpistemicFilters.has(n.epistemic)
      );
    }
    // "Docs only" filter — keep cluster hubs (so the layout doesn't shatter) but restrict
    // leaf nodes to those backed by a doc-kind Pod object.
    if (showOnlyDocs) {
      result = result.filter(n => {
        if (n.role === 'cluster' || n.role === 'relationship') return true;
        return isDocNode(n);
      });
    }
    // H8: hide spoke members of collapsed clusters. Focus temporarily opens the
    // neighbourhood so a collapsed collection cannot produce an empty local graph.
    if (collapsedClusters.size > 0 && !focusNodeId) {
      result = result.filter(n => {
        if (n.role === 'cluster') return true;
        if (n.role === 'relationship') return true;
        return !(n.cluster && collapsedClusters.has(n.cluster));
      });
    }
    // Maintenance view isolates true graph orphans; display preferences can otherwise
    // hide nodes that merely have no currently-visible relationships.
    if (showOnlyOrphans) {
      result = result.filter(n => n.role === 'node' && orphanNodeIds.has(n.id));
    } else if (!displayOptions.showOrphans) {
      const visibleIds = new Set(result.map(n => n.id));
      const degreeMap = new Map<string, number>();
      for (const e of layoutEdges) {
        if (visibleIds.has(e.source) && visibleIds.has(e.target)) {
          degreeMap.set(e.source, (degreeMap.get(e.source) ?? 0) + 1);
          degreeMap.set(e.target, (degreeMap.get(e.target) ?? 0) + 1);
        }
      }
      result = result.filter(n => n.role === 'cluster' || n.role === 'relationship' || (degreeMap.get(n.id) ?? 0) > 0);
    }
    return result;
  }, [nodes, layoutEdges, activeTypeFilters, activeEpistemicFilters, allEpistemicActive, timeCutoff, displayOptions.showOrphans, collapsedClusters, focusNodeId, orphanNodeIds, showOnlyDocs, showOnlyOrphans]);
  const filteredNodes = React.useMemo(() => {
    if (!focusNodeId) return facetFilteredNodes;
    const eligibleIds = new Set(facetFilteredNodes.map(node => node.id));
    const neighbourhood = graphNeighborhoodIds(focusNodeId, focusDepth, layoutEdges, eligibleIds);
    return facetFilteredNodes.filter(node => neighbourhood.has(node.id));
  }, [facetFilteredNodes, focusDepth, focusNodeId, layoutEdges]);
  const filteredNodeIds = React.useMemo(() => new Set(filteredNodes.map(n => n.id)), [filteredNodes]);
  const filteredNodeById = React.useMemo(() => new Map(filteredNodes.map(n => [n.id, n])), [filteredNodes]);
  const filteredNodesRef = React.useRef(filteredNodes);
  filteredNodesRef.current = filteredNodes;
  const filteredEdges = React.useMemo(() =>
    layoutEdges.filter(e => {
      if (!filteredNodeIds.has(e.source) || !filteredNodeIds.has(e.target)) return false;
      if (timeAxis === 'valid' && timeCutoff != null && e.valid_at) {
        const from = Date.parse(e.valid_at);
        const to = e.invalid_at ? Date.parse(e.invalid_at) : Infinity;
        if (Number.isFinite(from) && from > timeCutoff) return false;
        if (Number.isFinite(to) && timeCutoff >= to) return false;
      }
      return true;
    }),
    [layoutEdges, filteredNodeIds, timeAxis, timeCutoff]
  );

  React.useEffect(() => {
    if (!focusNodeId || viewMode !== '2d' || filteredNodes.length === 0) return;
    const frame = window.requestAnimationFrame(() => fitNodesToView(filteredNodes, true));
    return () => window.cancelAnimationFrame(frame);
  }, [filteredNodes, focusDepth, focusNodeId, rightPane, viewMode]);

  // A node hidden by a facet cannot remain an invisible selection or focus target.
  React.useEffect(() => {
    if (selectedId && !filteredNodeIds.has(selectedId)) {
      setSelectedId(null);
      setRightPane(pane => pane === 'detail' ? null : pane);
    }
    if (focusNodeId && !filteredNodeIds.has(focusNodeId)) exitFocus();
    setSelectedNodeIds(previous => {
      const visible = new Set([...previous].filter(id => filteredNodeIds.has(id)));
      return visible.size === previous.size ? previous : visible;
    });
  }, [filteredNodeIds, focusNodeId, selectedId]);

  // Live facet counts for the filter rail — filters that report their own weight get used.
  const typeCounts = React.useMemo(() => countGraphNodeTypes(nodes), [nodes]);
  const knowledgeNodeCount = (['decision', 'person', 'project', 'organisation', 'concept', 'tool', 'agent', 'preference', 'entity'] as const)
    .reduce((total, type) => total + (typeCounts.get(type) ?? 0), 0);
  const sourceRecordCount = typeCounts.get('artifact') ?? 0;

  const epistemicCounts = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const n of nodes) {
      if (n.role !== 'node') continue;
      const ep = n.epistemic;
      m.set(ep, (m.get(ep) ?? 0) + 1);
    }
    return m;
  }, [nodes]);

  const edgeLayerCounts = React.useMemo(() => {
    const counts = new Map<GraphEdge['layer'], number>();
    for (const edge of edges) counts.set(edge.layer, (counts.get(edge.layer) ?? 0) + 1);
    return counts;
  }, [edges]);

  const attentionFacetMode = [...activeEpistemicFilters]
    .every(epistemic => ATTENTION_EPISTEMIC.includes(epistemic));
  const totalGraphNodeCount = nodes.filter(node => node.role !== 'relationship').length;
  const visibleGraphNodeCount = filteredNodes.filter(node => node.role !== 'relationship').length;
  const selectedSecondaryFocusTypes = allTypesActive
    ? []
    : FOCUS_NODE_TYPES.filter(type => !PRIMARY_FOCUS_NODE_TYPES.includes(type) && activeTypeFilters.has(type));
  const visibleFocusTypes = typeFiltersExpanded
    ? FOCUS_NODE_TYPES
    : [...PRIMARY_FOCUS_NODE_TYPES, ...selectedSecondaryFocusTypes];

  function toggleOrphansOnly() {
    if (showOnlyOrphans) {
      selectKnowledgeView('current');
      return;
    }
    setShowOnlyOrphans(true);
    setActiveEpistemicFilters(new Set(ALL_GRAPH_EPISTEMIC));
    setDisplayOptions(options => ({ ...options, showOrphans: true }));
  }

  function resetGraphFilters() {
    setActiveTypeFilters(new Set(ALL_TYPES));
    setActiveEpistemicFilters(new Set(CURRENT_TRUTH_EPISTEMIC));
    setShowOnlyDocs(false);
    setShowOnlyOrphans(false);
    setDisplayOptions(options => ({
      ...options,
      showOrphans: true,
      showDerivedAssociations: false,
    }));
  }

  // Orbit view data — facets and lenses alter presentation without mutating graph semantics.
  const orbitData = React.useMemo(() => {
    const degree = new Map<string, number>();
    for (const e of filteredEdges) {
      degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
      degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
    }
    const bridgeNodeIds = new Set<string>();
    const crossCommunityEdgeIds = new Set<string>();
    for (const edge of filteredEdges) {
      if (edge.layer !== 'canonical' && edge.layer !== 'annotation') continue;
      const sourceCommunity = communities[edge.source];
      const targetCommunity = communities[edge.target];
      if (sourceCommunity == null || targetCommunity == null || sourceCommunity === targetCommunity) continue;
      bridgeNodeIds.add(edge.source);
      bridgeNodeIds.add(edge.target);
      crossCommunityEdgeIds.add(edge.id);
    }
    const orbitNodes = filteredNodes
      .filter(n => n.role !== 'relationship')
      .map(n => ({
        id: n.id,
        label: n.label,
        type: n.type,
        epistemic: n.epistemic,
        degree: degree.get(n.id) ?? 0,
        isHub: n.role === 'cluster',
        cluster: n.cluster,
        community: communities[n.id],
        influence: betweenness[n.id] ?? 0,
        isBridge: bridgeNodeIds.has(n.id),
      }))
      .sort((a, b) => {
        if (activeLensId === 'influence') return b.influence - a.influence || Number(b.isHub) - Number(a.isHub) || b.degree - a.degree || a.id.localeCompare(b.id);
        if (activeLensId === 'bridges') return Number(b.isBridge) - Number(a.isBridge) || b.influence - a.influence || Number(b.isHub) - Number(a.isHub) || a.id.localeCompare(b.id);
        if (activeLensId === 'themes') return Number(b.community != null) - Number(a.community != null) || Number(b.isHub) - Number(a.isHub) || b.degree - a.degree || a.id.localeCompare(b.id);
        return Number(b.isHub) - Number(a.isHub) || b.degree - a.degree || a.id.localeCompare(b.id);
      })
      .map((node, rank) => ({ ...node, rank }));
    const ids = new Set(orbitNodes.map(n => n.id));
    const orbitLinks = filteredEdges
      .filter(e => ids.has(e.source) && ids.has(e.target))
      .map(e => ({
        source: e.source,
        target: e.target,
        layer: e.layer,
        crossCommunity: crossCommunityEdgeIds.has(e.id),
        emphasis: Math.max(betweenness[e.source] ?? 0, betweenness[e.target] ?? 0),
      }));
    return { nodes: orbitNodes, links: orbitLinks };
  }, [filteredNodes, filteredEdges, communities, betweenness, activeLensId]);

  const connectedToActive = React.useMemo(() => {
    const activeId = hoveredId || selectedId;
    if (!activeId) return new Set<string>();
    const ids = new Set<string>();
    ids.add(activeId);
    // Walk 2 hops for hub nodes, 1 hop for others
    const isHub = filteredNodeById.get(activeId)?.role === 'cluster';
    for (const e of filteredEdges) {
      if (e.source === activeId) ids.add(e.target);
      if (e.target === activeId) ids.add(e.source);
    }
    if (isHub) {
      const firstHop = new Set(ids);
      for (const e of filteredEdges) {
        if (firstHop.has(e.source)) ids.add(e.target);
        if (firstHop.has(e.target)) ids.add(e.source);
      }
    }
    return ids;
  }, [hoveredId, selectedId, filteredNodeById, filteredEdges]);

  const connectedEdges = React.useMemo(() => {
    const activeId = hoveredId || selectedId;
    if (!activeId) return new Set<string>();
    const edgeIds = new Set<string>();
    for (const e of filteredEdges) {
      if (connectedToActive.has(e.source) && connectedToActive.has(e.target)) {
        edgeIds.add(e.id);
      }
    }
    return edgeIds;
  }, [hoveredId, selectedId, filteredEdges, connectedToActive]);

  const labelZoomRatio = Math.max(
    1,
    (zoom / Math.max(0.05, fitZoomRef.current)) * displayOptions.labelDensity,
  );
  const visibleLabelIds = React.useMemo(() => selectVisibleGraphLabelIds(
    filteredNodes.filter(node => node.role !== 'relationship'),
    {
      width: canvasSize.width,
      height: canvasSize.height,
      pan,
      zoom,
      zoomRatio: labelZoomRatio,
      selectedId,
      hoveredId,
      connectedIds: connectedToActive,
      importance: betweenness,
    },
  ), [filteredNodes, canvasSize, pan, zoom, labelZoomRatio, selectedId, hoveredId, connectedToActive, betweenness]);

  // Refs for drag state so window event listeners always see current values
  const draggingRef = React.useRef(dragging);
  draggingRef.current = dragging;
  const isPanningRef = React.useRef(isPanning);
  isPanningRef.current = isPanning;
  const panStartRef = React.useRef(panStart);
  panStartRef.current = panStart;
  const pendingLinkRef = React.useRef(pendingLink);
  pendingLinkRef.current = pendingLink;

  function nodeAtClientPoint(clientX: number, clientY: number): GraphNode | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    return hitTestGraphNode(
      filteredNodesRef.current,
      { x: clientX - rect.left, y: clientY - rect.top },
      viewportRef.current,
      node => Math.max(7, renderedNodeRadius(node) + 3),
    );
  }

  function handleMouseDown(e: React.MouseEvent, nodeId: string) {
    e.stopPropagation();
    handleNodeMouseLeave();
    // Phase E — shift-click adds the node to the traced path (no drag, no select toggle).
    if (e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
      setTracedPath(prev => (prev[prev.length - 1] === nodeId ? prev : [...prev, nodeId]));
      return;
    }
    // Multi-select with cmd / ctrl
    if (e.metaKey || e.ctrlKey) {
      setSelectedId(nodeId);
      setSelectedNodeIds(prev => {
        const next = new Set(prev);
        if (next.has(nodeId)) next.delete(nodeId);
        else next.add(nodeId);
        return next;
      });
      return;
    }
    // Phase F — alt-drag starts a manual link from this node
    if (e.altKey) {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const viewport = viewportRef.current;
      const mx = (e.clientX - rect.left - viewport.pan.x) / viewport.zoom;
      const my = (e.clientY - rect.top - viewport.pan.y) / viewport.zoom;
      setPendingLink({ sourceId: nodeId, toX: mx, toY: my });
      return;
    }
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const node = nodes.find(n => n.id === nodeId)!;
    const viewport = viewportRef.current;
    const mx = (e.clientX - rect.left - viewport.pan.x) / viewport.zoom;
    const my = (e.clientY - rect.top - viewport.pan.y) / viewport.zoom;
    setDragging({ id: nodeId, offsetX: mx - node.x, offsetY: my - node.y, originX: node.x, originY: node.y });
    setSelectedId(nodeId);
    // Clicking a node opens its pane; remember if the user came from the Ask thread.
    cameFromAskRef.current = rightPane === 'ask';
    setRightPane('detail');
  }

  function handleCanvasMouseDown(e: React.MouseEvent) {
    if ((e.target as Element).closest?.('.graph-gap-marker')) return;
    handleNodeMouseLeave();
    const node = nodeAtClientPoint(e.clientX, e.clientY);
    if (node) {
      handleMouseDown(e, node.id);
      return;
    }
    if (e.target === svgRef.current || (e.target as Element).tagName === 'rect') {
      const viewport = viewportRef.current;
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY, px: viewport.pan.x, py: viewport.pan.y });
      setSelectedId(null);
      setSelectedNodeIds(new Set());
      // Empty-canvas click returns the space to the graph (or to Ask, if that's where the user was).
      setRightPane(p => (p === 'detail' ? (cameFromAskRef.current ? 'ask' : null) : p));
      cameFromAskRef.current = false;
    }
  }

  // Use window-level listeners for drag/pan so we don't lose events when cursor leaves the SVG
  React.useEffect(() => {
    function onMove(e: MouseEvent) {
      const d = draggingRef.current;
      const pl = pendingLinkRef.current;
      if (d) {
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const viewport = viewportRef.current;
        const mx = (e.clientX - rect.left - viewport.pan.x) / viewport.zoom;
        const my = (e.clientY - rect.top - viewport.pan.y) / viewport.zoom;
        setNodes(prev => prev.map(n => n.id === d.id ? { ...n, x: mx - d.offsetX, y: my - d.offsetY } : n));
      } else if (pl) {
        // Phase F — update pending-link preview to follow the cursor
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const viewport = viewportRef.current;
        const mx = (e.clientX - rect.left - viewport.pan.x) / viewport.zoom;
        const my = (e.clientY - rect.top - viewport.pan.y) / viewport.zoom;
        setPendingLink({ sourceId: pl.sourceId, toX: mx, toY: my });
      } else if (isPanningRef.current) {
        const ps = panStartRef.current;
        renderViewport({
          pan: { x: ps.px + (e.clientX - ps.x), y: ps.py + (e.clientY - ps.y) },
          zoom: viewportRef.current.zoom,
        });
      }
    }
    function onUp(e: MouseEvent) {
      const d = draggingRef.current;
      const pl = pendingLinkRef.current;
      if (d) {
        // Q5: persist new position to localStorage; do NOT snap back.
        setNodes(prev => {
          const node = prev.find(n => n.id === d.id);
          if (node) persistPosition(d.id, node.x, node.y);
          return prev;
        });
      }
      if (pl) {
        // Phase F — find a node under the cursor; open the editor if drop target found.
        const targetId = nodeAtClientPoint(e.clientX, e.clientY)?.id ?? null;
        if (targetId && targetId !== pl.sourceId) {
          setLinkEditor({ sourceId: pl.sourceId, targetId, x: e.clientX, y: e.clientY });
        }
        setPendingLink(null);
      }
      if (isPanningRef.current) commitViewport();
      setDragging(null);
      setIsPanning(false);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    handleNodeMouseLeave();
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    const viewport = viewportRef.current;
    const newZoom = Math.max(0.15, Math.min(5, viewport.zoom * delta));
    // Zoom toward cursor
    renderViewport({
      pan: {
        x: mx - (mx - viewport.pan.x) * (newZoom / viewport.zoom),
        y: my - (my - viewport.pan.y) * (newZoom / viewport.zoom),
      },
      zoom: newZoom,
    });
    scheduleViewportCommit();
  }

  function zoom2dBy(factor: number) {
    const viewport = viewportRef.current;
    const newZoom = Math.max(0.15, Math.min(5, viewport.zoom * factor));
    const mx = canvasSize.width / 2;
    const my = canvasSize.height / 2;
    commitViewport({
      pan: {
        x: mx - (mx - viewport.pan.x) * (newZoom / viewport.zoom),
        y: my - (my - viewport.pan.y) * (newZoom / viewport.zoom),
      },
      zoom: newZoom,
    });
  }

  function fitNodesToView(targetNodes: GraphNode[], focus = false) {
    const svg = svgRef.current;
    if (!svg || targetNodes.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const rightInset = focus && rightPane && rect.width >= 720 ? 344 : 0;
    const next = fitGraphNodesToViewport(targetNodes, rect.width, rect.height, {
      padding: focus ? 72 : 60,
      rightInset,
      maxZoom: focus ? 1.4 : 1,
    });
    if (!next) return;
    fitZoomRef.current = next.zoom;
    commitViewport(next);
  }

  // Auto-fit the graph into the viewport
  function fitToView() {
    fitNodesToView(filteredNodes);
  }

  // Pinch-zoom + prevent browser zoom on graph surface
  const lastPinchDistRef = React.useRef<number | null>(null);
  const lastPinchCenterRef = React.useRef<{ x: number; y: number } | null>(null);
  React.useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    function getTouchDist(e: TouchEvent) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }
    function getTouchCenter(e: TouchEvent) {
      return { x: (e.touches[0].clientX + e.touches[1].clientX) / 2, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 };
    }
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        lastPinchDistRef.current = getTouchDist(e);
        lastPinchCenterRef.current = getTouchCenter(e);
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && lastPinchDistRef.current != null) {
        e.preventDefault();
        const newDist = getTouchDist(e);
        const center = getTouchCenter(e);
        const rect = svg.getBoundingClientRect();
        const mx = center.x - rect.left;
        const my = center.y - rect.top;
        const scale = newDist / lastPinchDistRef.current;
        const viewport = viewportRef.current;
        const z = viewport.zoom;
        const newZoom = Math.max(0.05, Math.min(5, z * scale));
        renderViewport({
          pan: {
            x: mx - (mx - viewport.pan.x) * (newZoom / z),
            y: my - (my - viewport.pan.y) * (newZoom / z),
          },
          zoom: newZoom,
        });
        lastPinchDistRef.current = newDist;
        lastPinchCenterRef.current = center;
      }
    };
    const onTouchEnd = () => {
      if (lastPinchDistRef.current != null) commitViewport();
      lastPinchDistRef.current = null;
      lastPinchCenterRef.current = null;
    };
    // Also intercept ctrl+wheel (trackpad pinch on macOS) to prevent browser zoom
    const onWheel = (e: WheelEvent) => { if (e.ctrlKey) e.preventDefault(); };
    svg.addEventListener('touchstart', onTouchStart, { passive: false });
    svg.addEventListener('touchmove', onTouchMove, { passive: false });
    svg.addEventListener('touchend', onTouchEnd);
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      svg.removeEventListener('touchstart', onTouchStart);
      svg.removeEventListener('touchmove', onTouchMove);
      svg.removeEventListener('touchend', onTouchEnd);
      svg.removeEventListener('wheel', onWheel);
    };
  }, []);

  function selectAndCenter(nodeId: string) {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    setSelectedId(nodeId);
    setConnectionsExpanded(false);
    setRightPane('detail');
    panToGraphPoint(node.x, node.y);
  }

  const selectedGraphNodes = React.useMemo(
    () => nodes.filter(node => selectedNodeIds.has(node.id) && node.role !== 'relationship'),
    [nodes, selectedNodeIds],
  );

  const selectedGraphEdges = React.useMemo(() => {
    if (selectedNodeIds.size < 2) return [] as GraphEdge[];
    return layoutEdges.filter(edge => selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target));
  }, [layoutEdges, selectedNodeIds]);

  function askAboutSelection() {
    if (selectedGraphNodes.length === 0) return;
    const objectIds = selectedGraphNodes.map(objectIdFromNode).filter((id): id is string => Boolean(id));
    const entityIds = selectedGraphNodes.filter(node => node.id.startsWith('sw:')).map(node => node.id.slice(3));
    const labels = selectedGraphNodes.map(node => node.label);
    props.onAskPodContext?.({
      title: 'Map selection',
      subtitle: `${selectedGraphNodes.length} node${selectedGraphNodes.length === 1 ? '' : 's'} · ${selectedGraphEdges.length} link${selectedGraphEdges.length === 1 ? '' : 's'}`,
      chips: labels,
      payload: {
        kind: 'map_selection',
        node_ids: selectedGraphNodes.map(node => node.id),
        object_ids: objectIds,
        entity_ids: entityIds,
        labels,
        edges: selectedGraphEdges.map(edge => ({ id: edge.id, source: edge.source, target: edge.target, label: edge.label, layer: edge.layer })),
      },
    });
  }

  // H8: cluster collapse helpers
  function clusterMemberCount(groupKey: string): number {
    return nodes.filter(n => n.cluster === groupKey && n.role === 'node').length;
  }

  function toggleClusterCollapse(groupKey: string) {
    setCollapsedClusters(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }

  function collapseLargeClusters(threshold = 20) {
    const groups = new Map<string, number>();
    for (const n of nodes) {
      if (n.role === 'node' && n.cluster) {
        groups.set(n.cluster, (groups.get(n.cluster) ?? 0) + 1);
      }
    }
    const next = new Set<string>();
    for (const [k, count] of groups) {
      if (count >= threshold) next.add(k);
    }
    setCollapsedClusters(next);
  }

  // H2: local-graph focus helpers
  function focusOnNode(nodeId: string) {
    if (!focusNodeId) {
      preFocusViewportRef.current = {
        pan: { ...viewportRef.current.pan },
        zoom: viewportRef.current.zoom,
        fitZoom: fitZoomRef.current,
      };
    }
    setFocusDepth(1);
    setFocusNodeId(nodeId);
  }
  function exitFocus() {
    const previous = preFocusViewportRef.current;
    preFocusViewportRef.current = null;
    setFocusNodeId(null);
    if (previous) {
      fitZoomRef.current = previous.fitZoom;
      if (viewMode === '2d') {
        window.requestAnimationFrame(() => commitViewport({ pan: previous.pan, zoom: previous.zoom }));
      }
    }
  }

  // H4: top-5 influential nodes (by betweenness) for the sidebar
  const topInfluential = React.useMemo(() => {
    if (Object.keys(betweenness).length === 0) return [];
    return topByMetric(betweenness, 5)
      .map(({ id, score }) => ({ node: nodes.find(n => n.id === id), score }))
      .filter(x => x.node && x.node.role !== 'cluster' && x.node.role !== 'relationship') as Array<{ node: GraphNode; score: number }>;
  }, [betweenness, nodes]);

  // Phase C — Ask Pod helpers
  function buildAskScope(): AskPodScope {
    const visibleNodes = filteredNodes
      .filter(n => n.role !== 'relationship')
      .map(n => ({ id: n.id, label: n.label, type: n.type }));
    const visibleEdges = filteredEdges.map(e => ({
      id: e.id, source: e.source, target: e.target, label: e.label, layer: e.layer,
    }));
    const selectedNode = selectedId
      ? (() => {
          const n = nodes.find(x => x.id === selectedId);
          return n ? { id: n.id, label: n.label, type: n.type } : undefined;
        })()
      : undefined;
    const focus = focusNodeId
      ? (() => {
          const n = nodes.find(x => x.id === focusNodeId);
          return n ? { node: { id: n.id, label: n.label, type: n.type }, depth: focusDepth } : undefined;
        })()
      : undefined;
    const trace = tracedPath.length >= 2
      ? tracedPath.map(id => {
          const n = nodes.find(x => x.id === id);
          return n ? { id: n.id, label: n.label, type: n.type } : null;
        }).filter(Boolean) as Array<{ id: string; label: string; type: string }>
      : undefined;
    const influential = topInfluential.length > 0
      ? topInfluential.map(t => t.node.label)
      : undefined;
    // Group communities by id and collect top-3 labels (by betweenness) for each
    const communityLabels = new Map<number, Array<{ label: string; score: number }>>();
    for (const n of nodes) {
      if (n.role === 'cluster' || n.role === 'relationship') continue;
      const cid = communities[n.id];
      if (cid == null) continue;
      const score = betweenness[n.id] ?? 0;
      const arr = communityLabels.get(cid) ?? [];
      arr.push({ label: n.label, score });
      communityLabels.set(cid, arr);
    }
    const communitiesSummary: AskPodScope['communities'] = [];
    for (const [id, arr] of communityLabels) {
      arr.sort((a, b) => b.score - a.score);
      communitiesSummary.push({ id, topLabels: arr.slice(0, 3).map(x => x.label) });
    }
    return {
      visibleNodes,
      visibleEdges,
      selectedNode,
      focus,
      trace,
      influential,
      communities: communitiesSummary.length > 0 ? communitiesSummary : undefined,
      lensId: activeLensId,
    };
  }

  async function sendAsk(queryRaw: string) {
    const query = queryRaw.trim();
    if (!query || askSending) return;
    const userMsgId = `u-${Date.now()}`;
    const podMsgId = `p-${Date.now()}`;
    setAskThread(prev => [
      ...prev,
      { id: userMsgId, role: 'user', text: query },
      { id: podMsgId, role: 'pod', text: '', pending: true },
    ]);
    setAskInput('');
    setAskSending(true);
    try {
      const scope = buildAskScope();
      const history = askThread
        .filter(message => !message.pending && message.text.trim())
        .slice(-8)
        .map(message => ({
          role: message.role === 'pod' ? 'assistant' as const : 'user' as const,
          content: message.text.slice(0, 1200),
        }));
      const result = await askPod({
        query,
        actorId: props.ownerActorId,
        history,
        scope,
        authToken: props.authToken,
      });
      setAskThread(prev => prev.map(m => m.id === podMsgId ? {
        ...m,
        text: result.answer || 'I don\'t have enough in Pod to answer that yet. Try asking about a specific memory in this map.',
        pending: false,
        citations: result.citations,
        provider: result.provider,
        model: result.model,
      } : m));
    } catch {
      setAskThread(prev => prev.map(m => m.id === podMsgId ? {
        ...m,
        text: '',
        pending: false,
        error: 'I couldn\'t reach Pod just now. Try again in a moment.',
      } : m));
    } finally {
      setAskSending(false);
    }
  }

  // Suggested prompts re-derive from the current scope
  const askSuggestedPrompts = React.useMemo(
    () => suggestedPromptsForScope(buildAskScope()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedId, focusNodeId, focusDepth, tracedPath.length, activeLensId, communities, betweenness.length]
  );

  // Q3: highlight immediately, but require settled pointer intent before showing a large card.
  const hoveredNodeRef = React.useRef<string | null>(null);

  function handleNodeMouseEnter(clientX: number, clientY: number, nodeId: string) {
    const next = updateGraphHoverIntent(hoverIntentRef.current, { nodeId, x: clientX, y: clientY });
    hoverIntentRef.current = next.intent;
    if (hoveredNodeRef.current !== nodeId) {
      hoveredNodeRef.current = nodeId;
      setHoveredId(nodeId);
    }
    if (!next.restartTimer) return;
    if (hoverTimerRef.current !== null) window.clearTimeout(hoverTimerRef.current);
    setHoverCard(null);
    const intent = next.intent!;
    hoverTimerRef.current = window.setTimeout(() => {
      hoverTimerRef.current = null;
      if (hoverIntentRef.current !== intent) return;
      setHoverCard({ id: intent.nodeId, clientX: intent.anchorX, clientY: intent.anchorY });
    }, GRAPH_HOVER_CARD_DELAY_MS);
  }

  function handleNodeMouseLeave() {
    if (hoveredNodeRef.current === null && hoverTimerRef.current === null && hoverIntentRef.current === null) return;
    hoveredNodeRef.current = null;
    hoverIntentRef.current = null;
    setHoveredId(null);
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setHoverCard(null);
  }

  function handleCanvasMouseMove(e: React.MouseEvent) {
    if (draggingRef.current || isPanningRef.current || pendingLinkRef.current) {
      handleNodeMouseLeave();
      return;
    }
    const node = nodeAtClientPoint(e.clientX, e.clientY);
    if (node) handleNodeMouseEnter(e.clientX, e.clientY, node.id);
    else handleNodeMouseLeave();
  }

  function handleCanvasDoubleClick(e: React.MouseEvent) {
    const node = nodeAtClientPoint(e.clientX, e.clientY);
    if (!node) return;
    e.preventDefault();
    e.stopPropagation();
    if (node.role === 'cluster' && node.cluster) toggleClusterCollapse(node.cluster);
    else emitOpen(node);
  }

  function handleCanvasContextMenu(e: React.MouseEvent) {
    const node = nodeAtClientPoint(e.clientX, e.clientY);
    if (!node) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(node.id);
    setContextMenu({ x: e.clientX, y: e.clientY, nodeId: node.id });
  }

  const activeId = hoveredId || selectedId;
  const dimmed = !!activeId;

  // Expanded nodes retain their larger hit targets; labels are selected separately in screen space.
  const expandedMode = zoom >= displayOptions.expandedThreshold;

  // H3: unique communities present in the graph, in stable order
  const uniqueCommunities = React.useMemo(() => {
    const set = new Set<number>();
    for (const v of Object.values(communities)) set.add(v);
    return [...set].sort((a, b) => a - b);
  }, [communities]);

  const lensEvidence = React.useMemo<Record<LensId, string>>(() => {
    const connected = Object.keys(communities).length;
    const ranked = Object.values(betweenness).filter(score => score > 0).length;
    let crossThemeLinks = 0;
    for (const edge of filteredEdges) {
      if (edge.layer !== 'canonical' && edge.layer !== 'annotation') continue;
      const source = communities[edge.source];
      const target = communities[edge.target];
      if (source != null && target != null && source !== target) crossThemeLinks += 1;
    }
    const documents = nodes.filter(node => node.role === 'node' && isDocNode(node)).length;
    const analyticStatus = (value: string) => analyticsLoading ? 'Analysing asserted links…' : value;
    return {
      default: `${filteredNodes.filter(node => node.role !== 'relationship').length.toLocaleString()} memories visible`,
      themes: analyticStatus(uniqueCommunities.length > 0 ? `${uniqueCommunities.length} themes · ${connected} connected` : 'No asserted themes yet'),
      influence: analyticStatus(ranked > 0 ? `${ranked} bridging memories ranked` : 'No bridging memories yet'),
      bridges: analyticStatus(crossThemeLinks > 0 ? `${crossThemeLinks} cross-theme links` : 'No cross-theme links yet'),
      docs: `${documents.toLocaleString()} openable documents`,
    };
  }, [analyticsLoading, betweenness, communities, filteredEdges, filteredNodes, nodes, uniqueCommunities]);

  // H2 — active local graph. Filtering already removed everything outside it;
  // this set also drives focused edge styling and labels.
  const focusReachable = React.useMemo(() => {
    if (!focusNodeId) return null as Set<string> | null;
    return new Set(filteredNodes.map(node => node.id));
  }, [filteredNodes, focusNodeId]);

  const focusDepthCounts = React.useMemo(() => {
    if (!focusNodeId) return [0, 0, 0];
    const eligibleIds = new Set(facetFilteredNodes.map(node => node.id));
    return [1, 2, 3].map(depth => {
      const ids = graphNeighborhoodIds(focusNodeId, depth, layoutEdges, eligibleIds);
      return facetFilteredNodes.filter(node => node.role !== 'relationship' && ids.has(node.id)).length;
    });
  }, [facetFilteredNodes, focusNodeId, layoutEdges]);

  // Per-node fill / stroke — flat colors, no gradients (Obsidian-style restraint).
  // When local-graph focus is active and this node is OUTSIDE the focused neighbourhood,
  // it collapses to a muted gray with no type color (Obsidian's local-graph pattern).
  function nodePalette(node: GraphNode): { fill: string; stroke: string; isMuted?: boolean } {
    if (focusReachable && !focusReachable.has(node.id)) {
      return { fill: MUTED_NODE_FILL, stroke: MUTED_NODE_FILL, isMuted: true };
    }
    if (node.role === 'cluster') {
      return { fill: '#B6C0CD', stroke: '#D6DCE5' };
    }
    if (colorMode === 'community' && node.role !== 'relationship') {
      return communities[node.id] != null
        ? communityColors(communities[node.id])
        : { fill: '#94A3B8', stroke: '#CBD5E1' };
    }
    const tp = NODE_COLORS[node.type] ?? NODE_COLORS.entity;
    return { fill: tp.fill, stroke: tp.stroke };
  }

  // H4: per-node radius scaled by betweenness when sizeMode === 'betweenness'
  function effectiveRadius(node: GraphNode, baseR: number): number {
    if (sizeMode !== 'betweenness') return baseR;
    if (node.role === 'cluster' || node.role === 'relationship') return baseR;
    const b = betweenness[node.id] ?? 0;
    return baseR * Math.min(3.0, 1 + b * 8);
  }

  function renderedNodeRadius(node: GraphNode): number {
    if (expandedMode && node.role !== 'relationship') {
      const base = node.role === 'cluster' ? 11 : 7;
      return Math.min(18, effectiveRadius(node, base)) * displayOptions.nodeScale;
    }
    if (node.role === 'cluster') {
      const count = node.cluster ? clusterMemberCount(node.cluster) : 0;
      return Math.max(4.5, Math.min(14, 4 + Math.sqrt(Math.max(1, count)) * 1.2)) * displayOptions.nodeScale;
    }
    const radius = effectiveRadius(node, 2.8);
    return Math.max(2, Math.min(sizeMode === 'betweenness' ? 12 : 4, radius)) * displayOptions.nodeScale;
  }

  function trustRingDash(epistemic: GraphEpistemic): number[] | undefined {
    if (epistemic === 'inference') return [3, 2.2];
    if (epistemic === 'opinion') return [0.8, 2.4];
    if (epistemic === 'contested') return [2, 1];
    if (epistemic === 'mixed') return [5, 1, 1, 1];
    if (epistemic === 'unclassified') return [1, 2];
    return undefined;
  }

  function draw2dCanvas(next: { pan: { x: number; y: number }; zoom: number }) {
    const canvas = graphCanvasRef.current;
    if (!canvas || viewMode !== '2d') return;
    drawGraphCanvas(canvas, {
      width: canvasSize.width,
      height: canvasSize.height,
      viewport: next,
      nodes: filteredNodes,
      edges: filteredEdges,
      nodeById: filteredNodeById,
      edgeVisual: (edge, source, target) => {
        const isActive = connectedEdges.has(edge.id);
        const inFocus = focusReachable
          ? focusReachable.has(source.id) && focusReachable.has(target.id)
          : false;
        const layer = EDGE_LAYER_STYLE[edge.layer];
        const opacity = focusReachable
          ? (inFocus ? (isActive ? 1 : layer.opacity) : 0.04)
          : dimmed ? (isActive ? 1 : 0.06) : layer.opacity;
        const dash = layer.dash ?? (edge.type === 'dashed' ? '4 3' : undefined);
        return {
          stroke: isActive ? layer.activeStroke : layer.stroke,
          width: (isActive ? Math.max(1.4, layer.width * 1.5) : layer.width) * displayOptions.linkScale,
          opacity: Math.min(1, opacity * displayOptions.linkOpacity),
          dash: dash?.split(' ').map(Number),
          arrow: displayOptions.showArrows && edge.direction !== 'undirected' && edge.layer !== 'structural',
        };
      },
      nodeVisual: (node) => {
        const palette = nodePalette(node);
        const radius = renderedNodeRadius(node);
        const isSelected = selectedId === node.id;
        const isHovered = hoveredId === node.id;
        const isMultiSelected = selectedNodeIds.has(node.id);
        const isConnected = connectedToActive.has(node.id);
        const isMuted = Boolean(focusReachable && !focusReachable.has(node.id));
        const opacity = dimmed ? (isConnected ? 1 : 0.06) : 1;
        const recent = Boolean(node.created_at && (Date.now() - Date.parse(node.created_at)) < 7 * 24 * 3600 * 1000);
        const ringRadius = expandedMode && node.role !== 'relationship' ? radius + 2 : radius + 1.6;
        const coreRadius = expandedMode && node.role !== 'relationship' ? Math.max(2, radius - 1.5) : Math.max(1.6, radius - 1);
        const active = isSelected || isHovered || highlightedCitationNodeId === node.id;
        return {
          radius: coreRadius,
          fill: isMuted ? MUTED_NODE_FILL : palette.fill,
          opacity: isMuted ? opacity * 0.6 : opacity * 0.95,
          halo: active ? {
            radius: radius * 2.35,
            fill: (NODE_COLORS[node.type] ?? NODE_COLORS.entity).glow,
            opacity: isSelected ? 0.7 : 0.45,
          } : undefined,
          ring: isMuted ? undefined : {
            radius: ringRadius,
            stroke: isSelected ? 'rgba(255,255,255,0.95)' : isMultiSelected ? 'rgba(254,0,107,0.95)' : palette.stroke,
            width: isSelected || isMultiSelected ? 1.4 : 0.8,
            dash: displayOptions.showTrustRings && node.role === 'node' ? trustRingDash(node.epistemic) : undefined,
          },
          pulse: !isMuted && recent ? {
            radius: radius + 4,
            stroke: 'rgba(92,236,198,0.5)',
            opacity: 0.35,
          } : undefined,
        };
      },
    });
  }

  canvasPaintRef.current = draw2dCanvas;
  React.useLayoutEffect(() => {
    if (viewMode === '2d') paintViewport(viewportRef.current);
  });

  // Phase D — Bridges lens: position topology-derived gap markers between the
  // current community centroids. Dragging only updates these cheap coordinates.
  const gapMarkers = React.useMemo(() => {
    if (!activeLens.settings.showGapMarkers || gapDefinitions.length === 0) return [] as Array<{
      a: { cx: number; cy: number; topLabels: string[]; communityId: number };
      b: { cx: number; cy: number; topLabels: string[]; communityId: number };
      weakness: number;
    }>;
    // Compute centroid + top-betweenness labels for each community.
    const centroids = new Map<number, { sumX: number; sumY: number; count: number }>();
    const topLabelsByCommunity = new Map<number, Array<{ label: string; score: number }>>();
    for (const n of nodes) {
      if (n.role !== 'node') continue;
      const cid = communities[n.id];
      if (cid == null) continue;
      const c = centroids.get(cid) ?? { sumX: 0, sumY: 0, count: 0 };
      c.sumX += n.x; c.sumY += n.y; c.count += 1;
      centroids.set(cid, c);
      const arr = topLabelsByCommunity.get(cid) ?? [];
      arr.push({ label: n.label, score: betweenness[n.id] ?? 0 });
      topLabelsByCommunity.set(cid, arr);
    }
    const out: Array<{
      a: { cx: number; cy: number; topLabels: string[]; communityId: number };
      b: { cx: number; cy: number; topLabels: string[]; communityId: number };
      weakness: number;
    }> = [];
    for (const gap of gapDefinitions.slice(0, 6)) {
      const ca = centroids.get(gap.a);
      const cb = centroids.get(gap.b);
      if (!ca || !cb || ca.count === 0 || cb.count === 0) continue;
      const labA = (topLabelsByCommunity.get(gap.a) ?? []).sort((x, y) => y.score - x.score).slice(0, 3).map(x => x.label);
      const labB = (topLabelsByCommunity.get(gap.b) ?? []).sort((x, y) => y.score - x.score).slice(0, 3).map(x => x.label);
      out.push({
        a: { cx: ca.sumX / ca.count, cy: ca.sumY / ca.count, topLabels: labA, communityId: gap.a },
        b: { cx: cb.sumX / cb.count, cy: cb.sumY / cb.count, topLabels: labB, communityId: gap.b },
        weakness: gap.weakness,
      });
    }
    return out;
  }, [activeLens.settings.showGapMarkers, gapDefinitions, communities, nodes, betweenness]);

  // Phase D — click a gap marker → seed Ask input with a bridge prompt, open rail
  function askAboutGap(g: typeof gapMarkers[number]) {
    const a = g.a.topLabels.join(', ') || `cluster ${g.a.communityId}`;
    const b = g.b.topLabels.join(', ') || `cluster ${g.b.communityId}`;
    const prompt = `What might connect ${a} with ${b}? Both clusters appear in my memory but don't reference each other.`;
    setAskInput(prompt);
    setRightPane('ask');
  }

  // Q1: typeahead matches for the toolbar search box
  const searchMatches = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [] as GraphNode[];
    return filteredNodes
      .filter(n => n.role !== 'relationship' && n.label.toLowerCase().includes(q))
      .slice(0, 8);
  }, [searchQuery, filteredNodes]);

  function handleSearchSubmit() {
    if (searchMatches.length > 0) {
      selectAndCenter(searchMatches[0].id);
      setSearchOpen(false);
    }
  }

  // Minimap bounds
  const graphBounds = React.useMemo(() => {
    if (nodes.length === 0) return { minX: -40, minY: -40, maxX: 40, maxY: 40 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of nodes) {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x);
      maxY = Math.max(maxY, node.y);
    }
    return { minX: minX - 40, minY: minY - 40, maxX: maxX + 40, maxY: maxY + 40 };
  }, [nodes]);
  const { minX, minY, maxX, maxY } = graphBounds;
  const gw = maxX - minX || 1;
  const gh = maxY - minY || 1;

  // ── Minimap viewport rect ──
  // Compute visible area in graph-space from pan/zoom and canvas size
  const canvasW = canvasSize.width;
  const canvasH = canvasSize.height;
  const vpX = -pan.x / zoom;
  const vpY = -pan.y / zoom;
  const vpW = canvasW / zoom;
  const vpH = canvasH / zoom;
  const sourceErrors = (graphMeta.source_errors ?? []).map(sourceErrorMessage);

  React.useLayoutEffect(() => {
    const canvas = minimapCanvasRef.current;
    if (!canvas || viewMode !== '2d') return;
    drawGraphMinimap(canvas, {
      width: canvas.clientWidth || 160,
      height: canvas.clientHeight || 110,
      bounds: graphBounds,
      nodes: filteredNodes,
      edges: filteredEdges,
      nodeById: filteredNodeById,
      nodeColor: node => nodePalette(node).fill,
    });
  }, [viewMode, graphBounds, filteredNodes, filteredEdges, filteredNodeById, colorMode, communities, focusReachable]);

  // ── Minimap interaction ──
  function minimapToGraph(e: React.MouseEvent): { gx: number; gy: number } | null {
    const svg = minimapRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const scale = Math.min(rect.width / gw, rect.height / gh);
    const offsetX = (rect.width - gw * scale) / 2;
    const offsetY = (rect.height - gh * scale) / 2;
    const gx = minX + Math.max(0, Math.min(gw, (e.clientX - rect.left - offsetX) / scale));
    const gy = minY + Math.max(0, Math.min(gh, (e.clientY - rect.top - offsetY) / scale));
    return { gx, gy };
  }

  function panToGraphPoint(gx: number, gy: number, commit = true) {
    const viewport = viewportRef.current;
    const next = {
      pan: {
        x: canvasSize.width / 2 - gx * viewport.zoom,
        y: canvasSize.height / 2 - gy * viewport.zoom,
      },
      zoom: viewport.zoom,
    };
    if (commit) commitViewport(next);
    else renderViewport(next);
  }

  function handleMinimapMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setMinimapDragging(true);
    const pt = minimapToGraph(e);
    if (pt) panToGraphPoint(pt.gx, pt.gy, false);
  }

  React.useEffect(() => {
    if (!minimapDragging) return;
    function onMove(e: MouseEvent) {
      const svg = minimapRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scale = Math.min(rect.width / gw, rect.height / gh);
      const offsetX = (rect.width - gw * scale) / 2;
      const offsetY = (rect.height - gh * scale) / 2;
      const gx = minX + Math.max(0, Math.min(gw, (e.clientX - rect.left - offsetX) / scale));
      const gy = minY + Math.max(0, Math.min(gh, (e.clientY - rect.top - offsetY) / scale));
      panToGraphPoint(gx, gy, false);
    }
    function onUp() { commitViewport(); setMinimapDragging(false); }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [minimapDragging, minX, minY, gw, gh, canvasSize]);

  const memoryHeaderAskPod = props.memoryHeaderActionsTarget && props.active !== false
    ? createPortal(
        <button
          className={`graph-ask-trigger memories-header-ask${rightPane === 'ask' ? ' active' : ''}`}
          onClick={() => {
            cameFromAskRef.current = false;
            setRightPane(p => (p === 'ask' ? (selectedId ? 'detail' : null) : 'ask'));
          }}
          title="Ask Pod about your map"
        >
          <SparklesIcon size={13} />
          <span>Ask Pod</span>
        </button>,
        props.memoryHeaderActionsTarget,
      )
    : null;

  const memoryModeToolbar = props.memoryViewMode ? (
    <div className="graph-toolbar memories-content-toolbar">
      <div className="graph-toolbar-left">
        <div className="graph-toolbar-title"><h2>Map</h2></div>
      </div>
      <div className="memories-toolbar-mode">{props.memoryViewMode}</div>
      <div className="graph-toolbar-right" />
    </div>
  ) : null;

  if (graphLoading) {
    return (
      <div className="graph-view">
        {memoryHeaderAskPod}
        {memoryModeToolbar}
        <div className="graph-state">
          <div className="graph-loading">
            <div className="graph-loading-orb" aria-hidden="true">
              <span className="gl-core" />
              <span className="gl-orbit gl-orbit-a"><i /></span>
              <span className="gl-orbit gl-orbit-b"><i /></span>
              <span className="gl-orbit gl-orbit-c"><i /></span>
            </div>
            <div className="graph-loading-text">Mapping your memories…</div>
            <div className="graph-loading-sub">Large pods can take a few seconds</div>
          </div>
        </div>
      </div>
    );
  }

  if (graphError || nodes.length === 0) {
    return (
      <div className="graph-view">
        {memoryHeaderAskPod}
        {memoryModeToolbar}
        <div className="graph-state">
          <div style={{ textAlign: 'center', color: 'var(--fg-3)', maxWidth: 320 }}>
            <Network size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
            <div>{graphError || 'No knowledge data yet.'}</div>
            <button className="graph-retry-button" onClick={() => setGraphRetryKey(key => key + 1)}>
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="graph-view">
      {memoryHeaderAskPod}
      <div className={`graph-toolbar${props.memoryViewMode ? ' memories-content-toolbar' : ''}`}>
        <div className="graph-toolbar-left">
          <div className="graph-toolbar-title">
            <h2>Map</h2>
            <span className="graph-node-count">{filteredNodes.filter(n => n.role !== 'relationship').length} · {filteredEdges.length}</span>
          </div>
        </div>

        {props.memoryViewMode && <div className="memories-toolbar-mode">{props.memoryViewMode}</div>}

        <div className="graph-toolbar-right">
          {/* View mode — flat canvas vs stable 3D Orbit */}
          <div className="graph-view-mode" role="group" aria-label="View mode">
            <button
              className={`graph-view-mode-btn${viewMode === '2d' ? ' active' : ''}`}
              onClick={() => setViewMode('2d')}
              title="Flat canvas"
            >
              2D
            </button>
            <button
              className={`graph-view-mode-btn${viewMode === 'orbit' ? ' active' : ''}`}
              onClick={() => setViewMode('orbit')}
              title="Navigate a 3D knowledge sphere"
            >
              Orbit
            </button>
          </div>

          {/* Lens menu — replaces Layout / Colour / Size / Influential toggle buttons */}
          <div className="graph-lens-trigger-wrap">
            <button
              className={`graph-lens-trigger${lensMenuOpen ? ' open' : ''}`}
              onClick={() => setLensMenuOpen(o => !o)}
              title={`${activeLens.description} ${lensEvidence[activeLensId]}`}
            >
              <span className="graph-lens-dot" style={{ background: activeLens.accent }} />
              <span className="graph-lens-name">{activeLens.name}</span>
              {lensEdited && <span className="graph-lens-edited">Edited</span>}
              <ChevronDownIcon size={12} />
            </button>
            {lensMenuOpen && (
              <div className="graph-lens-menu" onMouseLeave={() => setLensMenuOpen(false)}>
                <div className="graph-lens-menu-label">View through a lens</div>
                {BUILTIN_LENSES.map(lens => (
                  <button
                    key={lens.id}
                    className={`graph-lens-option${lens.id === activeLensId ? ' active' : ''}`}
                    onClick={() => {
                      if (lens.id === activeLensId) applyLensSettings(lens);
                      else setActiveLensId(lens.id);
                      setLensMenuOpen(false);
                    }}
                  >
                    <span className="graph-lens-option-icon" style={{ color: lens.accent }}>
                      {lens.icon === 'Compass' ? <Compass size={14} /> :
                       lens.icon === 'Network' ? <Network size={14} /> :
                       lens.icon === 'TrendingUp' ? <TrendingUp size={14} /> :
                       lens.icon === 'GitMerge' ? <GitMerge size={14} /> :
                       lens.icon === 'BookOpen' ? <BookOpen size={14} /> :
                       <Compass size={14} />}
                    </span>
                    <span className="graph-lens-option-body">
                      <span className="graph-lens-option-name">{lens.name}</span>
                      <span className="graph-lens-option-desc">{lens.description}</span>
                      <span className="graph-lens-option-meta">{lensEvidence[lens.id]}</span>
                    </span>
                    {lens.id === activeLensId && <Check size={14} className="graph-lens-option-check" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Settings panel toggle */}
          <div className="graph-overflow-wrap">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => { setSettingsPanelOpen(o => !o); setLensMenuOpen(false); }}
              title="Settings"
            >
              <MoreVertical size={14} />
            </Button>
          </div>

          {searchExpanded ? (
            <div className="graph-command graph-command-expanded">
              <Search size={15} className="graph-command-icon" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search a node…"
                aria-label="Search map nodes"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => window.setTimeout(() => {
                  setSearchOpen(false);
                  if (!searchQuery.trim()) setSearchExpanded(false);
                }, 150)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearchSubmit();
                    if (searchMatches.length > 0) {
                      setSearchQuery('');
                      setSearchExpanded(false);
                    }
                  }
                  if (e.key === 'Escape') {
                    setSearchQuery('');
                    setSearchOpen(false);
                    setSearchExpanded(false);
                  }
                }}
              />
              {searchQuery && (
                <button
                  className="graph-search-clear"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setSearchQuery('');
                    setSearchOpen(false);
                    searchInputRef.current?.focus();
                  }}
                  aria-label="Clear"
                >
                  <X size={12} />
                </button>
              )}
              {searchOpen && searchMatches.length > 0 && (
                <div className="graph-search-results">
                  {searchMatches.map(n => (
                    <button
                      key={n.id}
                      className="graph-search-result"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectAndCenter(n.id);
                        setSearchQuery('');
                        setSearchOpen(false);
                        setSearchExpanded(false);
                      }}
                    >
                      <span className="legend-swatch" style={{ background: NODE_COLORS[n.type]?.fill ?? '#888' }} />
                      <span className="graph-search-result-label">{n.label}</span>
                      <span className="graph-search-result-type">{n.type}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button
              className="graph-search-toggle"
              onClick={() => setSearchExpanded(true)}
              aria-label="Search map nodes"
              aria-expanded={false}
              title="Search map nodes"
            >
              <Search size={15} />
            </button>
          )}
        </div>
      </div>

      {(graphMeta.truncated || sourceErrors.length > 0) && (
        <div className="graph-meta-warning" role="status" title={sourceErrors.join('\n')}>
          <AlertTriangle size={13} />
          <span>
            {graphMeta.truncated && graphMeta.projection_mode === 'overview'
              && `Representative overview: ${graphMeta.projected_node_count ?? graphMeta.object_count ?? 'some'} of ${graphMeta.available_node_count ?? graphMeta.object_total ?? 'all'} items. `}
            {graphMeta.truncated && graphMeta.projection_mode === 'complete'
              && `Expanded view: ${graphMeta.projected_node_count ?? graphMeta.object_count ?? 'some'} of ${graphMeta.available_node_count ?? graphMeta.object_total ?? 'all'} items (browser safety limit). `}
            {graphMeta.truncated && graphMeta.projection_mode === 'neighborhood'
              && `Showing the ${graphMeta.depth ?? focusDepth}-hop neighborhood around this memory. `}
            {sourceErrors.length > 0 && `Unavailable: ${sourceErrors.join(' · ')}`}
          </span>
          {graphMeta.projection_mode !== 'neighborhood' && graphMeta.truncated && (
            <button onClick={() => setGraphProjectionMode(mode => mode === 'overview' ? 'complete' : 'overview')}>
              {graphProjectionMode === 'overview' ? 'Show more' : 'Use overview'}
            </button>
          )}
          {sourceErrors.length > 0 && <button onClick={() => setGraphRetryKey(key => key + 1)}>Retry</button>}
        </div>
      )}

      <div className={`graph-canvas-wrap${rightPane ? ' with-right-rail' : ''}`} ref={canvasRef}>
        {edgeMutationError && (
          <div className="graph-edge-mutation-error" role="alert">
            <AlertCircle size={13} /> {edgeMutationError}
            <button onClick={() => setEdgeMutationError(null)} aria-label="Dismiss"><X size={12} /></button>
          </div>
        )}
        {viewMode === '2d' && (
        <canvas ref={graphCanvasRef} className="graph-render-canvas" aria-hidden="true" />
        )}
        {viewMode === '2d' && (
        <svg
          ref={svgRef}
          className="graph-svg"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={handleNodeMouseLeave}
          onDoubleClick={handleCanvasDoubleClick}
          onContextMenu={handleCanvasContextMenu}
          onWheel={handleWheel}
          style={{ cursor: dragging || isPanning ? 'grabbing' : hoveredId ? 'pointer' : 'grab' }}
        >
          <defs>
            {/* Subtle ambient glow only used on the selected node — kept tiny. */}
            {(Object.entries(NODE_COLORS) as Array<[NodeType, { fill: string; stroke: string; glow: string }]>).map(([type, colors]) => (
              <radialGradient key={`glow-${type}`} id={`node-glow-${type}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={colors.fill} stopOpacity="0.45" />
                <stop offset="100%" stopColor={colors.fill} stopOpacity="0" />
              </radialGradient>
            ))}
            <filter id="card-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="card-shadow" x="-10%" y="-10%" width="130%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000" floodOpacity="0.5" />
              <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#000" floodOpacity="0.3" />
            </filter>
            <filter id="card-shadow-hover" x="-15%" y="-15%" width="140%" height="150%">
              <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#000" floodOpacity="0.6" />
              <feDropShadow dx="0" dy="12" stdDeviation="18" floodColor="#000" floodOpacity="0.35" />
            </filter>
            {/* 3D sphere gradients — brighter center fading to darker edge */}
            {(Object.entries(NODE_COLORS) as Array<[NodeType, { fill: string; stroke: string; glow: string }]>).map(([type, colors]) => (
              <radialGradient key={`sphere-${type}`} id={`node-sphere-${type}`} cx="35%" cy="30%" r="65%" fx="35%" fy="30%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
                <stop offset="30%" stopColor={colors.fill} stopOpacity="1" />
                <stop offset="100%" stopColor={colors.fill} stopOpacity="0.6" />
              </radialGradient>
            ))}
            <filter id="node-soft-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
            </filter>
            {/* Q4: arrow marker for directed edges */}
            <marker id="graph-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(180,195,220,0.7)" />
            </marker>
            {/* Deep-space ground: vignette + two faint nebula washes give the canvas depth
                without competing with node color. */}
            <radialGradient id="graph-bg-deep" cx="50%" cy="42%" r="80%">
              <stop offset="0%" stopColor="#1D2536" />
              <stop offset="100%" stopColor="#0F141D" />
            </radialGradient>
            <radialGradient id="graph-nebula-a" cx="20%" cy="16%" r="55%">
              <stop offset="0%" stopColor="rgba(139, 92, 246, 0.10)" />
              <stop offset="100%" stopColor="rgba(139, 92, 246, 0)" />
            </radialGradient>
            <radialGradient id="graph-nebula-b" cx="82%" cy="86%" r="60%">
              <stop offset="0%" stopColor="rgba(56, 189, 248, 0.08)" />
              <stop offset="100%" stopColor="rgba(56, 189, 248, 0)" />
            </radialGradient>
          </defs>

          {/* Transparent interaction plane keeps pan, zoom and delegated canvas hit-testing active everywhere. */}
          <rect width="100%" height="100%" fill="transparent" pointerEvents="all" />

          <g ref={sceneRef}>
            {/* Phase D — gap markers (Bridges lens) — render under edges so nodes/edges paint on top */}
            {gapMarkers.map((gap, i) => {
              const midX = (gap.a.cx + gap.b.cx) / 2;
              const midY = (gap.a.cy + gap.b.cy) / 2;
              return (
                <g key={`gap-${i}`} className="graph-gap-marker" onClick={() => askAboutGap(gap)} style={{ cursor: 'pointer' }}>
                  <line
                    x1={gap.a.cx} y1={gap.a.cy}
                    x2={gap.b.cx} y2={gap.b.cy}
                    stroke="rgba(217, 176, 116, 0.32)"
                    strokeWidth={1.2}
                    strokeDasharray="6 6"
                  />
                  <circle cx={midX} cy={midY} r={8} fill="rgba(217, 176, 116, 0.10)" stroke="rgba(217, 176, 116, 0.55)" strokeWidth={1} />
                  <text x={midX} y={midY + 3} textAnchor="middle" className="graph-gap-bolt">⌁</text>
                </g>
              );
            })}

            {/* Phase E — traced-path overlay (renders behind nodes but above edges) */}
            {tracedPath.length >= 2 && (() => {
              const points = tracedPath
                .map(id => nodes.find(n => n.id === id))
                .filter((n): n is GraphNode => !!n);
              if (points.length < 2) return null;
              const pathD = points.reduce((acc, p, i) => acc + (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`), '');
              return (
                <g pointerEvents="none">
                  <path d={pathD} fill="none" stroke="rgba(220, 240, 235, 0.9)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  {points.map((p, i) => (
                    <circle key={`tp-${i}`} cx={p.x} cy={p.y} r={7} fill="none" stroke="rgba(220, 240, 235, 0.85)" strokeWidth={1.5} />
                  ))}
                </g>
              );
            })()}

            {/* Phase F — pending-link preview while shift-dragging from a node */}
            {pendingLink && (() => {
              const src = nodes.find(n => n.id === pendingLink.sourceId);
              if (!src) return null;
              return (
                <line
                  x1={src.x} y1={src.y}
                  x2={pendingLink.toX} y2={pendingLink.toY}
                  stroke="rgba(255,255,255,0.8)"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  pointerEvents="none"
                />
              );
            })()}

            {/* Canvas owns the complete node/edge field. SVG stays bounded to readable labels. */}
            {filteredNodes.filter(node => visibleLabelIds.has(node.id)).map((node) => {
              const pal = nodePalette(node);
              const isSelected = selectedId === node.id;
              const isMultiSelected = selectedNodeIds.has(node.id);
              const isHovered = hoveredId === node.id;
              const isConnected = connectedToActive.has(node.id);
              // Q7: tighter focus-mode dimming
              const opacity = dimmed ? (isConnected ? 1 : 0.06) : 1;
              const showGlow = isSelected || isHovered;

              if (expandedMode && node.role !== 'relationship') {
                /* ── Expanded mode: flat circle + label only when relevant. Obsidian-style restraint. ── */
                const er = renderedNodeRadius(node);
                const showLabel = visibleLabelIds.has(node.id);
                return (
                  <g
                    key={node.id}
                    opacity={opacity}
                    className={`graph-node-g${isSelected ? ' selected' : ''}${isMultiSelected ? ' multi-selected' : ''}${highlightedCitationNodeId === node.id ? ' citation-pulse' : ''}`}
                    data-node-id={node.id}
                    onMouseDown={(e) => handleMouseDown(e, node.id)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      if (node.role === 'cluster' && node.cluster) toggleClusterCollapse(node.cluster);
                      else emitOpen(node);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault(); e.stopPropagation();
                      setSelectedId(node.id);
                      setContextMenu({ x: e.clientX, y: e.clientY, nodeId: node.id });
                    }}
                    onMouseEnter={(e) => handleNodeMouseEnter(e.clientX, e.clientY, node.id)}
                    onMouseLeave={handleNodeMouseLeave}
                    style={{ cursor: dragging?.id === node.id ? 'grabbing' : 'pointer' }}
                  >
                    {/* Halo — active nodes only (minimal at rest, luminous on touch) */}
                    {(isSelected || isHovered) && (
                      <circle cx={node.x} cy={node.y} r={er * 2.1}
                        fill={(NODE_COLORS[node.type] ?? NODE_COLORS.entity).glow} opacity={isSelected ? 0.55 : 0.35}
                        filter="url(#node-soft-glow)" pointerEvents="none"
                      />
                    )}
                    {/* Core — flat minimal disc */}
                    <circle cx={node.x} cy={node.y} r={Math.max(2, er - 1.5)} fill={pal.fill} opacity={0.95} />
                    {/* Hairline ring — type-colored; the dash pattern carries the trust grammar */}
                    <circle cx={node.x} cy={node.y} r={er + 2}
                      className={displayOptions.showTrustRings && node.epistemic && node.role !== 'cluster' ? `graph-trust-ring-svg ${node.epistemic}` : 'graph-trust-ring-svg'}
                      fill="none"
                      style={{ stroke: isSelected ? 'rgba(255,255,255,0.95)' : pal.stroke, strokeWidth: isSelected ? 1.4 : undefined }}
                      pointerEvents="none"
                    />
                    {/* Label */}
                    {showLabel && (
                      <text
                        x={node.x + er + 7 / Math.max(zoom, 0.05)} y={node.y + 4 / Math.max(zoom, 0.05)}
                        textAnchor="start" className={`expanded-node-label ${showGlow ? 'label-active' : ''}`}
                      >
                        {graphLabelText(node.label, isSelected || isHovered)}
                      </text>
                    )}
                    {/* Collapsed-cluster count badge */}
                    {node.role === 'cluster' && node.cluster && collapsedClusters.has(node.cluster) && (
                      <text
                        x={node.x} y={node.y + 4}
                        textAnchor="middle" className="graph-collapsed-count"
                      >
                        {clusterMemberCount(node.cluster)}
                      </text>
                    )}
                  </g>
                );
              }

              /* ── Dot mode — flat circles, Obsidian-style ── */
              // Semantic sizing is shared with the canvas; nodeScale is a visual multiplier.
              const r = renderedNodeRadius(node);
              const isMuted = !!(focusReachable && !focusReachable.has(node.id));
              const showLabel = visibleLabelIds.has(node.id) && (!isMuted || isHovered || isSelected);
              return (
                <g
                  key={node.id}
                  opacity={opacity}
                  className={`graph-node-g${isSelected ? ' selected' : ''}${isMultiSelected ? ' multi-selected' : ''}${highlightedCitationNodeId === node.id ? ' citation-pulse' : ''}`}
                  data-node-id={node.id}
                  onMouseDown={(e) => handleMouseDown(e, node.id)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (node.role === 'cluster' && node.cluster) toggleClusterCollapse(node.cluster);
                    else emitOpen(node);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault(); e.stopPropagation();
                    setSelectedId(node.id);
                    setContextMenu({ x: e.clientX, y: e.clientY, nodeId: node.id });
                  }}
                  onMouseEnter={(e) => handleNodeMouseEnter(e.clientX, e.clientY, node.id)}
                  onMouseLeave={handleNodeMouseLeave}
                  style={{ cursor: dragging?.id === node.id ? 'grabbing' : 'pointer' }}
                >
                  {/* Halo — active nodes only; keeps 4k-node maps light */}
                  {(isSelected || isHovered) && (
                    <circle cx={node.x} cy={node.y} r={r * 2.4}
                      fill={(NODE_COLORS[node.type] ?? NODE_COLORS.entity).glow}
                      opacity={isSelected ? 0.65 : 0.4}
                      filter="url(#node-soft-glow)"
                      pointerEvents="none"
                    />
                  )}
                  {/* Core — flat minimal disc */}
                  <circle
                    cx={node.x} cy={node.y} r={Math.max(1.6, r - 1)}
                    fill={isMuted ? MUTED_NODE_FILL : pal.fill}
                    opacity={isMuted ? 0.6 : 0.95}
                  />
                  {/* Hairline ring — type-colored; the dash pattern carries the trust grammar */}
                  {!isMuted && (
                    <circle
                      cx={node.x} cy={node.y} r={r + 1.6}
                      className={displayOptions.showTrustRings && node.epistemic && node.role === 'node' ? `graph-trust-ring-svg ${node.epistemic}` : 'graph-trust-ring-svg'}
                      fill="none"
                      style={{ stroke: isSelected ? 'rgba(255,255,255,0.95)' : pal.stroke, strokeWidth: isSelected ? 1.4 : undefined }}
                      pointerEvents="none"
                    />
                  )}
                  {/* Recent-memory pulse — nodes that arrived in the last 7 days breathe once */}
                  {!isMuted && node.created_at && (Date.now() - Date.parse(node.created_at)) < 7 * 24 * 3600 * 1000 && (
                    <circle cx={node.x} cy={node.y} r={r + 4}
                      className="graph-node-pulse"
                      fill="none" pointerEvents="none"
                    />
                  )}
                  {/* Collapsed-cluster count badge */}
                  {node.role === 'cluster' && node.cluster && collapsedClusters.has(node.cluster) && r >= 5 && (
                    <text
                      x={node.x} y={node.y + 3}
                      textAnchor="middle" className="graph-collapsed-count graph-collapsed-count-small"
                    >
                      {clusterMemberCount(node.cluster)}
                    </text>
                  )}
                  {showLabel && (
                    <text
                      x={node.x + r + 7 / Math.max(zoom, 0.05)} y={node.y + 4 / Math.max(zoom, 0.05)}
                      textAnchor="start"
                      className={`graph-node-label ${showGlow ? 'label-active' : ''} ${node.role === 'cluster' ? 'label-cluster' : ''} ${isMuted ? 'label-muted' : ''}`}
                    >
                      {graphLabelText(node.label, isSelected || isHovered)}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Relationship labels follow the explicit display policy; intent remains the quiet default. */}
            {filteredNodes.filter(n => n.role === 'relationship' && (
              displayOptions.relationshipLabels === 'always'
              || (displayOptions.relationshipLabels === 'intent' && (hoveredId === n.id || selectedId === n.id))
            )).map(n => (
              <text
                key={`bl-${n.id}`}
                x={n.x} y={n.y - 8}
                textAnchor="middle"
                className="graph-bridge-label"
              >
                {n.label}
              </text>
            ))}
          </g>
        </svg>
        )}

        {/* Orbit — stable 3D knowledge sphere. Lazy-loaded; overlays (filters, time, panes)
            stay mounted on top, so facets and playback drive the 3D view live. */}
        {viewMode === 'orbit' && (
          <React.Suspense
            fallback={
              <div className="graph-orbit-loading">
                <Loader2 size={20} className="spin" />
                <span>Loading Orbit…</span>
              </div>
            }
          >
            <GraphOrbit
              ref={orbitRef}
              nodes={orbitData.nodes}
              links={orbitData.links}
              lensId={activeLensId}
              sizeMode={sizeMode}
              nodeScale={displayOptions.nodeScale}
              linkScale={displayOptions.linkScale}
              linkOpacity={displayOptions.linkOpacity}
              labelDensity={displayOptions.labelDensity}
              active={props.active !== false}
              selectedId={selectedId}
              initialView={orbitCameraViewRef.current}
              onViewChange={(view) => { orbitCameraViewRef.current = view; }}
              onSelectNode={(id) => {
                setSelectedId(id);
                cameFromAskRef.current = rightPane === 'ask';
                setRightPane('detail');
              }}
            />
          </React.Suspense>
        )}

        {/* Settings answer how the map renders. Filters stay in the left rail; lenses carry intent. */}
        {settingsPanelOpen && (
          <div className="graph-settings-panel">
            <div className="graph-settings-header">
              <div className="graph-settings-heading">
                <span className="graph-settings-title">Map settings</span>
                <span className="graph-settings-scope">{viewMode === '2d' ? '2D' : 'Orbit'}</span>
              </div>
              <div className="graph-settings-header-actions">
                <button className="graph-settings-reset" onClick={resetGraphDisplay}>Reset display</button>
                <button className="graph-settings-close" onClick={() => setSettingsPanelOpen(false)} aria-label="Close map settings"><X size={14} /></button>
              </div>
            </div>

            <div className="graph-settings-section">
              <h4 className="graph-settings-section-title">Display</h4>
              <label className="graph-settings-slider">
                <span className="graph-settings-slider-label"><span>Label density</span><output>{scalePercent(displayOptions.labelDensity)}</output></span>
                <input aria-label="Label density" type="range" min="0.5" max="2" step="0.1" value={displayOptions.labelDensity} onChange={(e) => setDisplayOptions(o => ({ ...o, labelDensity: Number(e.target.value) }))} />
                <span className="graph-settings-slider-ends"><span>Sparse</span><span>More</span></span>
              </label>
              <label className="graph-settings-slider">
                <span className="graph-settings-slider-label"><span>Node scale</span><output>{scalePercent(displayOptions.nodeScale)}</output></span>
                <input aria-label="Node scale" type="range" min="0.6" max="1.8" step="0.1" value={displayOptions.nodeScale} onChange={(e) => setDisplayOptions(o => ({ ...o, nodeScale: Number(e.target.value) }))} />
                <span className="graph-settings-slider-ends"><span>Small</span><span>Large</span></span>
              </label>
              <label className="graph-settings-slider">
                <span className="graph-settings-slider-label"><span>Link thickness</span><output>{scalePercent(displayOptions.linkScale)}</output></span>
                <input aria-label="Link thickness" type="range" min="0.5" max="2.5" step="0.1" value={displayOptions.linkScale} onChange={(e) => setDisplayOptions(o => ({ ...o, linkScale: Number(e.target.value) }))} />
                <span className="graph-settings-slider-ends"><span>Fine</span><span>Strong</span></span>
              </label>
              <label className="graph-settings-slider">
                <span className="graph-settings-slider-label"><span>Link opacity</span><output>{scalePercent(displayOptions.linkOpacity)}</output></span>
                <input aria-label="Link opacity" type="range" min="0.25" max="1.5" step="0.05" value={displayOptions.linkOpacity} onChange={(e) => setDisplayOptions(o => ({ ...o, linkOpacity: Number(e.target.value) }))} />
                <span className="graph-settings-slider-ends"><span>Faint</span><span>Clear</span></span>
              </label>
            </div>

            <div className="graph-settings-section">
              <h4 className="graph-settings-section-title">Node sizing</h4>
              <div className="graph-settings-layout-btns">
                <button className={`graph-settings-layout-btn${sizeMode === 'fixed' ? ' active' : ''}`} onClick={() => setSizeMode('fixed')}>Uniform</button>
                <button className={`graph-settings-layout-btn${sizeMode === 'betweenness' ? ' active' : ''}`} onClick={() => setSizeMode('betweenness')}>Size by influence</button>
              </div>
              <div className="graph-settings-hint">Influence enlarges memories that bridge asserted relationships.</div>
            </div>

            {viewMode === '2d' ? (
              <>
                <div className="graph-settings-section">
                  <h4 className="graph-settings-section-title">Details</h4>
                  <label className="graph-settings-toggle">
                    <span>Direction arrows</span>
                    <input type="checkbox" checked={displayOptions.showArrows} onChange={(e) => setDisplayOptions(o => ({ ...o, showArrows: e.target.checked }))} />
                    <span className="graph-toggle-track" />
                  </label>
                  <label className="graph-settings-toggle">
                    <span>Trust rings</span>
                    <input type="checkbox" checked={displayOptions.showTrustRings} onChange={(e) => setDisplayOptions(o => ({ ...o, showTrustRings: e.target.checked }))} />
                    <span className="graph-toggle-track" />
                  </label>
                  <label className="graph-settings-select-row">
                    <span>Relationship labels</span>
                    <select aria-label="Relationship labels" value={displayOptions.relationshipLabels} onChange={(e) => setDisplayOptions(o => ({ ...o, relationshipLabels: e.target.value as GraphDisplayOptions['relationshipLabels'] }))}>
                      <option value="off">Off</option>
                      <option value="intent">Selected & hover</option>
                      <option value="always">Always</option>
                    </select>
                  </label>
                  <label className="graph-settings-slider">
                    <span className="graph-settings-slider-label"><span>Node detail</span><output>{displayOptions.expandedThreshold.toFixed(1)}×</output></span>
                    <input aria-label="Node detail zoom threshold" type="range" min="1" max="4" step="0.1" value={displayOptions.expandedThreshold} onChange={(e) => setDisplayOptions(o => ({ ...o, expandedThreshold: Number(e.target.value) }))} />
                    <span className="graph-settings-slider-ends"><span>Earlier</span><span>Later</span></span>
                  </label>
                </div>

                <div className="graph-settings-section">
                  <h4 className="graph-settings-section-title">Layout</h4>
                  <div className="graph-settings-layout-btns">
                    <button className={`graph-settings-layout-btn${layoutMode === 'hub-spoke' ? ' active' : ''}`} onClick={() => setLayoutMode('hub-spoke')}>Hub-spoke</button>
                    <button className={`graph-settings-layout-btn${layoutMode === 'force' ? ' active' : ''}`} onClick={() => setLayoutMode('force')}>Force</button>
                  </div>
                </div>

                {layoutMode === 'force' && (
                  <div className="graph-settings-section graph-settings-force">
                    <div className="graph-settings-section-heading">
                      <h4 className="graph-settings-section-title">Force layout</h4>
                      {forceLayoutRunning && <span className="graph-settings-working"><Loader2 size={10} className="spin" /> Arranging</span>}
                    </div>
                    <label className="graph-settings-slider">
                      <span className="graph-settings-slider-label"><span>Repulsion</span><output>{displayOptions.forceRepel}</output></span>
                      <input aria-label="Force repulsion" type="range" min="2" max="30" step="1" value={displayOptions.forceRepel} onChange={(e) => setDisplayOptions(o => ({ ...o, forceRepel: Number(e.target.value) }))} />
                      <span className="graph-settings-slider-ends"><span>Tight</span><span>Airy</span></span>
                    </label>
                    <label className="graph-settings-slider">
                      <span className="graph-settings-slider-label"><span>Center pull</span><output>{displayOptions.forceGravity.toFixed(1)}</output></span>
                      <input aria-label="Force center pull" type="range" min="0.2" max="3" step="0.1" value={displayOptions.forceGravity} onChange={(e) => setDisplayOptions(o => ({ ...o, forceGravity: Number(e.target.value) }))} />
                      <span className="graph-settings-slider-ends"><span>Loose</span><span>Compact</span></span>
                    </label>
                    <label className="graph-settings-toggle">
                      <span>Prevent overlaps</span>
                      <input type="checkbox" checked={displayOptions.forcePreventOverlap} onChange={(e) => setDisplayOptions(o => ({ ...o, forcePreventOverlap: e.target.checked }))} />
                      <span className="graph-toggle-track" />
                    </label>
                    <label className="graph-settings-toggle">
                      <span>Separate clusters</span>
                      <input type="checkbox" checked={displayOptions.forceSeparateClusters} onChange={(e) => setDisplayOptions(o => ({ ...o, forceSeparateClusters: e.target.checked }))} />
                      <span className="graph-toggle-track" />
                    </label>
                    <div className="graph-settings-hint">Changes settle after you pause, without blocking the map.</div>
                  </div>
                )}
              </>
            ) : (
              <div className="graph-settings-section graph-settings-orbit-note">
                <h4 className="graph-settings-section-title">Orbit layout</h4>
                <p>Orbit stays spherical as you navigate. Moving closer reveals more labels.</p>
              </div>
            )}

            <div className="graph-settings-section">
              <h4 className="graph-settings-section-title">View</h4>
              <button className="graph-settings-action" onClick={() => viewMode === 'orbit' ? orbitRef.current?.fitToView() : fitToView()}>
                <Maximize2 size={12} /> Fit to view
              </button>
              {viewMode === '2d' && (
                <button className="graph-settings-action" onClick={() => {
                  savedPositionsRef.current = {};
                  try { localStorage.removeItem(POSITIONS_STORAGE_KEY); } catch {}
                  forceLayoutRef.current = null;
                  const orig = originalLayoutRef.current;
                  if (Object.keys(orig).length > 0) {
                    setNodes(prev => prev.map(n => orig[n.id] ? { ...n, x: orig[n.id].x, y: orig[n.id].y } : n));
                  }
                  requestAnimationFrame(() => fitToView());
                }}>
                  <RotateCcw size={12} /> Reset positions
                </button>
              )}
            </div>

            <div className={`graph-settings-lens-status${lensEdited ? ' edited' : ''}`}>
              <span className="graph-lens-dot" style={{ background: activeLens.accent }} />
              <span><strong>{activeLens.name}</strong>{lensEdited ? ' · Edited' : ' lens'}</span>
              {lensEdited && <button onClick={() => applyLensSettings(activeLens)}>Revert</button>}
            </div>
          </div>
        )}

        {/* Minimap — 2D positions only */}
        {viewMode === '2d' && (
        <div className={`graph-minimap${minimapDragging ? ' dragging' : ''}`}>
          <div className="graph-viewfinder-controls" role="group" aria-label="Map view controls">
            <button
              type="button"
              className="graph-viewfinder-control"
              onClick={() => zoom2dBy(0.8)}
              aria-label="Zoom out"
              title="Zoom out"
            >−</button>
            <button
              type="button"
              className="graph-viewfinder-control graph-viewfinder-reset"
              onClick={fitToView}
              title="Reset view"
            >Reset</button>
            <button
              type="button"
              className="graph-viewfinder-control"
              onClick={() => zoom2dBy(1.2)}
              aria-label="Zoom in"
              title="Zoom in"
            >+</button>
          </div>
          <div className="graph-viewfinder-viewport">
            <canvas ref={minimapCanvasRef} aria-hidden="true" />
            <svg
              ref={minimapRef}
              viewBox={`${minX} ${minY} ${gw} ${gh}`}
              preserveAspectRatio="xMidYMid meet"
              onMouseDown={handleMinimapMouseDown}
            >
              {/* Background */}
              <rect x={minX} y={minY} width={gw} height={gh} fill="transparent" />
              {/* Viewport indicator */}
              <rect
                x={vpX} y={vpY} width={vpW} height={vpH}
                fill="rgba(147,197,253,0.06)"
                stroke="rgba(147,197,253,0.5)"
                strokeWidth={Math.max(gw, gh) * 0.006}
                rx={Math.max(gw, gh) * 0.008}
              />
            </svg>
          </div>
        </div>
        )}

        {/* Time playback — explicit valid-time vs recorded-time axes. */}
        {timeDomain && (
          <div className="graph-timebar">
            <button
              className="graph-timebar-play"
              onClick={() => {
                if (timePlaying) { setTimePlaying(false); return; }
                if (timeCursor >= 100) setTimeCursor(0);
                setTimePlaying(true);
              }}
              title={timePlaying ? 'Pause' : 'Replay memory growth'}
              aria-label={timePlaying ? 'Pause playback' : 'Replay memory growth'}
            >
              {timePlaying ? '❚❚' : '▶'}
            </button>
            <button
              type="button"
              className="graph-timebar-axis"
              onClick={() => {
                setTimePlaying(false);
                setTimeAxis(axis => axis === 'valid' ? 'recorded' : 'valid');
              }}
              title={timeAxis === 'valid'
                ? 'Showing when memories were true'
                : 'Showing when Pod recorded memories'}
            >
              {timeAxis === 'valid' ? 'True at' : 'Known by'}
            </button>
            <input
              type="range"
              min={0} max={100} step={1}
              value={timeCursor}
              onChange={(e) => { setTimePlaying(false); setTimeCursor(Number(e.target.value)); }}
              aria-label="Memory as-of date"
            />
            <span className="graph-timebar-date">
              {timeCutoff == null
                ? 'No date'
                : new Date(timeCutoff).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        )}

        {/* Map filters — everyday choices first, system detail progressively disclosed. */}
        <div
          className={`graph-filter-rail${railCollapsed ? ' collapsed' : ''}`}
          role="region"
          aria-label="Map filters"
        >
          <div className="graph-filter-rail-head">
            {!railCollapsed && <span className="graph-filter-rail-title">Show on map</span>}
            <button
              className="graph-filter-rail-toggle"
              onClick={() => setRailCollapsed(c => !c)}
              title={railCollapsed ? 'Show map filters' : 'Hide map filters'}
              aria-label={railCollapsed ? 'Show map filters' : 'Hide map filters'}
              aria-expanded={!railCollapsed}
            >
              {railCollapsed ? '»' : '«'}
            </button>
          </div>
          {railCollapsed ? (
            <div className="graph-filter-rail-glyphs" aria-hidden="true">
              {(Object.entries(NODE_COLORS) as Array<[NodeType, { fill: string; stroke: string; glow: string }]>)
                .filter(([type]) => allTypesActive || activeTypeFilters.has(type))
                .slice(0, 5)
                .map(([type, colors]) => (
                  <span key={type} className="legend-swatch" style={{ background: colors.fill }} />
                ))}
            </div>
          ) : (
            <div className="graph-filter-rail-body">
              <div className="graph-knowledge-switch" aria-label="How much to show">
                <button
                  type="button"
                  className={knowledgeView === 'current' ? 'active' : ''}
                  aria-pressed={knowledgeView === 'current'}
                  onClick={() => selectKnowledgeView('current')}
                  title="Show facts, possibilities, and opinions"
                >
                  Simple view
                </button>
                <button
                  type="button"
                  className={knowledgeView === 'evidence' ? 'active' : ''}
                  aria-pressed={knowledgeView === 'evidence'}
                  onClick={() => selectKnowledgeView('evidence')}
                  title="Include every item and connection"
                >
                  Show all
                </button>
              </div>
              <p className="graph-filter-view-note">
                {knowledgeView === 'current'
                  ? 'Shows facts, possibilities, and opinions.'
                  : knowledgeView === 'evidence'
                    ? 'Every item and connection is shown.'
                    : 'Showing only the filters you chose.'}
              </p>

              {sourceRecordCount > 0 && knowledgeNodeCount === 0 && (
                <div className="graph-reflect-hint">
                  <Sparkles size={12} aria-hidden="true" />
                  <span><strong>{formatGraphCount(sourceRecordCount)} source records captured.</strong> Reflect to organize their people, projects, events, relationships, and claims. A connected model gives richer results for email and other free-form content.</span>
                </div>
              )}

              <div className="graph-filter-group">
                <span className="graph-filter-group-title">Memory layers</span>
                <button
                  type="button"
                  className={`graph-filter-row graph-filter-everything${allTypesActive ? ' selected' : ''}`}
                  aria-pressed={allTypesActive}
                  onClick={() => setActiveTypeFilters(new Set(ALL_TYPES))}
                >
                  <span className="graph-filter-choice" aria-hidden="true" />
                  <span className="graph-filter-row-label">All memory</span>
                  <span className="graph-filter-row-count">{formatGraphCount(totalGraphNodeCount)}</span>
                </button>
                {visibleFocusTypes.map((type, index) => {
                  const colors = NODE_COLORS[type];
                  const isActive = activeTypeFilters.has(type);
                  const dimmedChip = !allTypesActive && !isActive;
                  const isSelected = !allTypesActive && isActive;
                  const section = NODE_TYPE_SECTIONS[type];
                  const previousSection = index > 0 ? NODE_TYPE_SECTIONS[visibleFocusTypes[index - 1]] : null;
                  return (
                    <React.Fragment key={type}>
                      {section !== previousSection && <span className="graph-filter-section-label">{section}</span>}
                      <button
                        type="button"
                        className={`graph-filter-row${dimmedChip ? ' off' : ''}${isSelected ? ' selected' : ''}`}
                        aria-pressed={isSelected}
                        onClick={() => toggleTypeFilter(type)}
                      >
                        <span className="legend-swatch" style={{ background: colors.fill }} />
                        <span className="graph-filter-row-label">{NODE_TYPE_LABELS[type]}</span>
                        <span className="graph-filter-row-count" title={`${typeCounts.get(type) ?? 0} items`}>
                          {formatGraphCount(typeCounts.get(type) ?? 0)}
                        </span>
                      </button>
                    </React.Fragment>
                  );
                })}
                <button
                  type="button"
                  className="graph-filter-more"
                  aria-expanded={typeFiltersExpanded}
                  onClick={() => setTypeFiltersExpanded(expanded => !expanded)}
                >
                  <ChevronRight size={11} aria-hidden="true" />
                  {typeFiltersExpanded ? 'Show fewer' : 'Show more'}
                </button>
              </div>

              <button
                type="button"
                className="graph-filter-disclosure"
                aria-expanded={filterDetailsOpen}
                onClick={() => setFilterDetailsOpen(open => !open)}
              >
                <span>More filters</span>
                <ChevronRight size={12} aria-hidden="true" />
              </button>

              {filterDetailsOpen && (
                <div className="graph-filter-details">
                  <div className="graph-filter-group">
                    <span className="graph-filter-group-title">Find specific items</span>
                    {ATTENTION_EPISTEMIC.map(ep => {
                      const isActive = activeEpistemicFilters.has(ep);
                      const isSelected = attentionFacetMode && isActive;
                      return (
                        <button
                          key={ep}
                          type="button"
                          className={`graph-filter-row graph-filter-attention${isSelected ? ' selected' : ''}`}
                          aria-pressed={isSelected}
                          onClick={() => toggleEpistemicFilter(ep, ATTENTION_EPISTEMIC, CURRENT_TRUTH_EPISTEMIC)}
                        >
                          <span className={`graph-trust-ring ${ep}`} />
                          <span className="graph-filter-row-label">{EPISTEMIC_LABELS[ep]}</span>
                          <span className="graph-filter-row-count" title={`${epistemicCounts.get(ep) ?? 0} items`}>
                            {formatGraphCount(epistemicCounts.get(ep) ?? 0)}
                          </span>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      className={`graph-filter-row graph-filter-attention${showOnlyOrphans ? ' selected' : ''}`}
                      aria-pressed={showOnlyOrphans}
                      onClick={toggleOrphansOnly}
                      title="Show only items with no connections"
                    >
                      <Link2Off size={11} aria-hidden="true" />
                      <span className="graph-filter-row-label">No connections yet</span>
                      <span className="graph-filter-row-count" title={`${orphanNodeIds.size} items`}>
                        {formatGraphCount(orphanNodeIds.size)}
                      </span>
                    </button>
                  </div>

                  <div className="graph-filter-group">
                    <span className="graph-filter-group-title">Information type</span>
                    {CURRENT_TRUTH_EPISTEMIC.map(ep => {
                      const currentFacetMode = [...activeEpistemicFilters]
                        .every(active => CURRENT_TRUTH_EPISTEMIC.includes(active));
                      const isSelected = currentFacetMode && activeEpistemicFilters.has(ep);
                      return (
                        <button
                          key={ep}
                          type="button"
                          className={`graph-filter-row${isSelected ? ' selected' : ''}`}
                          aria-pressed={isSelected}
                          onClick={() => toggleEpistemicFilter(ep, CURRENT_TRUTH_EPISTEMIC, CURRENT_TRUTH_EPISTEMIC)}
                        >
                          <span className={`graph-trust-ring ${ep}`} />
                          <span className="graph-filter-row-label">{EPISTEMIC_LABELS[ep]}</span>
                          <span className="graph-filter-row-count" title={`${epistemicCounts.get(ep) ?? 0} items`}>
                            {formatGraphCount(epistemicCounts.get(ep) ?? 0)}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="graph-filter-group">
                    <span className="graph-filter-group-title">Also show</span>
                    <button
                      type="button"
                      className={`graph-filter-row${showOnlyDocs ? ' selected' : ''}`}
                      aria-pressed={showOnlyDocs}
                      onClick={() => setShowOnlyDocs(value => !value)}
                      title="Show only items that open as documents"
                    >
                      <FileText size={11} aria-hidden="true" />
                      <span className="graph-filter-row-label">Documents only</span>
                    </button>
                    <button
                      type="button"
                      className={`graph-filter-row${displayOptions.showDerivedAssociations ? ' selected' : ' off'}`}
                      aria-pressed={displayOptions.showDerivedAssociations}
                      onClick={() => setDisplayOptions(options => ({ ...options, showDerivedAssociations: !options.showDerivedAssociations }))}
                      title="Include connections suggested by Coffee"
                    >
                      <span className="graph-edge-layer-swatch derived" />
                      <span className="graph-filter-row-label">Suggested connections</span>
                      <span className="graph-filter-row-count" title={`${edgeLayerCounts.get('derived') ?? 0} connections`}>
                        {formatGraphCount(edgeLayerCounts.get('derived') ?? 0)}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`graph-filter-row${displayOptions.showOrphans ? ' selected' : ' off'}`}
                      aria-pressed={displayOptions.showOrphans}
                      onClick={() => {
                        const showOrphans = !displayOptions.showOrphans;
                        setDisplayOptions(options => ({ ...options, showOrphans }));
                        if (!showOrphans) setShowOnlyOrphans(false);
                      }}
                      title="Include items with no connections"
                    >
                      <Link2Off size={11} aria-hidden="true" />
                      <span className="graph-filter-row-label">Unconnected items</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="graph-filter-summary">
                <span>
                  Showing <strong>{formatGraphCount(visibleGraphNodeCount)}</strong>
                  {' of '}{formatGraphCount(totalGraphNodeCount)} items
                </span>
                <button type="button" onClick={resetGraphFilters}>Clear filters</button>
              </div>
            </div>
          )}
        </div>

        {selectedGraphNodes.length > 0 && (
          <div className="graph-selection-bar">
            <span className="graph-selection-count">
              {selectedGraphNodes.length} item{selectedGraphNodes.length === 1 ? '' : 's'} selected
            </span>
            <button className="graph-selection-action primary" onClick={askAboutSelection}>
              <MessageSquare size={13} /> Ask Pod
            </button>
            {selectedGraphNodes.length === 1 && (
              <button className="graph-selection-action" onClick={() => focusOnNode(selectedGraphNodes[0].id)}>
                <Crosshair size={13} /> Focus
              </button>
            )}
            <button className="graph-selection-action" onClick={() => setSelectedNodeIds(new Set())}>
              <X size={13} /> Clear
            </button>
          </div>
        )}

        {/* Phase E — Trace toolbar (floating, bottom-center, visible when path has 1+ nodes) */}
        {tracedPath.length > 0 && (() => {
          const nodesInPath = tracedPath.map(id => nodes.find(n => n.id === id)).filter(Boolean) as GraphNode[];
          return (
            <div className="graph-trace-toolbar">
              <span className="graph-trace-toolbar-label">
                <GitMerge size={13} /> Trace ({nodesInPath.length})
              </span>
              <span className="graph-trace-toolbar-chain">
                {nodesInPath.map((n, i) => (
                  <React.Fragment key={n.id}>
                    {i > 0 && <span className="graph-trace-arrow">→</span>}
                    <button className="graph-trace-chip" onClick={() => selectAndCenter(n.id)} title={n.label}>{n.label}</button>
                  </React.Fragment>
                ))}
              </span>
              <button
                className="graph-trace-toolbar-btn"
                onClick={() => setTracedPath(prev => prev.slice(0, -1))}
                disabled={tracedPath.length === 0}
                title="Remove last waypoint"
              >
                ⌫
              </button>
              <button
                className="graph-trace-toolbar-btn"
                onClick={() => setTracedPath([])}
                title="Clear trace"
              >
                Clear
              </button>
              <button
                className="graph-trace-toolbar-btn primary"
                onClick={() => {
                  if (nodesInPath.length < 2) return;
                  const prompt = `What's the throughline this path tells, from ${nodesInPath[0].label} through ${nodesInPath.slice(1, -1).map(n => n.label).join(', ') || '(direct)'} to ${nodesInPath[nodesInPath.length - 1].label}?`;
                  setAskInput(prompt);
                  setRightPane('ask');
                }}
                disabled={nodesInPath.length < 2}
                title="Ask Pod about this path"
              >
                <SparklesIcon size={12} /> Ask about this path
              </button>
            </div>
          );
        })()}

        {/* Phase F — Inline link editor (opens when alt-drag lands on a target node) */}
        {linkEditor && (() => {
          const src = nodes.find(n => n.id === linkEditor.sourceId);
          const tgt = nodes.find(n => n.id === linkEditor.targetId);
          if (!src || !tgt) return null;
          const close = () => setLinkEditor(null);
          return (
            <>
              <div className="graph-context-shield" onClick={close} onContextMenu={(e) => { e.preventDefault(); close(); }} />
              <LinkEditor
                src={src} tgt={tgt} x={linkEditor.x} y={linkEditor.y}
                onCancel={close}
                onSave={async (payload) => {
                  await createAnnotationEdge(src.id, tgt.id, payload);
                  close();
                }}
              />
            </>
          );
        })()}

        {/* Q3: hover object card */}
        {hoverCard && (() => {
          const node = filteredNodes.find(n => n.id === hoverCard.id);
          if (!node || node.role === 'relationship') return null;
          if (selectedId === node.id) return null; // hide when detail panel is open for this node
          const pal = NODE_COLORS[node.type] ?? NODE_COLORS.entity;
          const Icon = NODE_TYPE_ICONS[node.type] ?? Network;
          const props3 = (node.properties ?? []).slice(0, 3);
          // Position the card near the cursor, but clamp to the viewport so it doesn't get clipped.
          const cardW = 240;
          const cardH = 120;
          const canvasRect = canvasRef.current?.getBoundingClientRect();
          const cx0 = hoverCard.clientX - (canvasRect?.left ?? 0) + 14;
          const cy0 = hoverCard.clientY - (canvasRect?.top ?? 0) + 14;
          const maxX = (canvasRect?.width ?? 800) - cardW - 8;
          const maxY = (canvasRect?.height ?? 600) - cardH - 8;
          const left = Math.max(8, Math.min(cx0, maxX));
          const top = Math.max(8, Math.min(cy0, maxY));
          return (
            <div
              className="graph-hover-card"
              style={{ left, top, borderLeftColor: pal.fill }}
            >
              <div className="graph-hover-card-header">
                <span className="graph-hover-card-icon" style={{ background: pal.fill }}>
                  <Icon size={12} strokeWidth={2.4} />
                </span>
                <span className="graph-hover-card-title">{node.label}</span>
              </div>
              <div className="graph-hover-card-meta">
                <span className="graph-hover-card-type" style={{ color: pal.stroke }}>{node.type}</span>
                {node.epistemic && (
                  <span className={`epistemic-label ${node.epistemic}`}>{node.epistemic}</span>
                )}
              </div>
              {props3.length > 0 && (
                <div className="graph-hover-card-props">
                  {props3.map(p => (
                    <div key={p.key} className="graph-hover-card-prop">
                      <span>{p.key}</span>
                      <strong>{p.value}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* H2: focus-mode indicator + depth slider */}
        {focusNodeId && (() => {
          const focused = nodes.find(n => n.id === focusNodeId);
          if (!focused) return null;
          const focusedMemoryCount = filteredNodes.filter(node => node.role !== 'relationship').length;
          return (
            <div className="graph-focus-bar">
              <Crosshair size={14} />
              <span className="graph-focus-label">Focus <strong>{focused.label}</strong></span>
              <span className="graph-focus-count">
                {focusedMemoryCount.toLocaleString()} {focusedMemoryCount === 1 ? 'memory' : 'memories'}
              </span>
              <div className="graph-focus-depth">
                <span>Hops</span>
                <button
                  className={`graph-focus-depth-btn${focusDepth === 1 ? ' active' : ''}`}
                  aria-label="Show one hop"
                  title={`${focusDepthCounts[0].toLocaleString()} memories within one hop`}
                  onClick={() => setFocusDepth(1)}
                >1</button>
                <button
                  className={`graph-focus-depth-btn${focusDepth === 2 ? ' active' : ''}`}
                  aria-label="Show two hops"
                  title={`${focusDepthCounts[1].toLocaleString()} memories within two hops`}
                  disabled={focusDepthCounts[1] <= focusDepthCounts[0]}
                  onClick={() => setFocusDepth(2)}
                >2</button>
                <button
                  className={`graph-focus-depth-btn${focusDepth === 3 ? ' active' : ''}`}
                  aria-label="Show three hops"
                  title={`${focusDepthCounts[2].toLocaleString()} memories within three hops`}
                  disabled={focusDepthCounts[2] <= focusDepthCounts[1]}
                  onClick={() => setFocusDepth(3)}
                >3</button>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={exitFocus} title="Exit focus"><X size={12} /></Button>
            </div>
          );
        })()}

        {/* On-demand right pane — node detail or Ask Pod. No tabs; one surface, summoned by
            intent. Default state leaves the canvas edge-to-edge. */}
        {(() => {
          const node = selectedId ? nodes.find(n => n.id === selectedId) ?? null : null;
          const pane: 'detail' | 'ask' | null = rightPane === 'detail' ? (node ? 'detail' : null) : rightPane;
          if (!pane || props.active === false) return null;
          const closePane = () => {
            if (pane === 'detail' && cameFromAskRef.current) {
              // Node was opened from inside the Ask thread — return to the conversation.
              cameFromAskRef.current = false;
              setSelectedId(null);
              setRightPane('ask');
              return;
            }
            cameFromAskRef.current = false;
            setSelectedId(null);
            setRightPane(null);
          };
          const rail = (
            <aside className={`graph-right-rail${pane === 'ask' && props.memoryPaneTarget ? ' graph-right-rail-raised' : ''}`}>
              <div className="graph-pane-head">
                <span className="graph-pane-title">
                  {pane === 'ask' ? <><SparklesIcon size={12} /> Ask Pod</> : 'Memory'}
                </span>
                <Button variant="icon" size="icon-sm" onClick={closePane} title="Close">
                  <X size={14} />
                </Button>
              </div>

              {/* Ask Pod pane — Phase C */}
              {pane === 'ask' && (
                <div className="graph-rail-ask">
                  <div className="graph-rail-ask-scroll">
                    {askThread.length === 0 ? (
                      <div className="graph-rail-ask-empty">
                        <div className="graph-rail-ask-headline">Ask Pod about your graph</div>
                        <p className="graph-rail-ask-blurb">
                          Pod answers from the part of your graph you can see right now — plus your wider memory when it helps.
                        </p>
                        <div className="graph-rail-ask-suggestions">
                          {askSuggestedPrompts.map((p, i) => (
                            <button
                              key={i}
                              className="graph-rail-ask-suggestion"
                              onClick={() => sendAsk(p)}
                              disabled={askSending}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="graph-rail-ask-thread">
                        {askThread.map(msg => (
                          <div key={msg.id} className={`graph-ask-msg graph-ask-msg-${msg.role}`}>
                            {msg.role === 'user' ? (
                              <div className="graph-ask-msg-user-body">{msg.text}</div>
                            ) : msg.pending ? (
                              <div className="graph-ask-msg-pending">
                                <PodLoader label="Searching this map…" size={34} />
                              </div>
                            ) : msg.error ? (
                              <div className="graph-ask-msg-error">{msg.error}</div>
                            ) : (
                              <div className="graph-ask-msg-pod-body">
                                {renderAnswerWithCitations(msg.text, msg.citations ?? [], {
                                  onCitationHover: setHighlightedCitationNodeId,
                                  onCitationClick: (nodeId) => { setHighlightedCitationNodeId(null); cameFromAskRef.current = true; selectAndCenter(nodeId); },
                                })}
                                {(msg.provider || msg.model) && (
                                  <div className="graph-ask-msg-meta">
                                    {msg.model ?? msg.provider}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="graph-ask-composer">
                    <input
                      type="text"
                      className="graph-ask-input"
                      placeholder="Ask about this graph…"
                      value={askInput}
                      onChange={(e) => setAskInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); sendAsk(askInput); }
                      }}
                      disabled={askSending}
                    />
                    <button
                      className="graph-ask-send"
                      onClick={() => sendAsk(askInput)}
                      disabled={!askInput.trim() || askSending}
                      title="Send (Enter)"
                    >
                      <ArrowUp size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* Node detail pane — opens on selection, no fixed tab */}
              {pane === 'detail' && node && (() => {
                const pal = NODE_COLORS[node.type] ?? NODE_COLORS.entity;
                const connections = layoutEdges.flatMap(edge => {
                  if (edge.source !== selectedId && edge.target !== selectedId) return [];
                  const otherId = edge.source === selectedId ? edge.target : edge.source;
                  const connectedNode = nodes.find(item => item.id === otherId);
                  return connectedNode ? [{ edge, node: connectedNode }] : [];
                });
                const VISIBLE_LIMIT = 12;
                const visibleConnections = connectionsExpanded ? connections : connections.slice(0, VISIBLE_LIMIT);
                const hasMore = connections.length > VISIBLE_LIMIT;
                return (
                  <div className="graph-rail-detail">
                    <div className="graph-detail-header" style={{ borderColor: pal.fill }}>
                      <span className="graph-detail-type" style={{ color: pal.stroke }}>{node.type}</span>
                      <button
                        className="graph-detail-title"
                        onClick={() => emitOpen(node)}
                        title={isDocNode(node) ? 'Open document in a new tab' : 'Open in Memories'}
                      >
                        <h3>{node.label}</h3>
                        <ArrowUpRight size={12} className="graph-detail-title-arrow" />
                      </button>
                    </div>

                    <div className="graph-detail-body">
                      {node.properties?.map((p) => {
                        const isDescription = p.key.trim().toLowerCase() === 'description';
                        return (
                          <div className={`graph-detail-prop${isDescription ? ' graph-detail-prop-description' : ''}`} key={p.key}>
                            <span>{p.key}</span>
                            {isDescription
                              ? <p className="graph-detail-description">{p.value}</p>
                              : <strong>{p.value}</strong>}
                          </div>
                        );
                      })}
                      {node.epistemic && (
                        <div className="graph-detail-prop">
                          <span>epistemic</span>
                          <span className={`epistemic-label ${node.epistemic}`}>{node.epistemic}</span>
                        </div>
                      )}
                      <div className="graph-detail-actions">
                        <button className="graph-detail-action-btn" onClick={() => { cameFromAskRef.current = false; setRightPane('ask'); }}>
                          <SparklesIcon size={12} /> Ask about this
                        </button>
                        {focusNodeId === node.id ? (
                          <button className="graph-detail-action-btn" onClick={exitFocus}>
                            <Crosshair size={12} /> Exit focus
                          </button>
                        ) : (
                          <button className="graph-detail-action-btn" onClick={() => focusOnNode(node.id)}>
                            <Crosshair size={12} /> Focus
                          </button>
                        )}
                        {node.role === 'cluster' && node.cluster && (
                          collapsedClusters.has(node.cluster) ? (
                            <button className="graph-detail-action-btn" onClick={() => toggleClusterCollapse(node.cluster!)}>
                              <Plus size={12} /> Expand ({clusterMemberCount(node.cluster)})
                            </button>
                          ) : (
                            <button className="graph-detail-action-btn" onClick={() => toggleClusterCollapse(node.cluster!)}>
                              <Minimize2 size={12} /> Collapse ({clusterMemberCount(node.cluster)})
                            </button>
                          )
                        )}
                      </div>
                    </div>
                    <div className="graph-detail-edges">
                      <span className="graph-detail-edges-title">Connections ({connections.length})</span>
                      {visibleConnections.map(({ edge, node: connectedNode }) => (
                        <div key={edge.id} className="graph-detail-edge-row">
                          <button className="graph-detail-edge" onClick={() => selectAndCenter(connectedNode.id)}>
                            <span className="legend-swatch" style={{ background: NODE_COLORS[connectedNode.type]?.fill ?? '#888' }} />
                            <span className="graph-detail-edge-copy">
                              <span className="graph-detail-edge-target">{connectedNode.label}</span>
                              <span className={`graph-edge-layer-label ${edge.layer}`}>{edge.label || edge.relation || edge.layer}</span>
                            </span>
                            <ChevronRight size={12} className="edge-arrow" />
                          </button>
                          {edge.layer === 'annotation' && (
                            <button
                              className="graph-detail-edge-delete"
                              onClick={() => deleteAnnotationEdge(edge)}
                              disabled={deletingEdgeId === edge.id}
                              title="Delete this saved annotation"
                              aria-label={`Delete ${edge.label || 'annotation'} link to ${connectedNode.label}`}
                            >
                              {deletingEdgeId === edge.id ? <Loader2 size={12} className="spin" /> : <Trash2 size={12} />}
                            </button>
                          )}
                        </div>
                      ))}
                      {hasMore && (
                        <button
                          className="graph-detail-more-btn"
                          onClick={() => setConnectionsExpanded(!connectionsExpanded)}
                        >
                          {connectionsExpanded ? 'Show less' : `+${connections.length - VISIBLE_LIMIT} more`}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </aside>
          );
          return pane === 'ask' && props.memoryPaneTarget
            ? createPortal(rail, props.memoryPaneTarget)
            : rail;
        })()}

        {/* Right-click context menu (Phase A) */}
        {contextMenu && (() => {
          const node = nodes.find(n => n.id === contextMenu.nodeId);
          if (!node) return null;
          const close = () => setContextMenu(null);
          const isHub = node.role === 'cluster';
          return (
            <>
              <div className="graph-context-shield" onClick={close} onContextMenu={(e) => { e.preventDefault(); close(); }} />
              <div className="graph-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
                <button className="graph-context-item" onClick={() => { selectAndCenter(node.id); setRightPane('ask'); close(); }}>
                  <SparklesIcon size={12} /> Ask about this
                </button>
                <button className="graph-context-item" onClick={() => { focusOnNode(node.id); close(); }}>
                  <Crosshair size={12} /> Focus
                </button>
                <button className="graph-context-item" onClick={() => { emitOpen(node); close(); }} disabled={isHub}>
                  <ArrowUpRight size={12} /> {isDocNode(node) ? 'Open in new tab' : 'Open in Memories'}
                </button>
                {isHub && node.cluster && (
                  <button className="graph-context-item" onClick={() => { toggleClusterCollapse(node.cluster!); close(); }}>
                    {collapsedClusters.has(node.cluster) ? <><Plus size={12} /> Expand cluster</> : <><Minimize2 size={12} /> Collapse cluster</>}
                  </button>
                )}
                <div className="graph-context-divider" />
                <button className="graph-context-item disabled" disabled title="Coming in Phase E">
                  <GitMerge size={12} /> Trace from here…
                </button>
                <button className="graph-context-item disabled" disabled title="Coming in Phase F">
                  <Link2 size={12} /> Link to…
                </button>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   Journal View — Daily notes + AI inspiration loop
   ═══════════════════════════════════════ */

interface JournalEntryRow {
  date: string;
  id: string;
  has_content: boolean;
  updated_at: string;
  preview: string;
  title: string;
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function todayLocalIso(): string {
  // YYYY-MM-DD in the user's local timezone (en-CA gives ISO format).
  return new Date().toLocaleDateString('en-CA');
}

function isoFromParts(y: number, m: number, d: number): string {
  return `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
}

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function addDays(iso: string, days: number): string {
  const dt = parseIsoDate(iso);
  dt.setDate(dt.getDate() + days);
  return isoFromParts(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

function startOfWeek(iso: string): string {
  // Sunday-start week (matches the screenshot's "Sun Mon Tue...").
  const dt = parseIsoDate(iso);
  const dow = dt.getDay();
  dt.setDate(dt.getDate() - dow);
  return isoFromParts(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

function weekDays(weekStart: string): Array<{ iso: string; weekday: string; day: number; month: number }> {
  return Array.from({ length: 7 }, (_, i) => {
    const iso = addDays(weekStart, i);
    const dt = parseIsoDate(iso);
    return {
      iso,
      weekday: WEEKDAY_SHORT[i]!,
      day: dt.getDate(),
      month: dt.getMonth() + 1,
    };
  });
}

function formatLongDate(iso: string): string {
  const dt = parseIsoDate(iso);
  return dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function JournalView(props: { authToken: string; objects: PodObject[]; collections: PodCollection[]; onRefresh?: () => void; onPatchObject?: (id: string, patch: Partial<PodObject>) => void }) {
  const today = React.useMemo(() => todayLocalIso(), []);
  const [selectedDate, setSelectedDate] = React.useState<string>(today);
  const [weekStart, setWeekStart] = React.useState<string>(() => startOfWeek(today));
  const [markdown, setMarkdown] = React.useState<string>('');
  const [loadedDate, setLoadedDate] = React.useState<string | null>(null);
  const [entry, setEntry] = React.useState<PodObject | null>(null);
  const [entries, setEntries] = React.useState<Record<string, JournalEntryRow>>({});
  const [prompt, setPrompt] = React.useState<{ text: string; source: 'ai' | 'rotation'; loading: boolean }>({ text: '', source: 'rotation', loading: true });
  const [saving, setSaving] = React.useState(false);
  const [inspectorOpen, setInspectorOpen] = React.useState(false);
  const [journalTags, setJournalTags] = React.useState<string[]>([]);
  const [journalTagInput, setJournalTagInput] = React.useState('');
  const [journalTagEditing, setJournalTagEditing] = React.useState(false);
  const journalTagRef = React.useRef<HTMLInputElement>(null);

  const loadEntry = React.useCallback(async (date: string) => {
    try {
      const data = await getJson<{ entry: PodObject | null; date: string; title: string; markdown: string }>(
        `/pod/journal/entry/${date}`,
        props.authToken,
      );
      return { markdown: data.markdown ?? '', entry: data.entry ? normalizePodObject(data.entry) : null };
    } catch {
      return { markdown: '', entry: null as PodObject | null };
    }
  }, [props.authToken]);

  /* ── Load entry for selectedDate ── */
  React.useEffect(() => {
    let cancelled = false;
    setLoadedDate(null);
    setEntry(null);
    loadEntry(selectedDate).then(({ markdown: md, entry: ent }) => {
      if (cancelled) return;
      const resolved = ent ?? props.objects.find(o => o.id === `journal_${selectedDate}`) ?? null;
      setMarkdown(md);
      setEntry(resolved);
      setJournalTags(resolved?.tags ?? []);
      setJournalTagInput('');
      setLoadedDate(selectedDate);
    });
    return () => { cancelled = true; };
  }, [selectedDate, loadEntry, props.objects]);

  /* ── Load week entries (for day-strip dot indicators) ── */
  const refreshWeekEntries = React.useCallback(async () => {
    const from = weekStart;
    const to = addDays(weekStart, 6);
    try {
      const data = await getJson<{ entries: JournalEntryRow[] }>(
        `/pod/journal/entries?from=${from}&to=${to}`,
        props.authToken,
      );
      const map: Record<string, JournalEntryRow> = {};
      for (const row of data.entries) map[row.date] = row;
      setEntries(map);
    } catch {
      setEntries({});
    }
  }, [weekStart, props.authToken]);

  React.useEffect(() => { refreshWeekEntries(); }, [refreshWeekEntries]);

  /* ── Load inspiration prompt ── */
  const loadPrompt = React.useCallback(async (refresh = false) => {
    setPrompt((p) => ({ ...p, loading: true }));
    try {
      const url = `/pod/journal/prompt?date=${selectedDate}${refresh ? '&refresh=true' : ''}`;
      const data = await getJson<{ prompt: string; source: 'ai' | 'rotation'; cached: boolean }>(url, props.authToken);
      setPrompt({ text: data.prompt, source: data.source, loading: false });
    } catch {
      // Backend unavailable — generate a contextual prompt locally from recent objects
      const fallbackPrompts = [
        'What\'s on your mind today?',
        'What are you working towards this week?',
        'What did you learn recently that surprised you?',
        'What\'s one thing you want to remember from today?',
        'What connections are you noticing between your ideas?',
        'What would make today feel productive?',
        'Is there something you\'ve been putting off reflecting on?',
        'What\'s energising you right now?',
      ];
      const recentTitles = (props.objects ?? [])
        .filter(o => o.kind === 'page' || o.kind === 'claim' || o.kind === 'meeting')
        .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
        .slice(0, 3)
        .map(o => o.title);
      let text: string;
      if (recentTitles.length > 0 && refresh) {
        const contextPrompts = [
          `You recently worked on "${recentTitles[0]}" — any new thoughts?`,
          `How does "${recentTitles[0]}" connect to what you're thinking about today?`,
          `Your Pod has ${(props.objects ?? []).length} memories. What patterns are you noticing?`,
          recentTitles.length >= 2 ? `How do "${recentTitles[0]}" and "${recentTitles[1]}" relate?` : fallbackPrompts[Math.floor(Math.random() * fallbackPrompts.length)],
        ];
        text = contextPrompts[Math.floor(Math.random() * contextPrompts.length)];
      } else {
        text = fallbackPrompts[Math.floor(Math.random() * fallbackPrompts.length)];
      }
      setPrompt({ text, source: 'rotation', loading: false });
    }
  }, [selectedDate, props.authToken, props.objects]);

  React.useEffect(() => { loadPrompt(false); }, [loadPrompt]);

  /* ── Save handler (PlateDocEditor onChange is already debounced internally) ── */
  const saveEntry = React.useCallback(async (next: string) => {
    setSaving(true);
    try {
      const res = await postJson<{ entry: PodObject; date: string; title: string; markdown: string }>(
        `/pod/journal/entry/${selectedDate}`,
        props.authToken,
        { markdown: next, actor_id: 'person-local' },
      );
      setEntry(res.entry ? normalizePodObject(res.entry) : null);
      setEntries((prev) => ({
        ...prev,
        [selectedDate]: {
          ...(prev[selectedDate] ?? { id: `journal_${selectedDate}`, date: selectedDate, title: formatLongDate(selectedDate), updated_at: new Date().toISOString(), preview: '' }),
          has_content: next.trim().length > 0,
          updated_at: new Date().toISOString(),
        },
      }));
    } catch {
      // swallow — user will see the saving indicator stall
    } finally {
      setSaving(false);
    }
  }, [selectedDate, props.authToken]);

  /* ── Inspector helpers ── */
  const ensureEntry = React.useCallback(async (): Promise<PodObject | null> => {
    if (entry) return entry;
    // Create an empty entry so the inspector has a PodObject to edit.
    try {
      const res = await postJson<{ entry: PodObject }>(
        `/pod/journal/entry/${selectedDate}`,
        props.authToken,
        { markdown: markdown ?? '', actor_id: 'person-local' },
      );
      const normalized = res.entry ? normalizePodObject(res.entry) : null;
      setEntry(normalized);
      return normalized;
    } catch {
      const synthetic: PodObject = {
        id: `journal_${selectedDate}`,
        collection_id: 'journal',
        kind: 'journal',
        title: formatLongDate(selectedDate),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        tags: [],
      };
      setEntry(synthetic);
      return synthetic;
    }
  }, [entry, selectedDate, props.authToken, markdown]);

  const handleOpenInspector = React.useCallback(async () => {
    const resolved = await ensureEntry();
    if (resolved) setInspectorOpen(true);
  }, [ensureEntry]);

  const refreshInspectorEntry = React.useCallback(async () => {
    const { entry: ent } = await loadEntry(selectedDate);
    setEntry(ent);
    setJournalTags(ent?.tags ?? []);
    props.onRefresh?.();
  }, [loadEntry, selectedDate, props]);

  const onPatchRef = React.useRef(props.onPatchObject);
  onPatchRef.current = props.onPatchObject;

  const patchJournalTags = React.useCallback(async (next: string[]) => {
    setJournalTags(next);
    const resolved = entry ?? await ensureEntry();
    if (resolved) {
      setEntry({ ...resolved, tags: next });
      onPatchRef.current?.(resolved.id, { tags: next });
      try {
        await fetch(`/pod/objects/${resolved.id}`, {
          method: 'PATCH',
          headers: { ...authHeaders(props.authToken), 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags: next }),
        });
      } catch { /* sample mode */ }
    }
  }, [entry, ensureEntry]);

  const addJournalTag = React.useCallback((t: string) => {
    const tag = t.trim().toLowerCase();
    if (!tag || journalTags.includes(tag)) return;
    patchJournalTags([...journalTags, tag]);
    setJournalTagInput('');
  }, [journalTags, patchJournalTags]);

  const removeJournalTag = React.useCallback((tag: string) => {
    patchJournalTags(journalTags.filter(t => t !== tag));
  }, [journalTags, patchJournalTags]);

  const handleChange = React.useCallback((next: string) => {
    setMarkdown(next);
    saveEntry(next);
  }, [saveEntry]);

  /* ── Day strip ── */
  const days = React.useMemo(() => weekDays(weekStart), [weekStart]);

  const goToday = () => {
    setSelectedDate(today);
    setWeekStart(startOfWeek(today));
  };

  const shiftWeek = (delta: number) => {
    const newStart = addDays(weekStart, delta * 7);
    setWeekStart(newStart);
  };

  const selectDay = (iso: string) => {
    setSelectedDate(iso);
    if (iso < weekStart || iso > addDays(weekStart, 6)) {
      setWeekStart(startOfWeek(iso));
    }
  };

  const isToday = selectedDate === today;
  const editorReady = loadedDate === selectedDate;

  return (
    <div className="journal-view">
      {/* ── Day strip header ── */}
      <div className="journal-header">
        <button className="journal-chevron" onClick={() => shiftWeek(-1)} title="Previous week" aria-label="Previous week">
          <ChevronLeft size={16} />
        </button>
        <div className="journal-day-strip">
          {days.map((d) => {
            const active = d.iso === selectedDate;
            const hasContent = entries[d.iso]?.has_content;
            return (
              <button
                key={d.iso}
                className={`journal-day-cell${active ? ' active' : ''}${d.iso === today ? ' is-today' : ''}`}
                onClick={() => selectDay(d.iso)}
              >
                <span className="journal-day-weekday">{d.weekday}</span>
                <span className="journal-day-num">{d.day}</span>
                {hasContent && <span className="journal-day-dot" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        <button className="journal-chevron" onClick={() => shiftWeek(1)} title="Next week" aria-label="Next week">
          <ChevronRight size={16} />
        </button>
        <div className="journal-header-actions">
          <button className="journal-today-btn" onClick={goToday} disabled={isToday}>Today</button>
        </div>
      </div>

      {/* ── Inspiration bubble ── */}
      <div className="journal-inspiration">
        <Sparkles size={16} className="journal-inspiration-icon" />
        <span className="journal-inspiration-text">
          {prompt.loading ? 'Drawing from your recent memories…' : (prompt.text || 'What\'s on your mind today?')}
        </span>
        <button
          className="journal-inspiration-refresh"
          onClick={() => loadPrompt(true)}
          title="New prompt"
          aria-label="New prompt"
          disabled={prompt.loading}
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* ── Date title + actions ── */}
      <div className="journal-date-row">
        <div className="journal-date-left">
          <h1 className="journal-date-title">{formatLongDate(selectedDate)}</h1>
          {isToday && <span className="journal-today-pill">Today</span>}
          {saving && <span className="journal-saving">Saving…</span>}
        </div>
        <div className="journal-page-actions">
          {!inspectorOpen && (
            <button className="docs-inspect-fab has-label" onClick={handleOpenInspector}>
              <Eye size={16} />
              <span className="docs-fab-label">Inspect</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Tags chips ── */}
      <div className="inline-tags-row">
        {journalTags.map(tag => (
          <span key={tag} className="inline-tag-chip">
            #{tag}
            <button className="inline-tag-remove" onClick={() => removeJournalTag(tag)} aria-label={`Remove ${tag}`}>&times;</button>
          </span>
        ))}
        {journalTagEditing ? (
          <input
            ref={journalTagRef}
            className="inline-tag-input"
            autoFocus
            value={journalTagInput}
            onChange={e => setJournalTagInput(e.target.value)}
            onBlur={() => { if (!journalTagInput.trim()) setJournalTagEditing(false); }}
            onKeyDown={e => {
              if (e.key === 'Enter' && journalTagInput.trim()) { e.preventDefault(); addJournalTag(journalTagInput); e.currentTarget.focus(); }
              if (e.key === 'Escape') { setJournalTagInput(''); setJournalTagEditing(false); }
              if (e.key === 'Backspace' && !journalTagInput && journalTags.length > 0) removeJournalTag(journalTags[journalTags.length - 1]);
            }}
            placeholder="#tag"
            size={Math.max(journalTagInput.length, 4)}
          />
        ) : (
          <span className="inline-tags-add" onClick={() => setJournalTagEditing(true)}>
            <Tag size={12} />
            <span>Add tag</span>
          </span>
        )}
      </div>

      {/* ── Editor body ── */}
      <div className="journal-editor-wrap">
        {editorReady ? (
          <React.Suspense fallback={<div className="journal-editor-loading">Loading editor…</div>}>
            <PlateDocEditor
              key={selectedDate}
              initialContent={markdown}
              onChange={handleChange}
              autoFocus={markdown.length === 0}
              authToken={props.authToken}
            />
          </React.Suspense>
        ) : (
          <div className="journal-editor-loading">Loading…</div>
        )}
      </div>

      {/* ── Inspector drawer (tags, relationships, metadata) ── */}
      {inspectorOpen && entry && (
        <>
          <div className="journal-inspector-backdrop" onClick={() => setInspectorOpen(false)} />
          <aside className="journal-inspector-drawer">
            <ObjectInspector
              obj={entry}
              allObjects={props.objects}
              collections={props.collections}
              authToken={props.authToken}
              onNavigate={() => { /* journal stays put on navigate; close drawer */ setInspectorOpen(false); }}
              onClose={() => setInspectorOpen(false)}
              onRefresh={refreshInspectorEntry}
              onPatchObject={props.onPatchObject}
            />
          </aside>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   Memories View — Unified memory browser
   ═══════════════════════════════════════ */

type MemorySectionId = 'list' | 'profile' | 'learnings';
type MemoryTabId = MemorySectionId | 'map';

function MemoriesView(props: { objects: PodObject[]; collections: PodCollection[]; onMoveDoc?: (id: string, collectionId: string | null) => void; onPatchObject?: (id: string, patch: Partial<PodObject>) => void; onRefresh?: () => void; onAskPodContext?: (context: AskPodContext) => void; onOpenDocument?: (id: string) => void; authToken?: string; ownerActorId: string; initialSection?: MemorySectionId; sectionRequestId?: number; initialListId?: string | null; onClearInitialList?: () => void }) {
  const [tab, setTab] = React.useState<MemoryTabId>(props.initialSection ?? 'list');
  const [mapMounted, setMapMounted] = React.useState(false);
  const [memoryPaneTarget, setMemoryPaneTarget] = React.useState<HTMLDivElement | null>(null);
  const [memoryHeaderActionsTarget, setMemoryHeaderActionsTarget] = React.useState<HTMLDivElement | null>(null);
  const [deepLinkId, setDeepLinkId] = React.useState<string | null>(props.initialListId ?? null);
  const lastSectionRequestRef = React.useRef<number | undefined>(undefined);
  const objectById = React.useMemo(() => new Map(props.objects.map(object => [object.id, object])), [props.objects]);

  React.useEffect(() => {
    if (props.initialListId) {
      setDeepLinkId(props.initialListId);
      setTab('list');
      props.onClearInitialList?.();
    }
  }, [props.initialListId]);

  React.useEffect(() => {
    if (lastSectionRequestRef.current === props.sectionRequestId) return;
    lastSectionRequestRef.current = props.sectionRequestId;
    if (props.initialSection && !props.initialListId) activateTab(props.initialSection);
  }, [props.initialSection, props.sectionRequestId]);

  function activateTab(nextTab: MemoryTabId) {
    if (nextTab === 'map') setMapMounted(true);
    setTab(nextTab);
  }

  function handleOpenFromGraph(payload: OpenInMemoriesPayload) {
    // Prefer exact object-id from the node id; fall back to fuzzy title match.
    let matchId: string | null = payload.objectId ?? null;
    if (!matchId) {
      const fuzzy = props.objects.find(o => o.title.toLowerCase() === payload.label.toLowerCase());
      matchId = fuzzy?.id ?? null;
    }
    // Documents open in the canonical Docs workspace; everything else enters List.
    const matchedObject = matchId ? objectById.get(matchId) : null;
    const objectKind = payload.kind ?? matchedObject?.kind;
    const isDocKind = opensInDocs(objectKind, !!objectKind && !!findCustomType(objectKind));
    if (matchId && isDocKind) {
      props.onOpenDocument?.(matchId);
    } else {
      setDeepLinkId(matchId);
      activateTab('list');
    }
  }

  const memoryViewMode = (tab === 'list' || tab === 'map') ? (
    <div className="memories-view-mode" role="group" aria-label="All memory view">
      <button className={tab === 'list' ? 'active' : ''} onClick={() => activateTab('list')} title="List view"><ListFilter size={14} /> List</button>
      <button className={tab === 'map' ? 'active' : ''} onClick={() => activateTab('map')} title="Map view"><Network size={14} /> Map</button>
    </div>
  ) : null;

  return (
    <div className="memories-view" ref={setMemoryPaneTarget}>
      <div className="memories-switcher-bar">
        <div className="memories-view-switcher" role="tablist" aria-label="Memory sections">
          <button role="tab" aria-selected={tab === 'list' || tab === 'map'} className={`memories-tab ${tab === 'list' || tab === 'map' ? 'active' : ''}`} onClick={() => activateTab('list')}>
            <Brain size={15} /> All memory
          </button>
          <button role="tab" aria-selected={tab === 'profile'} className={`memories-tab ${tab === 'profile' ? 'active' : ''}`} onClick={() => activateTab('profile')}>
            <User size={15} /> About you
          </button>
          <button role="tab" aria-selected={tab === 'learnings'} className={`memories-tab ${tab === 'learnings' ? 'active' : ''}`} onClick={() => activateTab('learnings')}>
            <Lightbulb size={15} /> Learnings
          </button>
        </div>
        <div className="memories-switcher-actions" ref={setMemoryHeaderActionsTarget} />
      </div>
      {tab === 'list' && <MemoriesListView objects={props.objects} collections={props.collections} authToken={props.authToken} initialSelectedId={deepLinkId} onRefresh={props.onRefresh} onMoveDoc={props.onMoveDoc} onPatchObject={props.onPatchObject} onOpenDetail={props.onOpenDocument} memoryViewMode={memoryViewMode} />}
      {tab === 'profile' && <ProfileView actorId={props.ownerActorId} authToken={props.authToken ?? ''} />}
      {tab === 'learnings' && <LearningsView authToken={props.authToken ?? ''} />}
      {mapMounted && (
        <div className={`memories-tab-panel${tab === 'map' ? ' active' : ''}`} aria-hidden={tab !== 'map'}>
          <GraphErrorBoundary><GraphView active={tab === 'map'} authToken={props.authToken} ownerActorId={props.ownerActorId} onOpenInMemories={handleOpenFromGraph} onAskPodContext={props.onAskPodContext} memoryViewMode={memoryViewMode} memoryHeaderActionsTarget={memoryHeaderActionsTarget} memoryPaneTarget={memoryPaneTarget} /></GraphErrorBoundary>
        </div>
      )}
    </div>
  );
}

/* Canonical artifact types. `color` drives icon tint, chips, and row accents
   wherever the type surfaces (Inspector chip, sidebar Types, table icon column). */
const MEMORY_TYPES: Array<{ kind: string; label: string; icon: React.ComponentType<{ size?: number; color?: string }>; color: string }> = [
  { kind: 'page',        label: 'Docs',         icon: BookOpen,       color: '#3b82f6' /* blue   */ },
  { kind: 'file',        label: 'Files',        icon: FileText,       color: '#f59e0b' /* amber  */ },
  { kind: 'entity',      label: 'Entities',     icon: Database,       color: '#10b981' /* green  */ },
  { kind: 'claim',       label: 'Claims',       icon: AlertTriangle,  color: '#ef4444' /* red    */ },
  { kind: 'observation', label: 'Observations', icon: Eye,            color: '#06b6d4' /* cyan   */ },
  { kind: 'source',      label: 'Source records', icon: Link,         color: '#64748b' /* slate  */ },
  { kind: 'journal',     label: 'Journal',      icon: BookOpen,       color: '#0ea5e9' /* sky    */ },
  { kind: 'calendar_event', label: 'Calendar',  icon: CalendarDays,   color: '#8b5cf6' /* violet */ },
  { kind: 'google_drive.file', label: 'Drive',  icon: FileText,       color: '#f59e0b' /* amber  */ },
];

const TYPE_FALLBACK_COLOR = '#94a3b8'; /* gray for unknown kinds */

/* ──────────────────────────────────────────────────────────
   User-authored custom types (color + icon, persisted locally).
   When a doc's `kind` matches a custom type's `id`, lookups
   prefer the custom registry over the built-in MEMORY_TYPES.
   ────────────────────────────────────────────────────────── */

type CustomType = {
  id: string;     // generated: `type-<timestamp>`; stored in obj.kind
  label: string;  // user-facing name
  icon: string;   // key into CUSTOM_TYPE_ICON_MAP
  color: string;  // hex
};

/* Curated icon palette for custom types — small set keeps the picker scannable. */
const CUSTOM_TYPE_ICON_MAP: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  BookOpen, Swords, FileText, Database, AlertTriangle, Eye, Link,
  Briefcase, Users, Building2, Hash, Tag, Star, CalendarDays,
  Brain, Sparkles, Bot, Shield, Bell, Layers, Folder, Inbox, Cloud, Zap,
  Globe, Archive, Activity, Clock, CodeXml, GitBranch, HardDrive,
  KeyRound, Lightbulb, Lock, MessageSquare, Network, Pencil,
  Plug, Search, Server, Settings, Upload, Wrench, Monitor,
};
const CUSTOM_TYPE_ICON_NAMES = Object.keys(CUSTOM_TYPE_ICON_MAP);

/* Curated color palette. */
const CUSTOM_TYPE_COLOR_PALETTE = [
  '#3b82f6', '#a855f7', '#f59e0b', '#10b981', '#ef4444', '#06b6d4',
  '#14b8a6', '#6366f1', '#ec4899', '#84cc16', '#f97316', '#64748b',
];

const CUSTOM_TYPES_KEY = 'coffee-pod-custom-types';
const CUSTOM_TYPES_EVENT = 'coffee-pod-custom-types-changed';

function hydrateCustomTypes(): CustomType[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TYPES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t): t is CustomType =>
      t && typeof t.id === 'string' && typeof t.label === 'string'
      && typeof t.icon === 'string' && typeof t.color === 'string'
    );
  } catch { return []; }
}

function persistCustomTypes(types: CustomType[]) {
  localStorage.setItem(CUSTOM_TYPES_KEY, JSON.stringify(types));
  CUSTOM_TYPES_RUNTIME = types;
  window.dispatchEvent(new Event(CUSTOM_TYPES_EVENT));
}

/* Module-level cache so helpers below stay synchronous. Refreshed on event. */
let CUSTOM_TYPES_RUNTIME: CustomType[] = hydrateCustomTypes();
if (typeof window !== 'undefined') {
  window.addEventListener(CUSTOM_TYPES_EVENT, () => {
    CUSTOM_TYPES_RUNTIME = hydrateCustomTypes();
  });
}

function findCustomType(kind: string): CustomType | undefined {
  return CUSTOM_TYPES_RUNTIME.find(t => t.id === kind);
}

function getTypeColor(kind: string): string {
  const custom = findCustomType(kind);
  if (custom) return custom.color;
  const filterKind = getFilterKind(kind);
  return MEMORY_TYPES.find(t => t.kind === filterKind)?.color ?? TYPE_FALLBACK_COLOR;
}

/* Map legacy kinds to filter categories */
const KIND_FILTER_MAP: Record<string, string> = {
  person: 'entity',
  project: 'entity',
  entity: 'entity',
  document: 'page',
  page: 'page',
  markdown: 'page',
  'coffee.meeting': 'observation',
  observation: 'observation',
  decision: 'claim',
  task: 'claim',
  claim: 'claim',
  file: 'file',
  pdf: 'file',
  image: 'file',
  csv: 'file',
  source: 'source',
};

function getFilterKind(kind: string): string {
  return KIND_FILTER_MAP[kind] ?? kind;
}

function getTypeIcon(kind: string): React.ComponentType<{ size?: number; color?: string; className?: string }> {
  const custom = findCustomType(kind);
  if (custom) return CUSTOM_TYPE_ICON_MAP[custom.icon] ?? FileText;
  const filterKind = getFilterKind(kind);
  return MEMORY_TYPES.find(t => t.kind === filterKind)?.icon ?? FileText;
}

function getTypeLabel(kind: string): string {
  const custom = findCustomType(kind);
  if (custom) return custom.label;
  const filterKind = getFilterKind(kind);
  const meta = MEMORY_TYPES.find(t => t.kind === filterKind);
  return meta?.label ?? kind;
}

type DocOrigin = 'written' | 'imported' | 'reflected' | 'agent-edited' | 'synced';

const ORIGIN_CONFIG: Record<DocOrigin, { label: string; icon: React.ComponentType<{ size?: number }>; className: string }> = {
  written:      { label: 'Written',      icon: Pencil,        className: 'origin-written' },
  imported:     { label: 'Imported',     icon: DownloadCloud, className: 'origin-imported' },
  reflected:    { label: 'Reflected',    icon: Sparkles,      className: 'origin-reflected' },
  'agent-edited': { label: 'Agent edited', icon: Bot,         className: 'origin-agent' },
  synced:       { label: 'Synced',       icon: Cloud,         className: 'origin-synced' },
};

// Map raw model identifiers to short, human labels. Falls back to the raw
// string when no mapping exists so unknown models still surface (rather
// than silently disappearing). Keep this list short — full brand-asset
// coverage is a separate pending task.
function shortModelLabel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s.includes('claude') && s.includes('opus')) return 'Claude Opus';
  if (s.includes('claude') && s.includes('sonnet')) return 'Claude Sonnet';
  if (s.includes('claude') && s.includes('haiku')) return 'Claude Haiku';
  if (s.includes('claude')) return 'Claude';
  if (s.includes('gpt-4o')) return 'GPT-4o';
  if (s.includes('gpt-4')) return 'GPT-4';
  if (s.includes('o1')) return 'GPT o1';
  if (s.includes('gemini')) return 'Gemini';
  if (s.includes('llama')) return 'Llama';
  if (s.includes('mistral')) return 'Mistral';
  if (s.includes('smartware-compiler')) return 'Smartware';
  return raw;
}

// Inline brand marks for LLM authoring identity. Drawn from each vendor's
// public-facing brand mark (Anthropic's burst, OpenAI's blossom, Google's
// diamond) at 11px to match the surrounding badge icon. Replace with real
// SVG assets in ui/public/brand/apps/ when available.
type ModelFamily = 'claude' | 'openai' | 'gemini' | 'llama' | 'mistral' | 'unknown';

function modelFamily(raw: string | null | undefined): ModelFamily {
  if (!raw) return 'unknown';
  const s = raw.toLowerCase();
  if (s.includes('claude')) return 'claude';
  if (s.includes('gpt') || s.includes('o1') || s.includes('o3') || s.includes('openai')) return 'openai';
  if (s.includes('gemini') || s.includes('palm')) return 'gemini';
  if (s.includes('llama')) return 'llama';
  if (s.includes('mistral')) return 'mistral';
  return 'unknown';
}

function ModelMark({ family, size = 11 }: { family: ModelFamily; size?: number }) {
  switch (family) {
    case 'claude':
      // Anthropic burst — four-point asterisk
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 1l1.8 8.4L22 12l-8.2 2.6L12 23l-1.8-8.4L2 12l8.2-2.6L12 1z" />
        </svg>
      );
    case 'openai':
      // OpenAI blossom — six-petal hex
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M12 3 L19 7 L19 17 L12 21 L5 17 L5 7 Z" />
          <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'gemini':
      // Gemini-style 4-point diamond star
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2 L14.5 9.5 L22 12 L14.5 14.5 L12 22 L9.5 14.5 L2 12 L9.5 9.5 Z" />
        </svg>
      );
    case 'llama':
    case 'mistral':
    case 'unknown':
    default:
      // Fallback — generic sparkle
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 4v4M12 16v4M4 12h4M16 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
  }
}

function OriginBadge({ origin, authoredBy }: { origin?: string | null; authoredBy?: string | null }) {
  if (!origin) return null;
  const cfg = ORIGIN_CONFIG[origin as DocOrigin];
  if (!cfg) return null;
  const Icon = cfg.icon;
  const agentOrigin = origin === 'reflected' || origin === 'agent-edited';
  // For agent-authored origins, swap the generic origin icon for the model's
  // brand mark and stash the full model name in `title` so it's available on
  // hover without taking up horizontal space.
  if (agentOrigin && authoredBy) {
    const family = modelFamily(authoredBy);
    const displayLabel = shortModelLabel(authoredBy) ?? authoredBy;
    return (
      <span
        className={`origin-badge ${cfg.className}`}
        title={`${cfg.label} by ${displayLabel}`}
      >
        <ModelMark family={family} size={11} />
        {cfg.label}
      </span>
    );
  }
  return (
    <span className={`origin-badge ${cfg.className}`} title={cfg.label}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

// Compact actor chip — paired with origin chip in the docs list so the user
// can see *who* did the write distinct from *what* the model was.
function ActorBadge({ actorId }: { actorId?: string | null }) {
  const ident = displayActor(actorId);
  if (!ident) return <span className="actor-badge actor-unknown">—</span>;
  const Icon = ident.role === 'agent' ? Bot
    : ident.role === 'substrate' ? Cpu
    : ident.role === 'system' ? Sparkles
    : ident.role === 'user' ? User
    : Globe;
  return (
    <span className={`actor-badge actor-${ident.role}`} title={`${ident.label} (${ident.role}) · ${ident.id}`}>
      <Icon size={11} />
      {ident.label}
    </span>
  );
}

function MemoryDetailPanel(props: { obj: PodObject; collections: PodCollection[] }) {
  const { obj } = props;
  const filterKind = getFilterKind(obj.kind);
  const content = obj.content as Record<string, unknown> | undefined;

  const renderTypeSpecificContent = () => {
    switch (filterKind) {
      case 'file':
        return (
          <div className="memory-detail-section">
            <h4>File Info</h4>
            <div className="memory-detail-meta">
              <div className="meta-row"><span>Type</span><strong>{String(content?.fileType ?? 'unknown').toUpperCase()}</strong></div>
              <div className="meta-row"><span>Size</span><strong>{String(content?.size ?? '—')}</strong></div>
              <div className="meta-row"><span>Source</span><strong>{obj.source?.app ?? 'local'}</strong></div>
              {content?.extractedText != null && Boolean(content.extractedText) && <div className="meta-row"><span>Text extracted</span><strong>Yes</strong></div>}
              {content?.entities != null && <div className="meta-row"><span>Entities found</span><strong>{String(content.entities)}</strong></div>}
              {content?.claims != null && <div className="meta-row"><span>Claims found</span><strong>{String(content.claims)}</strong></div>}
            </div>
          </div>
        );
      case 'entity':
        return (
          <div className="memory-detail-section">
            <h4>Entity</h4>
            <div className="memory-detail-meta">
              {content?.role != null && <div className="meta-row"><span>Role</span><strong>{String(content.role)}</strong></div>}
              {content?.org != null && <div className="meta-row"><span>Organization</span><strong>{String(content.org)}</strong></div>}
              {content?.type != null && <div className="meta-row"><span>Type</span><strong>{String(content.type)}</strong></div>}
              {content?.summary != null && <div className="meta-row"><span>Summary</span><strong>{String(content.summary)}</strong></div>}
              {content?.description != null && <div className="meta-row"><span>Description</span><strong>{String(content.description)}</strong></div>}
              {Array.isArray(content?.related) && <div className="meta-row"><span>Related</span><strong>{content.related.map(String).join(', ')}</strong></div>}
            </div>
          </div>
        );
      case 'claim':
        return (
          <div className="memory-detail-section">
            <h4>Claim Details</h4>
            <div className="memory-detail-meta">
              {content?.confidence != null && <div className="meta-row"><span>Confidence</span><strong>{Math.round(Number(content.confidence) * 100)}%</strong></div>}
              {content?.status != null && <div className="meta-row"><span>Status</span><strong>{String(content.status)}</strong></div>}
              {content?.basis != null && <div className="meta-row"><span>Basis</span><strong>{String(content.basis)}</strong></div>}
              {content?.rationale != null && <div className="meta-row"><span>Rationale</span><strong>{String(content.rationale)}</strong></div>}
              {content?.priority != null && <div className="meta-row"><span>Priority</span><strong>{String(content.priority)}</strong></div>}
            </div>
            <div className="meta-row" style={{ marginTop: 8 }}><span>Epistemic</span><span className={`epistemic-label ${content?.confidence != null && Number(content.confidence) > 0.8 ? 'fact' : 'inference'}`}>{content?.confidence != null && Number(content.confidence) > 0.8 ? 'fact' : 'inference'}</span></div>
          </div>
        );
      case 'observation':
        return (
          <div className="memory-detail-section">
            <h4>Observation</h4>
            <div className="memory-detail-meta">
              {content?.channel != null && <div className="meta-row"><span>Channel</span><strong>{String(content.channel)}</strong></div>}
              {Array.isArray(content?.participants) && <div className="meta-row"><span>Participants</span><strong>{content.participants.map(String).join(', ')}</strong></div>}
              {content?.notes != null && <div className="meta-row"><span>Notes</span><strong>{String(content.notes)}</strong></div>}
            </div>
            {Array.isArray(content?.key_points) && (
              <ul className="memory-key-points">
                {content.key_points.map((p, i) => <li key={i}>{String(p)}</li>)}
              </ul>
            )}
          </div>
        );
      case 'page':
        return (
          <div className="memory-detail-section">
            <h4>Page</h4>
            <div className="memory-detail-meta">
              {content?.confidence != null && <div className="meta-row"><span>Confidence</span><strong>{Math.round(Number(content.confidence) * 100)}%</strong></div>}
              {content?.compiled_from != null && <div className="meta-row"><span>Compiled from</span><strong>{String(content.compiled_from)} sources</strong></div>}
              {Array.isArray(content?.sections) && <div className="meta-row"><span>Sections</span><strong>{content.sections.map(String).join(', ')}</strong></div>}
            </div>
          </div>
        );
      case 'source':
        return (
          <div className="memory-detail-section">
            <h4>Source</h4>
            <div className="memory-detail-meta">
              {content?.status != null && <div className="meta-row"><span>Status</span><strong>{String(content.status)}</strong></div>}
              {content?.last_sync != null && <div className="meta-row"><span>Last sync</span><strong>{String(content.last_sync)}</strong></div>}
              {content?.files_synced != null && <div className="meta-row"><span>Files synced</span><strong>{String(content.files_synced)}</strong></div>}
            </div>
          </div>
        );
      default:
        return (
          <div className="memory-detail-section">
            <h4>Content</h4>
            <pre className="memory-content-pre">{JSON.stringify(content ?? {}, null, 2)}</pre>
          </div>
        );
    }
  };

  return (
    <div className="memory-detail-content">
      <div className="memory-detail-header">
        <h2>{obj.title}</h2>
        <span className="memory-kind-badge">{getTypeLabel(obj.kind)}</span>
      </div>
      {obj.origin && (
        <div className="memory-detail-section" style={{ paddingBottom: 8 }}>
          <OriginBadge origin={obj.origin as DocOrigin} authoredBy={obj.authored_by ?? (obj.metadata as Record<string, unknown> | null)?.authored_by as string | undefined} />
        </div>
      )}
      <div className="memory-detail-meta">
        <div className="meta-row"><span>Source</span><strong>{obj.source?.app ?? 'local'}</strong></div>
        <div className="meta-row"><span>Collection</span><strong>{props.collections.find(c => c.id === obj.collection_id)?.name ?? obj.collection_id}</strong></div>
        <div className="meta-row"><span>Updated</span><strong>{relativeTime(obj.updated_at)}</strong></div>
      </div>
      {renderTypeSpecificContent()}
      <div className="memory-detail-section">
        <h4>Provenance</h4>
        <p className="provenance-text">Observed from {obj.source?.app ?? 'local'}{obj.source?.external_id ? ` · ${obj.source.external_id}` : ''}</p>
      </div>
      <div className="detail-action-bar">
        <button className="detail-action-link"><Search size={13} /> Recall</button>
        <button className="detail-action-link"><Brain size={13} /> Reflect</button>
        <button className="detail-action-link"><RefreshCw size={13} /> Revise</button>
        <button className="detail-action-link"><Shield size={13} /> Access</button>
        <button className="detail-action-link"><Upload size={13} /> Export</button>
        <span className="detail-action-spacer" />
        <button className="detail-action-link detail-action-destructive"><Eraser size={13} /> Forget</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   Unified Object Inspector — shared by List, Docs, Map
   Spec §5: "Docs, List, and Map share a single inspector"
   ═══════════════════════════════════════ */
function ObjectInspector(props: {
  obj: PodObject;
  allObjects: PodObject[];
  collections: PodCollection[];
  authToken?: string;
  onNavigate?: (id: string) => void;
  onClose?: () => void;
  onRefresh?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
  onMoveDoc?: (id: string, collectionId: string | null) => void;
  onPatchObject?: (id: string, patch: Partial<PodObject>) => void;
  /** Open full artifact view (e.g. navigate from List → Docs) */
  onOpenDetail?: (id: string) => void;
}) {
  const { obj, allObjects, collections, onNavigate, onClose, isFavorite, onToggleFavorite } = props;
  const [actionStatus, setActionStatus] = React.useState<{ text: string; tone: 'pending' | 'success' | 'error' } | null>(null);
  const [actionInFlight, setActionInFlight] = React.useState<string | null>(null);

  const hdrs = (): HeadersInit => ({ 'Content-Type': 'application/json', ...(props.authToken ? { authorization: `Bearer ${props.authToken}` } : {}) });
  const patchObject = async (patch: Record<string, unknown>) => {
    try {
      const res = await fetch(`/pod/objects/${encodeURIComponent(obj.id)}`, {
        method: 'PATCH',
        headers: hdrs(),
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.message ?? errBody?.error ?? `HTTP ${res.status}`);
      }
      props.onRefresh?.();
    } catch {
      // API unavailable (sample mode) — optimistic local update stands
    }
  };

  const runAction = async (verb: string, endpoint: string, body: Record<string, unknown>, method = 'POST') => {
    setActionInFlight(verb);
    setActionStatus({ text: `Running ${verb}…`, tone: 'pending' });
    try {
      const res = await fetch(endpoint, { method, headers: hdrs(), body: JSON.stringify(body) });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.message ?? errBody?.error ?? `HTTP ${res.status}`);
      }
      setActionStatus({ text: `${verb} complete`, tone: 'success' });
      props.onRefresh?.();
      setTimeout(() => setActionStatus(null), 2500);
    } catch (e: any) {
      setActionStatus({ text: `${verb} failed: ${e?.message?.slice(0, 80) ?? 'unknown error'}`, tone: 'error' });
      setTimeout(() => setActionStatus(null), 4000);
    } finally {
      setActionInFlight(null);
    }
  };

  const isClaim = ['claim', 'decision', 'task'].includes(obj.kind);

  const handleRecall = () => runAction('Recall', '/pod/query', { query: obj.title, actor_id: 'person-local', scope: obj.scope ?? 'personal' });
  const handleReflect = () => runAction('Reflect', '/pod/compile', { actor_id: 'person-local', operation_id: createOperationId(), scope: obj.scope ?? 'personal' });
  const handleRevise = isClaim
    ? () => runAction('Revise', '/pod/correct', { actor_id: 'person-local', target_claim_id: obj.id, reason: 'changed' })
    : undefined;
  const handleForget = () => {
    if (!confirm(`Forget "${obj.title}"? This will tombstone the object.`)) return;
    runAction('Forget', '/pod/forget', { actor_id: 'person-local', operation_id: createOperationId(), target: { type: 'object', id: obj.id }, mode: 'tombstone' });
  };
  const handleExport = async () => {
    setActionInFlight('Export');
    setActionStatus({ text: 'Running Export…', tone: 'pending' });
    try {
      const res = await fetch(`/pod/objects/${encodeURIComponent(obj.id)}/vault`, {
        headers: props.authToken ? { authorization: `Bearer ${props.authToken}` } : {},
      });
      const data = await res.json();
      const text = data.markdown ?? data.content ?? JSON.stringify(data, null, 2);
      const blob = new Blob([text], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${obj.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
      a.click();
      URL.revokeObjectURL(a.href);
      setActionStatus({ text: 'Export complete', tone: 'success' });
      setTimeout(() => setActionStatus(null), 2500);
    } catch (e: any) {
      setActionStatus({ text: `Export failed: ${e?.message?.slice(0, 80) ?? 'unknown error'}`, tone: 'error' });
      setTimeout(() => setActionStatus(null), 4000);
    } finally {
      setActionInFlight(null);
    }
  };

  /* ── Tags state ── */
  const [tags, setTags] = React.useState<string[]>(obj.tags ?? []);
  const [tagInput, setTagInput] = React.useState('');
  const [tagFocused, setTagFocused] = React.useState(false);
  const [tagEditing, setTagEditing] = React.useState(false);
  const tagInputRef = React.useRef<HTMLInputElement>(null);

  /* ── Properties (Tolaria-style): Status, Date, custom key/values stored in metadata ── */
  const meta = asObjectRecord(obj.metadata) ?? {};
  const initialStatus = (typeof meta.status === 'string' ? meta.status : '') as string;
  const initialUserDate = (typeof meta.user_date === 'string' ? meta.user_date : (obj.created_at?.slice(0, 10) ?? '')) as string;
  type PropType = 'text' | 'number' | 'date' | 'checkbox' | 'url';
  interface TypedProp { type: PropType; value: string }
  const parseCustomProps = (raw: Record<string, unknown>): Record<string, TypedProp> => {
    const out: Record<string, TypedProp> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v && typeof v === 'object' && 'type' in v && 'value' in v) {
        out[k] = v as TypedProp;
      } else if (typeof v === 'string') {
        out[k] = { type: 'text', value: v };
      }
    }
    return out;
  };
  const initialCustom = parseCustomProps(asObjectRecord(meta.custom) ?? {});
  const [localKind, setLocalKind] = React.useState<string>(obj.kind);
  const [status, setStatus] = React.useState<string>(initialStatus);
  const [userDate, setUserDate] = React.useState<string>(initialUserDate);
  const [customProps, setCustomProps] = React.useState<Record<string, TypedProp>>(initialCustom);
  const [addingProp, setAddingProp] = React.useState<boolean | 'editing'>(false);
  const [newPropKey, setNewPropKey] = React.useState('');
  const [newPropValue, setNewPropValue] = React.useState('');
  const [newPropType, setNewPropType] = React.useState<PropType>('text');

  React.useEffect(() => {
    setLocalKind(obj.kind);
    setStatus(initialStatus);
    setUserDate(initialUserDate);
    setCustomProps(initialCustom);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obj.id]);

  const STATUS_OPTIONS: Array<{ value: string; label: string; swatch: string }> = [
    { value: '', label: '— none —', swatch: 'transparent' },
    { value: 'Not started', label: 'Not started', swatch: '#888' },
    { value: 'In progress', label: 'In progress', swatch: '#7c5cfc' },
    { value: 'Active', label: 'Active', swatch: '#22c55e' },
    { value: 'Done', label: 'Done', swatch: '#3b82f6' },
    { value: 'Blocked', label: 'Blocked', swatch: '#ef4444' },
    { value: 'Paused', label: 'Paused', swatch: '#eab308' },
    { value: 'Draft', label: 'Draft', swatch: '#ca8a04' },
    { value: 'Archived', label: 'Archived', swatch: '#6b7280' },
  ];

  const persistMetaPatch = (mergeIntoMeta: Record<string, unknown>) => {
    const nextMeta = { ...(asObjectRecord(obj.metadata) ?? {}), ...mergeIntoMeta };
    return patchObject({ metadata: nextMeta });
  };

  const changeStatus = (next: string) => {
    setStatus(next);
    void persistMetaPatch({ status: next || null }).catch((error: any) => {
      setActionStatus({ text: `Status update failed: ${error.message ?? 'unknown error'}`, tone: 'error' });
      setTimeout(() => setActionStatus(null), 3000);
    });
  };

  const changeUserDate = (next: string) => {
    setUserDate(next);
    void persistMetaPatch({ user_date: next || null }).catch((error: any) => {
      setActionStatus({ text: `Date update failed: ${error.message ?? 'unknown error'}`, tone: 'error' });
      setTimeout(() => setActionStatus(null), 3000);
    });
  };

  const changeKind = (next: string) => {
    setLocalKind(next);
    void patchObject({ kind: next }).catch(() => {});
  };

  const addCustomProperty = () => {
    const key = newPropKey.trim();
    const val = newPropType === 'checkbox' ? (newPropValue || 'false') : newPropValue.trim();
    if (!key) { setAddingProp(false); setNewPropKey(''); setNewPropValue(''); setNewPropType('text'); return; }
    if (newPropType !== 'checkbox' && !val) { setAddingProp(false); setNewPropKey(''); setNewPropValue(''); setNewPropType('text'); return; }
    const next = { ...customProps, [key]: { type: newPropType, value: val } };
    setCustomProps(next);
    setAddingProp(false);
    setNewPropKey('');
    setNewPropValue('');
    setNewPropType('text');
    void persistMetaPatch({ custom: next }).catch((error: any) => {
      setActionStatus({ text: `Property update failed: ${error.message ?? 'unknown error'}`, tone: 'error' });
      setTimeout(() => setActionStatus(null), 3000);
    });
  };

  const updateCustomPropValue = (key: string, value: string) => {
    const prev = customProps[key];
    if (!prev) return;
    const next = { ...customProps, [key]: { ...prev, value } };
    setCustomProps(next);
    void persistMetaPatch({ custom: next }).catch((error: any) => {
      setActionStatus({ text: `Property update failed: ${error.message ?? 'unknown error'}`, tone: 'error' });
      setTimeout(() => setActionStatus(null), 3000);
    });
  };

  const removeCustomProperty = (key: string) => {
    const next = { ...customProps };
    delete next[key];
    setCustomProps(next);
    void persistMetaPatch({ custom: next }).catch((error: any) => {
      setActionStatus({ text: `Property update failed: ${error.message ?? 'unknown error'}`, tone: 'error' });
      setTimeout(() => setActionStatus(null), 3000);
    });
  };

  React.useEffect(() => { setTags(obj.tags ?? []); }, [obj.id, obj.tags]);

  const allTags = React.useMemo(() => {
    const set = new Set<string>();
    allObjects.forEach(o => (o.tags ?? []).forEach(t => set.add(t)));
    return Array.from(set).sort();
  }, [allObjects]);

  const tagSuggestions = tagInput.trim()
    ? allTags.filter(t => t.toLowerCase().includes(tagInput.toLowerCase()) && !tags.includes(t)).slice(0, 5)
    : [];

  const addTag = (tag: string) => {
    const t = tag.trim().toLowerCase().replace(/^#/, '');
    if (!t || tags.includes(t)) return;
    const prev = tags;
    const next = [...tags, t];
    setTags(next);
    setTagInput('');
    props.onPatchObject?.(obj.id, { tags: next });
    void patchObject({ tags: next }).catch((error: any) => {
      setTags(prev);
      props.onPatchObject?.(obj.id, { tags: prev });
      setActionStatus({ text: `Tag update failed: ${error.message ?? 'unknown error'}`, tone: 'error' });
      setTimeout(() => setActionStatus(null), 3000);
    });
  };

  const removeTag = (tag: string) => {
    const prev = tags;
    const next = tags.filter(t => t !== tag);
    setTags(next);
    props.onPatchObject?.(obj.id, { tags: next });
    void patchObject({ tags: next }).catch((error: any) => {
      setTags(prev);
      props.onPatchObject?.(obj.id, { tags: prev });
      setActionStatus({ text: `Tag update failed: ${error.message ?? 'unknown error'}`, tone: 'error' });
      setTimeout(() => setActionStatus(null), 3000);
    });
  };

  /* ── Related objects — from backlinks/references ── */
  const [relations, setRelations] = React.useState<string[]>(getObjectRelatedTitles(obj));
  const [relSearch, setRelSearch] = React.useState<'claims' | 'files' | 'entities' | null>(null);
  const [relQuery, setRelQuery] = React.useState('');
  const relInputRef = React.useRef<HTMLInputElement>(null);
  const relSearchRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!relSearch) return;
    const handler = (e: MouseEvent) => {
      if (relSearchRef.current && !relSearchRef.current.contains(e.target as Node)) setRelSearch(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [relSearch]);

  React.useEffect(() => { setRelations(getObjectRelatedTitles(obj)); }, [obj.id, obj.related_to, obj.metadata]);

  const relatedTitleKeys = new Set(relations.map(normalizeLookupKey));
  const objectTitleKey = normalizeLookupKey(obj.title);
  const directRelatedObjects = allObjects.filter(o => o.id !== obj.id && relatedTitleKeys.has(normalizeLookupKey(o.title)));

  /* Also include objects that reference *this* object */
  const backlinkObjects = allObjects.filter((candidate) =>
    candidate.id !== obj.id
      && getObjectRelatedTitles(candidate).some((title) => normalizeLookupKey(title) === objectTitleKey),
  );

  const mergeRelationItems = (direct: PodObject[], backlinks: PodObject[]) => {
    const items = new Map<string, { obj: PodObject; removable: boolean }>();
    for (const item of direct) {
      items.set(item.id, { obj: item, removable: true });
    }
    for (const item of backlinks) {
      if (!items.has(item.id)) {
        items.set(item.id, { obj: item, removable: false });
      }
    }
    return Array.from(items.values());
  };

  const allClaimRels = mergeRelationItems(
    directRelatedObjects.filter(o => ['claim', 'decision', 'task'].includes(o.kind)),
    backlinkObjects.filter(o => ['claim', 'decision', 'task'].includes(o.kind)),
  );
  const allFileRels = mergeRelationItems(
    directRelatedObjects.filter(o => ['file', 'pdf', 'image', 'csv', 'document', 'markdown', 'page'].includes(o.kind)),
    backlinkObjects.filter(o => ['file', 'pdf', 'image', 'csv', 'document', 'markdown', 'page'].includes(o.kind)),
  );
  const allEntityRels = mergeRelationItems(
    directRelatedObjects.filter(o => ['person', 'project', 'entity'].includes(o.kind)),
    backlinkObjects.filter(o => ['person', 'project', 'entity'].includes(o.kind)),
  );

  const getSearchResults = (category: 'claims' | 'files' | 'entities') => {
    const q = relQuery.trim().toLowerCase();
    const existingTitles = new Set([
      objectTitleKey,
      ...relations.map(normalizeLookupKey),
      ...backlinkObjects.map((item) => normalizeLookupKey(item.title)),
    ]);
    const kindFilter = (o: PodObject) => {
      if (category === 'claims') return ['claim', 'decision', 'task'].includes(o.kind);
      if (category === 'files') return ['file', 'pdf', 'image', 'csv', 'document', 'markdown', 'page'].includes(o.kind);
      if (category === 'entities') return ['person', 'project', 'entity'].includes(o.kind);
      return false;
    };
    const candidates = allObjects.filter(o => !existingTitles.has(normalizeLookupKey(o.title)) && kindFilter(o));
    if (!q) {
      // No query — show most recent items
      return [...candidates].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 5);
    }
    return candidates.filter(o => o.title.toLowerCase().includes(q)).slice(0, 5);
  };

  const persistRelations = (next: string[]) => {
    const metadata = asObjectRecord(obj.metadata) ?? {};
    const references = asObjectRecord(metadata['references']) ?? {};
    return patchObject({
      metadata: {
        ...metadata,
        references: {
          ...references,
          related_to: next,
        },
      },
    });
  };

  const addRelation = (target: PodObject) => {
    const targetTitle = target.title.trim();
    if (!targetTitle || relatedTitleKeys.has(normalizeLookupKey(targetTitle))) return;
    const prev = relations;
    const next = [...relations, targetTitle];
    setRelations(next);
    setRelQuery('');
    setRelSearch(null);
    void persistRelations(next).catch((error: any) => {
      setRelations(prev);
      setActionStatus({ text: `Link update failed: ${error.message ?? 'unknown error'}`, tone: 'error' });
      setTimeout(() => setActionStatus(null), 3000);
    });
  };

  const removeRelation = (targetTitle: string) => {
    const prev = relations;
    const next = relations.filter((title) => normalizeLookupKey(title) !== normalizeLookupKey(targetTitle));
    setRelations(next);
    void persistRelations(next).catch((error: any) => {
      setRelations(prev);
      setActionStatus({ text: `Link update failed: ${error.message ?? 'unknown error'}`, tone: 'error' });
      setTimeout(() => setActionStatus(null), 3000);
    });
  };

  const openRelSearch = (category: 'claims' | 'files' | 'entities') => {
    setRelSearch(category);
    setRelQuery('');
    setTimeout(() => relInputRef.current?.focus(), 50);
  };

  /* ── Derived data ── */
  const collection = collections.find(c => c.id === obj.collection_id);
  const originLabel =
    obj.origin === 'reflected' ? 'Created by reflection' :
    obj.origin === 'written' ? 'Written by you' :
    obj.origin === 'synced' ? `Synced from ${obj.source?.app ?? 'Coffee'}` :
    obj.origin === 'imported' ? `Imported from ${obj.source?.app ?? 'upload'}` :
    obj.origin === 'agent-edited' ? 'Last changed by agent' : null;

  const renderRelatedSection = (title: string, items: Array<{ obj: PodObject; removable: boolean }>, category: 'claims' | 'files' | 'entities', SectionIcon: React.ComponentType<{ size?: number }>) => (
    <div key={category} className="inspector-section">
      <div className="inspector-section-header">
        <h4>{title}</h4>
        <button className="inspector-add-btn" onClick={() => openRelSearch(category)} title={`Link ${title.toLowerCase()}`}>
          <Plus size={12} />
        </button>
      </div>
      {items.map(({ obj: item, removable }) => (
        <div key={item.id} className="inspector-rel-item">
          <button className="inspector-rel-item-link" onClick={() => onNavigate?.(item.id)}>
            <SectionIcon size={12} />
            <span>{item.title}</span>
          </button>
          {removable && (
            <button className="inspector-rel-remove" onClick={() => removeRelation(item.title)} title="Remove link">
              <X size={10} />
            </button>
          )}
        </div>
      ))}
      {relSearch === category && (
        <div className="inspector-rel-search" ref={relSearchRef}>
          <input
            ref={relInputRef}
            value={relQuery}
            onChange={(e) => setRelQuery(e.target.value)}
            placeholder={`Search ${title.toLowerCase()}...`}
            onKeyDown={(e) => { if (e.key === 'Escape') setRelSearch(null); }}
          />
          {getSearchResults(category).map(r => (
            <button key={r.id} className="inspector-rel-result" onClick={() => addRelation(r)}>
              <Plus size={10} />
              <span>{r.title}</span>
            </button>
          ))}
          {relQuery.trim() && getSearchResults(category).length === 0 && (
            <p className="inspector-empty-hint">No matches</p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="object-inspector">
      {onClose && (
        <div className="inspector-top">
          <span className="inspector-top-label">Properties</span>
          <div className="inspector-top-actions">
            {onToggleFavorite && (
              <button
                className={`inspector-top-fav ${isFavorite ? 'is-favorite' : ''}`}
                title={isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                onClick={() => onToggleFavorite(obj.id)}
              >
                <Star size={14} />
              </button>
            )}
            <button className="activity-detail-close" onClick={onClose}><X size={14} /></button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="inspector-header">
        <h2>
          {props.onOpenDetail ? (
            <button
              type="button"
              className="inspector-title-link"
              title="Open in Docs"
              aria-label={`Open ${obj.title} in Docs`}
              onClick={() => props.onOpenDetail!(obj.id)}
            >
              <span className="inspector-title-link-text">{obj.title}</span>
              <ExternalLink className="inspector-title-link-icon" size={14} aria-hidden="true" />
            </button>
          ) : obj.title}
        </h2>
      </div>

      {/* Properties — editable Tolaria-style grid */}
      <div className="inspector-section">
        <div className="inspector-properties">
          <div className="prop-row">
            <span className="prop-key">Type</span>
            <AppDropdown
              className="prop-value-select prop-value-select-type"
              value={localKind}
              onChange={changeKind}
              options={[
                ...MEMORY_TYPES.map(t => ({ value: t.kind, label: t.label, swatch: getTypeColor(t.kind) })),
                ...CUSTOM_TYPES_RUNTIME.map(ct => ({ value: ct.id, label: ct.label, group: 'Custom', swatch: getTypeColor(ct.id) })),
                ...(!MEMORY_TYPES.find(t => t.kind === localKind) && !findCustomType(localKind) ? [{ value: localKind, label: getTypeLabel(localKind), swatch: getTypeColor(localKind) }] : []),
              ]}
            />
          </div>
          <div className="prop-row">
            <span className="prop-key">Status</span>
            <AppDropdown
              className="prop-value-select"
              value={status}
              onChange={changeStatus}
              options={STATUS_OPTIONS}
            />
          </div>
          <div className="prop-row">
            <span className="prop-key">Date</span>
            <AppDateInput className="prop-value-input" value={userDate} onChange={changeUserDate} />
          </div>
          <div className="prop-row">
            <span className="prop-key">Origin</span>
            <span className="prop-value-readonly"><OriginBadge origin={obj.origin as DocOrigin} authoredBy={obj.authored_by ?? (obj.metadata as Record<string, unknown> | null)?.authored_by as string | undefined} /></span>
          </div>
          <div className="prop-row">
            <span className="prop-key">Source</span>
            <span className="prop-value-readonly prop-source-val">{obj.source?.app && obj.source.app !== 'local' && <span className="prop-source-icon">{sourceAppIcon(obj.source.app, 13)}</span>}{formatSourceName(obj.source?.app ?? 'local')}</span>
          </div>
          <div className="prop-row">
            <span className="prop-key">Updated</span>
            <span className="prop-value-readonly">{relativeTime(obj.updated_at)}</span>
          </div>
          {obj.scope && (
            <div className="prop-row">
              <span className="prop-key">Scope</span>
              <span className="prop-value-readonly">{obj.scope}</span>
            </div>
          )}
          {typeof obj.backlink_count === 'number' && obj.backlink_count > 0 && (
            <div className="prop-row">
              <span className="prop-key">References</span>
              <span className="prop-value-readonly">{obj.backlink_count}</span>
            </div>
          )}
          {Object.entries(customProps).map(([k, prop]) => (
            <div className="prop-row" key={k}>
              <span className="prop-key">{k}</span>
              {prop.type === 'checkbox' ? (
                <span className="prop-value-check">
                  <input type="checkbox" checked={prop.value === 'true'} onChange={e => updateCustomPropValue(k, String(e.target.checked))} />
                  <button className="prop-remove-btn" onClick={() => removeCustomProperty(k)} title="Remove property"><X size={10} /></button>
                </span>
              ) : prop.type === 'url' ? (
                <span className="prop-value-readonly prop-value-url">
                  <a href={prop.value.startsWith('http') ? prop.value : `https://${prop.value}`} target="_blank" rel="noopener noreferrer">{prop.value}</a>
                  <button className="prop-remove-btn" onClick={() => removeCustomProperty(k)} title="Remove property"><X size={10} /></button>
                </span>
              ) : prop.type === 'date' ? (
                <span className="prop-value-inline">
                  <AppDateInput className="prop-value-input" value={prop.value} onChange={v => updateCustomPropValue(k, v)} />
                  <button className="prop-remove-btn" onClick={() => removeCustomProperty(k)} title="Remove property"><X size={10} /></button>
                </span>
              ) : prop.type === 'number' ? (
                <span className="prop-value-inline">
                  <input type="number" className="prop-value-input" value={prop.value} onChange={e => updateCustomPropValue(k, e.target.value)} />
                  <button className="prop-remove-btn" onClick={() => removeCustomProperty(k)} title="Remove property"><X size={10} /></button>
                </span>
              ) : (
                <span className="prop-value-readonly">
                  {prop.value}
                  <button className="prop-remove-btn" onClick={() => removeCustomProperty(k)} title="Remove property"><X size={10} /></button>
                </span>
              )}
            </div>
          ))}
          {addingProp === true ? (
            <div className="prop-add-type-list">
              {([['text', Type, 'Text'], ['number', Hash, 'Number'], ['date', CalendarDays, 'Date'], ['checkbox', CheckSquare, 'Checkbox'], ['url', Link2, 'URL']] as const).map(([tid, Icon, label]) => (
                <button key={tid} className="prop-add-type-item" onClick={() => { setNewPropType(tid); setNewPropValue(''); setAddingProp('editing'); }}>
                  <Icon size={13} /> {label}
                </button>
              ))}
              <button className="prop-add-type-item prop-add-type-cancel" onClick={() => setAddingProp(false)}>
                <X size={13} /> Cancel
              </button>
            </div>
          ) : addingProp === 'editing' ? (
            <div className="prop-add-form">
              <div className="prop-row prop-row-add">
                <input
                  className="prop-key-input"
                  placeholder="Name"
                  value={newPropKey}
                  autoFocus
                  onChange={(e) => setNewPropKey(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') { setAddingProp(false); setNewPropKey(''); setNewPropValue(''); setNewPropType('text'); } }}
                />
                {newPropType === 'checkbox' ? (
                  <span className="prop-value-check">
                    <input type="checkbox" checked={newPropValue === 'true'} onChange={e => setNewPropValue(String(e.target.checked))} />
                  </span>
                ) : newPropType === 'date' ? (
                  <AppDateInput className="prop-value-input" value={newPropValue} onChange={v => setNewPropValue(v)} />
                ) : newPropType === 'number' ? (
                  <input type="number" className="prop-value-input" placeholder="0" value={newPropValue} onChange={e => setNewPropValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addCustomProperty(); if (e.key === 'Escape') { setAddingProp(false); setNewPropKey(''); setNewPropValue(''); setNewPropType('text'); } }} />
                ) : (
                  <input className="prop-value-input" placeholder={newPropType === 'url' ? 'https://...' : 'Value'} value={newPropValue} onChange={e => setNewPropValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addCustomProperty(); if (e.key === 'Escape') { setAddingProp(false); setNewPropKey(''); setNewPropValue(''); setNewPropType('text'); } }} />
                )}
              </div>
              <div className="prop-add-actions">
                <button className="prop-add-save" onClick={addCustomProperty} disabled={!newPropKey.trim() || (newPropType !== 'checkbox' && !newPropValue.trim())}>Add</button>
                <button className="prop-add-cancel" onClick={() => { setAddingProp(false); setNewPropKey(''); setNewPropValue(''); setNewPropType('text'); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="prop-add-btn" onClick={() => setAddingProp(true)}>
              <Plus size={11} /> Add property
            </button>
          )}
        </div>
      </div>

      {/* Calendar event details — attendees, time, meeting link */}
      {obj.kind === 'calendar_event' && (() => {
        const c = obj.content as Record<string, unknown> | null;
        if (!c) return null;
        const start = typeof c.start === 'string' ? c.start : null;
        const end = typeof c.end === 'string' ? c.end : null;
        const attendees = Array.isArray(c.attendees) ? c.attendees as Array<{ email: string; response?: string; displayName?: string }> : [];
        const organizer = c.organizer as { email?: string; displayName?: string } | null;
        const meetingLink = typeof c.meeting_link === 'string' ? c.meeting_link : null;
        const location = typeof c.location === 'string' ? c.location : null;
        const description = typeof c.description === 'string' ? c.description : null;
        const fmtTime = (iso: string) => {
          try { return new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
          catch { return iso; }
        };
        const responseIcon = (r?: string) => r === 'accepted' ? '✓' : r === 'declined' ? '✗' : r === 'tentative' ? '?' : '·';
        return (
          <div className="inspector-section">
            <h4>Event Details</h4>
            <div className="inspector-properties">
              {start && (
                <div className="prop-row">
                  <span className="prop-key">When</span>
                  <span className="prop-value-readonly">{fmtTime(start)}{end ? ` – ${new Date(end).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : ''}</span>
                </div>
              )}
              {location && (
                <div className="prop-row">
                  <span className="prop-key">Location</span>
                  <span className="prop-value-readonly">{location}</span>
                </div>
              )}
              {meetingLink && (
                <div className="prop-row">
                  <span className="prop-key">Meeting</span>
                  <span className="prop-value-readonly"><a href={meetingLink} target="_blank" rel="noopener noreferrer" className="inspector-link">Join link</a></span>
                </div>
              )}
              {organizer?.email && (
                <div className="prop-row">
                  <span className="prop-key">Organizer</span>
                  <span className="prop-value-readonly">{organizer.displayName ?? organizer.email}</span>
                </div>
              )}
            </div>
            {attendees.length > 0 && (
              <>
                <h4 style={{ marginTop: 12 }}>Attendees ({attendees.length})</h4>
                <div className="inspector-attendees">
                  {attendees.map((a, i) => (
                    <div key={i} className="inspector-attendee">
                      <span className={`attendee-status ${a.response ?? 'pending'}`}>{responseIcon(a.response)}</span>
                      <span className="attendee-email">{a.displayName ?? a.email}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {description && (
              <>
                <h4 style={{ marginTop: 12 }}>Description</h4>
                <p className="inspector-description">{description}</p>
              </>
            )}
          </div>
        );
      })()}

      {/* Belongs to (was: Location) */}
      <div className="inspector-section">
        <h4>Belongs to</h4>
        <AppDropdown
          className="prop-value-select"
          value={obj.collection_id ?? 'inbox'}
          onChange={(val) => {
            const newCol = val === 'inbox' ? null : val;
            props.onMoveDoc?.(obj.id, newCol);
            patchObject({ collection_id: newCol });
          }}
          options={(() => {
            // Build "Parent / Child" labels so nested collections aren't
            // mistaken for top-level folders (e.g. "Aircraft" is really
            // "World War II / Aircraft"). Sort top-level first, then
            // children grouped under their parent.
            const byId = new Map(collections.map(c => [c.id, c]));
            const fullPath = (c: PodCollection): string => {
              const segments: string[] = [c.name];
              let cur: PodCollection | undefined = c;
              const seen = new Set<string>();
              while (cur?.parent_id && !seen.has(cur.parent_id)) {
                seen.add(cur.parent_id);
                const parent = byId.get(cur.parent_id);
                if (!parent) break;
                segments.unshift(parent.name);
                cur = parent;
              }
              return segments.join(' / ');
            };
            const sorted = [...collections].sort((a, b) => fullPath(a).localeCompare(fullPath(b)));
            return [
              { value: 'inbox', label: 'Inbox' },
              ...sorted.map(c => ({ value: c.id, label: fullPath(c) })),
            ];
          })()}
        />
      </div>

      {/* Tags — editable, now above Related sections */}
      <div className="inspector-section">
        <div className="inspector-section-header">
          <h4>Tags</h4>
          <button className="inspector-add-btn" onClick={() => { setTagEditing(true); setTimeout(() => tagInputRef.current?.focus(), 50); }} title="Add tag">
            <Plus size={12} />
          </button>
        </div>
        {tags.length > 0 && (
          <div className="inspector-tags">
            {tags.map(tag => (
              <span key={tag} className="inspector-tag">
                {tag}
                <button onClick={() => removeTag(tag)} className="inspector-tag-x"><X size={9} /></button>
              </span>
            ))}
          </div>
        )}
        {tagEditing && (
          <div className="inspector-tag-input-wrap">
            <input
              ref={tagInputRef}
              className="inspector-tag-input"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onFocus={() => setTagFocused(true)}
              onBlur={() => setTimeout(() => { setTagFocused(false); if (!tagInput.trim()) setTagEditing(false); }, 150)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && tagInput.trim()) { addTag(tagInput); }
                if (e.key === 'Backspace' && !tagInput && tags.length > 0) { removeTag(tags[tags.length - 1]); }
                if (e.key === 'Escape') { setTagInput(''); setTagEditing(false); tagInputRef.current?.blur(); }
              }}
              placeholder="Add tag..."
            />
            {tagFocused && tagSuggestions.length > 0 && (
              <div className="inspector-tag-suggestions">
                {tagSuggestions.map(s => (
                  <button key={s} onMouseDown={() => addTag(s)}>{s}</button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Related sections — clickable + searchable */}
      {renderRelatedSection('Related Claims', allClaimRels, 'claims', AlertTriangle)}
      {renderRelatedSection('Related Files', allFileRels, 'files', FileText)}
      {renderRelatedSection('Related Entities', allEntityRels, 'entities', Database)}

      {/* Unlinked mentions placeholder — v1.x per spec §5 */}
      {/* Provenance */}
      <div className="inspector-section">
        <h4>Provenance</h4>
        <p className="inspector-dim">
          {originLabel ?? `Observed from ${obj.source?.app ?? 'local'}`}
          {obj.source?.external_id ? ` · ${obj.source.external_id}` : ''}
        </p>
      </div>

      {/* Actions — v1 protocol verbs */}
      <div className="inspector-section">
        <h4>Actions</h4>
        {actionStatus && (
          <p className={`inspector-action-status is-${actionStatus.tone}`}>
            {actionStatus.tone === 'pending' && <Loader2 size={11} className="spin-inline" />}
            {actionStatus.tone === 'success' && <CheckCircle2 size={11} />}
            {actionStatus.tone === 'error' && <AlertTriangle size={11} />}
            {' '}{actionStatus.text}
          </p>
        )}
        <div className="detail-action-grid">
          <button
            className="detail-action-link"
            disabled={!!actionInFlight}
            aria-busy={actionInFlight === 'Recall'}
            onClick={handleRecall}
          >
            {actionInFlight === 'Recall' ? <Loader2 size={13} className="spin-inline" /> : <Search size={13} />} Recall
          </button>
          <button
            className="detail-action-link"
            disabled={!!actionInFlight}
            aria-busy={actionInFlight === 'Reflect'}
            onClick={handleReflect}
          >
            {actionInFlight === 'Reflect' ? <Loader2 size={13} className="spin-inline" /> : <Brain size={13} />} Reflect
          </button>
          <button
            className="detail-action-link"
            disabled={!handleRevise || !!actionInFlight}
            aria-busy={actionInFlight === 'Revise'}
            title={isClaim ? 'Revise this claim' : 'Only claims can be revised'}
            onClick={handleRevise}
          >
            {actionInFlight === 'Revise' ? <Loader2 size={13} className="spin-inline" /> : <RefreshCw size={13} />} Revise
          </button>
          <button
            className="detail-action-link"
            disabled={!!actionInFlight}
            aria-busy={actionInFlight === 'Export'}
            onClick={handleExport}
          >
            {actionInFlight === 'Export' ? <Loader2 size={13} className="spin-inline" /> : <Upload size={13} />} Export
          </button>
        </div>
        <button
          className="detail-action-link detail-action-destructive detail-action-forget"
          disabled={!!actionInFlight}
          aria-busy={actionInFlight === 'Forget'}
          onClick={handleForget}
        >
          {actionInFlight === 'Forget' ? <Loader2 size={13} className="spin-inline" /> : <Eraser size={13} />} Forget
        </button>
      </div>
    </div>
  );
}

function extractContentSnippet(content: unknown): string | null {
  if (!content || typeof content !== 'object') return null;
  const c = content as Record<string, unknown>;
  for (const key of ['summary', 'description', 'notes', 'rationale', 'detail', 'key_points', 'basis']) {
    const v = c[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (Array.isArray(v)) return v.filter(i => typeof i === 'string').join(', ');
  }
  const vals = Object.entries(c)
    .filter(([k, v]) => typeof v === 'string' && v.trim() && !['status', 'fileType', 'type'].includes(k))
    .map(([k, v]) => `${k}: ${v}`)
    .slice(0, 2);
  return vals.length > 0 ? vals.join(' · ') : null;
}

function MemoriesListView(props: { objects: PodObject[]; collections: PodCollection[]; authToken?: string; initialSelectedId?: string | null; onRefresh?: () => void; onOpenDetail?: (id: string) => void; onMoveDoc?: (id: string, collectionId: string | null) => void; onPatchObject?: (id: string, patch: Partial<PodObject>) => void; memoryViewMode?: React.ReactNode }) {
  type SortCol = 'title' | 'type' | 'scope' | 'origin' | 'source' | 'tags' | 'confidence' | 'status' | 'refs' | 'modified';
  type SortDir = 'asc' | 'desc';

  const [selectedId, setSelectedId] = React.useState<string | null>(props.initialSelectedId ?? null);
  const [search, setSearch] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState<string>('all');
  const [scopeFilter, setScopeFilter] = React.useState<string>('all');
  const [stateFilter, setStateFilter] = React.useState<string>('all');
  const [showArchived, setShowArchived] = React.useState(false);
  const [sortCol, setSortCol] = React.useState<SortCol>('modified');
  const [sortDir, setSortDir] = React.useState<SortDir>('desc');
  const [listLoading, setListLoading] = React.useState(true);

  const [rows, setRows] = React.useState<Array<{
    id: string;
    title: string;
    modified_at: string;
    type: string;
    scope?: string | null;
    tags: string[];
    origin?: string | null;
    source?: string | null;
    processing_state?: string | null;
    confidence?: string | null;
    backlink_count?: number;
    summary?: string | null;
  }>>([]);

  React.useEffect(() => {
    if (props.initialSelectedId) setSelectedId(props.initialSelectedId);
  }, [props.initialSelectedId]);

  /* ── Build rows from API or fallback to local objects ── */
  React.useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    if (typeFilter !== 'all') params.set('type', typeFilter);
    if (scopeFilter !== 'all') params.set('scope', scopeFilter);
    if (stateFilter !== 'all') params.set('state', stateFilter);
    if (showArchived) params.set('include_archived', 'true');
    const query = params.toString();
    getJson<{ rows: typeof rows }>(`/pod/memories/list${query ? `?${query}` : ''}`, props.authToken ?? '')
      .then((data) => { if (!cancelled) { setRows(data.rows); setListLoading(false); } })
      .catch(() => {
        if (!cancelled) {
          setRows(props.objects
            .filter((o) => {
              if (search && !o.title.toLowerCase().includes(search.toLowerCase())) return false;
              if (typeFilter !== 'all' && getFilterKind(o.kind) !== typeFilter) return false;
              return true;
            })
            .map((o) => ({
              id: o.id,
              title: o.title,
              modified_at: o.updated_at,
              type: o.kind,
              scope: o.scope ?? null,
              tags: o.tags ?? [],
              origin: o.created_origin ?? o.origin,
              source: o.source?.app ?? null,
              processing_state: o.processing_state ?? null,
              confidence: o.confidence ?? null,
              backlink_count: o.backlink_count ?? 0,
              summary: o.summary ?? extractContentSnippet(o.content),
            })));
          setListLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [props.authToken, props.objects, search, typeFilter, scopeFilter, stateFilter, showArchived]);

  /* ── Sort rows ── */
  const sortedRows = React.useMemo(() => {
    const copy = [...rows];
    const dir = sortDir === 'asc' ? 1 : -1;
    copy.sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      switch (sortCol) {
        case 'title': av = a.title.toLowerCase(); bv = b.title.toLowerCase(); break;
        case 'type': av = getTypeLabel(a.type); bv = getTypeLabel(b.type); break;
        case 'origin': av = a.origin ?? ''; bv = b.origin ?? ''; break;
        case 'source': av = a.source ?? ''; bv = b.source ?? ''; break;
        case 'tags': av = (a.tags?.[0] ?? '').toLowerCase(); bv = (b.tags?.[0] ?? '').toLowerCase(); break;
        case 'modified': av = a.modified_at; bv = b.modified_at; break;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return copy;
  }, [rows, sortCol, sortDir]);

  const { visible: visibleRows, hasMore: hasMoreRows, sentinelRef: rowsSentinelRef, total: totalRows, showing: showingRows } = useProgressiveRender(sortedRows, 50);

  const toggleSort = (col: SortCol) => {
    // Resize drags are already suppressed by ColResizeHandle's capture-phase
    // click blocker, so no resize guard is needed here.
    if (sortCol === col) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }
    else { setSortCol(col); setSortDir(col === 'modified' ? 'desc' : 'asc'); }
  };

  const sortIconClass = (col: SortCol) => sortCol === col ? `sort-icon ${sortDir}` : 'sort-icon';

  const selectedObject = props.objects.find((o) => o.id === selectedId) ?? null;
  const selectedRow = rows.find((r) => r.id === selectedId) ?? null;

  const activeFilterCount =
    (typeFilter !== 'all' ? 1 : 0) +
    (scopeFilter !== 'all' ? 1 : 0) +
    (stateFilter !== 'all' ? 1 : 0) +
    (showArchived ? 1 : 0);

  const clearAllFilters = () => {
    setTypeFilter('all');
    setScopeFilter('all');
    setStateFilter('all');
    setShowArchived(false);
  };

  const [searchOpen, setSearchOpen] = React.useState(false);
  const [showFilters, setShowFilters] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'table' | 'grid'>('table');
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const filterRef = React.useRef<HTMLDivElement>(null);

  const dbCols = React.useMemo<ColDef[]>(() => [
    { key: 'name', minWidth: 120, initWidth: 0 },
    { key: 'type', minWidth: 50, initWidth: 80 },
    { key: 'origin', minWidth: 60, initWidth: 100 },
    { key: 'source', minWidth: 50, initWidth: 90 },
    { key: 'tags', minWidth: 60, initWidth: 100 },
    { key: 'modified', minWidth: 60, initWidth: 90 },
  ], []);
  const dbResize = useColumnResize('memories-db-v2', dbCols);

  /* Close filter panel on outside click */
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (showFilters && filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilters(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showFilters]);

  const hasActiveFilters = typeFilter !== 'all' || scopeFilter !== 'all' || stateFilter !== 'all' || showArchived;

  return (
    <div className="db-browser">
      {/* ── Toolbar — matches Docs pattern ── */}
      <div className="docs-toolbar memories-content-toolbar">
        <div className="docs-toolbar-left">
          <Database size={14} style={{ color: 'var(--fg-4)', marginRight: 6 }} />
          <span className="docs-breadcrumb-seg current">List</span>
          <span className="docs-toolbar-count">{hasMoreRows ? `${showingRows} of ${totalRows}` : totalRows}</span>
        </div>
        {props.memoryViewMode && <div className="memories-toolbar-mode">{props.memoryViewMode}</div>}
        <div className="docs-toolbar-right">
          {/* Expandable search — same as Docs */}
          <div className={`docs-toolbar-search ${searchOpen ? 'open' : ''}`}>
            {searchOpen ? (
              <div className="docs-toolbar-search-field">
                <Search size={14} />
                <input
                  ref={searchInputRef}
                  autoFocus
                  placeholder="Search memories..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') { setSearch(''); setSearchOpen(false); } }}
                />
                <button className="docs-toolbar-search-close" onClick={() => { setSearch(''); setSearchOpen(false); }}>
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button className={`docs-action-btn ${search ? 'has-filter' : ''}`} title="Search" onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50); }}>
                <Search size={14} />
              </button>
            )}
          </div>
          {/* Filter dropdown — same as Docs */}
          <div className="docs-filter-wrap" ref={filterRef}>
            <button className={`docs-action-btn ${hasActiveFilters ? 'has-filter' : ''}`} title="Filter" onClick={() => setShowFilters(!showFilters)}>
              <Filter size={14} />
              {hasActiveFilters && <span className="filter-dot" />}
            </button>
            {showFilters && (
              <div className="docs-filter-panel">
                <div className="docs-filter-header">
                  <div>
                    <strong>Filters</strong>
                    <p>Narrow the memory database</p>
                  </div>
                  <Button variant="icon" size="icon-sm" onClick={() => setShowFilters(false)}><X size={14} /></Button>
                </div>
                <div className="docs-filter-section">
                  <span className="docs-filter-label">Type</span>
                  <div className="docs-filter-chips">
                    {[{ id: 'all', label: 'All' }, ...MEMORY_TYPES.map((mt) => ({ id: mt.kind, label: mt.label }))].map((t) => (
                      <button key={t.id} className={`docs-filter-chip ${typeFilter === t.id ? 'active' : ''}`} onClick={() => setTypeFilter(t.id)}>{t.label}</button>
                    ))}
                  </div>
                </div>
                <div className="docs-filter-section">
                  <span className="docs-filter-label">Scope</span>
                  <div className="docs-filter-chips">
                    {[
                      { id: 'all', label: 'All' },
                      { id: 'personal', label: 'Personal' },
                      { id: 'workspace', label: 'Workspace' },
                      { id: 'meetings', label: 'Meetings' },
                      { id: 'documents', label: 'Documents' },
                      { id: 'tasks', label: 'Tasks' },
                      { id: 'agents', label: 'Agents' },
                    ].map((s) => (
                      <button key={s.id} className={`docs-filter-chip ${scopeFilter === s.id ? 'active' : ''}`} onClick={() => setScopeFilter(s.id)}>{s.label}</button>
                    ))}
                  </div>
                </div>
                <div className="docs-filter-section">
                  <span className="docs-filter-label">Status</span>
                  <div className="docs-filter-chips">
                    {[
                      { id: 'all', label: 'All' },
                      { id: 'imported', label: 'Imported' },
                      { id: 'stored', label: 'Stored only' },
                      { id: 'searchable', label: 'Searchable' },
                      { id: 'reflecting', label: 'Reflecting' },
                      { id: 'ready', label: 'Ready' },
                      { id: 'reflected', label: 'Reflected' },
                      { id: 'synced', label: 'Synced' },
                      { id: 'failed', label: 'Failed' },
                      { id: 'needs_ocr', label: 'Needs OCR' },
                      { id: 'metadata_only', label: 'Metadata only' },
                      { id: 'needs_review', label: 'Needs review' },
                      { id: 'sensitive', label: 'Sensitive' },
                    ].map((s) => (
                      <button key={s.id} className={`docs-filter-chip ${stateFilter === s.id ? 'active' : ''}`} onClick={() => setStateFilter(s.id)}>{s.label}</button>
                    ))}
                  </div>
                </div>
                {hasActiveFilters && (
                  <button className="docs-filter-clear" onClick={clearAllFilters}>Clear all</button>
                )}
              </div>
            )}
          </div>
          {/* View mode toggle */}
          <button
            className={`docs-action-btn ${viewMode === 'grid' ? 'active' : ''}`}
            title={viewMode === 'table' ? 'Grid view' : 'Table view'}
            onClick={() => setViewMode(viewMode === 'table' ? 'grid' : 'table')}
          >
            {viewMode === 'table' ? <Layers size={14} /> : <ListFilter size={14} />}
          </button>
        </div>
      </div>

      {/* ── Data table / grid ── */}
      {listLoading ? (
        <div className="db-content" style={{ padding: '8px 0' }}>
          {viewMode === 'table' ? <TableSkeleton rows={10} cols={6} /> : <GridSkeleton cards={9} />}
        </div>
      ) : (
      <div className={`db-content ${selectedObject ? 'has-detail' : ''}`} style={{ '--db-grid': dbResize.gridTemplate } as React.CSSProperties}>
        {viewMode === 'table' ? (
          <div className="db-table-wrap">
            <div className="db-list-head">
              <button className={`docs-col-sort db-col-name resizable-col ${sortCol === 'title' ? 'active' : ''}`} onClick={() => toggleSort('title')}>
                Name <ArrowUpDown size={12} className={sortIconClass('title')} />
                <ColResizeHandle colIndex={0} onResize={dbResize.onResize} onResolve={dbResize.resolveWidth} />
              </button>
              <button className={`docs-col-sort db-col-type resizable-col ${sortCol === 'type' ? 'active' : ''}`} onClick={() => toggleSort('type')}>
                Type <ArrowUpDown size={12} className={sortIconClass('type')} />
                <ColResizeHandle colIndex={1} onResize={dbResize.onResize} />
              </button>
              <button className={`docs-col-sort db-col-origin resizable-col ${sortCol === 'origin' ? 'active' : ''}`} onClick={() => toggleSort('origin')}>
                Origin <ArrowUpDown size={12} className={sortIconClass('origin')} />
                <ColResizeHandle colIndex={2} onResize={dbResize.onResize} />
              </button>
              <button className={`docs-col-sort db-col-source resizable-col ${sortCol === 'source' ? 'active' : ''}`} onClick={() => toggleSort('source')}>
                Source <ArrowUpDown size={12} className={sortIconClass('source')} />
                <ColResizeHandle colIndex={3} onResize={dbResize.onResize} />
              </button>
              <button className={`docs-col-sort db-col-tags resizable-col ${sortCol === 'tags' ? 'active' : ''}`} onClick={() => toggleSort('tags')}>
                Tags <ArrowUpDown size={12} className={sortIconClass('tags')} />
                <ColResizeHandle colIndex={4} onResize={dbResize.onResize} />
              </button>
              <button className={`docs-col-sort db-col-modified ${sortCol === 'modified' ? 'active' : ''}`} onClick={() => toggleSort('modified')}>
                Modified <ArrowUpDown size={12} className={sortIconClass('modified')} />
              </button>
            </div>
            <div className="db-list-body">
              {sortedRows.length === 0 ? (
                <div className="db-empty"><Database size={20} /> No items match your filters</div>
              ) : visibleRows.map((row) => {
                const Icon = getTypeIcon(row.type);
                return (
                  <button key={row.id} className={`db-list-row ${selectedId === row.id ? 'selected' : ''}`} onClick={() => setSelectedId(row.id)}>
                    <span className="db-col-name">
                      <Icon size={14} className="db-row-icon" />
                      <span className="db-row-title">{row.title}</span>
                    </span>
                    <span className="db-col-type"><span className="db-badge">{getTypeLabel(row.type)}</span></span>
                    <span className="db-col-origin"><OriginBadge origin={row.origin} authoredBy={props.objects.find((object) => object.id === row.id)?.authored_by} /></span>
                    <span className="db-col-source db-dim">{row.source && row.source !== 'local' && row.source !== 'coffee-pod' && <span className="db-source-icon">{sourceAppIcon(row.source, 14)}</span>}{formatSourceName(row.source ?? (row.origin === 'manual' ? 'local' : ''))}</span>
                    <span className="db-col-tags">
                      {(row.tags ?? []).slice(0, 2).map((t: string) => (
                        <span key={t} className="row-tag-chip">#{t}</span>
                      ))}
                      {(row.tags ?? []).length > 2 && <span className="row-tag-overflow">+{(row.tags as string[]).length - 2}</span>}
                    </span>
                    <span className="db-col-modified db-dim">{relativeTime(row.modified_at)}</span>
                  </button>
                );
              })}
              {hasMoreRows && <div ref={rowsSentinelRef} className="progressive-sentinel" />}
            </div>
          </div>
        ) : (
          <div className="db-grid-wrap">
            {sortedRows.length === 0 ? (
              <div className="db-empty"><Database size={20} /> No items match your filters</div>
            ) : (
              <div className="db-grid">
                {visibleRows.map((row) => {
                  const Icon = getTypeIcon(row.type);
                  return (
                    <button key={row.id} className={`db-card ${selectedId === row.id ? 'selected' : ''}`} onClick={() => setSelectedId(row.id)}>
                      <div className="db-card-header">
                        <Icon size={16} className="db-card-icon-inline" />
                        <strong className="db-card-title">{row.title}</strong>
                      </div>
                      {row.summary && <p className="db-card-snippet">{row.summary}</p>}
                      <div className="db-card-meta">
                        <OriginBadge origin={row.origin} authoredBy={props.objects.find((object) => object.id === row.id)?.authored_by} />
                        <span className="db-card-time">{relativeTime(row.modified_at)}</span>
                        {(row.backlink_count ?? 0) > 0 && <span className="db-card-links" title="Connections"><Link2 size={11} />{row.backlink_count}</span>}
                      </div>
                      {row.source && row.source !== 'local' && row.source !== 'coffee-pod' && (
                        <span className="db-card-source-logo" title={row.source}>{sourceAppIcon(row.source, 14)}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            {hasMoreRows && <div ref={rowsSentinelRef} className="progressive-sentinel" />}
          </div>
        )}

        {/* ── Detail / Inspector panel ── */}
        {selectedObject && (
          <div className="memories-detail">
            <ObjectInspector
              obj={selectedObject}
              allObjects={props.objects}
              collections={props.collections}
              authToken={props.authToken}
              onNavigate={(id) => setSelectedId(id)}
              onClose={() => setSelectedId(null)}
              onRefresh={props.onRefresh}
              onMoveDoc={props.onMoveDoc}
              onPatchObject={props.onPatchObject}
              onOpenDetail={props.onOpenDetail}
            />
          </div>
        )}
      </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   Docs View — Knowledge page browser
   ═══════════════════════════════════════ */

type SmartViewDefinition = {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  custom?: boolean;
  filterTypes?: string[];
  filterOrigins?: string[];
  filterSources?: string[];
  filterTags?: string[];
  filterDateRange?: 'today' | '7d' | '30d';
  filterHasBacklinks?: boolean;
  filterProps?: Array<{ key: string; op: 'is' | 'is not' | 'contains' | 'is empty' | 'is not empty'; value: string }>;
  search?: string;
};

type PersistedCustomSmartView = Omit<SmartViewDefinition, 'icon'>;

const SMART_VIEW_ORDER_KEY = 'coffee-pod-smart-view-order';
const CUSTOM_SMART_VIEWS_KEY = 'coffee-pod-custom-smart-views';
const SMART_VIEW_HIDDEN_KEY = 'coffee-pod-smart-view-hidden';
const SMART_VIEWS_EVENT = 'coffee-pod-smart-views-changed';
const FAVORITES_KEY = 'coffee-pod-doc-favorites';
const SIDEBAR_COLLAPSED_KEY = 'coffee-pod-docs-sidebar-collapsed';

type SidebarSectionId = 'favorites' | 'views' | 'types' | 'tags' | 'folders';

function hydrateFavoriteIds(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

function persistFavoriteIds(ids: Set<string>): void {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...ids]));
}

function hydrateCollapsedSections(): Record<SidebarSectionId, boolean> {
  const defaults: Record<SidebarSectionId, boolean> = {
    favorites: false, views: false, types: false, tags: true, folders: false,
  };
  try {
    const raw = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaults;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

function persistCollapsedSections(state: Record<SidebarSectionId, boolean>): void {
  localStorage.setItem(SIDEBAR_COLLAPSED_KEY, JSON.stringify(state));
}

const SMART_VIEWS: SmartViewDefinition[] = [
  { id: 'recently-edited', label: 'Recently edited', icon: Clock },
  { id: 'this-week', label: 'This week', icon: CalendarDays },
  { id: 'ai-generated', label: 'AI-generated', icon: Sparkles },
];

/* Knowledge-artifact kinds visible on the Docs page.
   Everything else (claim, observation, entity, person, project, decision, task, source)
   lives on the List page. */
const DOC_KIND_WHITELIST = new Set<string>([
  ...DOC_KINDS,
]);

/* Sidebar "Types" section — knowledge artifacts only.
   Each type is a predicate that yields the docs visible under that type. */
type DocTypeDefinition = {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  color: string;
  match: (obj: PodObject) => boolean;
};

const DOC_TYPES: DocTypeDefinition[] = [
  { id: 'pages',       label: 'Pages',       icon: BookOpen,      color: '#3b82f6', match: o => ['page', 'markdown', 'document'].includes(o.kind) && o.origin !== 'imported' && o.origin !== 'reflected' && o.origin !== 'agent-edited' },
  { id: 'files',       label: 'Files',       icon: FileText,      color: '#f59e0b', match: o => ['file', 'pdf', 'image', 'csv'].includes(o.kind) },
  { id: 'imports',     label: 'Imports',     icon: DownloadCloud, color: '#14b8a6' /* teal */,   match: o => o.origin === 'imported' },
  { id: 'reflections', label: 'Reflections', icon: Sparkles,      color: '#6366f1' /* indigo */, match: o => o.origin === 'reflected' || o.origin === 'agent-edited' },
];

function hydrateCustomSmartViews(): SmartViewDefinition[] {
  try {
    const raw = localStorage.getItem(CUSTOM_SMART_VIEWS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PersistedCustomSmartView[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(view => typeof view.id === 'string' && typeof view.label === 'string')
      .map(view => ({ ...view, icon: ListFilter, custom: true }));
  } catch {
    return [];
  }
}

function orderSmartViews(views: SmartViewDefinition[]): SmartViewDefinition[] {
  try {
    const raw = localStorage.getItem(SMART_VIEW_ORDER_KEY);
    if (!raw) return views;
    const order = JSON.parse(raw) as string[];
    if (!Array.isArray(order)) return views;
    const rank = new Map(order.map((id, index) => [id, index]));
    return [...views].sort((a, b) => {
      const aRank = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const bRank = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return aRank - bRank;
    });
  } catch {
    return views;
  }
}

function hydrateHiddenSmartViewIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SMART_VIEW_HIDDEN_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

function persistSmartViews(views: SmartViewDefinition[]): void {
  localStorage.setItem(SMART_VIEW_ORDER_KEY, JSON.stringify(views.map(v => v.id)));
  const customViews: PersistedCustomSmartView[] = views
    .filter(v => v.custom)
    .map(({ icon: _icon, ...v }) => v);
  localStorage.setItem(CUSTOM_SMART_VIEWS_KEY, JSON.stringify(customViews));
}

function persistHiddenSmartViewIds(ids: Set<string>): void {
  localStorage.setItem(SMART_VIEW_HIDDEN_KEY, JSON.stringify([...ids]));
}

function broadcastSmartViewChange(): void {
  window.dispatchEvent(new Event(SMART_VIEWS_EVENT));
}

interface SmartViewsController {
  views: SmartViewDefinition[];
  visibleViews: SmartViewDefinition[];
  hiddenIds: Set<string>;
  reorder: (fromId: string, toId: string) => void;
  setHidden: (id: string, hidden: boolean) => void;
  addCustom: (input: Omit<SmartViewDefinition, 'id' | 'icon' | 'custom'>) => SmartViewDefinition;
  updateCustom: (id: string, patch: Partial<Omit<SmartViewDefinition, 'id' | 'icon' | 'custom'>>) => void;
  deleteCustom: (id: string) => void;
}

/** Detects scroll overflow on a horizontal container and returns CSS classes for fade hints */
function useScrollFade(ref: React.RefObject<HTMLElement | null>) {
  const [classes, setClasses] = React.useState('');
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      const canLeft = scrollLeft > 2;
      const canRight = scrollLeft + clientWidth < scrollWidth - 2;
      setClasses(`scroll-fade-wrap${canLeft ? ' fade-left' : ''}${canRight ? ' fade-right' : ''}`);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', update); ro.disconnect(); };
  }, [ref]);
  return classes;
}

function useSmartViews(): SmartViewsController {
  const [views, setViews] = React.useState<SmartViewDefinition[]>(() => orderSmartViews([...SMART_VIEWS, ...hydrateCustomSmartViews()]));
  const [hiddenIds, setHiddenIdsState] = React.useState<Set<string>>(() => hydrateHiddenSmartViewIds());

  React.useEffect(() => {
    const resync = () => {
      setViews(orderSmartViews([...SMART_VIEWS, ...hydrateCustomSmartViews()]));
      setHiddenIdsState(hydrateHiddenSmartViewIds());
    };
    window.addEventListener(SMART_VIEWS_EVENT, resync);
    window.addEventListener('storage', resync);
    return () => {
      window.removeEventListener(SMART_VIEWS_EVENT, resync);
      window.removeEventListener('storage', resync);
    };
  }, []);

  const writeViews = (next: SmartViewDefinition[]) => {
    setViews(next);
    persistSmartViews(next);
    broadcastSmartViewChange();
  };

  const writeHidden = (next: Set<string>) => {
    setHiddenIdsState(next);
    persistHiddenSmartViewIds(next);
    broadcastSmartViewChange();
  };

  const reorder: SmartViewsController['reorder'] = (fromId, toId) => {
    if (fromId === toId) return;
    const fromIndex = views.findIndex(v => v.id === fromId);
    const toIndex = views.findIndex(v => v.id === toId);
    if (fromIndex < 0 || toIndex < 0) return;
    const next = [...views];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    writeViews(next);
  };

  const setHidden: SmartViewsController['setHidden'] = (id, hidden) => {
    const next = new Set(hiddenIds);
    if (hidden) next.add(id); else next.delete(id);
    writeHidden(next);
  };

  const addCustom: SmartViewsController['addCustom'] = (input) => {
    const view: SmartViewDefinition = {
      ...input,
      id: `custom-${Date.now()}`,
      icon: ListFilter,
      custom: true,
    };
    writeViews([...views, view]);
    return view;
  };

  const updateCustom: SmartViewsController['updateCustom'] = (id, patch) => {
    const next = views.map(v => v.id === id && v.custom ? { ...v, ...patch } : v);
    writeViews(next);
  };

  const deleteCustom: SmartViewsController['deleteCustom'] = (id) => {
    const next = views.filter(v => !(v.id === id && v.custom));
    writeViews(next);
    if (hiddenIds.has(id)) {
      const nextHidden = new Set(hiddenIds);
      nextHidden.delete(id);
      writeHidden(nextHidden);
    }
  };

  const visibleViews = views.filter(v => !hiddenIds.has(v.id));

  return { views, visibleViews, hiddenIds, reorder, setHidden, addCustom, updateCustom, deleteCustom };
}

/* Nested folder tree model */
interface DocTreeFolder {
  id: string;
  label: string;
  children: DocTreeFolder[];
  docIds: string[];
  sortOrder: number;
}

/* Count all docs recursively in a folder tree */
function countFolderDocs(folder: DocTreeFolder): number {
  return folder.docIds.length + folder.children.reduce((s, c) => s + countFolderDocs(c), 0);
}

/* Find folder path for a doc id */
function findFolderPath(folders: DocTreeFolder[], docId: string, path: string[] = []): string[] | null {
  for (const f of folders) {
    const next = [...path, f.label];
    if (f.docIds.includes(docId)) return next;
    const found = findFolderPath(f.children, docId, next);
    if (found) return found;
  }
  return null;
}

/* Apply a Set of allowed values; if the set is empty the predicate passes. */
function passSet(value: string | undefined | null, allowed: string[] | undefined): boolean {
  if (!allowed || allowed.length === 0) return true;
  return value != null && allowed.includes(value);
}

function passDateRange(updatedAt: string, range: 'today' | '7d' | '30d' | undefined): boolean {
  if (!range) return true;
  const now = Date.now();
  const t = new Date(updatedAt).getTime();
  const cutoff = range === 'today' ? now - 24 * 60 * 60 * 1000
                : range === '7d'   ? now - 7 * 24 * 60 * 60 * 1000
                : /* 30d */          now - 30 * 24 * 60 * 60 * 1000;
  return t >= cutoff;
}

/* Smart view filter */
function getDocsForSmartView(view: SmartViewDefinition, objects: PodObject[]): PodObject[] {
  if (view.custom) {
    return objects.filter(o => {
      if (!passSet(getFilterKind(o.kind), view.filterTypes)) return false;
      if (!passSet(o.origin, view.filterOrigins)) return false;
      if (!passSet(o.source?.app ?? 'local', view.filterSources)) return false;
      if (view.filterTags && view.filterTags.length > 0) {
        const tags = o.tags ?? [];
        if (!view.filterTags.some(t => tags.includes(t))) return false;
      }
      if (!passDateRange(o.updated_at, view.filterDateRange)) return false;
      if (view.filterHasBacklinks && !(o.backlink_count && o.backlink_count > 0)) return false;
      if (view.filterProps && view.filterProps.length > 0) {
        const meta = asObjectRecord(o.metadata);
        const custom = asObjectRecord(meta?.custom) as Record<string, { type?: string; value?: string }> | null;
        for (const rule of view.filterProps) {
          const propVal = custom?.[rule.key]?.value ?? '';
          switch (rule.op) {
            case 'is': if (propVal.toLowerCase() !== rule.value.toLowerCase()) return false; break;
            case 'is not': if (propVal.toLowerCase() === rule.value.toLowerCase()) return false; break;
            case 'contains': if (!propVal.toLowerCase().includes(rule.value.toLowerCase())) return false; break;
            case 'is empty': if (propVal !== '') return false; break;
            case 'is not empty': if (propVal === '') return false; break;
          }
        }
      }
      if (view.search && !o.title.toLowerCase().includes(view.search.toLowerCase())) return false;
      return true;
    });
  }

  switch (view.id) {
    case 'recently-edited':
      return [...objects].sort((a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      ).slice(0, 50);
    case 'this-week': {
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      return objects.filter(o => new Date(o.updated_at).getTime() > weekAgo);
    }
    case 'ai-generated':
      return objects.filter(o => o.origin === 'reflected' || o.origin === 'agent-edited');
    default: return [];
  }
}

/* ──────────────────────────────────────────────────────────
   New Type modal — name + icon + color
   ────────────────────────────────────────────────────────── */
function NewTypeModal(props: {
  existingLabels: string[];
  onCancel: () => void;
  onCreate: (input: { label: string; icon: string; color: string }) => void;
}) {
  const [label, setLabel] = React.useState('');
  const [icon, setIcon] = React.useState(CUSTOM_TYPE_ICON_NAMES[0]);
  const [color, setColor] = React.useState(CUSTOM_TYPE_COLOR_PALETTE[0]);
  const trimmed = label.trim();
  const isDuplicate = trimmed !== '' && props.existingLabels.includes(trimmed.toLowerCase());
  const canSubmit = trimmed.length > 0 && !isDuplicate;

  return (
    <div className="modal-backdrop" onClick={props.onCancel}>
      <div className="modal-dialog modal-dialog-wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Create a new type</h3>
            <p className="modal-subtitle">Group related docs under a label of your own — pick an icon and color so it stands out in the sidebar and table.</p>
          </div>
          <button className="modal-close" onClick={props.onCancel}><X size={14} /></button>
        </div>

        <div className="modal-body">
          <div className="modal-field">
            <label className="modal-label">Name</label>
            <input
              className="modal-input"
              autoFocus
              value={label}
              placeholder="e.g. Project, Meeting, Recipe"
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && canSubmit) props.onCreate({ label: trimmed, icon, color }); if (e.key === 'Escape') props.onCancel(); }}
            />
            {isDuplicate && <p className="modal-warning">A type with this name already exists.</p>}
          </div>

          <div className="modal-field">
            <label className="modal-label">Color</label>
            <div className="modal-color-grid">
              {CUSTOM_TYPE_COLOR_PALETTE.map(c => (
                <button
                  key={c}
                  className={`modal-color-swatch ${color === c ? 'active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  aria-label={`Choose ${c}`}
                >
                  {color === c && <span className="modal-color-check">✓</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="modal-field">
            <label className="modal-label">Icon</label>
            <div className="modal-icon-grid">
              {CUSTOM_TYPE_ICON_NAMES.map(name => {
                const Icon = CUSTOM_TYPE_ICON_MAP[name];
                const active = icon === name;
                return (
                  <button
                    key={name}
                    className={`modal-icon-btn ${active ? 'active' : ''}`}
                    onClick={() => setIcon(name)}
                    aria-label={name}
                    style={active ? { borderColor: color, color } : undefined}
                  >
                    <Icon size={16} color={active ? color : undefined} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="modal-field">
            <label className="modal-label">Preview</label>
            <div className="modal-type-preview" style={{ ['--type-color' as any]: color }}>
              {(() => { const Icon = CUSTOM_TYPE_ICON_MAP[icon] ?? FileText; return <Icon size={14} color={color} />; })()}
              <span>{trimmed || 'Type name'}</span>
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="modal-cancel" onClick={props.onCancel}>Cancel</button>
          <button className="modal-primary" disabled={!canSubmit} onClick={() => props.onCreate({ label: trimmed, icon, color })}>Create type</button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Save filter modal — captures the current filter set
   ────────────────────────────────────────────────────────── */
function NewViewModal(props: {
  activeFilters: {
    types: string[]; origins: string[]; sources: string[]; tags: string[];
    dateRange: 'today' | '7d' | '30d' | null; hasBacklinks: boolean; search: string;
  };
  onCancel: () => void;
  onCreate: (label: string) => void;
}) {
  const [label, setLabel] = React.useState('');
  const trimmed = label.trim();
  const canSubmit = trimmed.length > 0;

  const { activeFilters: f } = props;
  const filterSummary: Array<{ key: string; values: string[] }> = [];
  if (f.types.length) filterSummary.push({ key: 'Type', values: f.types });
  if (f.origins.length) filterSummary.push({ key: 'Origin', values: f.origins });
  if (f.sources.length) filterSummary.push({ key: 'Source', values: f.sources });
  if (f.tags.length) filterSummary.push({ key: 'Tags', values: f.tags.map(t => `#${t}`) });
  if (f.dateRange) filterSummary.push({ key: 'Modified', values: [f.dateRange === 'today' ? 'Today' : f.dateRange === '7d' ? 'Past 7 days' : 'Past 30 days'] });
  if (f.hasBacklinks) filterSummary.push({ key: 'Other', values: ['Has backlinks'] });
  if (f.search) filterSummary.push({ key: 'Search', values: [`"${f.search}"`] });

  const isEmpty = filterSummary.length === 0;

  return (
    <div className="modal-backdrop" onClick={props.onCancel}>
      <div className="modal-dialog" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Save filter</h3>
            <p className="modal-subtitle">Saved filters let you return to the same slice of memory without rebuilding it. Pick a name you'll recognize at a glance.</p>
          </div>
          <button className="modal-close" onClick={props.onCancel}><X size={14} /></button>
        </div>

        <div className="modal-body">
          <div className="modal-field">
            <label className="modal-label">Name</label>
            <input
              className="modal-input"
              autoFocus
              value={label}
              placeholder="e.g. Imported this week"
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && canSubmit) props.onCreate(trimmed); if (e.key === 'Escape') props.onCancel(); }}
            />
          </div>

          <div className="modal-field">
            <label className="modal-label">Captures</label>
            {isEmpty ? (
              <p className="modal-warning">No active filters — this view will show all docs. Add filters first or just save as-is.</p>
            ) : (
              <div className="modal-filter-summary">
                {filterSummary.map(row => (
                  <div className="modal-filter-row" key={row.key}>
                    <span className="modal-filter-key">{row.key}</span>
                    <div className="modal-filter-values">
                      {row.values.map(v => <span key={v} className="modal-filter-pill">{v}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="modal-actions">
          <button className="modal-cancel" onClick={props.onCancel}>Cancel</button>
          <button className="modal-primary" disabled={!canSubmit} onClick={() => props.onCreate(trimmed)}>Save view</button>
        </div>
      </div>
    </div>
  );
}

function DocsView(rawProps: { objects: PodObject[]; collections: PodCollection[]; ready?: boolean; onOpenImport?: (folder?: string) => void; onDeleteDoc?: (id: string, forget: boolean) => void; onMoveDoc?: (id: string, collectionId: string | null) => void; onPatchObject?: (id: string, patch: Partial<PodObject>) => void; onAddObject?: (obj: PodObject) => void; onAddCollection?: (col: PodCollection) => void; onRefresh?: () => void; authToken?: string; initialDocId?: string | null; initialCollectionId?: string | null; createDocRequestId?: number; createFolderRequestId?: number; onClearInitialDoc?: () => void; onClearInitialCollection?: () => void; onClearCreateDocRequest?: () => void; onClearCreateFolderRequest?: () => void }) {
  /* Custom types must be loaded before `props` memoization (the kind whitelist
     consults them) — keep this state at the top of the component. */
  const [customTypes, setCustomTypes] = React.useState<CustomType[]>(() => hydrateCustomTypes());
  const docsReady = rawProps.ready ?? rawProps.objects.length > 0;

  /* Enforce Docs/List boundary: only knowledge-artifact kinds enter this view.
     Custom types created by the user are also allowed (their id matches obj.kind).
     Claims/observations/entities/decisions/tasks/sources/persons/projects live in List. */
  const props = React.useMemo(() => ({
    ...rawProps,
    objects: rawProps.objects.filter(o => DOC_KIND_WHITELIST.has(o.kind) || !!findCustomType(o.kind)),
  }), [rawProps, customTypes]);
  const [activeFolderId, setActiveFolderId] = React.useState<string>(rawProps.initialCollectionId ?? 'inbox');
  const [activeSmartView, setActiveSmartView] = React.useState<string | null>(null);
  const [activeTypeId, setActiveTypeId] = React.useState<string | null>(null);
  const [activeTagId, setActiveTagId] = React.useState<string | null>(null);
  const [showFavorites, setShowFavorites] = React.useState(false);
  const [favoriteIds, setFavoriteIds] = React.useState<Set<string>>(() => hydrateFavoriteIds());
  const [collapsedSections, setCollapsedSections] = React.useState<Record<SidebarSectionId, boolean>>(() => hydrateCollapsedSections());
  const [selectedDocId, setSelectedDocId] = React.useState<string | null>(props.initialDocId ?? null);
  const [sidebarRevealed, setSidebarRevealed] = React.useState(true);
  const [expandedFolders, setExpandedFolders] = React.useState<Record<string, boolean>>({ inbox: true });
  const [mainExpandedFolders, setMainExpandedFolders] = React.useState<Record<string, boolean>>({});
  const [sidebarSearch, setSidebarSearch] = React.useState('');
  const [searchOpen, setSearchOpen] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [showCreateMenu, setShowCreateMenu] = React.useState(false);
  const [inspectorOpen, setInspectorOpen] = React.useState(false);
  const [inspectorWidth, setInspectorWidth] = React.useState(300);
  const inspectorDragRef = React.useRef<{ startX: number; startW: number } | null>(null);
  const [rawEditorOpen, setRawEditorOpen] = React.useState(false);
  const [showFilters, setShowFilters] = React.useState(false);
  /* Multi-select filter state (replaces single-value origin/kind from prior version). */
  const [filterTypes, setFilterTypes] = React.useState<Set<string>>(new Set());
  const [filterOrigins, setFilterOrigins] = React.useState<Set<string>>(new Set());
  const [filterAuthors, setFilterAuthors] = React.useState<Set<string>>(new Set());
  const [filterSources, setFilterSources] = React.useState<Set<string>>(new Set());
  const [filterTags, setFilterTags] = React.useState<Set<string>>(new Set());
  const [filterDateRange, setFilterDateRange] = React.useState<'today' | '7d' | '30d' | null>(null);
  const [filterHasBacklinks, setFilterHasBacklinks] = React.useState(false);
  const [filterProps, setFilterProps] = React.useState<Array<{ key: string; op: 'is' | 'is not' | 'contains' | 'is empty' | 'is not empty'; value: string }>>([]);
  const [sortCol, setSortCol] = React.useState<'manual' | 'name' | 'type' | 'origin' | 'author' | 'source' | 'tags' | 'modified'>('manual');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');
  const [checkedIds, setCheckedIds] = React.useState<Set<string>>(new Set());
  const [docMenuId, setDocMenuId] = React.useState<string | null>(null);
  const [showNewTypeModal, setShowNewTypeModal] = React.useState(false);
  const [showNewViewModal, setShowNewViewModal] = React.useState(false);
  const [showManageViews, setShowManageViews] = React.useState(false);

  React.useEffect(() => {
    const handler = () => setCustomTypes(hydrateCustomTypes());
    window.addEventListener(CUSTOM_TYPES_EVENT, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(CUSTOM_TYPES_EVENT, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);
  const [deleteConfirm, setDeleteConfirm] = React.useState<{ id: string; title: string; type?: 'doc' | 'folder' } | null>(null);
  const [alsoForget, setAlsoForget] = React.useState(true);
  const [moveModal, setMoveModal] = React.useState<{ id: string; title: string; currentFolder: string | null } | null>(null);
  const [editingTitle, setEditingTitle] = React.useState(false);
  const [editingBody, setEditingBody] = React.useState(false);
  const [autoFocusBody, setAutoFocusBody] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState('');
  const [editBody, setEditBody] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [docTagInput, setDocTagInput] = React.useState('');
  const [docTagEditing, setDocTagEditing] = React.useState(false);
  const docTagJustAdded = React.useRef(false);
  const [docKindOverrides, setDocKindOverrides] = React.useState<Record<string, string>>({});
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);
  const createRef = React.useRef<HTMLDivElement>(null);
  const filterRef = React.useRef<HTMLDivElement>(null);
  const docMenuRef = React.useRef<HTMLDivElement>(null);

  /* Resizable columns: check(28-fixed) type(28-fixed) name origin source tags modified actions(60-fixed) */
  const docsCols = React.useMemo<ColDef[]>(() => [
    { key: 'check', minWidth: 28, initWidth: 28 },
    { key: 'type', minWidth: 28, initWidth: 28 },
    { key: 'name', minWidth: 120, initWidth: 0 },
    { key: 'origin', minWidth: 50, initWidth: 80 },
    { key: 'author', minWidth: 50, initWidth: 80 },
    { key: 'source', minWidth: 50, initWidth: 100 },
    { key: 'tags', minWidth: 50, initWidth: 80 },
    { key: 'modified', minWidth: 60, initWidth: 90 },
    { key: 'actions', minWidth: 40, initWidth: 50 },
  ], []);
  const docsResize = useColumnResize('docs-table-v2', docsCols);

  const [dragItem, setDragItem] = React.useState<{ type: 'doc' | 'folder'; id: string } | null>(null);
  const centerItemsRef = React.useRef<Array<{ type: 'folder'; folder: any } | { type: 'doc'; doc: any }>>([]);
  const [dropTarget, setDropTarget] = React.useState<string | null>(null);
  const [dropPosition, setDropPosition] = React.useState<'above' | 'below' | 'into'>('into');
  const [sidebarDocMenuId, setSidebarDocMenuId] = React.useState<string | null>(null);
  const [renamingFolderId, setRenamingFolderId] = React.useState<string | null>(null);
  const [renameFolderValue, setRenameFolderValue] = React.useState('');
  const smartViewsCtl = useSmartViews();
  const smartViews = smartViewsCtl.visibleViews;
  const [dragSmartViewId, setDragSmartViewId] = React.useState<string | null>(null);
  const [smartViewDropTarget, setSmartViewDropTarget] = React.useState<string | null>(null);

  /* ── Unified drag-over handler for center panel rows ── */
  const handleRowDragOver = (e: React.DragEvent, targetId: string, targetType: 'folder' | 'doc') => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const h = rect.height;
    let pos: 'above' | 'below' | 'into';
    if (targetType === 'folder') {
      if (y < h * 0.25) pos = 'above';
      else if (y > h * 0.75) pos = 'below';
      else pos = 'into';
    } else {
      pos = y < h * 0.5 ? 'above' : 'below';
    }
    setDropTarget(targetId);
    setDropPosition(pos);
  };

  /** Wraps fetch + checks res.ok so silent 4xx/5xx surface as console errors.
   *  fetch() resolves on any HTTP status, so a missing res.ok check makes
   *  failures invisible. */
  const docsPatch = async (url: string, body: Record<string, unknown>): Promise<boolean> => {
    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { ...authHeaders(props.authToken), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error(`[docs] PATCH ${url} → ${res.status}`, text.slice(0, 200));
        return false;
      }
      return true;
    } catch (err) {
      console.error(`[docs] PATCH ${url} threw`, err);
      return false;
    }
  };

  /** Skill rows live in the skills table, not objects. PATCHing them through
   *  the object endpoint would 404, so treat them as non-relocatable here. */
  const isSyntheticDocId = (id: string): boolean => {
    const o = props.objects.find(x => x.id === id);
    return o?.kind === 'skill';
  };

  const handleDrop = async (targetId: string, position: 'above' | 'below' | 'into', targetType: 'folder' | 'doc' = 'folder') => {
    if (!dragItem) {
      console.warn('[docs] drop fired with no dragItem');
      return;
    }
    if (dragItem.type === 'doc' && isSyntheticDocId(dragItem.id)) {
      console.info('[docs] skill rows are not relocatable from Docs — manage from Capabilities');
      setDragItem(null);
      setDropTarget(null);
      setDropPosition('into');
      return;
    }
    console.debug('[docs] drop', { dragItem, targetId, position, targetType });
    setDropTarget(null);
    setDropPosition('into');

    // Bulk move into folder
    if (checkedIds.size > 1 && position === 'into' && targetType === 'folder') {
      await handleBulkDrop(targetId);
      setDragItem(null);
      return;
    }

    // Drop INTO a folder — move item inside
    if (position === 'into' && targetType === 'folder') {
      const finalId = targetId === 'inbox' ? null : targetId;
      if (dragItem.type === 'doc') {
        props.onMoveDoc?.(dragItem.id, finalId);
        const ok = await docsPatch(`/pod/objects/${encodeURIComponent(dragItem.id)}`, { collection_id: finalId });
        if (ok) props.onRefresh?.();
        else props.onMoveDoc?.(dragItem.id, dragItem.id === finalId ? null : finalId); // best-effort revert noop; refresh will reconcile
      } else {
        if (dragItem.id !== targetId) {
          const ok = await docsPatch(`/pod/collections/${encodeURIComponent(dragItem.id)}`, { parent_id: finalId });
          if (ok) props.onRefresh?.();
        }
      }
      setDragItem(null);
      return;
    }

    // ABOVE / BELOW — reorder within the current view
    // Build the current item order from centerItems for the active folder context
    const currentCollectionId = activeFolderId === 'inbox' || !activeFolderId ? null : activeFolderId;

    // Get all items in the current view (same collection)
    type OrderItem = { type: 'folder' | 'doc'; id: string };
    const currentCenterItems = centerItemsRef.current;
    const viewItems: OrderItem[] = currentCenterItems.map(ci =>
      ci.type === 'folder' ? { type: 'folder' as const, id: ci.folder.id } : { type: 'doc' as const, id: ci.doc.id }
    );

    // Also include nested docs if the target is a nested doc
    const targetInNested = !viewItems.find(vi => vi.id === targetId);
    if (targetInNested) {
      // Target is a nested doc inside an expanded folder — move drag item into that folder
      const targetDoc = props.objects.find(d => d.id === targetId);
      const folderId = targetDoc?.collection_id ?? null;
      const finalId = (!folderId || folderId === 'inbox') ? null : folderId;
      if (dragItem.type === 'doc') {
        props.onMoveDoc?.(dragItem.id, finalId);
        const ok = await docsPatch(`/pod/objects/${encodeURIComponent(dragItem.id)}`, { collection_id: finalId });
        if (ok) props.onRefresh?.();
      }
      setDragItem(null);
      return;
    }

    // Find where to insert
    const dragItemKey: OrderItem = { type: dragItem.type, id: dragItem.id };
    const filtered = viewItems.filter(vi => !(vi.type === dragItemKey.type && vi.id === dragItemKey.id));
    const targetIdx = filtered.findIndex(vi => vi.id === targetId);
    const insertIdx = position === 'below' ? targetIdx + 1 : targetIdx;
    filtered.splice(Math.max(0, Math.min(insertIdx, filtered.length)), 0, dragItemKey);

    // Persist the new order
    const patches = filtered.map((item, i) => {
      const url = item.type === 'folder'
        ? `/pod/collections/${encodeURIComponent(item.id)}`
        : `/pod/objects/${encodeURIComponent(item.id)}`;
      return docsPatch(url, { sort_order: i });
    });
    const results = await Promise.all(patches);
    const failed = results.filter(ok => !ok).length;
    if (failed > 0) console.error(`[docs] reorder: ${failed}/${results.length} patches failed`);
    props.onRefresh?.();

    setDragItem(null);
  };

  /** Get collection_id for a doc */
  function getDocFolder(docId: string): string | null {
    const doc = props.objects.find(d => d.id === docId);
    return doc?.collection_id ?? null;
  }

  function findParentOfFolder(folderId: string): string | null {
    const col = props.collections.find(c => c.id === folderId);
    return col?.parent_id ?? null;
  }

  function getSiblingsInOrder(parentId: string | null): PodCollection[] {
    return props.collections
      .filter(c => c.id !== 'inbox' && c.id !== 'archive' && (c.parent_id ?? null) === parentId)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name));
  }

  const handleSmartViewDrop = (targetId: string) => {
    if (!dragSmartViewId || dragSmartViewId === targetId) {
      setDragSmartViewId(null);
      setSmartViewDropTarget(null);
      return;
    }
    smartViewsCtl.reorder(dragSmartViewId, targetId);
    setDragSmartViewId(null);
    setSmartViewDropTarget(null);
  };

  const createCustomSmartView = (label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const nextView = smartViewsCtl.addCustom({
      label: trimmed,
      filterTypes: filterTypes.size > 0 ? [...filterTypes] : undefined,
      filterOrigins: filterOrigins.size > 0 ? [...filterOrigins] : undefined,
      filterSources: filterSources.size > 0 ? [...filterSources] : undefined,
      filterTags: filterTags.size > 0 ? [...filterTags] : undefined,
      filterDateRange: filterDateRange ?? undefined,
      filterHasBacklinks: filterHasBacklinks || undefined,
      filterProps: filterProps.length > 0 ? filterProps : undefined,
      search: sidebarSearch.trim() || undefined,
    });
    selectView(nextView.id);
  };

  /* Persist favorites + collapsed sections */
  React.useEffect(() => { persistFavoriteIds(favoriteIds); }, [favoriteIds]);
  React.useEffect(() => { persistCollapsedSections(collapsedSections); }, [collapsedSections]);

  const toggleFavorite = (docId: string) => {
    setFavoriteIds(prev => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId); else next.add(docId);
      return next;
    });
  };

  const toggleSectionCollapse = (id: SidebarSectionId) => {
    setCollapsedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  /* Sidebar selection helpers — each clears the others to keep selection mutually exclusive. */
  const clearOtherSelections = () => {
    setActiveSmartView(null);
    setActiveTypeId(null);
    setActiveTagId(null);
    setShowFavorites(false);
  };
  const selectFavorites = () => {
    clearOtherSelections();
    setShowFavorites(true);
    setActiveFolderId('');
    setSelectedDocId(null);
    setSidebarRevealed(true);
  };
  const selectView = (id: string) => {
    clearOtherSelections();
    setActiveSmartView(id);
    setActiveFolderId('');
    setSelectedDocId(null);
    setSidebarRevealed(true);
  };
  const selectType = (id: string) => {
    clearOtherSelections();
    setActiveTypeId(id);
    setActiveFolderId('');
    setSelectedDocId(null);
    setSidebarRevealed(true);
  };
  const selectTag = (tag: string) => {
    clearOtherSelections();
    setActiveTagId(tag);
    setActiveFolderId('');
    setSelectedDocId(null);
    setSidebarRevealed(true);
  };

  /* Aggregate tags across visible docs (top N rendered in sidebar). */
  const tagCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const o of props.objects) {
      for (const t of o.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [props.objects]);
  const topTags = tagCounts.slice(0, 8);

  /* Aggregate connected sources for the filter panel. */
  const availableSources = React.useMemo(() => {
    const set = new Set<string>();
    for (const o of props.objects) set.add(o.source?.app ?? 'local');
    return [...set].sort();
  }, [props.objects]);

  /* Distinct authors across loaded objects — feeds the Author filter chips. */
  const availableAuthors = React.useMemo(() => {
    const byId = new Map<string, ActorIdentity>();
    for (const o of props.objects) {
      const ident = displayActor(o.last_modified_by);
      if (ident && !byId.has(ident.id)) byId.set(ident.id, ident);
    }
    return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [props.objects]);

  /* Tags used anywhere — for the filter panel tag cloud. */
  const allTagsList = React.useMemo(() => tagCounts.map(([t]) => t), [tagCounts]);

  /* All custom property keys used across docs — for filter panel. */
  const allPropKeys = React.useMemo(() => {
    const set = new Set<string>();
    for (const o of props.objects) {
      const meta = asObjectRecord(o.metadata);
      const custom = asObjectRecord(meta?.custom);
      if (custom) for (const k of Object.keys(custom)) set.add(k);
    }
    return [...set].sort();
  }, [props.objects]);

  /* Live count per Type for sidebar badges. */
  const typeCounts = React.useMemo(() => {
    const result: Record<string, number> = {};
    for (const t of DOC_TYPES) {
      result[t.id] = props.objects.filter(t.match).length;
    }
    return result;
  }, [props.objects]);

  /* Dynamic extra types from MEMORY_TYPES that have docs but aren't covered by DOC_TYPES. */
  const extraMemoryTypes = React.useMemo(() => {
    // Kinds already matched by existing DOC_TYPES
    const coveredKinds = new Set(['page', 'markdown', 'document', 'skill', 'file', 'pdf', 'image', 'csv']);
    return MEMORY_TYPES
      .filter(mt => !coveredKinds.has(mt.kind))
      .map(mt => {
        const count = props.objects.filter(o => o.kind === mt.kind).length;
        return { ...mt, count };
      })
      .filter(mt => mt.count > 0);
  }, [props.objects]);

  const saveDoc = async (id: string, patch: { title?: string; content?: unknown }) => {
    setSaving(true);
    try {
      const res = await fetch(`/pod/objects/${id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(props.authToken), 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`PATCH /pod/objects/${id} → ${res.status}`);
      // Update parent's object store so the new title/content is reflected
      // on subsequent renders without a full reload.
      if (patch.title !== undefined) props.onPatchObject?.(id, { title: patch.title });
    } catch (err) {
      console.error('saveDoc failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const setDocKind = async (id: string, kind: string) => {
    setDocKindOverrides(prev => ({ ...prev, [id]: kind }));
    try {
      const res = await fetch(`/pod/objects/${id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(props.authToken), 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind }),
      });
      if (!res.ok) throw new Error(`PATCH /pod/objects/${id} → ${res.status}`);
      props.onRefresh?.();
    } catch (err) { console.error('Type change failed:', err); }
  };

  const patchDocTags = async (id: string, tags: string[]) => {
    props.onPatchObject?.(id, { tags });
    try {
      const res = await fetch(`/pod/objects/${id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(props.authToken), 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags }),
      });
      if (!res.ok) throw new Error(`PATCH /pod/objects/${id} → ${res.status}`);
      props.onRefresh?.();
    } catch { /* sample mode */ }
  };

  React.useEffect(() => {
    if (props.initialDocId) {
      setSelectedDocId(props.initialDocId);
      props.onClearInitialDoc?.();
    }
  }, [props.initialDocId]);

  React.useEffect(() => {
    if (!props.initialCollectionId) return;
    setSelectedDocId(null);
    setActiveSmartView(null);
    setActiveTypeId(null);
    setActiveTagId(null);
    setShowFavorites(false);
    setActiveFolderId(props.initialCollectionId);
    props.onClearInitialCollection?.();
  }, [props.initialCollectionId]);

  const docReadyRef = React.useRef(false);
  const pendingTitleEdit = React.useRef(false);
  React.useEffect(() => {
    const wantsTitleEdit = pendingTitleEdit.current;
    pendingTitleEdit.current = false;
    if (wantsTitleEdit) {
      // New doc — open title in edit mode after a tick
      setEditingBody(false);
      setDocTagInput('');
      setDocTagEditing(false);
      docReadyRef.current = true;
      requestAnimationFrame(() => {
        setEditTitle('Untitled');
        setEditingTitle(true);
      });
    } else {
      setEditingTitle(false);
      setEditingBody(false);
      setDocTagInput('');
      setDocTagEditing(false);
      docReadyRef.current = false;
      const t = setTimeout(() => { docReadyRef.current = true; }, 300);
      return () => clearTimeout(t);
    }
  }, [selectedDocId]);

  // Close doc context menu on outside click.
  // Use `pointerdown` on the next tick so the toggle button's click isn't
  // immediately caught by the handler (which would close the menu before it
  // finishes opening, causing a white-screen race on fast re-renders).
  React.useEffect(() => {
    if (!docMenuId) return;
    let armed = false;
    const raf = requestAnimationFrame(() => { armed = true; });
    const handler = (e: MouseEvent) => {
      if (!armed) return;
      if (docMenuRef.current && !docMenuRef.current.contains(e.target as Node)) setDocMenuId(null);
    };
    document.addEventListener('pointerdown', handler);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('pointerdown', handler); };
  }, [docMenuId]);

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'folder') {
      try {
        await fetch(`/pod/collections/${encodeURIComponent(deleteConfirm.id)}`, { method: 'DELETE', headers: authHeaders(props.authToken) });
        if (activeFolderId === deleteConfirm.id) setActiveFolderId('inbox');
        props.onRefresh?.();
      } catch (err) { console.error('Delete folder failed:', err); }
    } else {
      props.onDeleteDoc?.(deleteConfirm.id, alsoForget);
      if (selectedDocId === deleteConfirm.id) setSelectedDocId(null);
    }
    setDeleteConfirm(null);
    setAlsoForget(true);
  };

  const handleMoveDoc = async (targetFolderId: string) => {
    if (!moveModal) return;
    const docId = moveModal.id;
    const finalId = targetFolderId === 'inbox' ? null : targetFolderId;
    setMoveModal(null);
    props.onMoveDoc?.(docId, finalId);
    try {
      await fetch(`/pod/objects/${docId}`, {
        method: 'PATCH',
        headers: { ...authHeaders(props.authToken), 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection_id: finalId }),
      });
    } catch { /* API may not be available in sample mode */ }
  };

  const [bulkDeleteConfirm, setBulkDeleteConfirm] = React.useState(false);
  const handleBulkDelete = async () => {
    for (const cid of checkedIds) {
      try {
        if (cid.startsWith('folder:')) {
          const folderId = cid.slice(7);
          await fetch(`/pod/collections/${encodeURIComponent(folderId)}`, { method: 'DELETE', headers: authHeaders(props.authToken) });
          if (activeFolderId === folderId) setActiveFolderId('inbox');
        } else {
          props.onDeleteDoc?.(cid, alsoForget);
          if (selectedDocId === cid) setSelectedDocId(null);
        }
      } catch (err) { console.error('Bulk delete failed:', err); }
    }
    setCheckedIds(new Set());
    setBulkDeleteConfirm(false);
    setAlsoForget(true);
    props.onRefresh?.();
  };

  const handleBulkDrop = async (targetFolderId: string) => {
    const finalId = targetFolderId === 'inbox' ? null : targetFolderId;
    for (const cid of checkedIds) {
      if (cid.startsWith('folder:')) {
        const folderId = cid.slice(7);
        if (folderId === targetFolderId) continue;
        try { await fetch(`/pod/collections/${encodeURIComponent(folderId)}`, { method: 'PATCH', headers: { ...authHeaders(props.authToken), 'Content-Type': 'application/json' }, body: JSON.stringify({ parent_id: finalId }) }); } catch { /* sample mode */ }
      } else {
        props.onMoveDoc?.(cid, finalId);
        try { await fetch(`/pod/objects/${encodeURIComponent(cid)}`, { method: 'PATCH', headers: { ...authHeaders(props.authToken), 'Content-Type': 'application/json' }, body: JSON.stringify({ collection_id: finalId }) }); } catch { /* sample mode */ }
      }
    }
    setCheckedIds(new Set());
  };

  // Radix DropdownMenu handles outside-click via onOpenChange — no manual handler needed

  // Close filter panel on outside click
  React.useEffect(() => {
    if (!showFilters) return;
    const handler = (e: MouseEvent) => { if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilters(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFilters]);

  const objectMap = React.useMemo(() => {
    const m: Record<string, PodObject> = {};
    for (const o of props.objects) m[o.id] = o;
    return m;
  }, [props.objects]);

  /* Build folder tree dynamically from real collections & objects */
  const folderTree = React.useMemo<DocTreeFolder[]>(() => {
    const byCollection: Record<string, string[]> = {};
    const unfiled: string[] = [];
    for (const obj of props.objects) {
      const cid = obj.collection_id;
      if (cid && props.collections.some(c => c.id === cid)) {
        (byCollection[cid] ??= []).push(obj.id);
      } else {
        unfiled.push(obj.id);
      }
    }

    const nodeMap: Record<string, DocTreeFolder> = {};
    for (const col of props.collections) {
      if (col.id === 'inbox') continue;
      nodeMap[col.id] = { id: col.id, label: col.name, children: [], docIds: byCollection[col.id] ?? [], sortOrder: col.sort_order ?? 0 };
    }

    const roots: DocTreeFolder[] = [];
    for (const col of props.collections) {
      if (col.id === 'inbox') continue;
      const node = nodeMap[col.id];
      if (col.parent_id && nodeMap[col.parent_id]) {
        nodeMap[col.parent_id].children.push(node);
      } else {
        roots.push(node);
      }
    }

    const inboxIds = [...unfiled, ...(byCollection['inbox'] ?? [])];
    const archiveNode = nodeMap['archive'];
    const userRoots = roots.filter(r => r.id !== 'archive');
    return [
      { id: 'inbox', label: 'Inbox', children: [], docIds: inboxIds, sortOrder: -1 },
      ...userRoots,
      ...(archiveNode ? [archiveNode] : [{ id: 'archive', label: 'Archive', children: [], docIds: [], sortOrder: 9999 }]),
    ];
  }, [props.objects, props.collections]);

  const toggleFolder = (id: string) => setExpandedFolders(prev => ({ ...prev, [id]: !prev[id] }));
  const selectFolder = (id: string) => {
    clearOtherSelections();
    setActiveFolderId(id);
    setSelectedDocId(null);
    setSidebarRevealed(true);
  };

  /* Build ancestor chain for breadcrumb */
  function findFolderAncestors(folders: DocTreeFolder[], targetId: string, path: DocTreeFolder[] = []): DocTreeFolder[] | null {
    for (const f of folders) {
      if (f.id === targetId) return [...path, f];
      const found = findFolderAncestors(f.children, targetId, [...path, f]);
      if (found) return found;
    }
    return null;
  }

  /* Find current folder node */
  function findFolder(folders: DocTreeFolder[], id: string): DocTreeFolder | null {
    for (const f of folders) {
      if (f.id === id) return f;
      const found = findFolder(f.children, id);
      if (found) return found;
    }
    return null;
  }

  const currentFolder = activeFolderId ? findFolder(folderTree, activeFolderId) : null;
  const isInsideFolder = !!activeFolderId && activeFolderId !== 'inbox';

  const createLocalDoc = (collectionId?: string) => {
    const newId = `doc_${Date.now()}`;
    const obj: PodObject = {
      id: newId,
      collection_id: collectionId ?? 'inbox',
      kind: 'page',
      title: 'Untitled',
      origin: 'manual' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: [],
      content: '',
    };
    props.onAddObject?.(obj);
    pendingTitleEdit.current = true;
    setSelectedDocId(newId);
  };

  const createDoc = async (folderId: string) => {
    const collectionId = folderId === 'inbox' ? undefined : folderId;
    try {
      const res = await fetch('/pod/objects', {
        method: 'POST',
        headers: { ...authHeaders(props.authToken), 'content-type': 'application/json' },
        body: JSON.stringify({ actor_id: 'person-local', kind: 'page', title: 'Untitled', content: '', collection_id: collectionId, origin: 'manual' }),
      });
      if (res.ok) {
        const data = await res.json();
        props.onRefresh?.();
        const newId = data.object?.id ?? null;
        pendingTitleEdit.current = true;
        setSelectedDocId(newId);
      } else {
        createLocalDoc(collectionId);
      }
    } catch { createLocalDoc(collectionId); }
  };

  const createDocQuiet = async () => {
    try {
      const res = await fetch('/pod/objects', {
        method: 'POST',
        headers: { ...authHeaders(props.authToken), 'content-type': 'application/json' },
        body: JSON.stringify({ actor_id: 'person-local', kind: 'page', title: 'Untitled', content: '', origin: 'manual' }),
      });
      if (res.ok) {
        const data = await res.json();
        props.onRefresh?.();
        const newId = data.object?.id ?? null;
        pendingTitleEdit.current = true;
        setSelectedDocId(newId);
      } else {
        createLocalDoc();
      }
    } catch { createLocalDoc(); }
  };

  React.useEffect(() => {
    if (!rawProps.createDocRequestId) return;
    rawProps.onClearCreateDocRequest?.();
    void createDoc(activeFolderId || 'inbox');
  }, [rawProps.createDocRequestId]);

  const createFolder = async (parentId: string | null) => {
    const createLocalFolder = () => {
      const newId = `col_${Date.now()}`;
      const col: PodCollection = { id: newId, name: 'Untitled', description: '', updated_at: new Date().toISOString(), parent_id: parentId ?? undefined };
      props.onAddCollection?.(col);
      if (parentId) setExpandedFolders(prev => ({ ...prev, [parentId]: true }));
      setTimeout(() => { setRenamingFolderId(newId); setRenameFolderValue(''); }, 100);
    };
    try {
      const res = await fetch('/pod/collections', {
        method: 'POST',
        headers: { ...authHeaders(props.authToken), 'content-type': 'application/json' },
        body: JSON.stringify({ actor_id: 'person-local', name: 'Untitled', parent_id: parentId }),
      });
      if (res.ok) {
        const data = await res.json();
        props.onRefresh?.();
        const newId = data.collection?.id;
        if (newId) {
          if (parentId) setExpandedFolders(prev => ({ ...prev, [parentId]: true }));
          setTimeout(() => { setRenamingFolderId(newId); setRenameFolderValue(''); }, 100);
        }
      } else {
        createLocalFolder();
      }
    } catch { createLocalFolder(); }
  };

  React.useEffect(() => {
    if (!rawProps.createFolderRequestId) return;
    rawProps.onClearCreateFolderRequest?.();
    void createFolder(activeFolderId === 'inbox' ? null : activeFolderId || null);
  }, [rawProps.createFolderRequestId]);

  /* Build items for center pane */
  type CenterItem = { type: 'folder'; folder: DocTreeFolder } | { type: 'doc'; doc: PodObject };
  let centerItems: CenterItem[] = [];
  let centerLabel = '';
  const selectedSmartView = activeSmartView ? smartViews.find(v => v.id === activeSmartView) ?? null : null;
  const selectedType = activeTypeId ? DOC_TYPES.find(t => t.id === activeTypeId) ?? null : null;
  const selectedMemoryType = activeTypeId && !selectedType ? MEMORY_TYPES.find(t => t.kind === activeTypeId) ?? null : null;
  const selectedCustomType = activeTypeId && !selectedType && !selectedMemoryType ? customTypes.find(t => t.id === activeTypeId) ?? null : null;

  if (showFavorites) {
    centerLabel = 'Favorites';
    const favDocs = props.objects.filter(o => favoriteIds.has(o.id));
    centerItems = favDocs.map(d => ({ type: 'doc' as const, doc: d }));
  } else if (selectedSmartView) {
    centerLabel = selectedSmartView.label;
    const smartDocs = getDocsForSmartView(selectedSmartView, props.objects);
    centerItems = smartDocs.map(d => ({ type: 'doc', doc: d }));
  } else if (selectedType) {
    centerLabel = selectedType.label;
    centerItems = props.objects.filter(selectedType.match).map(d => ({ type: 'doc' as const, doc: d }));
  } else if (selectedMemoryType) {
    centerLabel = selectedMemoryType.label;
    centerItems = props.objects.filter(o => o.kind === selectedMemoryType.kind).map(d => ({ type: 'doc' as const, doc: d }));
  } else if (selectedCustomType) {
    centerLabel = selectedCustomType.label;
    centerItems = props.objects
      .filter(o => o.kind === selectedCustomType.id)
      .map(d => ({ type: 'doc' as const, doc: d }));
  } else if (activeTagId) {
    centerLabel = `#${activeTagId}`;
    centerItems = props.objects
      .filter(o => (o.tags ?? []).includes(activeTagId))
      .map(d => ({ type: 'doc' as const, doc: d }));
  } else if (activeFolderId === '__all__') {
    centerLabel = 'All Docs';
    centerItems = props.objects.map(d => ({ type: 'doc' as const, doc: d }));
  } else if (activeFolderId === 'inbox' && !sidebarRevealed) {
    centerLabel = '';
    const topFolders = folderTree.filter(f => f.id !== 'inbox' && f.id !== 'archive');
    centerItems = [
      ...topFolders.map(f => ({ type: 'folder' as const, folder: f })),
      ...props.objects.map(d => ({ type: 'doc' as const, doc: d })),
    ];
  } else if (currentFolder) {
    centerLabel = currentFolder.label;
    centerItems = [
      ...currentFolder.children.map(c => ({ type: 'folder' as const, folder: c })),
      ...currentFolder.docIds.map(id => objectMap[id]).filter(Boolean).map(d => ({ type: 'doc' as const, doc: d })),
    ];
  }

  // Filter by search
  if (sidebarSearch) {
    const q = sidebarSearch.toLowerCase();
    centerItems = centerItems.filter(item =>
      item.type === 'folder' ? item.folder.label.toLowerCase().includes(q) : item.doc.title.toLowerCase().includes(q)
    );
  }

  // Filter panel predicates (multi-select).
  const applyFilterPredicates = (item: CenterItem): boolean => {
    if (item.type === 'folder') return true;
    const doc = item.doc;
    if (filterTypes.size > 0 && !filterTypes.has(getFilterKind(doc.kind))) return false;
    if (filterOrigins.size > 0 && !(doc.origin && filterOrigins.has(doc.origin))) return false;
    if (filterAuthors.size > 0) {
      const ident = displayActor(doc.last_modified_by);
      if (!ident || !filterAuthors.has(ident.id)) return false;
    }
    if (filterSources.size > 0 && !filterSources.has(doc.source?.app ?? 'local')) return false;
    if (filterTags.size > 0) {
      const tags = doc.tags ?? [];
      if (!tags.some(t => filterTags.has(t))) return false;
    }
    if (filterDateRange && !passDateRange(doc.updated_at, filterDateRange)) return false;
    if (filterHasBacklinks && !(doc.backlink_count && doc.backlink_count > 0)) return false;
    if (filterProps.length > 0) {
      const meta = asObjectRecord(doc.metadata);
      const custom = asObjectRecord(meta?.custom) as Record<string, { type?: string; value?: string }> | null;
      for (const rule of filterProps) {
        const propVal = custom?.[rule.key]?.value ?? '';
        switch (rule.op) {
          case 'is': if (propVal.toLowerCase() !== rule.value.toLowerCase()) return false; break;
          case 'is not': if (propVal.toLowerCase() === rule.value.toLowerCase()) return false; break;
          case 'contains': if (!propVal.toLowerCase().includes(rule.value.toLowerCase())) return false; break;
          case 'is empty': if (propVal !== '') return false; break;
          case 'is not empty': if (propVal === '') return false; break;
        }
      }
    }
    return true;
  };
  centerItems = centerItems.filter(applyFilterPredicates);

  const activeFilterCount = filterTypes.size + filterOrigins.size + filterAuthors.size + filterSources.size + filterTags.size
    + (filterDateRange ? 1 : 0) + (filterHasBacklinks ? 1 : 0) + filterProps.length;
  const hasActiveFilters = activeFilterCount > 0;

  // Sort
  const toggleSort = (col: 'name' | 'type' | 'origin' | 'author' | 'source' | 'tags' | 'modified') => {
    // Resize drags are already suppressed by ColResizeHandle's capture-phase
    // click blocker, so no resize guard is needed here.
    if (sortCol === col) {
      if (sortDir === 'asc') setSortDir('desc');
      else { setSortCol('manual'); setSortDir('asc'); }
    }
    else { setSortCol(col); setSortDir(col === 'modified' ? 'desc' : 'asc'); }
  };
  centerItems.sort((a, b) => {
    if (sortCol === 'manual') {
      const orderOf = (i: CenterItem) => i.type === 'folder' ? (i.folder.sortOrder ?? 0) : (i.doc.sort_order ?? 0);
      return orderOf(a) - orderOf(b);
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    const nameOf = (i: CenterItem) => i.type === 'folder' ? i.folder.label : i.doc.title;
    const typeOf = (i: CenterItem) => i.type === 'folder' ? '' : getTypeLabel(i.doc.kind);
    const originOf = (i: CenterItem) => i.type === 'folder' ? '' : (i.doc.origin ?? '');
    const authorOf = (i: CenterItem) => i.type === 'folder' ? '' : (displayActor(i.doc.last_modified_by)?.label ?? '');
    const sourceOf = (i: CenterItem) => i.type === 'folder' ? '' : (i.doc.source?.app ?? '');
    const tagsOf = (i: CenterItem) => i.type === 'folder' ? '' : ((i.doc.tags?.[0] ?? '').toLowerCase());
    const modifiedOf = (i: CenterItem) => i.type === 'folder' ? '' : (i.doc.updated_at ?? '');
    let cmp = 0;
    switch (sortCol) {
      case 'name': cmp = nameOf(a).localeCompare(nameOf(b)); break;
      case 'type': cmp = typeOf(a).localeCompare(typeOf(b)); break;
      case 'origin': cmp = originOf(a).localeCompare(originOf(b)); break;
      case 'author': cmp = authorOf(a).localeCompare(authorOf(b)); break;
      case 'source': cmp = sourceOf(a).localeCompare(sourceOf(b)); break;
      case 'tags': cmp = tagsOf(a).localeCompare(tagsOf(b)); break;
      case 'modified': cmp = modifiedOf(a).localeCompare(modifiedOf(b)); break;
    }
    return cmp * dir;
  });

  // Keep ref current so handleDrop can access the latest centerItems
  centerItemsRef.current = centerItems;

  // Progressive rendering — show first 50, auto-load more on scroll
  const { visible: visibleCenterItems, hasMore: hasMoreDocs, sentinelRef: docsSentinelRef, total: totalDocs, showing: showingDocs } = useProgressiveRender(centerItems, 50);

  // Checkbox helpers (operate on the full list, not just visible)
  const allIds = centerItems.map(i => i.type === 'folder' ? `folder:${i.folder.id}` : i.doc.id);
  const allChecked = allIds.length > 0 && allIds.every(id => checkedIds.has(id));
  const someChecked = allIds.some(id => checkedIds.has(id));
  const toggleCheck = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (allChecked) setCheckedIds(new Set());
    else setCheckedIds(new Set(allIds));
  };

  const selectedDoc = selectedDocId ? objectMap[selectedDocId] ?? null : null;

  /* Fetch vault content for selected doc (try backend, fall back to object content) */
  const [vaultContent, setVaultContent] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!selectedDocId) { setVaultContent(null); return; }
    let cancelled = false;
    fetch(`/pod/objects/${encodeURIComponent(selectedDocId)}/vault`, { headers: authHeaders(props.authToken) })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!cancelled && data?.content) setVaultContent(data.content); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selectedDocId]);

  /* Derive page content: prefer vault markdown, fall back to object content field */
  const pageContent = React.useMemo<{ meta: string; body: string } | null>(() => {
    if (!selectedDoc) return null;
    if (vaultContent) {
      // Split vault markdown: everything after second --- is body
      const parts = vaultContent.split('---');
      const meta = parts.length >= 3 ? parts[1].trim() : '';
      const body = parts.length >= 3 ? parts.slice(2).join('---').trim() : vaultContent;
      return { meta: `Vault file · ${meta.split('\n').length} frontmatter fields`, body };
    }
    // Fall back: build from object content field
    const body = generateFallbackContent(selectedDoc);
    const metaParts: string[] = [];
    if (selectedDoc.kind) metaParts.push(`Kind: ${selectedDoc.kind}`);
    if (selectedDoc.source?.app) metaParts.push(`Source: ${selectedDoc.source.app}`);
    metaParts.push(`Updated ${relativeTime(selectedDoc.updated_at)}`);
    return { meta: metaParts.join(' · '), body };
  }, [selectedDoc, vaultContent]);


  const startRenameFolder = (folderId: string, currentName: string) => {
    setRenamingFolderId(folderId);
    setRenameFolderValue(currentName);
  };

  const commitRenameFolder = async () => {
    if (!renamingFolderId) return;
    const trimmed = renameFolderValue.trim();
    if (trimmed) {
      try {
        await fetch(`/pod/collections/${encodeURIComponent(renamingFolderId)}`, {
          method: 'PATCH',
          headers: { ...authHeaders(props.authToken), 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed }),
        });
        props.onRefresh?.();
      } catch (err) { console.error('Rename folder failed:', err); }
    }
    setRenamingFolderId(null);
    setRenameFolderValue('');
  };

  const deleteSidebarDoc = (docId: string) => {
    const doc = objectMap[docId];
    if (doc) setDeleteConfirm({ id: docId, title: doc.title, type: 'doc' });
    setSidebarDocMenuId(null);
  };

  /* Recursive sidebar folder renderer */
  function renderFolderTree(folders: DocTreeFolder[], depth: number = 0) {
    return folders.map(folder => {
      const isActive = activeFolderId === folder.id && !activeSmartView;
      const isExpanded = expandedFolders[folder.id] ?? false;
      const hasChildren = folder.children.length > 0;
      const hasDocs = folder.docIds.length > 0;
      const showExpanded = isExpanded && (hasChildren || hasDocs);
      const count = countFolderDocs(folder);
      const isDraggable = folder.id !== 'inbox' && folder.id !== 'archive';
      const isDropAbove = dropTarget === folder.id && dropPosition === 'above';
      const isDropBelow = dropTarget === folder.id && dropPosition === 'below';
      const isDropInto = dropTarget === folder.id && dropPosition === 'into';

      const handleFolderDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!isDraggable) { setDropTarget(folder.id); setDropPosition('into'); return; }
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const third = rect.height / 3;
        if (y < third) { setDropTarget(folder.id); setDropPosition('above'); }
        else if (y > third * 2) { setDropTarget(folder.id); setDropPosition('below'); }
        else { setDropTarget(folder.id); setDropPosition('into'); }
      };

      return (
        <React.Fragment key={folder.id}>
          <div style={{ position: 'relative' }}>
            {isDropAbove && <div className="drop-indicator drop-indicator-above" style={{ left: 12 + depth * 16 }} />}
            <div
              role="button"
              tabIndex={0}
              className={`docs-tree-item ${isActive ? 'active' : ''} ${isDropInto ? 'drop-target' : ''}`}
              style={{ paddingLeft: 12 + depth * 16 }}
              onClick={() => { selectFolder(folder.id); setExpandedFolders(prev => ({ ...prev, [folder.id]: true })); }}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
                e.preventDefault();
                selectFolder(folder.id);
                setExpandedFolders(prev => ({ ...prev, [folder.id]: true }));
              }}
              draggable={isDraggable}
              onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDragItem({ type: 'folder', id: folder.id }); }}
              onDragEnd={() => { setDragItem(null); setDropTarget(null); setDropPosition('into'); }}
              onDragOver={handleFolderDragOver}
              onDragLeave={() => { setDropTarget(null); setDropPosition('into'); }}
              onDrop={(e) => { e.preventDefault(); handleDrop(folder.id, dropPosition); }}
            >
              <span className="docs-tree-hover-chevron" onClick={(e) => { e.stopPropagation(); toggleFolder(folder.id); }}>
                <ChevronRight size={12} style={{ transform: showExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease' }} />
              </span>
              {showExpanded ? <FolderOpen size={14} /> : <Folder size={14} />}
              {renamingFolderId === folder.id ? (
                <input
                  className="docs-tree-rename-input"
                  value={renameFolderValue}
                  autoFocus
                  placeholder="Folder name"
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setRenameFolderValue(e.target.value)}
                  onBlur={() => commitRenameFolder()}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitRenameFolder(); if (e.key === 'Escape') { setRenamingFolderId(null); setRenameFolderValue(''); } }}
                />
              ) : (
                <>
                  <span className="docs-tree-label">{folder.label}</span>
                  {count > 0 && <span className="docs-sidebar-count">{count}</span>}
                </>
              )}
              <span className="docs-tree-actions">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="docs-tree-action-btn" title="Actions" onClick={(e) => e.stopPropagation()}>
                      <MoreVertical size={12} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="right">
                    <DropdownMenuItem onSelect={() => createDoc(folder.id)}>
                      <FilePlus size={12} /> New Doc
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => createFolder(folder.id === 'inbox' ? null : folder.id)}>
                      <FolderPlus size={12} /> New Folder
                    </DropdownMenuItem>
                    {isDraggable && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => startRenameFolder(folder.id, folder.label)}>
                          <Pencil size={12} /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setDeleteConfirm({ id: folder.id, title: folder.label, type: 'folder' })}>
                          <Trash2 size={12} /> Delete
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                <button type="button" className="docs-tree-action-btn" title="New doc" onClick={(e) => { e.stopPropagation(); createDoc(folder.id); }}>
                  <Plus size={12} />
                </button>
              </span>
            </div>
            {isDropBelow && <div className="drop-indicator drop-indicator-below" style={{ left: 12 + depth * 16 }} />}
          </div>
          {showExpanded && renderFolderTree(folder.children, depth + 1)}
          {isExpanded && folder.docIds.map(docId => {
            const doc = objectMap[docId];
            if (!doc) return null;
            const isDocActive = selectedDocId === docId;
            return (
              <div
                key={docId}
                className={`docs-tree-doc ${isDocActive ? 'active' : ''}`}
                style={{ paddingLeft: 12 + (depth + 1) * 16 }}
                onClick={() => setSelectedDocId(docId)}
                draggable
                onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDragItem({ type: 'doc', id: docId }); }}
                onDragEnd={() => { setDragItem(null); setDropTarget(null); setDropPosition('into'); }}
              >
                <span className="docs-tree-hover-chevron">
                  <ChevronRight size={12} />
                </span>
                <FileText size={12} />
                <span className="docs-tree-label">{doc.title || 'Untitled'}</span>
                <span className="docs-tree-actions">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="docs-tree-action-btn" title="Actions" onClick={(e) => e.stopPropagation()}>
                        <MoreVertical size={12} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" side="right">
                      <DropdownMenuItem onSelect={() => deleteSidebarDoc(docId)}>
                        <Trash2 size={12} /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <span className="docs-tree-action-btn" title="New doc" onClick={(e) => { e.stopPropagation(); createDoc(folder.id); }}>
                    <Plus size={12} />
                  </span>
                </span>
              </div>
            );
          })}
        </React.Fragment>
      );
    });
  }

  /* A folder pin or folder is only active when no cross-cutting selection is in play. */
  const noCrossSelection = !activeSmartView && !activeTypeId && !activeTagId && !showFavorites;
  const isFolderPinActive = (id: string) => activeFolderId === id && noCrossSelection;
  const favoriteDocs = props.objects.filter(o => favoriteIds.has(o.id));

  /* Render a sidebar section header with chevron + label + count + add button. */
  const renderSectionHeader = (id: SidebarSectionId, label: string, count: number | null, onAdd?: () => void, addTitle?: string) => {
    const collapsed = collapsedSections[id];
    return (
      <button className="docs-sidebar-section-heading docs-sidebar-section-heading-button" onClick={() => toggleSectionCollapse(id)}>
        <ChevronRight size={11} style={{ transform: collapsed ? 'none' : 'rotate(90deg)', transition: 'transform 0.15s ease' }} />
        <span className="docs-sidebar-section-label">{label}</span>
        <span className="docs-sidebar-section-actions">
          {count !== null && count > 0 && <span className="docs-sidebar-section-count">{count}</span>}
          {onAdd && (
            <span
              role="button"
              className="docs-sidebar-add-btn"
              title={addTitle ?? `Add ${label.toLowerCase()}`}
              onClick={(e) => { e.stopPropagation(); onAdd(); }}
            >
              <Plus size={13} />
            </span>
          )}
        </span>
      </button>
    );
  };

  return (
    <div className={`docs-view ${!inspectorOpen ? 'inspector-collapsed' : ''} ${!sidebarRevealed ? 'sidebar-hidden' : ''}`} style={inspectorOpen ? { '--inspector-w': `${inspectorWidth}px` } as React.CSSProperties : undefined}>
      {/* Left sidebar */}
      <div className="docs-sidebar">
        {/* Pinned: Inbox / All Docs / Archive */}
        <div className="docs-sidebar-pinned">
          <div
            className={`docs-tree-item docs-tree-pinned ${isFolderPinActive('inbox') ? 'active' : ''}`}
            onClick={() => selectFolder('inbox')}
          >
            <Inbox size={15} />
            <span className="docs-tree-label">Inbox</span>
            {(() => { const f = folderTree.find(f => f.id === 'inbox'); const c = f ? countFolderDocs(f) : 0; return c > 0 ? <span className="docs-tree-count accent">{c}</span> : null; })()}
          </div>
          <div
            className={`docs-tree-item docs-tree-pinned ${isFolderPinActive('__all__') ? 'active' : ''}`}
            onClick={() => selectFolder('__all__')}
          >
            <FileText size={15} />
            <span className="docs-tree-label">All Docs</span>
            <span className="docs-tree-count">{props.objects.length}</span>
          </div>
          <div
            className={`docs-tree-item docs-tree-pinned ${isFolderPinActive('archive') ? 'active' : ''}`}
            onClick={() => selectFolder('archive')}
          >
            <Archive size={15} />
            <span className="docs-tree-label">Archive</span>
            {(() => { const f = folderTree.find(f => f.id === 'archive'); const c = f ? countFolderDocs(f) : 0; return c > 0 ? <span className="docs-tree-count">{c}</span> : null; })()}
          </div>
        </div>

        {/* Favorites */}
        <div className="docs-sidebar-section">
          {renderSectionHeader('favorites', 'Favorites', favoriteDocs.length)}
          {!collapsedSections.favorites && (
            favoriteDocs.length === 0 ? (
              <p className="docs-sidebar-empty">Star a doc to pin it here.</p>
            ) : (
              <>
                <div
                  className={`docs-tree-item ${showFavorites ? 'active' : ''}`}
                  onClick={() => selectFavorites()}
                >
                  <Star size={14} />
                  <span className="docs-tree-label">All favorites</span>
                  <span className="docs-tree-count">{favoriteDocs.length}</span>
                </div>
                {favoriteDocs.slice(0, 6).map(doc => (
                  <div
                    key={doc.id}
                    className={`docs-tree-doc ${selectedDocId === doc.id ? 'active' : ''}`}
                    style={{ paddingLeft: 28 }}
                    onClick={() => { setSelectedDocId(doc.id); setSidebarRevealed(true); }}
                  >
                    <FileText size={12} />
                    <span className="docs-tree-label">{doc.title || 'Untitled'}</span>
                  </div>
                ))}
              </>
            )
          )}
        </div>

        {/* Types — knowledge-artifact taxonomy + user-authored */}
        <div className="docs-sidebar-section">
          {renderSectionHeader('types', 'Types', null, () => setShowNewTypeModal(true), 'New type')}
          {!collapsedSections.types && (
            <>
              {DOC_TYPES.map(t => {
                const Icon = t.icon;
                const count = typeCounts[t.id] ?? 0;
                if (count === 0) return null;
                const isActive = activeTypeId === t.id;
                return (
                  <div
                    key={t.id}
                    className={`docs-tree-item docs-tree-type ${isActive ? 'active' : ''}`}
                    onClick={() => selectType(t.id)}
                    style={{ ['--type-color' as any]: t.color }}
                  >
                    <Icon size={14} color={t.color} />
                    <span className="docs-tree-label">{t.label}</span>
                    <span className="docs-tree-count">{count}</span>
                  </div>
                );
              })}
              {extraMemoryTypes.map(mt => {
                const Icon = mt.icon;
                const isActive = activeTypeId === mt.kind;
                return (
                  <div
                    key={mt.kind}
                    className={`docs-tree-item docs-tree-type ${isActive ? 'active' : ''}`}
                    onClick={() => selectType(mt.kind)}
                    style={{ ['--type-color' as any]: mt.color }}
                  >
                    <Icon size={14} color={mt.color} />
                    <span className="docs-tree-label">{mt.label}</span>
                    <span className="docs-tree-count">{mt.count}</span>
                  </div>
                );
              })}
              {customTypes.map(ct => {
                const Icon = CUSTOM_TYPE_ICON_MAP[ct.icon] ?? FileText;
                const count = props.objects.filter(o => o.kind === ct.id).length;
                const isActive = activeTypeId === ct.id;
                return (
                  <div
                    key={ct.id}
                    className={`docs-tree-item docs-tree-type docs-tree-custom-type ${isActive ? 'active' : ''}`}
                    onClick={() => selectType(ct.id)}
                    style={{ ['--type-color' as any]: ct.color }}
                  >
                    <Icon size={14} color={ct.color} />
                    <span className="docs-tree-label">{ct.label}</span>
                    {count > 0 && <span className="docs-tree-count">{count}</span>}
                    <button
                      className="docs-tree-item-action"
                      title="Delete type"
                      onClick={e => {
                        e.stopPropagation();
                        if (!confirm(`Delete the "${ct.label}" type? Docs using this type keep the value but will lose its color/icon.`)) return;
                        persistCustomTypes(customTypes.filter(t => t.id !== ct.id));
                        if (activeTypeId === ct.id) { setActiveTypeId(null); setActiveFolderId('inbox'); }
                      }}
                    >
                      <X size={11} />
                    </button>
                  </div>
                );
              })}
              {DOC_TYPES.every(t => (typeCounts[t.id] ?? 0) === 0) && customTypes.length === 0 && (
                <p className="docs-sidebar-empty">No types yet. Click + to create one.</p>
              )}
            </>
          )}
        </div>

        {/* Tags — top N by usage */}
        {topTags.length > 0 && (
          <div className="docs-sidebar-section">
            {renderSectionHeader('tags', 'Tags', tagCounts.length)}
            {!collapsedSections.tags && topTags.map(([tag, count]) => {
              const isActive = activeTagId === tag;
              return (
                <div
                  key={tag}
                  className={`docs-tree-item ${isActive ? 'active' : ''}`}
                  onClick={() => selectTag(tag)}
                >
                  <Hash size={13} />
                  <span className="docs-tree-label">{tag}</span>
                  <span className="docs-tree-count">{count}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Folders */}
        <div className="docs-sidebar-section">
          {renderSectionHeader('folders', 'Folders', null, () => createFolder(null), 'New folder')}
          {!collapsedSections.folders && (
            folderTree.filter(f => f.id !== 'inbox' && f.id !== 'archive').length === 0 ? (
              <p className="docs-sidebar-empty">No folders yet. Click + to create one or drag a doc in.</p>
            ) : (
              renderFolderTree(folderTree.filter(f => f.id !== 'inbox' && f.id !== 'archive'))
            )
          )}
        </div>

      </div>

      {/* Persistent toolbar — spans center + inspector */}
      <div className="docs-toolbar">
        <div className="docs-toolbar-left">
          <nav className="docs-breadcrumb">
            <button
              className="docs-breadcrumb-collapse"
              title={sidebarRevealed ? 'Collapse sidebar' : 'Show sidebar'}
              onClick={() => {
                if (sidebarRevealed) { setSidebarRevealed(false); }
                else { setSidebarRevealed(true); }
              }}
            >
              <Sidebar size={14} />
            </button>
            <button
              className={`docs-breadcrumb-seg ${!sidebarRevealed && !selectedDoc ? 'current' : ''}`}
              onClick={() => { setSidebarRevealed(false); setActiveFolderId('inbox'); setActiveSmartView(''); setSelectedDocId(null); }}
            >
              Docs
            </button>
            {(() => {
              // Determine which folder to show in breadcrumb:
              // If a doc is selected, use its collection_id; otherwise use activeFolderId
              const folderId = selectedDoc
                ? (selectedDoc.collection_id || activeFolderId)
                : activeFolderId;
              if (folderId && folderId !== 'inbox') {
                const ancestors = findFolderAncestors(folderTree, folderId) ?? [];
                return ancestors.map((seg, i) => (
                  <React.Fragment key={seg.id}>
                    <ChevronRight size={12} className="docs-breadcrumb-sep" />
                    <button
                      className={`docs-breadcrumb-seg ${!selectedDoc && i === ancestors.length - 1 ? 'current' : ''}`}
                      onClick={() => { selectFolder(seg.id); setSelectedDocId(null); }}
                    >
                      {seg.label}
                    </button>
                  </React.Fragment>
                ));
              }
              return null;
            })()}
            {!selectedDoc && showFavorites && (
              <>
                <ChevronRight size={12} className="docs-breadcrumb-sep" />
                <span className="docs-breadcrumb-seg current">Favorites</span>
              </>
            )}
            {!selectedDoc && activeSmartView && selectedSmartView && (
              <>
                <ChevronRight size={12} className="docs-breadcrumb-sep" />
                <span className="docs-breadcrumb-seg">Saved filters</span>
                <ChevronRight size={12} className="docs-breadcrumb-sep" />
                <span className="docs-breadcrumb-seg current">{selectedSmartView.label}</span>
              </>
            )}
            {!selectedDoc && selectedType && (
              <>
                <ChevronRight size={12} className="docs-breadcrumb-sep" />
                <span className="docs-breadcrumb-seg">Types</span>
                <ChevronRight size={12} className="docs-breadcrumb-sep" />
                <span className="docs-breadcrumb-seg current">{selectedType.label}</span>
              </>
            )}
            {!selectedDoc && activeTagId && (
              <>
                <ChevronRight size={12} className="docs-breadcrumb-sep" />
                <span className="docs-breadcrumb-seg">Tags</span>
                <ChevronRight size={12} className="docs-breadcrumb-sep" />
                <span className="docs-breadcrumb-seg current">#{activeTagId}</span>
              </>
            )}
            {selectedDoc && (
              <>
                <ChevronRight size={12} className="docs-breadcrumb-sep" />
                <span className="docs-breadcrumb-seg current">{selectedDoc.title}</span>
              </>
            )}
            {!selectedDoc && <span className="docs-toolbar-count">{hasMoreDocs ? `${showingDocs} of ${totalDocs}` : totalDocs}</span>}
          </nav>
        </div>
        <div className="docs-toolbar-right">
          <div className={`docs-toolbar-search ${searchOpen ? 'open' : ''}`}>
            {searchOpen ? (
              <div className="docs-toolbar-search-field">
                <Search size={14} />
                <input
                  ref={searchInputRef}
                  autoFocus
                  placeholder="Search docs..."
                  value={sidebarSearch}
                  onChange={e => setSidebarSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') { setSidebarSearch(''); setSearchOpen(false); } }}
                />
                <button className="docs-toolbar-search-close" onClick={() => { setSidebarSearch(''); setSearchOpen(false); }}>
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button className={`docs-action-btn ${sidebarSearch ? 'has-filter' : ''}`} title="Search" onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50); }}>
                <Search size={14} />
              </button>
            )}
          </div>
          <div className="docs-filter-wrap" ref={filterRef}>
            <button className={`docs-action-btn ${hasActiveFilters ? 'has-filter' : ''}`} title="Filter" onClick={() => setShowFilters(!showFilters)}>
              <Filter size={14} />
              {activeFilterCount > 0 && <span className="filter-count-badge">{activeFilterCount}</span>}
            </button>
            {showFilters && (
              <div className="docs-filter-panel">
                <div className="docs-filter-header">
                  <div>
                    <strong>Filters</strong>
                    <p>Refine the current docs view</p>
                  </div>
                  <Button variant="icon" size="icon-sm" onClick={() => setShowFilters(false)}><X size={14} /></Button>
                </div>
                <div className="docs-filter-section">
                  <div className="docs-filter-label-row">
                    <span className="docs-filter-label">Saved filters</span>
                    <button className="conn-link" onClick={() => { setShowFilters(false); setShowManageViews(true); }}>Manage</button>
                  </div>
                  <div className="docs-filter-chips">
                    {smartViews.map(view => {
                      const Icon = view.icon;
                      return (
                        <button key={view.id} className={`docs-filter-chip ${activeSmartView === view.id ? 'active' : ''}`} onClick={() => { selectView(view.id); setShowFilters(false); }}>
                          <Icon size={11} /> {view.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="docs-filter-section">
                  <span className="docs-filter-label">Type</span>
                  <div className="docs-filter-chips">
                    {[
                      { id: 'page', label: 'Pages' },
                      { id: 'file', label: 'Files' },
                    ].map(t => {
                      const active = filterTypes.has(t.id);
                      return (
                        <button key={t.id} className={`docs-filter-chip ${active ? 'active' : ''}`} onClick={() => setFilterTypes(prev => { const next = new Set(prev); if (next.has(t.id)) next.delete(t.id); else next.add(t.id); return next; })}>{t.label}</button>
                      );
                    })}
                  </div>
                </div>
                <div className="docs-filter-section">
                  <span className="docs-filter-label">Origin</span>
                  <div className="docs-filter-chips">
                    {[
                      { id: 'written', label: 'Written' },
                      { id: 'imported', label: 'Imported' },
                      { id: 'reflected', label: 'Reflected' },
                      { id: 'agent-edited', label: 'Agent edited' },
                      { id: 'synced', label: 'Synced' },
                    ].map(o => {
                      const active = filterOrigins.has(o.id);
                      return (
                        <button key={o.id} className={`docs-filter-chip ${active ? 'active' : ''}`} onClick={() => setFilterOrigins(prev => { const next = new Set(prev); if (next.has(o.id)) next.delete(o.id); else next.add(o.id); return next; })}>{o.label}</button>
                      );
                    })}
                  </div>
                </div>
                {availableAuthors.length > 1 && (
                  <div className="docs-filter-section">
                    <span className="docs-filter-label">Author</span>
                    <div className="docs-filter-chips">
                      {availableAuthors.map(ident => {
                        const active = filterAuthors.has(ident.id);
                        return (
                          <button key={ident.id} className={`docs-filter-chip ${active ? 'active' : ''}`} title={`${ident.role} · ${ident.id}`} onClick={() => setFilterAuthors(prev => { const next = new Set(prev); if (next.has(ident.id)) next.delete(ident.id); else next.add(ident.id); return next; })}>{ident.label}</button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {availableSources.length > 1 && (
                  <div className="docs-filter-section">
                    <span className="docs-filter-label">Source</span>
                    <div className="docs-filter-chips">
                      {availableSources.map(src => {
                        const active = filterSources.has(src);
                        return (
                          <button key={src} className={`docs-filter-chip ${active ? 'active' : ''}`} onClick={() => setFilterSources(prev => { const next = new Set(prev); if (next.has(src)) next.delete(src); else next.add(src); return next; })}>{src}</button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {allTagsList.length > 0 && (
                  <div className="docs-filter-section">
                    <span className="docs-filter-label">Tags</span>
                    <div className="docs-filter-chips">
                      {allTagsList.slice(0, 20).map(tag => {
                        const active = filterTags.has(tag);
                        return (
                          <button key={tag} className={`docs-filter-chip ${active ? 'active' : ''}`} onClick={() => setFilterTags(prev => { const next = new Set(prev); if (next.has(tag)) next.delete(tag); else next.add(tag); return next; })}>#{tag}</button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {allPropKeys.length > 0 && (
                  <div className="docs-filter-section">
                    <span className="docs-filter-label">Properties</span>
                    <div className="docs-filter-prop-rules">
                      {filterProps.map((rule, idx) => (
                        <div className="docs-filter-prop-row" key={idx}>
                          <select className="docs-filter-prop-select" value={rule.key} onChange={e => setFilterProps(prev => prev.map((r, i) => i === idx ? { ...r, key: e.target.value } : r))}>
                            {allPropKeys.map(k => <option key={k} value={k}>{k}</option>)}
                          </select>
                          <select className="docs-filter-prop-op" value={rule.op} onChange={e => setFilterProps(prev => prev.map((r, i) => i === idx ? { ...r, op: e.target.value as typeof rule.op } : r))}>
                            <option value="is">is</option>
                            <option value="is not">is not</option>
                            <option value="contains">contains</option>
                            <option value="is empty">is empty</option>
                            <option value="is not empty">is not empty</option>
                          </select>
                          {rule.op !== 'is empty' && rule.op !== 'is not empty' && (
                            <input className="docs-filter-prop-value" placeholder="Value" value={rule.value} onChange={e => setFilterProps(prev => prev.map((r, i) => i === idx ? { ...r, value: e.target.value } : r))} />
                          )}
                          <button className="docs-filter-prop-remove" onClick={() => setFilterProps(prev => prev.filter((_, i) => i !== idx))} title="Remove rule"><X size={12} /></button>
                        </div>
                      ))}
                      <button className="docs-filter-prop-add" onClick={() => setFilterProps(prev => [...prev, { key: allPropKeys[0], op: 'is', value: '' }])}>
                        <Plus size={12} /> Add property rule
                      </button>
                    </div>
                  </div>
                )}
                <div className="docs-filter-section">
                  <span className="docs-filter-label">Modified</span>
                  <div className="docs-filter-chips">
                    {([
                      { id: 'today' as const, label: 'Today' },
                      { id: '7d' as const,    label: 'Past 7 days' },
                      { id: '30d' as const,   label: 'Past 30 days' },
                    ]).map(d => {
                      const active = filterDateRange === d.id;
                      return (
                        <button key={d.id} className={`docs-filter-chip ${active ? 'active' : ''}`} onClick={() => setFilterDateRange(active ? null : d.id)}>{d.label}</button>
                      );
                    })}
                  </div>
                </div>
                <div className="docs-filter-section">
                  <label className="docs-filter-toggle">
                    <input type="checkbox" checked={filterHasBacklinks} onChange={e => setFilterHasBacklinks(e.target.checked)} />
                    <span>Has backlinks</span>
                  </label>
                </div>
                <div className="docs-filter-footer">
                  {hasActiveFilters && (
                    <button className="docs-filter-clear" onClick={() => { setFilterTypes(new Set()); setFilterOrigins(new Set()); setFilterSources(new Set()); setFilterTags(new Set()); setFilterDateRange(null); setFilterHasBacklinks(false); setFilterProps([]); }}>Clear all</button>
                  )}
                  <button className="docs-filter-save" disabled={!hasActiveFilters} onClick={() => { setShowFilters(false); setShowNewViewModal(true); }}>
                    <Plus size={12} /> Save filter
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="docs-create-wrap" ref={createRef}>
            <div className="docs-create-btn">
              <button
                className="docs-create-label"
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); setShowCreateMenu(false); if (!sidebarRevealed) { createDocQuiet(); } else { createDoc(activeFolderId || 'inbox'); } }}
              >
                Create Doc
              </button>
              <span className="docs-create-divider-v" />
              <DropdownMenu open={showCreateMenu} onOpenChange={setShowCreateMenu}>
                <DropdownMenuTrigger asChild>
                  <button className="docs-create-chevron" aria-label="Create options"><ChevronDown size={12} /></button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => { if (!sidebarRevealed) { createDocQuiet(); } else { createDoc(activeFolderId || 'inbox'); } }}><FilePlus size={14} /> New Doc</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => createFolder(activeFolderId === 'inbox' ? null : activeFolderId || null)}><FolderPlus size={14} /> New Folder</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => props.onOpenImport?.(activeFolderId ?? undefined)}><DownloadCloud size={14} /> Import</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Center pane */}
      <div className="docs-main">
        {!docsReady ? (
          <div style={{ padding: '8px 0' }}><TableSkeleton rows={10} cols={7} /></div>
        ) : selectedDoc ? (
          <div className="docs-reader">
            <div className="docs-page-actions">
              <button className={`docs-inspect-fab has-label ${rawEditorOpen ? 'active' : ''}`} onClick={() => setRawEditorOpen(!rawEditorOpen)}>
                <CodeXml size={16} />
                <span className="docs-fab-label">Raw Editor</span>
              </button>
              {!inspectorOpen && (
                <button className="docs-inspect-fab has-label" onClick={() => setInspectorOpen(true)}>
                  <Eye size={16} />
                  <span className="docs-fab-label">Inspect</span>
                </button>
              )}
              <div style={{ position: 'relative' }}>
                <button className="docs-inspect-fab" onClick={() => setDocMenuId(docMenuId === selectedDocId ? null : selectedDocId)} title="More actions">
                  <MoreVertical size={16} />
                </button>
                {docMenuId === selectedDocId && (
                  <div className="doc-context-menu" ref={docMenuRef} style={{ right: 0, top: '100%' }}>
                    <button className="doc-context-item" onClick={() => {
                      setDocMenuId(null);
                      const text = vaultContent ?? generateFallbackContent(selectedDoc);
                      const blob = new Blob([text], { type: 'text/markdown' });
                      const a = document.createElement('a');
                      a.href = URL.createObjectURL(blob);
                      a.download = `${selectedDoc.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
                      a.click();
                      URL.revokeObjectURL(a.href);
                    }}>
                      <Download size={13} /> Download .md
                    </button>
                    <button className="doc-context-item" onClick={() => {
                      setDocMenuId(null);
                      const text = vaultContent ?? generateFallbackContent(selectedDoc);
                      const filename = `${selectedDoc.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
                      const w = window as any;
                      if (w.coffeePod?.openInDefaultApp) {
                        w.coffeePod.openInDefaultApp(filename, text);
                      } else {
                        window.open(URL.createObjectURL(new Blob([text], { type: 'text/markdown' })), '_blank');
                      }
                    }}>
                      <ExternalLink size={13} /> Open in…
                    </button>
                    <button className="doc-context-item" onClick={() => { setDocMenuId(null); setMoveModal({ id: selectedDoc.id, title: selectedDoc.title, currentFolder: selectedDoc.collection_id ?? null }); }}>
                      <FolderInput size={13} /> Move
                    </button>
                    <button className="doc-context-item danger" onClick={() => { setDocMenuId(null); setDeleteConfirm({ id: selectedDoc.id, title: selectedDoc.title, type: 'doc' }); }}>
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
            {rawEditorOpen ? (
              <>
                <div className="docs-content-inner docs-content-inner-slim">
                  <h1 className="docs-page-title">{selectedDoc.title}</h1>
                  <div className="docs-page-meta">
                    <OriginBadge origin={selectedDoc.origin} authoredBy={selectedDoc.authored_by ?? (selectedDoc.metadata as Record<string, unknown> | null)?.authored_by as string | undefined} />
                  </div>
                </div>
                <div className="docs-raw-editor">
                  <RawDocEditor
                    key={selectedDoc.id}
                    initialRaw={generateRawDoc(selectedDoc, pageContent, vaultContent)}
                    onSave={async ({ title, body, tags }) => {
                      const content = (selectedDoc.content ?? {}) as Record<string, unknown>;
                      const newContent = { ...content, text: body };
                      const patch: { title?: string; content?: unknown } = { content: newContent };
                      if (title && title !== selectedDoc.title) patch.title = title;
                      await saveDoc(selectedDoc.id, patch);
                      (selectedDoc as any).content = newContent;
                      if (patch.title) (selectedDoc as any).title = patch.title;
                      // Stale vault projection would otherwise clobber the edit
                      // if the user toggles back to raw view.
                      setVaultContent(null);
                      if (tags && JSON.stringify(tags) !== JSON.stringify(selectedDoc.tags ?? [])) {
                        patchDocTags(selectedDoc.id, tags);
                        (selectedDoc as any).tags = tags;
                      }
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="docs-content-inner">
                {editingTitle ? (
                  <input
                    className="docs-page-title docs-title-input"
                    autoFocus
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    onFocus={e => { if (editTitle === 'Untitled') e.target.select(); }}
                    onBlur={async () => {
                      const trimmed = editTitle.trim() || 'Untitled';
                      if (trimmed !== selectedDoc.title) {
                        await saveDoc(selectedDoc.id, { title: trimmed });
                        (selectedDoc as any).title = trimmed;
                      }
                      setEditingTitle(false);
                      // Focus the body editor after title commit
                      requestAnimationFrame(() => {
                        const el = document.querySelector('.plate-editor-content') as HTMLElement | null;
                        el?.focus();
                      });
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
                      if (e.key === 'Escape') { setEditTitle(selectedDoc.title); setEditingTitle(false); }
                    }}
                  />
                ) : (
                  <h1 className="docs-page-title docs-title-editable" onClick={() => { if (!docReadyRef.current) return; setEditTitle(selectedDoc.title); setEditingTitle(true); }}>{selectedDoc.title}</h1>
                )}
                <div className="docs-page-meta-strip">
                  <AppDropdown
                    className="docs-inline-type-dropdown"
                    value={docKindOverrides[selectedDoc.id] ?? selectedDoc.kind}
                    onChange={v => setDocKind(selectedDoc.id, v)}
                    options={[
                      ...MEMORY_TYPES.map(t => ({ value: t.kind, label: t.label, swatch: getTypeColor(t.kind) })),
                      ...customTypes.map(ct => ({ value: ct.id, label: ct.label, group: 'Custom', swatch: getTypeColor(ct.id) })),
                      ...(!MEMORY_TYPES.find(t => t.kind === (docKindOverrides[selectedDoc.id] ?? selectedDoc.kind)) && !customTypes.find(ct => ct.id === (docKindOverrides[selectedDoc.id] ?? selectedDoc.kind)) ? [{ value: docKindOverrides[selectedDoc.id] ?? selectedDoc.kind, label: getTypeLabel(docKindOverrides[selectedDoc.id] ?? selectedDoc.kind), swatch: getTypeColor(docKindOverrides[selectedDoc.id] ?? selectedDoc.kind) }] : []),
                    ]}
                  />
                  <OriginBadge origin={selectedDoc.origin} authoredBy={selectedDoc.authored_by ?? (selectedDoc.metadata as Record<string, unknown> | null)?.authored_by as string | undefined} />
                  <div className="inline-tags-row">
                    {(selectedDoc.tags ?? []).map(tag => (
                      <span key={tag} className="inline-tag-chip">
                        #{tag}
                        <button className="inline-tag-remove" onClick={() => { const next = (selectedDoc.tags ?? []).filter(t => t !== tag); patchDocTags(selectedDoc.id, next); }}>&times;</button>
                      </span>
                    ))}
                    {!docTagEditing && (
                      <span className="inline-tags-add" onClick={() => setDocTagEditing(true)}>
                        <Tag size={12} />
                        <span>Add tag</span>
                      </span>
                    )}
                    {docTagEditing && (
                      <input
                        className="inline-tag-input"
                        autoFocus
                        placeholder="tag name"
                        value={docTagInput}
                        onChange={e => setDocTagInput(e.target.value)}
                        onBlur={() => {
                          // On blur: save any pending text as a tag, then close
                          const t = docTagInput.trim().toLowerCase().replace(/^#/, '');
                          if (t && !(selectedDoc.tags ?? []).includes(t)) {
                            patchDocTags(selectedDoc.id, [...(selectedDoc.tags ?? []), t]);
                          }
                          setDocTagInput('');
                          setDocTagEditing(false);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const t = docTagInput.trim().toLowerCase().replace(/^#/, '');
                            if (t && !(selectedDoc.tags ?? []).includes(t)) {
                              patchDocTags(selectedDoc.id, [...(selectedDoc.tags ?? []), t]);
                            }
                            setDocTagInput('');
                            // Keep input open for next tag
                          }
                          if (e.key === 'Escape') { setDocTagInput(''); setDocTagEditing(false); }
                        }}
                      />
                    )}
                  </div>
                  {saving && <span className="docs-saving-indicator">Saving...</span>}
                </div>
                <React.Suspense fallback={<div className="journal-editor-loading">Loading editor…</div>}>
                  <PlateDocEditor
                    key={selectedDoc.id}
                    authToken={props.authToken}
                    initialContent={(() => {
                    const stripCodeFence = (s: string) => {
                      const trimmed = s.trim();
                      if (trimmed.startsWith('```') && trimmed.endsWith('```')) {
                        const inner = trimmed.slice(trimmed.indexOf('\n') + 1, trimmed.lastIndexOf('```')).trim();
                        if (inner) return inner;
                      }
                      return s;
                    };
                    const raw = selectedDoc.content;
                    if (!raw || raw === '' || (typeof raw === 'object' && Object.keys(raw).length === 0)) return '';
                    const content = documentContentFields(raw);
                    if (content.text !== null) return stripCodeFence(content.text);
                    if (content.body !== null) return stripCodeFence(content.body);
                    if (pageContent?.body) return stripCodeFence(pageContent.body);
                    return generateFallbackContent(selectedDoc);
                    })()}
                    autoFocus={autoFocusBody}
                    onChange={async (markdown) => {
                      const content = (selectedDoc.content ?? {}) as Record<string, unknown>;
                      const newContent = { ...content, text: markdown };
                      await saveDoc(selectedDoc.id, { content: newContent });
                      (selectedDoc as any).content = newContent;
                      if (autoFocusBody) setAutoFocusBody(false);
                    }}
                  />
                </React.Suspense>
              </div>
            )}
          </div>
        ) : (
          <div className="docs-table-resizable" style={{ '--doc-grid': docsResize.gridTemplate } as React.CSSProperties}>
            <div className="docs-table-head">
              <span className="docs-col-check">
                <input type="checkbox" className="row-checkbox" aria-label="Select all docs" checked={allChecked} ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }} onChange={toggleAll} />
              </span>
              <span className="docs-col-type" />
              <button className={`docs-col-name docs-col-sort resizable-col ${sortCol === 'name' ? 'active' : ''}`} onClick={() => toggleSort('name')}>
                Name <ArrowUpDown size={12} className={sortCol === 'name' ? `sort-icon ${sortDir}` : 'sort-icon'} />
                <ColResizeHandle colIndex={2} onResize={docsResize.onResize} onResolve={docsResize.resolveWidth} />
              </button>
              <button className={`docs-col-origin docs-col-sort resizable-col ${sortCol === 'origin' ? 'active' : ''}`} onClick={() => toggleSort('origin')}>
                Origin <ArrowUpDown size={12} className={sortCol === 'origin' ? `sort-icon ${sortDir}` : 'sort-icon'} />
                <ColResizeHandle colIndex={3} onResize={docsResize.onResize} />
              </button>
              <button className={`docs-col-author docs-col-sort resizable-col ${sortCol === 'author' ? 'active' : ''}`} onClick={() => toggleSort('author')}>
                Author <ArrowUpDown size={12} className={sortCol === 'author' ? `sort-icon ${sortDir}` : 'sort-icon'} />
                <ColResizeHandle colIndex={4} onResize={docsResize.onResize} />
              </button>
              <button className={`docs-col-source docs-col-sort resizable-col ${sortCol === 'source' ? 'active' : ''}`} onClick={() => toggleSort('source')}>
                Source <ArrowUpDown size={12} className={sortCol === 'source' ? `sort-icon ${sortDir}` : 'sort-icon'} />
                <ColResizeHandle colIndex={5} onResize={docsResize.onResize} />
              </button>
              <button className={`docs-col-tags docs-col-sort resizable-col ${sortCol === 'tags' ? 'active' : ''}`} onClick={() => toggleSort('tags')}>
                Tags <ArrowUpDown size={12} className={sortCol === 'tags' ? `sort-icon ${sortDir}` : 'sort-icon'} />
                <ColResizeHandle colIndex={6} onResize={docsResize.onResize} />
              </button>
              <button className={`docs-col-modified docs-col-sort resizable-col ${sortCol === 'modified' ? 'active' : ''}`} onClick={() => toggleSort('modified')}>
                Modified <ArrowUpDown size={12} className={sortCol === 'modified' ? `sort-icon ${sortDir}` : 'sort-icon'} />
                <ColResizeHandle colIndex={7} onResize={docsResize.onResize} />
              </button>
              <span className="docs-col-actions" />
            </div>

            {checkedIds.size > 0 && (
              <div className="docs-bulk-bar">
                <span className="docs-bulk-count">{checkedIds.size} selected</span>
                <button className="docs-bulk-action" onClick={() => setBulkDeleteConfirm(true)}>
                  <Trash2 size={13} /> Delete
                </button>
                <button className="docs-bulk-action" onClick={() => { setCheckedIds(new Set()); }}>
                  <X size={13} /> Clear
                </button>
              </div>
            )}

            <div className="docs-table-body">
              {centerItems.length > 0 ? visibleCenterItems.map(item => {
                if (item.type === 'folder') {
                  const f = item.folder;
                  const count = countFolderDocs(f);
                  const isExpanded = !!mainExpandedFolders[f.id];
                  const folderDocs = f.docIds.map(id => objectMap[id]).filter(Boolean);
                  return (
                    <React.Fragment key={f.id}>
                      <div className="docs-table-row-wrap" style={{ position: 'relative' }}>
                        {dropTarget === f.id && dropPosition === 'above' && <div className="drop-indicator drop-indicator-above" />}
                        <div role="button" tabIndex={0} className={`docs-table-row folder-row ${dropTarget === f.id && dropPosition === 'into' ? 'drop-target' : ''} ${checkedIds.has(`folder:${f.id}`) ? 'checked' : ''}`} onClick={() => setMainExpandedFolders(prev => ({ ...prev, [f.id]: !prev[f.id] }))}
                          onKeyDown={(e) => {
                            if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
                            e.preventDefault();
                            setMainExpandedFolders(prev => ({ ...prev, [f.id]: !prev[f.id] }));
                          }}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = 'move';
                            setDragItem({ type: 'folder', id: f.id });
                            if (checkedIds.size > 0 && !checkedIds.has(`folder:${f.id}`)) {
                              setCheckedIds(prev => new Set([...prev, `folder:${f.id}`]));
                            }
                          }}
                          onDragEnd={() => { setDragItem(null); setDropTarget(null); setDropPosition('into'); }}
                          onDragOver={(e) => handleRowDragOver(e, f.id, 'folder')}
                          onDragLeave={() => { setDropTarget(null); setDropPosition('into'); }}
                          onDrop={(e) => { e.preventDefault(); handleDrop(f.id, dropPosition, 'folder'); }}
                        >
                          <span className="docs-col-check" onClick={(e) => toggleCheck(`folder:${f.id}`, e)}>
                            <input type="checkbox" className="row-checkbox" aria-label="Select folder row" checked={checkedIds.has(`folder:${f.id}`)} readOnly />
                          </span>
                          <span className="docs-col-type" />
                          <span className="docs-col-name">
                            <GripVertical size={12} className="row-drag-handle" />
                            <ChevronRight size={12} className={`row-chevron ${isExpanded ? 'expanded' : ''}`} />
                            <Folder size={14} className="row-icon" />
                            <span className="docs-row-title">{f.label}</span>
                            <span className="row-item-count">{count}</span>
                          </span>
                          <span className="docs-col-origin" />
                          <span className="docs-col-author" />
                          <span className="docs-col-source" />
                          <span className="docs-col-tags" />
                          <span className="docs-col-modified" />
                          <span className="docs-col-actions" style={{ position: 'relative' }}>
                            <button className="row-action-btn" onClick={e => { e.stopPropagation(); setDocMenuId(docMenuId === `folder:${f.id}` ? null : `folder:${f.id}`); }}><MoreVertical size={14} /></button>
                            {docMenuId === `folder:${f.id}` && (
                              <div className="doc-context-menu" ref={docMenuRef}>
                                <button className="doc-context-item" onClick={e => { e.stopPropagation(); setDocMenuId(null); createDoc(f.id); }}>
                                  <FilePlus size={13} /> New Doc
                                </button>
                                <button className="doc-context-item" onClick={e => { e.stopPropagation(); setDocMenuId(null); createFolder(f.id); }}>
                                  <FolderPlus size={13} /> New Folder
                                </button>
                                <button className="doc-context-item" onClick={e => { e.stopPropagation(); setDocMenuId(null); startRenameFolder(f.id, f.label); }}>
                                  <Pencil size={13} /> Rename
                                </button>
                                <button className="doc-context-item danger" onClick={e => { e.stopPropagation(); setDocMenuId(null); setDeleteConfirm({ id: f.id, title: f.label, type: 'folder' }); }}>
                                  <Trash2 size={13} /> Delete
                                </button>
                              </div>
                            )}
                          </span>
                        </div>
                        {dropTarget === f.id && dropPosition === 'below' && <div className="drop-indicator drop-indicator-below" />}
                      </div>
                      {isExpanded && folderDocs.map(doc => (
                        <div key={doc.id} className="docs-table-row-wrap" style={{ position: 'relative' }}>
                          {dropTarget === doc.id && dropPosition === 'above' && <div className="drop-indicator drop-indicator-above" />}
                          <div role="button" tabIndex={0} className={`docs-table-row nested-doc ${selectedDocId === doc.id ? 'selected' : ''} ${checkedIds.has(doc.id) ? 'checked' : ''}`} onClick={() => { setSelectedDocId(doc.id); setActiveFolderId(f.id); setSidebarRevealed(true); }}
                            onKeyDown={(e) => {
                              if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
                              e.preventDefault();
                              setSelectedDocId(doc.id);
                              setActiveFolderId(f.id);
                              setSidebarRevealed(true);
                            }}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = 'move';
                              setDragItem({ type: 'doc', id: doc.id });
                              if (checkedIds.size > 0 && !checkedIds.has(doc.id)) {
                                setCheckedIds(prev => new Set([...prev, doc.id]));
                              }
                            }}
                            onDragEnd={() => { setDragItem(null); setDropTarget(null); setDropPosition('into'); }}
                            onDragOver={(e) => handleRowDragOver(e, doc.id, 'doc')}
                            onDragLeave={() => { setDropTarget(null); setDropPosition('into'); }}
                            onDrop={(e) => { e.preventDefault(); handleDrop(doc.id, dropPosition, 'doc'); }}
                          >
                            <span className="docs-col-check" onClick={(e) => toggleCheck(doc.id, e)}>
                              <input type="checkbox" className="row-checkbox" aria-label="Select doc row" checked={checkedIds.has(doc.id)} readOnly />
                            </span>
                            <span className="docs-col-type">
                              {(() => { const k = docKindOverrides[doc.id] ?? doc.kind; const I = getTypeIcon(k); return <I size={14} color={getTypeColor(k)} />; })()}
                            </span>
                            <span className="docs-col-name" style={{ paddingLeft: 16 }}>
                              <GripVertical size={12} className="row-drag-handle" />
                                                            <span className="docs-row-title">{doc.title || 'Untitled'}</span>
                            </span>
                            <span className="docs-col-origin"><OriginBadge origin={doc.origin as DocOrigin | undefined} authoredBy={doc.authored_by ?? (doc.metadata as Record<string, unknown> | null)?.authored_by as string | undefined} /></span>
                            <span className="docs-col-author"><ActorBadge actorId={doc.last_modified_by} /></span>
                            <span className="docs-col-source">{(() => { const src = doc.source?.app ?? (doc.origin === 'manual' ? 'local' : ''); return src ? <>{src !== 'local' && src !== 'coffee-pod' && <span className="db-source-icon">{sourceAppIcon(src, 14)}</span>}{formatSourceName(src)}</> : null; })()}</span>
                            <span className="docs-col-tags">
                              {(doc.tags ?? []).slice(0, 2).map(t => (
                                <span key={t} className="row-tag-chip">#{t}</span>
                              ))}
                              {(doc.tags ?? []).length > 2 && <span className="row-tag-overflow">+{(doc.tags ?? []).length - 2}</span>}
                            </span>
                            <span className="docs-col-modified">{relativeTime(doc.updated_at)}</span>
                            <span className="docs-col-actions" style={{ position: 'relative' }}>
                              <button className="row-action-btn" onClick={e => { e.stopPropagation(); setDocMenuId(docMenuId === doc.id ? null : doc.id); }}><MoreVertical size={14} /></button>
                              {docMenuId === doc.id && (
                                <div className="doc-context-menu" ref={docMenuRef}>
                                  <button className="doc-context-item" onClick={e => { e.stopPropagation(); setDocMenuId(null); setMoveModal({ id: doc.id, title: doc.title, currentFolder: doc.collection_id ?? null }); }}>
                                    <FolderInput size={13} /> Move
                                  </button>
                                  <button className="doc-context-item danger" onClick={e => { e.stopPropagation(); setDocMenuId(null); setDeleteConfirm({ id: doc.id, title: doc.title, type: 'doc' }); }}>
                                    <Trash2 size={13} /> Delete
                                  </button>
                                </div>
                              )}
                            </span>
                          </div>
                          {dropTarget === doc.id && dropPosition === 'below' && <div className="drop-indicator drop-indicator-below" />}
                        </div>
                      ))}
                    </React.Fragment>
                  );
                }
                const doc = item.doc;
                return (
                  <div key={doc.id} className="docs-table-row-wrap" style={{ position: 'relative' }}>
                    {dropTarget === doc.id && dropPosition === 'above' && <div className="drop-indicator drop-indicator-above" />}
                    <div role="button" tabIndex={0} className={`docs-table-row ${selectedDocId === doc.id ? 'selected' : ''} ${checkedIds.has(doc.id) ? 'checked' : ''}`} onClick={() => { setSelectedDocId(doc.id); setSidebarRevealed(true); }}
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
                        e.preventDefault();
                        setSelectedDocId(doc.id);
                        setSidebarRevealed(true);
                      }}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move';
                        setDragItem({ type: 'doc', id: doc.id });
                        if (checkedIds.size > 0 && !checkedIds.has(doc.id)) {
                          setCheckedIds(prev => new Set([...prev, doc.id]));
                        }
                      }}
                      onDragEnd={() => { setDragItem(null); setDropTarget(null); setDropPosition('into'); }}
                      onDragOver={(e) => handleRowDragOver(e, doc.id, 'doc')}
                      onDragLeave={() => { setDropTarget(null); setDropPosition('into'); }}
                      onDrop={(e) => { e.preventDefault(); handleDrop(doc.id, dropPosition, 'doc'); }}
                    >
                      <span className="docs-col-check" onClick={(e) => toggleCheck(doc.id, e)}>
                        <input type="checkbox" className="row-checkbox" aria-label="Select doc row" checked={checkedIds.has(doc.id)} readOnly />
                      </span>
                      <span className="docs-col-type">
                        {(() => { const k = docKindOverrides[doc.id] ?? doc.kind; const I = getTypeIcon(k); return <I size={14} color={getTypeColor(k)} />; })()}
                      </span>
                      <span className="docs-col-name">
                        <GripVertical size={12} className="row-drag-handle" />
                                                <span className="docs-row-title">{doc.title || 'Untitled'}</span>
                      </span>
                      <span className="docs-col-origin"><OriginBadge origin={doc.origin as DocOrigin | undefined} authoredBy={doc.authored_by ?? (doc.metadata as Record<string, unknown> | null)?.authored_by as string | undefined} /></span>
                      <span className="docs-col-author"><ActorBadge actorId={doc.last_modified_by} /></span>
                      <span className="docs-col-source">{(() => { const src = doc.source?.app ?? 'local'; return <>{src !== 'local' && src !== 'coffee-pod' && <span className="db-source-icon">{sourceAppIcon(src, 14)}</span>}{formatSourceName(src)}</>; })()}</span>
                      <span className="docs-col-tags">
                        {(doc.tags ?? []).slice(0, 2).map(t => (
                          <span key={t} className="row-tag-chip">#{t}</span>
                        ))}
                        {(doc.tags ?? []).length > 2 && <span className="row-tag-overflow">+{(doc.tags ?? []).length - 2}</span>}
                      </span>
                      <span className="docs-col-modified">{relativeTime(doc.updated_at)}</span>
                      <span className="docs-col-actions" style={{ position: 'relative' }}>
                        <button
                          className={`row-fav-btn ${favoriteIds.has(doc.id) ? 'is-favorite' : ''}`}
                          title={favoriteIds.has(doc.id) ? 'Remove from Favorites' : 'Add to Favorites'}
                          onClick={e => { e.stopPropagation(); toggleFavorite(doc.id); }}
                        >
                          <Star size={13} />
                        </button>
                        <button className="row-action-btn" onClick={e => { e.stopPropagation(); setDocMenuId(docMenuId === doc.id ? null : doc.id); }}><MoreVertical size={14} /></button>
                        {docMenuId === doc.id && (
                          <div className="doc-context-menu" ref={docMenuRef}>
                            <button className="doc-context-item" onClick={e => { e.stopPropagation(); setDocMenuId(null); setMoveModal({ id: doc.id, title: doc.title, currentFolder: doc.collection_id ?? null }); }}>
                              <FolderInput size={13} /> Move
                            </button>
                            <div className="doc-context-item doc-context-type-row" onClick={e => e.stopPropagation()}>
                              <span className="doc-context-type-swatch" style={{ background: getTypeColor(docKindOverrides[doc.id] ?? doc.kind) }} />
                              <span>Type</span>
                              <AppDropdown
                                className="doc-context-type-dropdown"
                                value={docKindOverrides[doc.id] ?? doc.kind}
                                onChange={v => { setDocKind(doc.id, v); setDocMenuId(null); }}
                                options={[
                                  ...MEMORY_TYPES.map(t => ({ value: t.kind, label: t.label })),
                                  ...customTypes.map(ct => ({ value: ct.id, label: ct.label, group: 'Custom' })),
                                  ...(!MEMORY_TYPES.find(t => t.kind === (docKindOverrides[doc.id] ?? doc.kind)) && !customTypes.find(ct => ct.id === (docKindOverrides[doc.id] ?? doc.kind)) ? [{ value: docKindOverrides[doc.id] ?? doc.kind, label: getTypeLabel(docKindOverrides[doc.id] ?? doc.kind) }] : []),
                                ]}
                              />
                            </div>
                            <button className="doc-context-item danger" onClick={e => { e.stopPropagation(); setDocMenuId(null); setDeleteConfirm({ id: doc.id, title: doc.title, type: 'doc' }); }}>
                              <Trash2 size={13} /> Delete
                            </button>
                          </div>
                        )}
                      </span>
                    </div>
                    {dropTarget === doc.id && dropPosition === 'below' && <div className="drop-indicator drop-indicator-below" />}
                  </div>
                );
              }) : (
                (() => {
                  let icon: React.ReactNode = <Folder size={24} />;
                  let heading = 'No docs here yet';
                  let body = 'Create a new doc or import files to get started.';
                  if (showFavorites) {
                    icon = <Star size={24} />;
                    heading = 'No favorites yet';
                    body = 'Star docs to pin them here for quick access.';
                  } else if (selectedType) {
                    const Icon = selectedType.icon;
                    icon = <Icon size={24} />;
                    heading = `No ${selectedType.label.toLowerCase()} yet`;
                    body = 'They will appear here as you create or import them.';
                  } else if (activeTagId) {
                    icon = <Hash size={24} />;
                    heading = `No docs tagged #${activeTagId}`;
                    body = 'Tag docs from the inspector to surface them here.';
                  } else if (selectedSmartView) {
                    const Icon = selectedSmartView.icon;
                    icon = <Icon size={24} />;
                    heading = `No docs match this view`;
                    body = 'Adjust your filters or save a new view that captures what you need.';
                  } else if (activeFolderId === 'inbox') {
                    icon = <Inbox size={24} />;
                    heading = 'Inbox is empty';
                    body = 'New docs land here until you file them.';
                  }
                  return (
                    <div className="docs-empty-state">
                      {icon}
                      <strong>{heading}</strong>
                      <p>{body}</p>
                    </div>
                  );
                })()
              )}
              {hasMoreDocs && <div ref={docsSentinelRef} className="progressive-sentinel" />}
            </div>
          </div>
        )}
      </div>

      {/* Right inspector */}
      {inspectorOpen && selectedDoc && (
      <div className="docs-inspector">
        <div
          className="docs-inspector-resize-handle"
          onMouseDown={e => {
            e.preventDefault();
            inspectorDragRef.current = { startX: e.clientX, startW: inspectorWidth };
            const onMove = (ev: MouseEvent) => {
              if (!inspectorDragRef.current) return;
              const delta = inspectorDragRef.current.startX - ev.clientX;
              setInspectorWidth(Math.min(500, Math.max(240, inspectorDragRef.current.startW + delta)));
            };
            const onUp = () => { inspectorDragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
          }}
        />
        <ObjectInspector
          obj={selectedDoc}
          allObjects={props.objects}
          collections={props.collections}
          authToken={props.authToken}
          onNavigate={(id) => { setSelectedDocId(id); }}
          onClose={() => setInspectorOpen(false)}
          onRefresh={props.onRefresh}
          isFavorite={favoriteIds.has(selectedDoc.id)}
          onToggleFavorite={toggleFavorite}
          onMoveDoc={props.onMoveDoc}
          onPatchObject={props.onPatchObject}
        />
      </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <div className="modal-backdrop" onClick={() => setDeleteConfirm(null)}>
          <div className="delete-confirm-dialog" onClick={e => e.stopPropagation()}>
            <h3>Delete "{deleteConfirm.title}"?</h3>
            <p className="delete-confirm-desc">
              {deleteConfirm.type === 'folder'
                ? 'This will delete the folder and move its documents to Inbox.'
                : 'This will remove the document from your Pod.'}
            </p>
            {deleteConfirm.type !== 'folder' && (
              <label className="delete-confirm-forget">
                <input type="checkbox" checked={alsoForget} onChange={e => setAlsoForget(e.target.checked)} />
                <span>Also forget extracted knowledge<p className="delete-confirm-hint">Removes entities and claims the system learned from this document.</p></span>
              </label>
            )}
            <div className="delete-confirm-actions">
              <button className="delete-confirm-cancel" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="delete-confirm-delete" onClick={handleDeleteConfirm}><Trash2 size={13} /> Delete</button>
            </div>
          </div>
        </div>
      )}
      {bulkDeleteConfirm && (
        <div className="modal-backdrop" onClick={() => setBulkDeleteConfirm(false)}>
          <div className="delete-confirm-dialog" onClick={e => e.stopPropagation()}>
            <h3>Delete {checkedIds.size} items?</h3>
            <p className="delete-confirm-desc">
              This will delete the selected documents and folders. Folder contents will be moved to Inbox.
            </p>
            <label className="delete-confirm-forget">
              <input type="checkbox" checked={alsoForget} onChange={e => setAlsoForget(e.target.checked)} />
              <span>Also forget extracted knowledge</span>
            </label>
            <div className="delete-confirm-actions">
              <button className="delete-confirm-cancel" onClick={() => setBulkDeleteConfirm(false)}>Cancel</button>
              <button className="delete-confirm-delete" onClick={handleBulkDelete}><Trash2 size={13} /> Delete {checkedIds.size} items</button>
            </div>
          </div>
        </div>
      )}

      {/* Move doc modal */}
      {moveModal && (
        <div className="modal-backdrop" onClick={() => setMoveModal(null)}>
          <div className="move-modal" onClick={e => e.stopPropagation()}>
            <h3>Move "{moveModal.title}"</h3>
            <p className="move-modal-desc">Choose a destination folder.</p>
            <div className="move-modal-list">
              <button
                className={`move-modal-item ${!moveModal.currentFolder || moveModal.currentFolder === 'inbox' ? 'current' : ''}`}
                onClick={() => handleMoveDoc('inbox')}
              >
                <Inbox size={14} />
                <span>Inbox</span>
                {(!moveModal.currentFolder || moveModal.currentFolder === 'inbox') && <span className="move-modal-current">Current</span>}
              </button>
              <button
                className={`move-modal-item ${moveModal.currentFolder === 'archive' ? 'current' : ''}`}
                onClick={() => handleMoveDoc('archive')}
              >
                <Archive size={14} />
                <span>Archive</span>
                {moveModal.currentFolder === 'archive' && <span className="move-modal-current">Current</span>}
              </button>
              {folderTree.filter(f => f.id !== 'inbox' && f.id !== 'archive').map(f => (
                <button
                  key={f.id}
                  className={`move-modal-item ${moveModal.currentFolder === f.id ? 'current' : ''}`}
                  onClick={() => handleMoveDoc(f.id)}
                >
                  <Folder size={14} />
                  <span>{f.label}</span>
                  {moveModal.currentFolder === f.id && <span className="move-modal-current">Current</span>}
                </button>
              ))}
            </div>
            <div className="move-modal-actions">
              <button className="move-modal-cancel" onClick={() => setMoveModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showNewTypeModal && (
        <NewTypeModal
          existingLabels={[...MEMORY_TYPES.map(t => t.label.toLowerCase()), ...customTypes.map(t => t.label.toLowerCase())]}
          onCancel={() => setShowNewTypeModal(false)}
          onCreate={(input) => {
            const next: CustomType = {
              id: `type-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              label: input.label,
              icon: input.icon,
              color: input.color,
            };
            persistCustomTypes([...customTypes, next]);
            setShowNewTypeModal(false);
            /* Jump straight to the new (empty) type so the user sees feedback */
            setActiveTypeId(next.id);
            setActiveFolderId('');
            setActiveSmartView(null);
            setActiveTagId(null);
            setShowFavorites(false);
            setSidebarRevealed(true);
          }}
        />
      )}

      {showNewViewModal && (
        <NewViewModal
          activeFilters={{
            types: [...filterTypes],
            origins: [...filterOrigins],
            sources: [...filterSources],
            tags: [...filterTags],
            dateRange: filterDateRange,
            hasBacklinks: filterHasBacklinks,
            search: sidebarSearch.trim(),
          }}
          onCancel={() => setShowNewViewModal(false)}
          onCreate={(label) => { createCustomSmartView(label); setShowNewViewModal(false); }}
        />
      )}
      {showManageViews && (
        <Dialog open onOpenChange={open => { if (!open) setShowManageViews(false); }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Manage saved filters</DialogTitle>
              <DialogDescription>Reorder, rename, hide, or remove the filters available in Documents.</DialogDescription>
            </DialogHeader>
            <DocumentViewsManager />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/* Generate raw doc source with frontmatter.
 * Body precedence: content.text (the canonical field the rich editor reads
 * and writes) → vault body → derived page body → generated fallback. Keeping
 * content.text first means the raw and rich editors always agree. */
function generateRawDoc(doc: PodObject, pageContent: { meta?: string; body?: string } | null, rawVault?: string | null): string {
  const frontmatter = [
    '---',
    `type: ${doc.kind === 'page' ? 'Note' : doc.kind.charAt(0).toUpperCase() + doc.kind.slice(1)}`,
    `origin: ${doc.origin}`,
    doc.source?.app ? `source: ${doc.source.app}` : null,
    `created: ${doc.created_at}`,
    `updated: ${doc.updated_at}`,
    doc.tags && doc.tags.length > 0 ? `tags: [${doc.tags.join(', ')}]` : null,
    '---',
  ].filter(Boolean).join('\n');

  const contentText = documentContentFields(doc.content).text;
  let vaultBody: string | null = null;
  if (rawVault) {
    const parts = rawVault.split('---');
    vaultBody = parts.length >= 3 ? parts.slice(2).join('---').trim() : rawVault;
  }
  const body = (contentText && contentText.trim() ? contentText : null)
    ?? vaultBody
    ?? pageContent?.body
    ?? generateFallbackContent(doc);
  return `${frontmatter}\n# ${doc.title}\n\n${body}`;
}

/* Parse raw markdown (frontmatter + # title + body) back into editable fields.
 * Mirrors generateRawDoc so the raw editor round-trips losslessly. */
function parseRawDoc(raw: string): { title?: string; body: string; tags?: string[] } {
  let working = raw.replace(/\r\n/g, '\n');
  let tags: string[] | undefined;
  // Strip a leading YAML-ish frontmatter block delimited by --- … ---
  const fmMatch = working.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fmMatch) {
    const tagLine = fmMatch[1].match(/^tags:\s*\[(.*)\]\s*$/m);
    if (tagLine) {
      tags = tagLine[1].split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean);
    }
    working = working.slice(fmMatch[0].length);
  }
  // Treat the first non-empty line as the title when it's an H1
  const lines = working.split('\n');
  let idx = 0;
  while (idx < lines.length && lines[idx].trim() === '') idx++;
  let title: string | undefined;
  if (idx < lines.length && /^#\s+/.test(lines[idx])) {
    title = lines[idx].replace(/^#\s+/, '').trim();
    lines.splice(0, idx + 1);
    working = lines.join('\n');
  }
  return { title, body: working.trim(), tags };
}

/* Controlled raw-markdown editor with line gutter + debounced save. */
function RawDocEditor({ initialRaw, onSave }: {
  initialRaw: string;
  onSave: (parsed: { title?: string; body: string; tags?: string[] }) => void;
}) {
  const [value, setValue] = React.useState(initialRaw);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = React.useRef(onSave);
  onSaveRef.current = onSave;
  // Flush any pending save on unmount (e.g. toggling back to rich view)
  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const flush = (next: string) => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    onSaveRef.current(parseRawDoc(next));
  };
  const schedule = (next: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; onSaveRef.current(parseRawDoc(next)); }, 600);
  };
  const lines = value.split('\n');
  return (
    <div className="docs-raw-gutter-wrap">
      <div className="docs-raw-gutter">
        {lines.map((_, i) => (
          <span key={i} className="docs-raw-line-num">{i + 1}</span>
        ))}
      </div>
      <textarea
        className="docs-raw-textarea"
        value={value}
        spellCheck={false}
        rows={lines.length + 2}
        onChange={e => { setValue(e.target.value); schedule(e.target.value); }}
        onBlur={() => flush(value)}
      />
    </div>
  );
}

/* Simple markdown-to-html for rendered page content */
function markdownToHtml(md: string): string {
  return md
    .split('\n\n')
    .map(block => {
      block = block.trim();
      if (!block) return '';
      if (block.startsWith('## ')) return `<h2>${block.slice(3)}</h2>`;
      if (block.startsWith('### ')) return `<h3>${block.slice(4)}</h3>`;
      if (block.startsWith('- ')) {
        const items = block.split('\n').map(line => {
          const text = line.replace(/^- /, '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
          return `<li>${text}</li>`;
        }).join('');
        return `<ul>${items}</ul>`;
      }
      return `<p>${block.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</p>`;
    })
    .join('\n');
}

function generateFallbackContent(obj: PodObject): string {
  const content = typeof obj.content === 'object' && obj.content !== null
    ? obj.content as Record<string, unknown>
    : undefined;
  const lines: string[] = [`## ${obj.title}`];

  // Wiki-projected rows (page/entity from /pod/objects wiki adapter) put the
  // compiled markdown in content.body. Prefer it over content.text.
  const { body: bodyVal, text: textVal } = documentContentFields(obj.content);
  const hasBody = bodyVal !== null && bodyVal.trim().length > 0;
  const hasText = textVal !== null && textVal.trim().length > 0;

  if (hasBody) {
    lines.push(`\n\n${bodyVal}`);
  } else if (hasText) {
    lines.push(`\n\n${textVal}`);
  } else if (obj.kind === 'pdf' || obj.kind === 'document') {
    const meta = obj.metadata as Record<string, unknown> | undefined;
    lines.push('\n\n*No text content extracted from this file.*');
    if (meta?.mime_type) lines.push(`\n\n**Type**: ${meta.mime_type}`);
    if (content?.size) lines.push(`\n\n**Size**: ${formatBytes(content.size as number)}`);
    if (meta?.pages) lines.push(`\n\n**Pages**: ${meta.pages}`);
    lines.push('\n\nRe-import this file to extract text content.');
  } else if (content) {
    Object.entries(content).forEach(([key, val]) => {
      if (key === 'text') return;
      if (typeof val === 'string' && val.trim()) lines.push(`\n\n**${key}**: ${val}`);
      else if (Array.isArray(val)) lines.push(`\n\n**${key}**: ${val.join(', ')}`);
    });
  }
  return lines.join('');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ═══════════════════════════════════════
   Activity View — Structured dashboard
   ═══════════════════════════════════════ */

/* ── Waves process icons & colors ── */

const PROCESS_META: Record<WavesProcess, { label: string; icon: React.ComponentType<{ size?: number }>; color: string }> = {
  observe:  { label: 'Observe',  icon: Eye,       color: '#3b82f6' },
  recall:   { label: 'Recall',   icon: Search,    color: '#10b981' },
  reflect:  { label: 'Reflect',  icon: Brain,     color: '#a855f7' },
  revise:   { label: 'Revise',   icon: RefreshCw, color: '#f97316' },
  forget:   { label: 'Forget',   icon: Eraser,    color: '#64748b' },
  dream:    { label: 'Dream',    icon: Moon,       color: '#6366f1' },
  access:   { label: 'Access',   icon: Shield,    color: '#ef4444' },
};

// Meta for non-wave processes that appear in the feed but get NO filter pill
// (the pill row is driven by a separate `processes` array). Import events land
// here so they render with a proper label/icon in the "All" feed.
const EXTRA_PROCESS_META: Record<string, { label: string; icon: React.ComponentType<{ size?: number }>; color: string }> = {
  import: { label: 'Import', icon: Upload, color: '#0ea5e9' },
};

const PROCESS_FALLBACK = { label: 'Process', icon: Brain, color: '#94a3b8' };
function getProcessMeta(p: WavesProcessLoose) {
  return PROCESS_META[p as WavesProcess] ?? EXTRA_PROCESS_META[p] ?? PROCESS_FALLBACK;
}

/* ── Bubble layout engine ── */

/** 3-lane wave: left → center → right, repeating */
function computeXPositions(count: number, containerWidth: number) {
  const RULER_SPACE = 80;
  const usableWidth = containerWidth - RULER_SPACE;
  const CARD_W = Math.min(320, usableWidth - 24);

  if (usableWidth < CARD_W * 2) {
    const centerX = Math.max(8, (usableWidth - CARD_W) / 2);
    return Array.from({ length: count }, () => centerX);
  }

  const leftX = Math.max(12, usableWidth * 0.08);
  const centerX = (usableWidth - CARD_W) / 2;
  const rightX = Math.min(usableWidth - CARD_W - 8, usableWidth * 0.92 - CARD_W);
  const lanes = [leftX, centerX, rightX];
  return Array.from({ length: count }, (_, i) => lanes[i % 3]);
}

function ActivityView(props: {
  events: ActivityEvent[];
  objects?: PodObject[];
  authToken?: string;
  ownerActorId?: string;
  onOpenConnections?: (tab: ConnectionManagementTab) => void;
  onOpenImport?: () => void;
  onNavigateObject?: (id: string) => void;
  onNavigateCollection?: (id: string) => void;
  onNavigateReflectionClaims?: () => void;
  onNavigateReflectionPages?: () => void;
  onAttentionAction?: (event: ActivityEvent, action: ActivityAttentionAction) => void;
  onAttentionResolved?: () => void | Promise<void>;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const brainwaveRef = React.useRef<HTMLDivElement>(null);
  const cardRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollToPresentRef = React.useRef(true);
  const scrollRequestKeyRef = React.useRef('');
  const [containerWidth, setContainerWidth] = React.useState(800);
  const [selectedEvent, setSelectedEvent] = React.useState<ActivityEvent | null>(null);
  const [attentionOpen, setAttentionOpen] = React.useState(() => localStorage.getItem('coffee-pod-attention-panel') === 'open');
  const [measuredHeights, setMeasuredHeights] = React.useState<Map<string, number>>(new Map());
  const [actionStatus, setActionStatus] = React.useState<{ text: string; tone: 'pending' | 'success' | 'error' } | null>(null);
  const [actionInFlight, setActionInFlight] = React.useState<string | null>(null);
  const [attentionDismissalOverrides, setAttentionDismissalOverrides] = React.useState<Record<string, boolean>>({});
  const [attentionMutationIds, setAttentionMutationIds] = React.useState<Set<string>>(new Set());
  const [attentionBulkConfirm, setAttentionBulkConfirm] = React.useState(false);
  const [attentionFeedback, setAttentionFeedback] = React.useState<{
    text: string;
    tone: 'success' | 'error';
    eventIds: string[];
  } | null>(null);
  const attentionFeedbackTimerRef = React.useRef<number | null>(null);
  const attentionEvents = React.useMemo(
    () => activityAttentionEvents(props.events.map(event => {
      const override = attentionDismissalOverrides[event.id];
      if (override === undefined) return event;
      return { ...event, dismissed_at: override ? 'optimistic' : null };
    })),
    [props.events, attentionDismissalOverrides],
  );
  const attentionPanelOpen = attentionOpen && (attentionEvents.length > 0 || attentionFeedback !== null);

  React.useEffect(() => {
    localStorage.setItem('coffee-pod-attention-panel', attentionOpen ? 'open' : 'closed');
  }, [attentionOpen]);

  React.useEffect(() => () => {
    if (attentionFeedbackTimerRef.current != null) {
      window.clearTimeout(attentionFeedbackTimerRef.current);
    }
  }, []);

  const hdrs = (): HeadersInit => ({ 'Content-Type': 'application/json', ...(props.authToken ? { authorization: `Bearer ${props.authToken}` } : {}) });
  const showAttentionFeedback = (
    feedback: { text: string; tone: 'success' | 'error'; eventIds: string[] },
    timeout = 6000,
  ) => {
    if (attentionFeedbackTimerRef.current != null) {
      window.clearTimeout(attentionFeedbackTimerRef.current);
    }
    setAttentionFeedback(feedback);
    attentionFeedbackTimerRef.current = window.setTimeout(() => {
      setAttentionFeedback(null);
      attentionFeedbackTimerRef.current = null;
    }, timeout);
  };
  const updateAttentionDismissal = async (eventIds: string[], dismissed: boolean) => {
    if (eventIds.length === 0 || attentionMutationIds.size > 0) return;
    setAttentionMutationIds(new Set(eventIds));
    setAttentionBulkConfirm(false);
    try {
      const response = await fetch('/pod/events/attention', {
        method: 'PATCH',
        headers: hdrs(),
        body: JSON.stringify({ event_ids: eventIds, dismissed }),
      });
      const body = await response.json().catch(() => null) as { event_ids?: string[]; message?: string; error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.message ?? body?.error ?? `HTTP ${response.status}`);
      }
      const updatedIds = body?.event_ids ?? [];
      if (updatedIds.length > 0) {
        setAttentionDismissalOverrides(previous => {
          const next = { ...previous };
          for (const id of updatedIds) next[id] = dismissed;
          return next;
        });
      }
      if (dismissed) {
        const itemLabel = updatedIds.length === 1 ? 'item' : 'items';
        showAttentionFeedback({
          text: updatedIds.length > 0
            ? `Dismissed ${updatedIds.length} ${itemLabel} from Needs your input`
            : 'Those items no longer need your input',
          tone: 'success',
          eventIds: updatedIds,
        });
      } else {
        showAttentionFeedback({
          text: updatedIds.length === 1
            ? 'Restored to Needs your input'
            : `Restored ${updatedIds.length} items to Needs your input`,
          tone: 'success',
          eventIds: [],
        }, 3500);
      }
      await props.onAttentionResolved?.();
    } catch (error) {
      showAttentionFeedback({
        text: `Couldn’t ${dismissed ? 'dismiss' : 'restore'} ${eventIds.length === 1 ? 'this item' : 'these items'}: ${error instanceof Error ? error.message : 'unknown error'}`,
        tone: 'error',
        eventIds: [],
      });
    } finally {
      setAttentionMutationIds(new Set());
    }
  };
  const openDestination = (destination: ActivityDestination) => {
    if (destination.kind === 'object') props.onNavigateObject?.(destination.id);
    else props.onNavigateCollection?.(destination.id);
  };

  const runEventAction = async (verb: string, endpoint: string, body: Record<string, unknown>) => {
    setActionInFlight(verb);
    setActionStatus({ text: `Running ${verb}…`, tone: 'pending' });
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: hdrs(), body: JSON.stringify(body) });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.message ?? errBody?.error ?? `HTTP ${res.status}`);
      }
      setActionStatus({ text: `${verb} complete`, tone: 'success' });
      setTimeout(() => setActionStatus(null), 2500);
    } catch (e: any) {
      setActionStatus({ text: `${verb} failed: ${e.message?.slice(0, 80) ?? 'unknown error'}`, tone: 'error' });
      setTimeout(() => setActionStatus(null), 4000);
    } finally {
      setActionInFlight(null);
    }
  };

  React.useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width);
    });
    ro.observe(containerRef.current);
    setContainerWidth(containerRef.current.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Oldest first so newest cards appear at the bottom
  const sorted = React.useMemo(() =>
    [...props.events].sort((a, b) => new Date(a.observed_at).getTime() - new Date(b.observed_at).getTime()),
    [props.events]
  );

  // Measure card heights after render (before paint) so we can position with equal gaps
  React.useLayoutEffect(() => {
    const next = new Map<string, number>();
    cardRefs.current.forEach((el, id) => {
      next.set(id, el.offsetHeight);
    });
    // Only update if heights actually changed to avoid infinite loops
    let changed = next.size !== measuredHeights.size;
    if (!changed) {
      next.forEach((h, id) => { if (measuredHeights.get(id) !== h) changed = true; });
    }
    if (changed) setMeasuredHeights(next);
  });

  // Heights array for current sorted cards
  const cardHeights = sorted.map(e => measuredHeights.get(e.id) || ACTIVITY_CARD_ESTIMATED_HEIGHT);

  const xPositions = React.useMemo(
    () => computeXPositions(sorted.length, containerWidth),
    [sorted.length, containerWidth]
  );
  const {
    yPositions,
    rulerHeight,
    canvasHeight,
  } = React.useMemo(
    () => computeActivityTimelineLayout(cardHeights),
    [cardHeights.join(',')],
  );

  // The latest card is the initial/fallback colour before scroll geometry is available.
  const latestProcess = sorted.length > 0 ? sorted[sorted.length - 1].process : 'reflect';
  const brainwaveColor = getProcessMeta(latestProcess).color;
  const brainwaveColorStops = React.useMemo(() => sorted.map((event, index) => ({
    position: (yPositions[index] ?? 0) + cardHeights[index] / 2,
    color: getProcessMeta(event.process).color,
  })), [sorted, yPositions, cardHeights.join(',')]);

  const scrollRequestKey = `${sorted.length}:${sorted[sorted.length - 1]?.id ?? ''}`;
  React.useLayoutEffect(() => {
    if (scrollRequestKeyRef.current === scrollRequestKey) return;
    scrollRequestKeyRef.current = scrollRequestKey;
    scrollToPresentRef.current = true;
  }, [scrollRequestKey]);

  // Scroll again after measured card heights settle. The first layout uses
  // an estimated card height, which can leave PRESENT below the viewport after reflow.
  React.useLayoutEffect(() => {
    if (scrollToPresentRef.current && scrollRef.current && sorted.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      if (sorted.every(event => measuredHeights.has(event.id))) {
        scrollToPresentRef.current = false;
      }
    }
  }, [scrollRequestKey, sorted, measuredHeights, canvasHeight]);

  // Sample the timeline at the brightest part of the bottom glow. Card colours
  // are blended between their centres, making the gradient track scrolling
  // continuously instead of snapping when a different card becomes nearest.
  React.useLayoutEffect(() => {
    const scrollElement = scrollRef.current;
    const canvasElement = containerRef.current;
    const brainwaveElement = brainwaveRef.current;
    if (!scrollElement || !canvasElement || !brainwaveElement) return;

    const GLOW_FOCUS_FROM_BOTTOM = 64;
    let animationFrame: number | null = null;

    const updateColor = () => {
      animationFrame = null;
      const focusPosition = scrollElement.scrollTop
        + scrollElement.clientHeight
        - GLOW_FOCUS_FROM_BOTTOM
        - canvasElement.offsetTop;
      const color = activityTimelineColorAt(brainwaveColorStops, focusPosition, brainwaveColor);
      brainwaveElement.style.setProperty('--bw-hue', color);
    };
    const scheduleColorUpdate = () => {
      if (animationFrame === null) animationFrame = window.requestAnimationFrame(updateColor);
    };

    updateColor();
    scrollElement.addEventListener('scroll', scheduleColorUpdate, { passive: true });
    const resizeObserver = new ResizeObserver(scheduleColorUpdate);
    resizeObserver.observe(scrollElement);

    return () => {
      scrollElement.removeEventListener('scroll', scheduleColorUpdate);
      resizeObserver.disconnect();
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    };
  }, [brainwaveColor, brainwaveColorStops]);

  return (
    <div className="activity-view bubbles">
      <div className={`activity-body ${selectedEvent || attentionPanelOpen ? 'has-detail' : ''}`}>
        {attentionEvents.length > 0 && !attentionPanelOpen && !selectedEvent && (
          <button
            type="button"
            className="activity-attention-tab"
            onClick={() => setAttentionOpen(true)}
            aria-label={`Open ${attentionEvents.length} item${attentionEvents.length === 1 ? '' : 's'} needing your input`}
          >
            <Bell size={14} />
            <span>Needs your input</span>
            <strong>{attentionEvents.length}</strong>
            <ChevronLeft size={13} />
          </button>
        )}
        {/* "Past" label — pinned to top-right of scroll viewport */}
        {sorted.length > 0 && <span className="timeline-past-sticky">Past</span>}
        <div className="bubble-scroll" ref={scrollRef}>
          <div className="bubble-scroll-inner">
            {/* Empty state — overlaid inside scroll area so timeline ruler stays visible */}
            {sorted.length === 0 && (
              <section className="activity-empty-hero" aria-labelledby="activity-empty-title">
                <div className="activity-empty-bubble" aria-hidden="true">
                  <Sparkles size={17} />
                </div>
                <div className="activity-empty-copy">
                  <h1 id="activity-empty-title">Give Pod something to remember</h1>
                  <p>Connect where you work, or an agent you use. Pod will turn what it can access into searchable memory.</p>
                </div>
                <div className="activity-empty-actions">
                  <button
                    type="button"
                    className="activity-empty-action is-primary"
                    onClick={() => props.onOpenConnections?.('sources')}
                  >
                    <span className="activity-empty-action-icon"><Plug size={18} /></span>
                    <span className="activity-empty-action-copy">
                      <strong>Connect your apps</strong>
                      <small>Bring in context from Drive, Slack, mail, and more.</small>
                    </span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="activity-empty-action"
                    onClick={() => props.onOpenConnections?.('agents')}
                  >
                    <span className="activity-empty-action-icon"><Bot size={18} /></span>
                    <span className="activity-empty-action-copy">
                      <strong>Connect an agent</strong>
                      <small>Let Codex, Claude Code, or another agent remember with you.</small>
                    </span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                </div>
                <button type="button" className="activity-empty-import" onClick={props.onOpenImport}>
                  <Upload size={13} />
                  Import documents instead
                </button>
              </section>
            )}
            <div className="bubble-canvas" ref={containerRef} style={{ height: canvasHeight }}>
              {props.events.length > 0 && (
                <div className="timeline-ruler" style={{ height: rulerHeight }}>
                  <div className="timeline-ruler-track">
                    <div className="timeline-ruler-line" />
                    {Array.from({ length: 81 }).map((_, i) => (
                      <span
                        key={i}
                        className={`timeline-tick ${i % 20 === 0 ? 'major' : i % 4 === 0 ? '' : 'minor'}`}
                        style={{ top: `${(i / 80) * 100}%` }}
                      />
                    ))}
                  </div>
                  <div className="timeline-ruler-now">
                    <span className="timeline-now-dot" />
                    <span className="timeline-ruler-label now">PRESENT</span>
                  </div>
                </div>
              )}
              {sorted.map((event, i) => {
                const x = xPositions[i] ?? 0;
                const y = yPositions[i] ?? 0;
                const meta = getProcessMeta(event.process);
                const Icon = meta.icon;
                const reverseIndex = sorted.length - 1 - i;
                const staggerStep = sorted.length > 1 ? Math.min(0.09, 0.6 / (sorted.length - 1)) : 0;
                const riseDistance = 400 + reverseIndex * (ACTIVITY_CARD_ESTIMATED_HEIGHT + ACTIVITY_CARD_GAP);
                return (
                  <div
                    key={event.id}
                    ref={(el) => { if (el) cardRefs.current.set(event.id, el); else cardRefs.current.delete(event.id); }}
                    className={`bubble-card ${selectedEvent?.id === event.id ? 'selected' : ''}`}
                    onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
                    style={{
                      left: x,
                      top: y,
                      animationDelay: `${reverseIndex * staggerStep}s`,
                      '--bubble-color': meta.color,
                      '--bubble-rise': `${riseDistance}px`,
                    } as React.CSSProperties}
                  >
                    {(() => {
                      const cardSrc = event.source_app || inferSourceFromEvent(event.type, event.actor_id);
                      return (
                        <div className="bubble-card-icon-wrap">
                          {cardSrc ? (
                            <div className="bubble-card-icon bubble-card-icon-source">
                              {sourceAppIcon(cardSrc, 20)}
                            </div>
                          ) : (
                            <div className="bubble-card-icon" style={{ background: meta.color + '18', color: meta.color }}>
                              <Icon size={16} />
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    <div className="bubble-card-body">
                      <div className="bubble-card-header">
                        <span className="activity-verb-chip" style={{ '--verb-color': meta.color } as React.CSSProperties}>
                          {meta.label}
                        </span>
                        <time>{relativeTime(event.observed_at)}</time>
                      </div>
                      <strong>{event.title}</strong>
                      {event.detail && <p>{event.detail}</p>}
                      {(() => {
                        const src = event.source_app || inferSourceFromEvent(event.type, event.actor_id);
                        if (!event.subProcess && !src && !event.collection) return null;
                        return (
                          <div className="bubble-card-meta">
                            {event.subProcess && (
                              <span className="bubble-subprocess" style={{ color: meta.color }}>{event.subProcess}</span>
                            )}
                            {event.collection && <span className="bubble-collection"><Folder size={10} /> {event.collection}</span>}
                            {src && <span className="bubble-source">{formatSourceName(src)}</span>}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </div>
        {/* Ambient brain-wave — pinned to bottom of scroll viewport */}
        <div ref={brainwaveRef} className="brainwave-ambient" style={{ '--bw-hue': brainwaveColor } as React.CSSProperties}>
          <div className="bw-sheet bw-sheet-1" />
          <div className="bw-sheet bw-sheet-2" />
          <div className="bw-sheet bw-sheet-3" />
          <div className="bw-sheet bw-sheet-4" />
          <div className="bw-sheet bw-sheet-5" />
          <div className="bw-sheet bw-sheet-6" />
          <div className="bw-sheet bw-sheet-7" />
          <div className="bw-sheet bw-sheet-8" />
          <div className="brainwave-glow" />
        </div>

        {attentionPanelOpen && !selectedEvent && (
          <aside className="activity-detail-panel activity-attention-panel" aria-label="Items needing your input">
            <div className="activity-detail-inner">
              <div className="activity-attention-header">
                <span className="activity-attention-header-icon"><Bell size={16} /></span>
                <div>
                  <span>Attention</span>
                  <h2>Needs your input</h2>
                  <p>{attentionEvents.length} unresolved item{attentionEvents.length === 1 ? '' : 's'}</p>
                </div>
                <button
                  type="button"
                  className="activity-detail-close"
                  onClick={() => setAttentionOpen(false)}
                  aria-label="Close attention panel"
                  title="Close attention panel"
                >
                  <X size={14} />
                </button>
              </div>

              {attentionEvents.length > 0 ? (
                <ul className="activity-attention-list">
                  {attentionEvents.map(event => {
                    const meta = getProcessMeta(event.process);
                    const Icon = meta.icon;
                    const presentation = activityAttentionPresentation(event);
                    const isUpdating = attentionMutationIds.has(event.id);
                    return (
                      <li key={event.id}>
                        <article className="activity-attention-item">
                          <button
                            type="button"
                            className="activity-attention-item-content"
                            onClick={() => setSelectedEvent(event)}
                          >
                            <span className="activity-attention-item-top">
                              <span className="activity-verb-chip compact" style={{ '--verb-color': meta.color } as React.CSSProperties}>
                                <Icon size={12} /> {meta.label}
                              </span>
                              <time>{relativeTime(event.observed_at)}</time>
                            </span>
                            <strong>{event.title}</strong>
                            <span className="activity-attention-reason">{presentation.reason}</span>
                          </button>
                          <div className="activity-attention-item-actions">
                            <button
                              type="button"
                              className="activity-attention-action"
                              onClick={() => setSelectedEvent(event)}
                            >
                              {presentation.actionLabel} <ChevronRight size={13} />
                            </button>
                            <button
                              type="button"
                              className="activity-attention-dismiss"
                              disabled={attentionMutationIds.size > 0}
                              aria-busy={isUpdating}
                              onClick={() => void updateAttentionDismissal([event.id], true)}
                            >
                              {isUpdating ? <Loader2 size={12} className="spin-inline" /> : <X size={12} />}
                              Dismiss
                            </button>
                          </div>
                        </article>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="activity-attention-empty">
                  <span><CheckCircle2 size={19} /></span>
                  <strong>You’re caught up</strong>
                  <p>Dismissed items stay in activity history.</p>
                </div>
              )}

              <div className="activity-attention-footer">
                {attentionFeedback && (
                  <div className={`activity-attention-feedback is-${attentionFeedback.tone}`} role="status">
                    <span>{attentionFeedback.text}</span>
                    {attentionFeedback.eventIds.length > 0 && (
                      <button
                        type="button"
                        disabled={attentionMutationIds.size > 0}
                        onClick={() => void updateAttentionDismissal(attentionFeedback.eventIds, false)}
                      >
                        Undo
                      </button>
                    )}
                  </div>
                )}
                {attentionBulkConfirm && attentionEvents.length > 0 ? (
                  <div className="activity-attention-bulk-confirm">
                    <p>Dismiss all {attentionEvents.length}? No memory choices will change.</p>
                    <div>
                      <button type="button" onClick={() => setAttentionBulkConfirm(false)}>Cancel</button>
                      <button
                        type="button"
                        className="is-confirm"
                        disabled={attentionMutationIds.size > 0}
                        onClick={() => void updateAttentionDismissal(attentionEvents.map(event => event.id), true)}
                      >
                        Dismiss {attentionEvents.length}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="activity-attention-note">
                    <p>Only events that require a decision or intervention appear here.</p>
                    {attentionEvents.length > 1 && (
                      <button
                        type="button"
                        disabled={attentionMutationIds.size > 0}
                        onClick={() => setAttentionBulkConfirm(true)}
                      >
                        Dismiss all
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </aside>
        )}

        {/* Detail panel */}
        {selectedEvent && (() => {
          const conflict = activityConflictFromEvent(selectedEvent);
          if (conflict) {
            return (
              <ConflictResolver
                eventId={selectedEvent.id}
                conflict={conflict}
                authToken={props.authToken}
                actorId={props.ownerActorId ?? 'person-local'}
                onBack={() => { setSelectedEvent(null); setAttentionOpen(true); }}
                onClose={() => { setSelectedEvent(null); setAttentionOpen(false); }}
                onResolved={() => {
                  setSelectedEvent(null);
                  setAttentionOpen(true);
                  props.onAttentionResolved?.();
                }}
              />
            );
          }
          const meta = getProcessMeta(selectedEvent.process);
          const Icon = meta.icon;
          const destination = resolveActivityDestination(selectedEvent, props.objects ?? []);
          const source = selectedEvent.source_app || inferSourceFromEvent(selectedEvent.type, selectedEvent.actor_id);
          const sourceItems = source === 'gmail' || source === 'icloud-mail'
            ? activitySourceItems(selectedEvent)
            : [];
          const reflectionResult = activityReflectionResult(selectedEvent);
          const attentionPresentation = attentionEvents.some(event => event.id === selectedEvent.id)
            ? activityAttentionPresentation(selectedEvent)
            : null;
          return (
            <div className="activity-detail-panel">
              <div className="activity-detail-inner">
                <div className="activity-detail-scroll">
                  <div className="inspector-top">
                    {attentionPanelOpen ? (
                      <button type="button" className="activity-attention-back" onClick={() => { setSelectedEvent(null); setAttentionOpen(true); }}>
                        <ArrowLeft size={13} /> Attention
                      </button>
                    ) : (
                      <span className="inspector-top-label" style={{ color: meta.color, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Icon size={14} /> {meta.label}
                      </span>
                    )}
                    <div className="inspector-top-actions">
                      <button
                        className="activity-detail-close"
                        onClick={() => { setSelectedEvent(null); setAttentionOpen(false); }}
                        aria-label="Close details"
                        title="Close details"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="inspector-header">
                    <h2>{selectedEvent.title}</h2>
                    {selectedEvent.detail && <p className="activity-detail-desc">{selectedEvent.detail}</p>}
                  </div>

                  <div className="inspector-section">
                    <div className="inspector-meta">
                      <div className="meta-row"><span>Process</span><strong style={{ color: meta.color }}>{meta.label}</strong></div>
                      <div className="meta-row"><span>Protocol</span><strong>{selectedEvent.type.replace(/_/g, ' ')}</strong></div>
                      {(() => {
                        const src = selectedEvent.source_app || inferSourceFromEvent(selectedEvent.type, selectedEvent.actor_id);
                        return src && <div className="meta-row"><span>Source</span><strong className="meta-row-source">{sourceAppIcon(src, 13)}{formatSourceName(src)}</strong></div>;
                      })()}
                      {selectedEvent.source_id && <div className="meta-row"><span>Source ID</span><strong>{selectedEvent.source_id}</strong></div>}
                      {selectedEvent.collection && <div className="meta-row"><span>Collection</span><strong>{selectedEvent.collection}</strong></div>}
                      <div className="meta-row"><span>Scope</span><strong>{selectedEvent.scope}</strong></div>
                      <div className="meta-row"><span>Visibility</span><strong>{selectedEvent.visibility ?? 'private'}</strong></div>
                      <div className="meta-row"><span>Actor</span><strong>{formatActorName(selectedEvent.actor_id)}</strong></div>
                      <div className="meta-row"><span>Time</span><strong>{relativeTime(selectedEvent.observed_at)}</strong></div>
                      {selectedEvent.captured_at && selectedEvent.captured_at !== selectedEvent.observed_at && (
                        <div className="meta-row"><span>Captured</span><strong>{relativeTime(selectedEvent.captured_at)}</strong></div>
                      )}
                      {selectedEvent.sensitive && (
                        <div className="meta-row"><span>Sensitive</span><strong style={{ color: '#ef4444' }}>Yes</strong></div>
                      )}
                      {selectedEvent.subProcess && (
                        <div className="meta-row"><span>Sub-process</span><strong>{selectedEvent.subProcess}</strong></div>
                      )}
                      {selectedEvent.revise_reason && (
                        <div className="meta-row"><span>Reason</span><strong>{selectedEvent.revise_reason.replace(/_/g, ' ')}</strong></div>
                      )}
                      {selectedEvent.redaction_reason && (
                        <div className="meta-row"><span>Redaction</span><strong>{selectedEvent.redaction_reason.replace(/_/g, ' ')}</strong></div>
                      )}
                    </div>
                  </div>

                  {/* Linked object */}
                  {selectedEvent.pod_object_id ? (
                    <div className="inspector-section">
                      <h4>Affected object</h4>
                      <button
                        className="activity-detail-object-link"
                        onClick={() => props.onNavigateObject?.(selectedEvent.pod_object_id!)}
                      >
                        <FileText size={12} />
                        <span>{props.objects?.find(o => o.id === selectedEvent.pod_object_id)?.title ?? selectedEvent.pod_object_id}</span>
                        {selectedEvent.pod_object_version != null && (
                          <span className="activity-detail-object-ver">v{selectedEvent.pod_object_version}</span>
                        )}
                        <ArrowRight size={10} />
                      </button>
                    </div>
                  ) : null}

                  {sourceItems.length > 0 && (
                    <div className="inspector-section">
                      <h4>Emails in this sync</h4>
                      <ul className="activity-source-items">
                        {sourceItems.map((item, index) => {
                          const canOpenSource = Boolean(item.source_url);
                          const canOpenMemory = !canOpenSource && Boolean(item.object_id);
                          return (
                            <li className="activity-source-item" key={`${item.object_id ?? item.title}-${index}`}>
                              <span className="activity-source-item-icon">
                                {source ? sourceAppIcon(source, 16) : <Mail size={16} />}
                              </span>
                              <span className="activity-source-item-copy">
                                <strong title={item.title}>{item.title}</strong>
                                {(item.sender || item.occurred_at) && (
                                  <span>
                                    {[item.sender, item.occurred_at ? relativeTime(item.occurred_at) : null]
                                      .filter(Boolean)
                                      .join(' · ')}
                                  </span>
                                )}
                              </span>
                              {(canOpenSource || canOpenMemory) && (
                                <button
                                  type="button"
                                  className="activity-source-item-action"
                                  aria-label={canOpenSource
                                    ? `Open ${item.title} in ${source === 'gmail' ? 'Gmail' : 'the source app'}`
                                    : `View ${item.title} in Pod`}
                                  onClick={() => {
                                    if (item.source_url) {
                                      window.open(item.source_url, '_blank', 'noopener,noreferrer');
                                    } else if (item.object_id) {
                                      props.onNavigateObject?.(item.object_id);
                                    }
                                  }}
                                >
                                  {canOpenSource ? <ExternalLink size={13} /> : <ArrowRight size={13} />}
                                  <span>{canOpenSource && source === 'gmail' ? 'Open in Gmail' : 'View email'}</span>
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {reflectionResult && (
                    <div className="inspector-section">
                      <h4>Reflection output</h4>
                      <div className="reflection-output-summary">
                        <button type="button" onClick={props.onNavigateReflectionClaims}>
                          <Brain size={16} />
                          <span><strong>{reflectionResult.claims_created}</strong> claims created</span>
                          <ArrowRight size={13} />
                        </button>
                        <button type="button" onClick={props.onNavigateReflectionPages}>
                          <FileText size={16} />
                          <span><strong>{reflectionResult.pages_compiled}</strong> pages compiled</span>
                          <ArrowRight size={13} />
                        </button>
                      </div>
                      {reflectionResult.scopes.length > 0 && (
                        <div className="reflection-scope-results">
                          {reflectionResult.scopes.map(result => (
                            <div className="reflection-scope-result" key={result.scope}>
                              <span title={result.scope}>{result.scope.split('/').at(-1)}</span>
                              <strong>{result.claims_created} claims · {result.pages_compiled} pages</strong>
                            </div>
                          ))}
                        </div>
                      )}
                      {reflectionResult.scopes.some(result => result.pages.length > 0) && (
                        <ul className="activity-source-items reflection-page-results">
                          {reflectionResult.scopes.flatMap(result => result.pages).map(page => (
                            <li className="activity-source-item" key={page.id}>
                              <span className="activity-source-item-icon"><FileText size={16} /></span>
                              <span className="activity-source-item-copy">
                                <strong>{page.title}</strong>
                                <span>{page.path}</span>
                              </span>
                              <button
                                type="button"
                                className="activity-source-item-action"
                                onClick={() => props.onNavigateObject?.(page.id)}
                              >
                                <Eye size={13} /><span>View page</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {selectedEvent.content != null && (
                    <div className="inspector-section">
                      <h4>Raw event</h4>
                      <pre className="memory-content-pre">{JSON.stringify(selectedEvent.content, null, 2)}</pre>
                    </div>
                  )}
                </div>

                {actionStatus && (
                  <p className={`inspector-action-status is-${actionStatus.tone}`}>
                    {actionStatus.tone === 'pending' && <Loader2 size={11} className="spin-inline" />}
                    {actionStatus.tone === 'success' && <CheckCircle2 size={11} />}
                    {actionStatus.tone === 'error' && <AlertTriangle size={11} />}
                    {' '}{actionStatus.text}
                  </p>
                )}

                <div className="detail-action-bar">
                  {attentionPresentation
                    && !['inspect', 'conflict'].includes(attentionPresentation.action)
                    && props.onAttentionAction && (
                    <button
                      className="detail-action-link activity-attention-primary-action"
                      onClick={() => props.onAttentionAction?.(selectedEvent, attentionPresentation.action)}
                    >
                      {attentionPresentation.actionLabel} <ArrowRight size={13} />
                    </button>
                  )}
                  <button
                    className="detail-action-link"
                    disabled={!!actionInFlight}
                    aria-busy={actionInFlight === 'Recall'}
                    onClick={() => runEventAction('Recall', '/pod/query', { query: selectedEvent.title, actor_id: 'person-local', scope: selectedEvent.scope })}
                  >
                    {actionInFlight === 'Recall' ? <Loader2 size={13} className="spin-inline" /> : <Search size={13} />} Recall
                  </button>
                  <button
                    className="detail-action-link"
                    disabled={!!actionInFlight}
                    aria-busy={actionInFlight === 'Reflect'}
                    onClick={() => runEventAction('Reflect', '/pod/compile', { actor_id: 'person-local', operation_id: createOperationId(), scope: selectedEvent.scope })}
                  >
                    {actionInFlight === 'Reflect' ? <Loader2 size={13} className="spin-inline" /> : <Brain size={13} />} Reflect
                  </button>
                  {destination && (
                    <button className="detail-action-link" disabled={!!actionInFlight} onClick={() => openDestination(destination)}>
                      {destination.kind === 'collection' ? <FolderOpen size={13} /> : <Eye size={13} />}
                      {destination.kind === 'collection'
                        ? `Browse ${source ? formatSourceName(source) : 'collection'}`
                        : 'View memory'}
                    </button>
                  )}
                  {selectedEvent.pod_object_id && (
                    <button
                      className="detail-action-link detail-action-destructive"
                      disabled={!!actionInFlight}
                      aria-busy={actionInFlight === 'Forget'}
                      onClick={() => {
                        const linkedObj = props.objects?.find(o => o.id === selectedEvent.pod_object_id);
                        const targetTitle = linkedObj?.title ?? selectedEvent.title;
                        if (!window.confirm(`Forget "${targetTitle}"? This tombstones the linked object — the activity log entry stays.`)) return;
                        void runEventAction('Forget', '/pod/forget', {
                          actor_id: 'person-local',
                          operation_id: createOperationId(),
                          target: { type: 'object', id: selectedEvent.pod_object_id },
                          mode: 'tombstone',
                        });
                      }}
                    >
                      {actionInFlight === 'Forget' ? <Loader2 size={13} className="spin-inline" /> : <Eraser size={13} />} Forget
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   Capabilities View — Skills and Agent Plugins
   ═══════════════════════════════════════ */

/* ── Browse Skills — multi-source registry aggregation ── */
type SkillSource = 'clawhub' | 'skills.sh' | 'skillsmp' | 'github' | 'local';

const SOURCE_ICONS: Record<SkillSource, string> = {
  'clawhub': '/brand/apps/clawhub.svg',
  'skills.sh': '/brand/apps/skillssh.svg',
  'skillsmp': '/brand/apps/skillsmp.svg',
  'github': '/brand/apps/notion.svg', // placeholder
  'local': '',
};

const SOURCE_LABELS: Record<SkillSource, string> = {
  'clawhub': 'ClawHub',
  'skills.sh': 'skills.sh',
  'skillsmp': 'SkillsMP',
  'github': 'GitHub',
  'local': 'Local',
};

interface BrowseSkill {
  slug: string;
  displayName: string;
  summary: string;
  version: string;
  ownerHandle: string;
  owner?: { handle: string; displayName?: string; image?: string };
  tags: string[];
  updatedAt: string;
  createdAt?: string;
  scanStatus?: 'clean' | 'warn' | 'blocked';
  moderation?: { verdict?: string; summary?: string; reasonCodes?: string[] };
  capabilities?: string[];
  _source: SkillSource;
  _downloads?: number;
  _installs?: number;
  _stars?: number;
  _versions?: number;
  _readme?: string;
  _license?: string;
  _externalUrl?: string;
  _ghRepo?: string;
  _ghSkillId?: string;
}

interface SkillAgent {
  id: string;
  name: string;
  status: string;
  discovered?: boolean;
}

/* Proxied through backend to avoid CORS */
const CLAWHUB_BASE = '/pod/skills/registry/clawhub';
const SKILLSSH_BASE = '/pod/skills/registry/skillssh';
const SKILLSMP_BASE = '/pod/skills/registry/skillsmp';

function skillAgentLogo(agentId: string, size = 18): React.ReactNode {
  const id = agentId.replace(/^agent:/, '').toLowerCase();
  if (id.includes('claude')) return <ClaudeCodeLogo size={size} />;
  if (id.includes('codex')) return <CodexLogo size={size} />;
  if (id.includes('cursor')) return <CursorLogo size={size} />;
  if (id.includes('hermes')) return <HermesLogo size={size} />;
  if (id.includes('openclaw')) return <OpenClawLogo size={size} />;
  if (id.includes('pod')) return <PodLogo size={size} />;
  return <Bot size={size} />;
}

const BROWSE_CATEGORIES = [
  { id: 'all', label: 'All', query: '' },
  { id: 'mcp', label: 'MCP Tools', query: 'mcp server tool' },
  { id: 'code', label: 'Code & Dev', query: 'code review development testing' },
  { id: 'writing', label: 'Writing', query: 'writing content copywriting' },
  { id: 'data', label: 'Data & APIs', query: 'data api database' },
  { id: 'workflow', label: 'Workflows', query: 'workflow automation agent' },
  { id: 'research', label: 'Research', query: 'research analysis knowledge' },
] as const;

const TAG_TO_CATEGORY: Record<string, string> = {
  mcp: 'MCP Tools', server: 'MCP Tools', tool: 'MCP Tools',
  'dev-tools': 'Code & Dev', code: 'Code & Dev', development: 'Code & Dev', testing: 'Code & Dev', review: 'Code & Dev',
  writing: 'Writing', content: 'Writing', copywriting: 'Writing',
  data: 'Data & APIs', api: 'Data & APIs', database: 'Data & APIs',
  workflow: 'Workflows', automation: 'Workflows', agent: 'Workflows',
  research: 'Research', analysis: 'Research', knowledge: 'Research',
};

function inferCategory(skill: BrowseSkill): string | null {
  for (const t of skill.tags) {
    const lower = t.toLowerCase();
    if (TAG_TO_CATEGORY[lower]) return TAG_TO_CATEGORY[lower];
  }
  const text = `${skill.displayName} ${skill.summary}`.toLowerCase();
  if (/\bmcp\b/.test(text)) return 'MCP Tools';
  if (/\bdata|api|database|sql|google|notion|obsidian|slack|weather|speech|whisper|image|pdf|vault/.test(text)) return 'Data & APIs';
  if (/\bcode\b|dev|debug|review|lint|\btdd\b|\btest/.test(text)) return 'Code & Dev';
  if (/\bwrit|content|copy/.test(text)) return 'Writing';
  if (/\bworkflow|automat|improv|\bagent\b/.test(text)) return 'Workflows';
  if (/\bresearch|analy|knowledge/.test(text)) return 'Research';
  return null;
}

/* Fallback skills when registries are unreachable — mix of real skills.sh + clawhub */
const FEATURED_SKILLS: BrowseSkill[] = [
  { slug: 'find-skills', displayName: 'Find Skills', summary: 'Install: npx skills add vercel-labs/skills/find-skills', version: '1.0.0', ownerHandle: 'vercel-labs', tags: ['official'], updatedAt: new Date().toISOString(), scanStatus: 'clean', _source: 'skills.sh', _downloads: 1516064, _externalUrl: 'https://www.skills.sh/s/vercel-labs/skills/find-skills' },
  { slug: 'frontend-design', displayName: 'Frontend Design', summary: 'Install: npx skills add anthropics/skills/frontend-design', version: '1.0.0', ownerHandle: 'anthropics', tags: ['official'], updatedAt: new Date().toISOString(), scanStatus: 'clean', _source: 'skills.sh', _downloads: 411111, _externalUrl: 'https://www.skills.sh/s/anthropics/skills/frontend-design' },
  { slug: 'diagnose', displayName: 'Diagnose', summary: 'Debug issues by systematically narrowing down root causes', version: '1.2.0', ownerHandle: 'mattpocock', tags: ['dev-tools'], updatedAt: new Date().toISOString(), scanStatus: 'clean', _source: 'skills.sh' },
  { slug: 'tdd', displayName: 'TDD', summary: 'Test-driven development — write failing tests first, then make them pass', version: '1.1.0', ownerHandle: 'mattpocock', tags: ['dev-tools'], updatedAt: new Date().toISOString(), scanStatus: 'clean', _source: 'skills.sh' },
  { slug: 'self-improving-agent', displayName: 'Self-Improving Agent', summary: 'Logs learnings, errors, and patterns to continuously improve agent behavior', version: '2.1.0', ownerHandle: 'pskoett', tags: ['automation'], updatedAt: new Date().toISOString(), scanStatus: 'clean', _source: 'clawhub' },
  { slug: 'code-review', displayName: 'Code Review', summary: 'Systematic review focusing on correctness, security, and maintainability', version: '1.0.0', ownerHandle: 'anthropic', tags: ['dev-tools'], updatedAt: new Date().toISOString(), scanStatus: 'clean', _source: 'clawhub' },
];

interface SkillEntry {
  id: string;
  name: string;
  description: string;
  version: string;
  scope: string;
  status: 'installed' | 'review' | 'stale' | 'flagged' | 'disabled' | 'update_available';
  trustScore: number;
  trustLevel: 'high' | 'medium' | 'caution' | 'blocked';
  lastRun?: string;
  installedAt: string;
  runs: number;
  failures: number;
  permissions: string[];
  author: string;
  source: 'coffee' | 'skills.sh' | 'clawhub' | 'github' | 'local' | 'manual';
  equippedTo: string[];
  portability: 'local' | 'exportable' | 'synced';
  lastUpdated: string;
}

interface SkillBinding {
  skillId: string;
  skillName: string;
  agentName: string;
  scope: string;
  permissions: string[];
  lastUsed?: string;
  successRate: number;
  requiresApproval: boolean;
}

interface TelemetryEvent {
  id: string;
  skillName: string;
  event: 'skill.run.completed' | 'skill.run.failed' | 'skill.permission.denied' | 'skill.runtime.anomaly' | 'skill.update.available' | 'skill.review.completed' | 'skill.learned' | 'skill.equipped';
  detail: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'error';
}

const sampleSkills: SkillEntry[] = [
  {
    id: 'sk-1', name: 'self-improving-agent', version: '2.1.0', source: 'clawhub', author: 'pskoett',
    scope: 'Workspace', status: 'installed', trustScore: 88, trustLevel: 'high',
    equippedTo: ['Pod by Coffee', 'OpenClaw'], permissions: ['read:code', 'write:learnings', 'read:memory', 'shell:exec'],
    portability: 'exportable', runs: 156, failures: 8, installedAt: '2 weeks ago', lastRun: '2h ago', lastUpdated: '3 days ago',
    description: 'Logs learnings, errors, and patterns to continuously improve agent behavior across sessions',
  },
  {
    id: 'sk-2', name: 'find-skills', version: '1.0.3', source: 'skills.sh', author: 'vercel-labs',
    scope: 'Personal', status: 'installed', trustScore: 94, trustLevel: 'high',
    equippedTo: ['Pod by Coffee'], permissions: ['read:registry', 'network:api'],
    portability: 'synced', runs: 23, failures: 0, installedAt: '1 month ago', lastRun: '1d ago', lastUpdated: '1 week ago',
    description: 'Discovers and recommends skills from the skills.sh registry with quality and security checks',
  },
  {
    id: 'sk-3', name: 'code-review', version: '0.8.2', source: 'github', author: 'community',
    scope: 'Workspace', status: 'stale', trustScore: 71, trustLevel: 'medium',
    equippedTo: ['Claude Code', 'Cursor'], permissions: ['read:code', 'write:comments', 'read:git'],
    portability: 'local', runs: 89, failures: 12, installedAt: '2 months ago', lastRun: '2w ago', lastUpdated: '1 month ago',
    description: 'Automated code review with inline comments and suggestions',
  },
  {
    id: 'sk-4', name: 'slack-digest', version: '1.0.0-beta', source: 'skills.sh', author: 'unknown',
    scope: 'Workspace', status: 'review', trustScore: 0, trustLevel: 'blocked',
    equippedTo: [], permissions: ['read:slack', 'write:notes', 'network:api', 'read:contacts'],
    portability: 'local', runs: 0, failures: 0, installedAt: 'Pending', lastRun: undefined, lastUpdated: 'N/A',
    description: 'Summarizes Slack channels into daily digest notes',
  },
  {
    id: 'sk-5', name: 'auto-tagger', version: '1.4.2', source: 'github', author: 'community',
    scope: 'Personal', status: 'flagged', trustScore: 41, trustLevel: 'caution',
    equippedTo: [], permissions: ['read:all', 'write:tags', 'network:external'],
    portability: 'local', runs: 31, failures: 9, installedAt: '3 weeks ago', lastRun: '3d ago', lastUpdated: '2 weeks ago',
    description: 'Automatically tags and categorizes content based on patterns',
  },
];

const sampleBindings: SkillBinding[] = [
  { skillId: 'sk-1', skillName: 'self-improving-agent', agentName: 'Pod by Coffee', scope: 'Workspace', permissions: ['read:code', 'write:learnings', 'read:memory', 'shell:exec'], lastUsed: '2h ago', successRate: 95, requiresApproval: false },
  { skillId: 'sk-2', skillName: 'find-skills', agentName: 'Pod by Coffee', scope: 'Personal', permissions: ['read:registry', 'network:api'], lastUsed: '1d ago', successRate: 100, requiresApproval: false },
  { skillId: 'sk-1', skillName: 'self-improving-agent', agentName: 'OpenClaw', scope: 'Workspace', permissions: ['read:code', 'write:learnings'], lastUsed: '5h ago', successRate: 91, requiresApproval: false },
  { skillId: 'sk-3', skillName: 'code-review', agentName: 'Claude Code', scope: 'Workspace', permissions: ['read:code', 'write:comments', 'read:git'], lastUsed: '2w ago', successRate: 87, requiresApproval: false },
  { skillId: 'sk-3', skillName: 'code-review', agentName: 'Cursor', scope: 'Workspace', permissions: ['read:code', 'write:comments'], lastUsed: '1w ago', successRate: 84, requiresApproval: false },
  { skillId: 'sk-2', skillName: 'find-skills', agentName: 'Codex', scope: 'Personal', permissions: ['read:registry'], lastUsed: undefined, successRate: 0, requiresApproval: true },
];

const sampleTelemetry: TelemetryEvent[] = [
  { id: 'te-1', skillName: 'self-improving-agent', event: 'skill.run.completed', detail: 'Logged 3 new patterns from session context', timestamp: '2h ago', severity: 'info' },
  { id: 'te-2', skillName: 'code-review', event: 'skill.run.failed', detail: 'Timeout after 30s — git diff too large (4.2MB)', timestamp: '6h ago', severity: 'error' },
  { id: 'te-3', skillName: 'auto-tagger', event: 'skill.permission.denied', detail: 'Attempted read:contacts — not in declared permissions', timestamp: '1d ago', severity: 'warning' },
  { id: 'te-4', skillName: 'self-improving-agent', event: 'skill.runtime.anomaly', detail: 'Shell exec duration exceeded 10s threshold (12.4s)', timestamp: '1d ago', severity: 'warning' },
  { id: 'te-5', skillName: 'code-review', event: 'skill.update.available', detail: 'v0.9.0 available — current v0.8.2 is 1 month old', timestamp: '2d ago', severity: 'info' },
  { id: 'te-6', skillName: 'find-skills', event: 'skill.run.completed', detail: 'Found 12 matching skills for query "code quality"', timestamp: '1d ago', severity: 'info' },
  { id: 'te-7', skillName: 'slack-digest', event: 'skill.review.completed', detail: 'Initial review flagged: unknown author, broad permissions', timestamp: '3d ago', severity: 'warning' },
  { id: 'te-8', skillName: 'self-improving-agent', event: 'skill.learned', detail: 'Skill learned from clawhub registry — trust score initialized at 88', timestamp: '2w ago', severity: 'info' },
  { id: 'te-9', skillName: 'find-skills', event: 'skill.equipped', detail: 'Equipped to Pod AI with scope: Personal', timestamp: '1mo ago', severity: 'info' },
  { id: 'te-10', skillName: 'auto-tagger', event: 'skill.runtime.anomaly', detail: 'Failure rate 29% exceeds 20% threshold — flagged for review', timestamp: '4d ago', severity: 'error' },
];

const agentIcons: Record<string, React.ReactNode> = {
  'Pod by Coffee': <PodLogo size={16} />,
  'OpenClaw': <OpenClawLogo size={16} />,
  'Codex': <CodexLogo size={16} />,
  'Claude Code': <ClaudeCodeLogo size={16} />,
  'Cursor': <CursorLogo size={16} />,
  'Hermes': <HermesLogo size={16} />,
};

/** Lightweight markdown → HTML for skill README rendering (no deps) */
function simpleMarkdown(md: string): string {
  // Strip YAML frontmatter
  let src = md.replace(/^---[\s\S]*?---\n*/m, '').trim();

  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = src.split('\n');
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      out.push(`<pre${lang ? ` data-lang="${esc(lang)}"` : ''}><code>${esc(codeLines.join('\n'))}</code></pre>`);
      continue;
    }

    // Table (line with |)
    if (line.includes('|') && line.trim().startsWith('|')) {
      const tableRows: string[] = [];
      let isHeader = true;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim().startsWith('|')) {
        const row = lines[i].trim();
        // Skip separator row (|---|---|)
        if (/^\|[\s\-:]+\|/.test(row) && !row.replace(/[\s|\-:]/g, '')) {
          isHeader = false;
          i++;
          continue;
        }
        const cells = row.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).map(c => c.trim());
        const tag = isHeader ? 'th' : 'td';
        tableRows.push(`<tr>${cells.map(c => `<${tag}>${inlineMarkdown(c)}</${tag}>`).join('')}</tr>`);
        if (isHeader) isHeader = false; // first non-separator row is header
        i++;
      }
      out.push(`<table>${tableRows.join('')}</table>`);
      continue;
    }

    // Horizontal rule
    if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(line)) {
      out.push('<hr/>');
      i++;
      continue;
    }

    // Headings
    const hMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (hMatch) {
      const level = hMatch[1].length;
      out.push(`<h${level}>${inlineMarkdown(hMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    // Unordered list block
    if (/^\s*[-*]\s/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) {
        listItems.push(`<li>${inlineMarkdown(lines[i].replace(/^\s*[-*]\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ul>${listItems.join('')}</ul>`);
      continue;
    }

    // Ordered list block
    if (/^\s*\d+\.\s/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) {
        listItems.push(`<li>${inlineMarkdown(lines[i].replace(/^\s*\d+\.\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ol>${listItems.join('')}</ol>`);
      continue;
    }

    // Blank line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Paragraph — collect consecutive non-empty, non-special lines
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() && !lines[i].startsWith('#') && !lines[i].startsWith('```') && !/^\s*[-*]\s/.test(lines[i]) && !/^\s*\d+\.\s/.test(lines[i]) && !(lines[i].includes('|') && lines[i].trim().startsWith('|')) && !/^(\*{3,}|-{3,}|_{3,})\s*$/.test(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      out.push(`<p>${inlineMarkdown(paraLines.join(' '))}</p>`);
    }
  }

  return out.join('\n');
}

function inlineMarkdown(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

/* ── Fetch helpers for skill registries ── */
async function fetchClawHub(path: string, signal?: AbortSignal): Promise<any> {
  // path starts with / e.g. /skills?sort=trending — strip leading slash for proxy route
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const res = await fetch(`${CLAWHUB_BASE}/${cleanPath}`, { signal });
  if (!res.ok) throw new Error(`ClawHub ${res.status}`);
  return res.json();
}

async function fetchSkillsSh(path: string, signal?: AbortSignal): Promise<any> {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const res = await fetch(`${SKILLSSH_BASE}/${cleanPath}`, { signal });
  if (!res.ok) throw new Error(`skills.sh ${res.status}`);
  return res.json();
}

async function fetchSkillsMP(path: string, signal?: AbortSignal): Promise<any> {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const res = await fetch(`${SKILLSMP_BASE}/${cleanPath}`, { signal });
  if (!res.ok) throw new Error(`SkillsMP ${res.status}`);
  return res.json();
}

function normalizeClawHub(s: any): BrowseSkill {
  // ClawHub tags come as { tagName: version } object — extract keys
  const rawTags = s.tags;
  const tags: string[] = Array.isArray(rawTags) ? rawTags : (rawTags && typeof rawTags === 'object' ? Object.keys(rawTags).filter(k => k !== 'latest') : []);
  return {
    slug: s.slug ?? s.id ?? s.name,
    displayName: s.displayName ?? s.name ?? s.slug,
    summary: s.summary ?? s.description ?? '',
    version: s.version ?? s.latestVersion?.version ?? '0.0.0',
    ownerHandle: s.ownerHandle ?? s.owner?.handle ?? s.author ?? 'unknown',
    owner: s.owner,
    tags,
    updatedAt: s.updatedAt ?? '',
    scanStatus: s.scanStatus,
    capabilities: s.capabilities ?? [],
    _source: 'clawhub',
    _downloads: s.stats?.downloads ?? s.stats?.installsAllTime ?? s.downloads ?? s.installs,
    _stars: s.stats?.stars ?? s.stars ?? s.starCount,
    _license: s.latestVersion?.license,
  };
}

function normalizeSkillsSh(s: any): BrowseSkill {
  // skills.sh data shape: { source, skillId, name, installs, isOfficial }
  const ownerHandle = typeof s.source === 'string' ? s.source.split('/')[0] : (s.author ?? 'unknown');
  const displayName = (s.name ?? s.skillId ?? s.slug ?? '').replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
  return {
    slug: s.skillId ?? s.slug ?? (s.source && s.name ? `${s.source}/${s.name}` : s.name ?? ''),
    displayName,
    summary: s.description ?? s.summary ?? `Install: npx skills add ${s.source ?? s.name}`,
    version: s.version ?? '0.0.0',
    ownerHandle,
    tags: s.tags ?? s.categories ?? (s.isOfficial ? ['official'] : []),
    updatedAt: s.updatedAt ?? '',
    scanStatus: s.isOfficial ? 'clean' : (s.audit?.status === 'pass' ? 'clean' : s.audit?.status === 'warn' ? 'warn' : undefined),
    capabilities: [],
    _source: 'skills.sh',
    _downloads: s.installs ?? s.downloads ?? s.stats?.installs ?? s.stats?.downloads,
    _stars: s.stars ?? s.stats?.stars,
    _externalUrl: s.source ? `https://www.skills.sh/s/${s.source}/${s.skillId ?? s.name}` : undefined,
    _ghRepo: s.source ?? undefined,
    _ghSkillId: s.skillId ?? s.name ?? undefined,
  };
}

function normalizeSkillsMP(s: any): BrowseSkill {
  return {
    slug: s.id ?? s.name ?? 'unknown',
    displayName: s.name ?? s.id ?? 'Untitled',
    summary: s.description ?? '',
    version: '0.0.0',
    ownerHandle: s.author ?? 'unknown',
    tags: [],
    updatedAt: s.updatedAt ? new Date(Number(s.updatedAt) * 1000).toISOString() : '',
    scanStatus: undefined,
    capabilities: [],
    _source: 'skillsmp',
    _downloads: undefined,
    _stars: s.stars ?? 0,
    _externalUrl: s.githubUrl ?? s.skillUrl ?? '',
  };
}

async function enrichFromGitHub(skill: BrowseSkill): Promise<Partial<BrowseSkill>> {
  if (!skill._ghRepo || !skill._ghSkillId) return {};
  const repo = skill._ghRepo;
  const skillId = skill._ghSkillId;
  const gh = `https://raw.githubusercontent.com/${repo}/main/skills/${skillId}`;
  const api = `https://api.github.com/repos/${repo}`;
  const result: Partial<BrowseSkill> = {};

  const fetches = await Promise.allSettled([
    fetch(`${gh}/metadata.json`, { signal: AbortSignal.timeout(5000) }).then(r => r.ok ? r.json() : null),
    fetch(`${gh}/SKILL.md`, { signal: AbortSignal.timeout(5000) }).then(r => r.ok ? r.text() : null),
    fetch(`${gh}/README.md`, { signal: AbortSignal.timeout(5000) }).then(r => r.ok ? r.text() : null),
    fetch(api, { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(5000) }).then(r => r.ok ? r.json() : null),
  ]);

  const meta = fetches[0].status === 'fulfilled' ? fetches[0].value : null;
  const skillMd = fetches[1].status === 'fulfilled' ? fetches[1].value : null;
  const readme = fetches[2].status === 'fulfilled' ? fetches[2].value : null;
  const repoData = fetches[3].status === 'fulfilled' ? fetches[3].value : null;

  if (meta) {
    if (meta.abstract) result.summary = meta.abstract;
    if (meta.version) result.version = meta.version;
    if (meta.organization) result.ownerHandle = meta.organization;
  }
  if (skillMd || readme) {
    result._readme = skillMd ?? readme ?? undefined;
  }
  if (repoData) {
    if (repoData.stargazers_count) result._stars = repoData.stargazers_count;
    if (repoData.updated_at) result.updatedAt = repoData.updated_at;
    if (repoData.license?.spdx_id) result._license = repoData.license.spdx_id;
  }

  return result;
}

/** Merge two skill lists, dedup by slug AND by name+owner (prefer first source) */
function deduplicateSkills(primary: BrowseSkill[], secondary: BrowseSkill[]): BrowseSkill[] {
  const seen = new Set<string>();
  for (const s of primary) {
    seen.add(s.slug.toLowerCase());
    seen.add(`${s.displayName.toLowerCase()}::${s.ownerHandle.toLowerCase()}`);
  }
  const deduped = [...primary];
  for (const s of secondary) {
    const slugKey = s.slug.toLowerCase();
    const nameKey = `${s.displayName.toLowerCase()}::${s.ownerHandle.toLowerCase()}`;
    if (!seen.has(slugKey) && !seen.has(nameKey)) {
      seen.add(slugKey);
      seen.add(nameKey);
      deduped.push(s);
    }
  }
  return deduped;
}

type SortMode = 'trending' | 'newest' | 'downloads' | 'stars';

function SkillsBrowseTab({
  registeredSkills, agents, authToken, onSkillsChanged, initialSlug,
}: {
  registeredSkills: Array<{ slug: string; status: PodSkill['status'] }>;
  agents: SkillAgent[];
  authToken: string;
  onSkillsChanged?: () => void;
  initialSlug?: string | null;
}) {
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [category, setCategory] = React.useState('all');
  const [sort, setSort] = React.useState<SortMode>('trending');
  const [sourceFilter, setSourceFilter] = React.useState<'all' | SkillSource>('all');
  const [skills, setSkills] = React.useState<BrowseSkill[]>(FEATURED_SKILLS);
  const [visibleCount, setVisibleCount] = React.useState(30);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = React.useState<BrowseSkill | null>(null);
  const [detailSkill, setDetailSkill] = React.useState<BrowseSkill | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [installing, setInstalling] = React.useState<string | null>(null);
  const [registered, setRegistered] = React.useState<Map<string, PodSkill['status']>>(
    () => new Map(registeredSkills.map(skill => [skill.slug, skill.status])),
  );
  const [installTarget, setInstallTarget] = React.useState<BrowseSkill | null>(null);
  const [selectedAgents, setSelectedAgents] = React.useState<Set<string>>(new Set());
  const [readmeCopied, setReadmeCopied] = React.useState(false);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const initialSlugHandled = React.useRef(false);

  React.useEffect(() => {
    setRegistered(new Map(registeredSkills.map(skill => [skill.slug, skill.status])));
  }, [registeredSkills]);

  // Debounce search
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch from both ClawHub and skills.sh, merge and deduplicate
  React.useEffect(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    setVisibleCount(30);

    const fetchAll = async () => {
      const results: { clawhub: BrowseSkill[]; skillssh: BrowseSkill[]; skillsmp: BrowseSkill[] } = { clawhub: [], skillssh: [], skillsmp: [] };

      // Fetch ClawHub (proxy → direct fallback)
      {
        const catDef = BROWSE_CATEGORIES.find(c => c.id === category);
        const searchQuery = debouncedSearch.trim() || catDef?.query || '';

        const fetchClaw = async (path: string): Promise<BrowseSkill[]> => {
          try {
            const data = await fetchClawHub(path, ctrl.signal);
            const items = data.items ?? data.results ?? data.skills ?? (Array.isArray(data) ? data : []);
            return items.map(normalizeClawHub);
          } catch (proxyErr: any) {
            if (proxyErr.name === 'AbortError') throw proxyErr;
            try {
              const res = await fetch(`https://clawhub.ai/api/v1${path}`, {
                headers: { 'Accept': 'application/json' },
                signal: ctrl.signal,
              });
              if (res.ok) {
                const data = await res.json();
                const items = data.items ?? data.results ?? data.skills ?? (Array.isArray(data) ? data : []);
                return items.map(normalizeClawHub);
              }
            } catch (directErr: any) {
              if (directErr.name === 'AbortError') throw directErr;
              console.warn('ClawHub fetch failed (proxy + direct):', directErr);
            }
            return [];
          }
        };

        try {
          if (searchQuery) {
            // Search endpoint lacks stats — also fetch the listing to enrich
            const [searchResults, listResults] = await Promise.all([
              fetchClaw(`/search?q=${encodeURIComponent(searchQuery)}&limit=60`),
              fetchClaw(`/skills?sort=${sort}&limit=100`),
            ]);
            // Build stats lookup from listing
            const statsMap = new Map<string, BrowseSkill>();
            for (const s of listResults) statsMap.set(s.slug.toLowerCase(), s);
            // Enrich search results with stats from listing
            const enriched = searchResults.map(s => {
              const full = statsMap.get(s.slug.toLowerCase());
              if (full) return { ...s, _downloads: full._downloads, _stars: full._stars };
              return s;
            });
            results.clawhub = enriched;
          } else {
            results.clawhub = await fetchClaw(`/skills?sort=${sort}&limit=100`);
          }
        } catch (err: any) {
          if (err.name === 'AbortError') return;
        }
      }

      // Fetch skills.sh
      try {
        let data: any;
        if (debouncedSearch.trim()) {
          data = await fetchSkillsSh(`/skills/search?q=${encodeURIComponent(debouncedSearch)}`, ctrl.signal);
        } else {
          const view = sort === 'newest' ? 'all-time' : sort === 'trending' ? 'trending' : 'hot';
          data = await fetchSkillsSh(`/skills?view=${view}`, ctrl.signal);
        }
        results.skillssh = (data.skills ?? data.results ?? data ?? []).slice(0, 60).map(normalizeSkillsSh);
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.warn('skills.sh fetch failed:', err);
      }

      // Fetch SkillsMP (proxy → direct fallback)
      {
        const catDef = BROWSE_CATEGORIES.find(c => c.id === category);
        // SkillsMP requires a query — use category query or a broad default
        const searchQuery = debouncedSearch.trim() || catDef?.query || 'agent skill tool';
        const smpPath = `/skills/search?q=${encodeURIComponent(searchQuery)}&limit=60&sortBy=${sort === 'newest' ? 'recent' : 'stars'}`;
        try {
          let data: any;
          try {
            data = await fetchSkillsMP(smpPath, ctrl.signal);
          } catch {
            const res = await fetch(`https://skillsmp.com/api/v1${smpPath}`, {
              headers: { 'Accept': 'application/json' },
              signal: ctrl.signal,
            });
            if (res.ok) data = await res.json();
          }
          if (data) {
            const items = data?.data?.skills ?? [];
            results.skillsmp = items.map(normalizeSkillsMP);
          }
        } catch (err: any) {
          if (err.name === 'AbortError') return;
          console.warn('SkillsMP fetch failed:', err);
        }
      }

      // Merge — prefer ClawHub, then skills.sh, then SkillsMP
      let merged = deduplicateSkills(deduplicateSkills(results.clawhub, results.skillssh), results.skillsmp);

      // Client-side sort
      if (sort === 'downloads') {
        merged.sort((a, b) => (b._downloads ?? 0) - (a._downloads ?? 0));
      } else if (sort === 'stars') {
        merged.sort((a, b) => (b._stars ?? 0) - (a._stars ?? 0));
      } else if (sort === 'newest') {
        merged.sort((a, b) => {
          const ta = typeof a.updatedAt === 'number' ? a.updatedAt : new Date(a.updatedAt || 0).getTime();
          const tb = typeof b.updatedAt === 'number' ? b.updatedAt : new Date(b.updatedAt || 0).getTime();
          return tb - ta;
        });
      }

      if (merged.length > 0) {
        setSkills(merged);
        setError(null);
      } else {
        setError('Could not reach skill registries — showing featured skills');
        setSkills(FEATURED_SKILLS);
      }
      setLoading(false);
    };
    fetchAll();
    return () => ctrl.abort();
  }, [debouncedSearch, category, sort]);

  React.useEffect(() => {
    if (!initialSlug || initialSlugHandled.current || skills.length === 0) return;
    const match = skills.find(s => s.slug === initialSlug || s.displayName === initialSlug);
    if (match) { initialSlugHandled.current = true; openDetail(match); }
  }, [initialSlug, skills]);

  // Fetch skill detail from the appropriate registry (with direct-fetch fallback)
  const openDetail = async (skill: BrowseSkill) => {
    setSelectedSkill(skill);
    setDetailSkill(skill);
    setDetailLoading(true);

    const tryClawHubDetail = async () => {
      let data: any;
      let fileContent: string = '';

      // Helper: fetch SKILL.md as text (endpoint returns text/markdown, not JSON)
      const fetchSkillMd = async (baseUrl: string, headers?: Record<string, string>) => {
        try {
          const fRes = await fetch(`${baseUrl}/skills/${encodeURIComponent(skill.slug)}/file?path=SKILL.md`, {
            headers: { ...headers },
            signal: AbortSignal.timeout(8000),
          });
          if (fRes.ok) return await fRes.text();
        } catch { /* no file */ }
        return '';
      };

      // Try proxy first, then direct
      try {
        const cleanSlug = encodeURIComponent(skill.slug);
        const [detailRes, mdText] = await Promise.all([
          fetchClawHub(`/skills/${cleanSlug}`),
          fetchSkillMd(`${CLAWHUB_BASE}`),
        ]);
        data = detailRes;
        fileContent = mdText;
      } catch {
        // Proxy down — try direct fetch to ClawHub
        const res = await fetch(`https://clawhub.ai/api/v1/skills/${encodeURIComponent(skill.slug)}`, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error(`ClawHub direct ${res.status}`);
        data = await res.json();
        fileContent = await fetchSkillMd('https://clawhub.ai/api/v1');
      }
      const d = data?.skill ?? data;
      const lv = data?.latestVersion ?? d.latestVersion;
      const mod = data?.moderation ?? d.moderation;
      const own = data?.owner ?? d.owner;
      return {
        ...skill,
        slug: d.slug ?? skill.slug,
        displayName: d.displayName ?? skill.displayName,
        summary: d.summary ?? skill.summary,
        ownerHandle: own?.handle ?? d.ownerHandle ?? skill.ownerHandle,
        owner: own ?? skill.owner,
        tags: (() => { const t = d.tags; return Array.isArray(t) ? t : (t && typeof t === 'object' ? Object.keys(t).filter((k: string) => k !== 'latest') : skill.tags); })(),
        createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : skill.createdAt,
        updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : skill.updatedAt,
        version: lv?.version ?? skill.version,
        scanStatus: mod?.verdict === 'clean' ? 'clean' : mod?.verdict === 'warn' ? 'warn' : (d.scanStatus ?? skill.scanStatus),
        moderation: mod ? { verdict: mod.verdict, summary: mod.summary, reasonCodes: mod.reasonCodes } : skill.moderation,
        capabilities: d.capabilities ?? skill.capabilities ?? [],
        _source: 'clawhub' as SkillSource,
        _downloads: d.stats?.downloads ?? skill._downloads,
        _installs: d.stats?.installsAllTime ?? d.stats?.installsCurrent ?? skill._installs,
        _stars: d.stats?.stars ?? skill._stars,
        _versions: d.stats?.versions ?? skill._versions,
        _license: lv?.license ?? skill._license,
        _readme: fileContent || '',
      };
    };

    try {
      if (skill._source === 'skillsmp') {
        setDetailSkill({
          ...skill,
          _readme: skill.summary ? `**${skill.displayName}**\n\n${skill.summary}${skill._externalUrl ? `\n\n[View on GitHub](${skill._externalUrl})` : ''}` : '',
        });
      } else if (skill._source === 'skills.sh') {
        try {
          const ghData = await enrichFromGitHub(skill);
          setDetailSkill({
            ...skill,
            ...ghData,
            _source: 'skills.sh',
          });
        } catch {
          try {
            setDetailSkill(await tryClawHubDetail());
          } catch { /* keep list-level data */ }
        }
      } else {
        setDetailSkill(await tryClawHubDetail());
      }
    } catch {
      // Keep the list-level data
    } finally {
      setDetailLoading(false);
    }
  };

  // Step 1: choose which connected agents this review request is for.
  const handleInstall = (skill: BrowseSkill) => {
    setInstallTarget(skill);
    setSelectedAgents(new Set(agents[0] ? [agents[0].id] : []));
  };

  // Step 2: register one idempotent review request with stable agent ids.
  const confirmInstall = async () => {
    if (!installTarget) return;
    const skill = installTarget;
    setInstalling(skill.slug);
    setInstallTarget(null);
    try {
      const response = await fetch('/pod/skills', {
        method: 'POST',
        headers: { ...authHeaders(authToken), 'content-type': 'application/json' },
        body: JSON.stringify({
          actor_id: 'person-local',
          name: skill.displayName,
          description: skill.summary,
          version: skill.version,
          author: skill.ownerHandle,
          source: skill._source,
          source_slug: skill.slug,
          scope: 'personal',
          permissions: [],
          agent_ids: [...selectedAgents],
          portability: 'exportable',
          metadata: { source_slug: skill.slug, source_url: skill._externalUrl },
          content: skill._readme,
          files: skill._readme ? { 'SKILL.md': skill._readme } : undefined,
        }),
      });
      const data = await response.json() as { skill?: PodSkill; message?: string };
      if (!response.ok || !data.skill) throw new Error(data.message ?? `Request failed (${response.status})`);
      setRegistered(prev => new Map(prev).set(skill.slug, data.skill!.status));
      onSkillsChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add this skill for review.');
    } finally {
      setInstalling(null);
    }
  };

  const toggleAgent = (id: string) => {
    setSelectedAgents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  function scanBadge(status?: string) {
    if (!status || status === 'clean') return <span className="browse-security-badge" data-level="safe"><ShieldCheck size={11} /> Verified</span>;
    if (status === 'warn') return <span className="browse-security-badge" data-level="medium"><ShieldCheck size={11} /> Warning</span>;
    return <span className="browse-security-badge" data-level="high-risk"><ShieldCheck size={11} /> Blocked</span>;
  }

  function relTime(iso: string) {
    if (!iso) return '';
    const d = Date.now() - new Date(iso).getTime();
    if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
    if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
    if (d < 2592000000) return `${Math.floor(d / 86400000)}d ago`;
    return new Date(iso).toLocaleDateString();
  }

  function registrationLabel(status: PodSkill['status']): string {
    if (status === 'review' || status === 'possible') return 'In review';
    if (status === 'approved') return 'In Library';
    if (status === 'disabled') return 'Disabled';
    if (status === 'flagged') return 'Needs attention';
    return 'Enabled';
  }

  // ── Agent picker overlay (shared by card grid + detail) ──
  const agentPickerOverlay = installTarget && (
    <div className="browse-agent-picker-overlay" onClick={() => setInstallTarget(null)}>
      <div className="browse-agent-picker" onClick={e => e.stopPropagation()}>
        <div className="browse-agent-picker-header">
          <h3>Add "{installTarget.displayName}" for review</h3>
          <button className="browse-agent-picker-close" onClick={() => setInstallTarget(null)}><X size={14} /></button>
        </div>
        <p className="browse-agent-picker-sub">Choose the connected agents that should receive this skill after approval.</p>
        <div className="browse-agent-picker-list">
          {agents.length === 0 && (
            <div className="browse-agent-picker-empty">Connect an agent from Connections before adding a skill.</div>
          )}
          {agents.map(agent => {
            const sel = selectedAgents.has(agent.id);
            return (
              <button key={agent.id} className={`browse-agent-chip-btn ${sel ? 'selected' : ''}`} onClick={() => toggleAgent(agent.id)}>
                <span className="browse-agent-chip-icon">{skillAgentLogo(agent.id, 22)}</span>
                <span>{agent.name}</span>
                {sel && <CheckCircle2 size={13} className="browse-agent-chip-check" />}
              </button>
            );
          })}
        </div>
        <div className="browse-agent-picker-footer">
          <span className="browse-agent-picker-hint">{selectedAgents.size === 0 ? 'Select at least one agent' : `${selectedAgents.size} agent${selectedAgents.size !== 1 ? 's' : ''} selected`}</span>
          <div className="browse-agent-picker-actions">
            <button className="browse-agent-picker-cancel" onClick={() => setInstallTarget(null)}>Cancel</button>
            <button className="browse-install-btn primary" onClick={confirmInstall} disabled={selectedAgents.size === 0}>
              <ShieldCheck size={13} /> Add for review
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Detail view ──
  if (selectedSkill && detailSkill) {
    const registrationStatus = registered.get(detailSkill.slug);
    const fmtK = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
    const sourceUrl = detailSkill._source === 'skillsmp'
      ? (detailSkill._externalUrl || `https://skillsmp.com/skills/${detailSkill.slug}`)
      : detailSkill._source === 'skills.sh'
      ? `https://skills.sh/skills/${detailSkill.ownerHandle}/${detailSkill.slug}`
      : `https://clawhub.ai/skills/${detailSkill.slug}`;
    const ownerImg = detailSkill.owner?.image;
    const ownerName = detailSkill.owner?.displayName ?? detailSkill.ownerHandle;
    return (
      <div className="browse-detail-wrap">
        {/* Top bar: back + actions */}
        <div className="browse-detail-topbar">
          <button className="browse-back-btn" onClick={() => { setSelectedSkill(null); setDetailSkill(null); }}>
            <ChevronLeft size={14} /> Back
          </button>
          <div className="browse-detail-actions">
            {registrationStatus ? (
              <span className="browse-installed-badge"><CheckCircle2 size={14} /> {registrationLabel(registrationStatus)}</span>
            ) : (
              <button className="browse-install-btn primary" onClick={() => handleInstall(detailSkill)} disabled={installing === detailSkill.slug}>
                <ShieldCheck size={14} /> {installing === detailSkill.slug ? 'Adding…' : 'Add for review'}
              </button>
            )}
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="browse-download-btn" title="View source">
              <ExternalLink size={14} /> View source
            </a>
          </div>
        </div>

        {detailLoading && <div className="browse-loading-line" />}

        {/* Hero — title, publisher, description */}
        <div className="browse-detail-hero-full">
          <h2 className="browse-detail-title">{detailSkill.displayName}</h2>
          <div className="browse-detail-publisher">
            {ownerImg ? (
              <img src={ownerImg} alt="" className="browse-detail-publisher-img" />
            ) : (
              <div className="browse-detail-publisher-avatar">{ownerName.charAt(0).toUpperCase()}</div>
            )}
            <span>{ownerName}</span>
          </div>
          <p className="browse-detail-hero-desc">{detailSkill.summary}</p>
        </div>

        {/* Stats row */}
        <div className="browse-detail-stats-row">
          {detailSkill._stars != null && detailSkill._stars > 0 && (
            <span className="browse-stat-pill"><Star size={14} /> {fmtK(detailSkill._stars)}</span>
          )}
          {detailSkill._downloads != null && (
            <span className="browse-stat-pill"><Download size={14} /> {fmtK(detailSkill._downloads)}</span>
          )}
          {detailSkill._installs != null && detailSkill._installs > 0 && (
            <span className="browse-stat-pill"><Users size={14} /> {fmtK(detailSkill._installs)} installs</span>
          )}
          {detailSkill.version && detailSkill.version !== '0.0.0' && (
            <span className="browse-stat-pill">v{detailSkill.version}</span>
          )}
          {detailSkill._license && (
            <span className="browse-stat-pill">{detailSkill._license}</span>
          )}
          {detailSkill.updatedAt && (
            <span className="browse-stat-pill">Updated {relTime(detailSkill.updatedAt)}</span>
          )}
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="browse-stat-pill source">
            {SOURCE_ICONS[detailSkill._source] && <img src={SOURCE_ICONS[detailSkill._source]} alt="" />}
            {SOURCE_LABELS[detailSkill._source]}
            <ExternalLink size={11} />
          </a>
        </div>

        {/* Tags */}
        {detailSkill.tags.length > 0 && (
          <div className="browse-detail-meta-row">
            {detailSkill.tags.map(t => <span key={t} className="browse-tag-chip">{t}</span>)}
          </div>
        )}

        {/* Full-width content */}
        {detailSkill._readme ? (
          <div className="browse-detail-readme-wrap">
            <div className="browse-detail-readme-header">
              <FileText size={14} />
              <span>SKILL.MD</span>
              <button
                className={`browse-readme-copy${readmeCopied ? ' is-copied' : ''}`}
                title={readmeCopied ? 'Copied!' : 'Copy markdown'}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(detailSkill._readme ?? '');
                    setReadmeCopied(true);
                    setTimeout(() => setReadmeCopied(false), 1500);
                  } catch {
                    // Fallback for clipboard API blocked: select + execCommand
                    try {
                      const ta = document.createElement('textarea');
                      ta.value = detailSkill._readme ?? '';
                      ta.style.position = 'fixed';
                      ta.style.opacity = '0';
                      document.body.appendChild(ta);
                      ta.select();
                      document.execCommand('copy');
                      document.body.removeChild(ta);
                      setReadmeCopied(true);
                      setTimeout(() => setReadmeCopied(false), 1500);
                    } catch {/* give up silently */}
                  }
                }}
              >
                {readmeCopied ? <Check size={13} /> : <Copy size={13} />}
              </button>
            </div>
            <div className="browse-detail-readme" dangerouslySetInnerHTML={{ __html: simpleMarkdown(detailSkill._readme) }} />
          </div>
        ) : !detailLoading ? (
          <div className="browse-detail-empty-readme">
            <p>No README content loaded yet.</p>
          </div>
        ) : null}

        {(detailSkill.capabilities ?? []).length > 0 && (
          <div className="browse-detail-section">
            <h4>Capabilities</h4>
            <div className="browse-detail-meta-row">
              {detailSkill.capabilities!.map(c => <span key={c} className="browse-agent-chip">{c}</span>)}
            </div>
          </div>
        )}
        {agentPickerOverlay}
      </div>
    );
  }

  // ── Main browse view ──
  return (
    <div className="browse-wrap">
      {/* Search + dropdowns row */}
      <div className="browse-top-row">
        <div className="browse-search-row">
          <Search size={14} className="browse-search-icon" />
          <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search skills…" />
          {search && <button className="browse-search-clear" onClick={() => { setSearch(''); searchRef.current?.focus(); }}><X size={12} /></button>}
        </div>
        <AppSelect className="browse-sort-select" value={sort} onChange={v => setSort(v as SortMode)} options={[
          { value: 'trending', label: 'Trending' },
          { value: 'downloads', label: 'Most Downloads' },
          { value: 'stars', label: 'Most Stars' },
          { value: 'newest', label: 'Newest' },
        ]} />
      </div>

      {error && <div className="browse-notice">{error}</div>}

      {/* Category + source chips */}
      <div className="browse-categories">
        {BROWSE_CATEGORIES.map(cat => (
          <button key={cat.id} className={`browse-cat-chip ${category === cat.id ? 'active' : ''}`} onClick={() => setCategory(cat.id)}>
            {cat.label}
          </button>
        ))}
        <span className="browse-chip-divider" />
        {([['all', 'All Sources'], ['clawhub', 'ClawHub'], ['skillsmp', 'SkillsMP'], ['skills.sh', 'skills.sh']] as const).map(([val, label]) => (
          <button key={val} className={`browse-cat-chip browse-source-filter ${sourceFilter === val ? 'active' : ''}`} onClick={() => setSourceFilter(val as any)}>
            {label}
          </button>
        ))}
      </div>

      {/* Skills grid */}
      <div className="browse-section" style={{ position: 'relative' }}>
        {loading && <GridSkeleton cards={12} />}
        {!loading && (() => {
          const filtered = sourceFilter === 'all' ? skills : skills.filter(s => s._source === sourceFilter);
          const visible = filtered.slice(0, visibleCount);
          const hasMore = filtered.length > visibleCount;
          return filtered.length === 0 ? (
          <div className="activity-empty">
            <Search size={28} />
            <strong>No skills found</strong>
            <p>Try a different search, category, or source filter.</p>
          </div>
        ) : (
          <>
          <div className="browse-grid">
            {visible.map(skill => {
              const registrationStatus = registered.get(skill.slug);
              const fmtNum = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
              return (
                <div
                  key={skill.slug}
                  className="browse-skill-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => openDetail(skill)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openDetail(skill);
                    }
                  }}
                >
                  <div className="browse-card-top">
                    <h4 className="browse-card-name">{skill.displayName}</h4>
                    <span className="browse-card-author">by {skill.ownerHandle}</span>
                  </div>
                  <div className="browse-card-badges">
                    {(() => { const cat = inferCategory(skill); return cat ? <span className="browse-type-chip">{cat}</span> : null; })()}
                    <span className={`browse-source-chip ${skill._source}`}>
                      {SOURCE_ICONS[skill._source] && <img src={SOURCE_ICONS[skill._source]} alt="" />}
                      {SOURCE_LABELS[skill._source]}
                    </span>
                    {registrationStatus && <span className="browse-installed-badge"><CheckCircle2 size={11} /> {registrationLabel(registrationStatus)}</span>}
                  </div>
                  <span className="browse-card-desc">{skill.summary}</span>
                  <div className="browse-card-footer">
                    <div className="browse-card-stats">
                      {skill._stars != null && skill._stars > 0 && (
                        <span className="browse-card-stat"><Star size={15} /> {fmtNum(skill._stars)}</span>
                      )}
                      {skill._downloads != null && (
                        <span className="browse-card-stat"><Download size={15} /> {fmtNum(skill._downloads)}</span>
                      )}
                    </div>
                    {!registrationStatus ? (
                      <button className="browse-install-btn" onClick={(e) => { e.stopPropagation(); handleInstall(skill); }} disabled={installing === skill.slug}>
                        <ShieldCheck size={13} /> {installing === skill.slug ? 'Adding…' : 'Add for review'}
                      </button>
                    ) : (
                      <span className="browse-installed-check"><CheckCircle2 size={13} /></span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {hasMore && (
            <div className="browse-load-more">
              <button className="browse-load-more-btn" onClick={() => setVisibleCount(c => c + 30)}>
                Show more skills ({filtered.length - visibleCount} remaining)
              </button>
            </div>
          )}
          {!hasMore && filtered.length > 0 && (
            <div className="browse-end-note">{filtered.length} skill{filtered.length === 1 ? '' : 's'} from {sourceFilter === 'all' ? 'all sources' : sourceFilter}</div>
          )}
          </>
        );
        })()}
      </div>

      {agentPickerOverlay}
    </div>
  );
}

function CapabilitiesView(props: { skills: PodSkill[]; plugins: PodPlugin[]; authToken: string; onCapabilitiesChanged?: () => void }) {
  const [section, setSection] = React.useState<'inbox' | 'library' | 'deployments' | 'discover'>(() =>
    props.skills.some(skill => skill.pending_revision) || props.plugins.some(plugin => plugin.pending_revision) ? 'inbox' : 'library',
  );
  const [capabilityType, setCapabilityType] = React.useState<'all' | 'skill' | 'plugin'>('all');
  const [browseSlug, setBrowseSlug] = React.useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = React.useState<PodSkill | null>(null);
  const [selectedPlugin, setSelectedPlugin] = React.useState<PodPlugin | null>(null);
  const [skillContent, setSkillContent] = React.useState<{ content: string; files: Record<string, string>; directory: string } | null>(null);
  const [contentLoading, setContentLoading] = React.useState(false);
  const [selectedEvent, setSelectedEvent] = React.useState<{ id: string; type: string; title: string; detail: string | null; observed_at: string; content: any } | null>(null);
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [skillEvents, setSkillEvents] = React.useState<{ id: string; type: string; title: string; detail: string | null; observed_at: string; content: any }[]>([]);
  const [agents, setAgents] = React.useState<SkillAgent[]>([]);
  const [manageSkill, setManageSkill] = React.useState<PodSkill | null>(null);
  const [manageAgentIds, setManageAgentIds] = React.useState<Set<string>>(new Set());
  const [manageSaving, setManageSaving] = React.useState(false);
  const [scanning, setScanning] = React.useState(false);
  const [deploying, setDeploying] = React.useState<string | null>(null);
  const [importingPlugin, setImportingPlugin] = React.useState(false);
  const pluginFolderInputRef = React.useRef<HTMLInputElement>(null);

  // Fetch skill .md content when a skill is selected
  React.useEffect(() => {
    if (!selectedSkill) { setSkillContent(null); return; }
    const revision = selectedSkill.pending_revision ?? selectedSkill.current_revision;
    const revisionFiles = revision?.files ?? (revision?.content ? { 'SKILL.md': revision.content } : null);
    if (revision && revisionFiles && Object.keys(revisionFiles).length > 0) {
      setSkillContent({
        content: revisionFiles['SKILL.md'] ?? Object.values(revisionFiles)[0],
        files: revisionFiles,
        directory: `Canonical revision ${revision.revision_number}`,
      });
      setContentLoading(false);
      return;
    }
    setContentLoading(true);
    getJson<{ content: string; files: Record<string, string>; directory: string }>(`/pod/skills/${encodeURIComponent(selectedSkill.id)}/content`, props.authToken)
      .then(data => setSkillContent(data))
      .catch(() => setSkillContent(null))
      .finally(() => setContentLoading(false));
  }, [selectedSkill?.id]);

  React.useEffect(() => {
    getJson<{ events: any[] }>('/pod/events?process=access&limit=50', props.authToken)
      .then(data => setSkillEvents(data.events))
      .catch(() => {});
  }, [props.skills]);

  React.useEffect(() => {
    getJson<{ agents: SkillAgent[] }>('/pod/registry/agents', props.authToken)
      .then(data => setAgents(data.agents.filter(agent => !agent.discovered && agent.status !== 'disabled')))
      .catch(() => setAgents([]));
  }, [props.authToken]);

  const allSkills = props.skills;

  const librarySkills = allSkills.filter(s => Boolean(s.current_revision) || s.status === 'approved' || s.status === 'installed' || s.status === 'disabled');
  const inboxSkills = allSkills.filter(s => Boolean(s.pending_revision) || s.status === 'review' || s.status === 'possible' || s.status === 'flagged');
  const libraryPlugins = props.plugins.filter(plugin => Boolean(plugin.current_revision) || plugin.status === 'approved' || plugin.status === 'disabled');
  const inboxPlugins = props.plugins.filter(plugin => Boolean(plugin.pending_revision) || plugin.status === 'review' || plugin.status === 'flagged');
  const visibleInboxSkills = capabilityType === 'plugin' ? [] : inboxSkills;
  const visibleInboxPlugins = capabilityType === 'skill' ? [] : inboxPlugins;
  const visibleLibrarySkills = capabilityType === 'plugin' ? [] : librarySkills;
  const visibleLibraryPlugins = capabilityType === 'skill' ? [] : libraryPlugins;
  const deploymentRows = librarySkills.flatMap(skill => {
    const agentIds = new Set([
      ...skill.equipped_to,
      ...skill.deployments.map(deployment => deployment.agent_id),
    ]);
    return [...agentIds].map(agentId => ({
      skill,
      agentId,
      agent: agents.find(candidate => candidate.id === agentId || candidate.name === agentId),
      deployment: skill.deployments.find(candidate => candidate.agent_id === agentId),
    }));
  });

  async function scanNativeSkills() {
    setScanning(true);
    setActionError(null);
    try {
      const response = await fetch('/pod/skills/scan', {
        method: 'POST',
        headers: { ...authHeaders(props.authToken), 'content-type': 'application/json' },
        body: JSON.stringify({ actor_id: 'person-local' }),
      });
      const data = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? `Scan failed (${response.status})`);
      props.onCapabilitiesChanged?.();
      setSection('inbox');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not scan native Skill directories.');
    } finally {
      setScanning(false);
    }
  }

  async function reviewRevision(skill: PodSkill, action: 'approve' | 'reject') {
    const revision = skill.pending_revision;
    if (!revision) return;
    setActionLoading(skill.id);
    setActionError(null);
    try {
      const response = await fetch(`/pod/skills/${encodeURIComponent(skill.id)}/revisions/${encodeURIComponent(revision.id)}/${action}`, {
        method: 'POST',
        headers: { ...authHeaders(props.authToken), 'content-type': 'application/json' },
        body: JSON.stringify({ actor_id: 'person-local' }),
      });
      const data = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? `Review failed (${response.status})`);
      setSelectedSkill(null);
      props.onCapabilitiesChanged?.();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not review this revision.');
    } finally {
      setActionLoading(null);
    }
  }

  async function importPluginFolder(files: FileList) {
    const selected = Array.from(files);
    if (selected.length === 0) return;
    setImportingPlugin(true);
    setActionError(null);
    try {
      const firstRelative = (selected[0] as File & { webkitRelativePath?: string }).webkitRelativePath || selected[0].name;
      const rootName = firstRelative.includes('/') ? firstRelative.split('/')[0] : 'local-plugin';
      const packageFiles: Record<string, { encoding: 'utf8' | 'base64'; content: string }> = {};
      for (const file of selected) {
        const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        const packagePath = relative.startsWith(`${rootName}/`) ? relative.slice(rootName.length + 1) : relative;
        const bytes = new Uint8Array(await file.arrayBuffer());
        try {
          packageFiles[packagePath] = { encoding: 'utf8', content: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
        } catch {
          let binary = '';
          for (let offset = 0; offset < bytes.length; offset += 0x8000) {
            binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
          }
          packageFiles[packagePath] = { encoding: 'base64', content: btoa(binary) };
        }
      }
      const response = await fetch('/pod/plugins', {
        method: 'POST',
        headers: { ...authHeaders(props.authToken), 'content-type': 'application/json' },
        body: JSON.stringify({ actor_id: 'person-local', source: 'local', source_ref: rootName, files: packageFiles }),
      });
      const data = await response.json().catch(() => ({})) as { message?: string; inspection?: { issues?: Array<{ message: string }> } };
      if (!response.ok) {
        const issue = data.inspection?.issues?.[0]?.message;
        throw new Error(issue ?? data.message ?? `Plugin import failed (${response.status})`);
      }
      await props.onCapabilitiesChanged?.();
      setCapabilityType('plugin');
      setSection('inbox');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not import this Agent Plugin.');
    } finally {
      setImportingPlugin(false);
      if (pluginFolderInputRef.current) pluginFolderInputRef.current.value = '';
    }
  }

  async function reviewPluginRevision(plugin: PodPlugin, action: 'approve' | 'reject') {
    const revision = plugin.pending_revision;
    if (!revision) return;
    setActionLoading(plugin.id);
    setActionError(null);
    try {
      const response = await fetch(`/pod/plugins/${encodeURIComponent(plugin.id)}/revisions/${encodeURIComponent(revision.id)}/${action}`, {
        method: 'POST',
        headers: { ...authHeaders(props.authToken), 'content-type': 'application/json' },
        body: JSON.stringify({ actor_id: 'person-local' }),
      });
      const data = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? `Review failed (${response.status})`);
      setSelectedPlugin(null);
      props.onCapabilitiesChanged?.();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not review this Plugin revision.');
    } finally {
      setActionLoading(null);
    }
  }

  async function removePlugin(plugin: PodPlugin) {
    setActionLoading(plugin.id);
    setActionError(null);
    try {
      const response = await fetch(`/pod/plugins/${encodeURIComponent(plugin.id)}`, {
        method: 'DELETE',
        headers: { ...authHeaders(props.authToken), 'content-type': 'application/json' },
        body: JSON.stringify({ actor_id: 'person-local' }),
      });
      if (!response.ok) throw new Error(`Remove failed (${response.status})`);
      setSelectedPlugin(null);
      props.onCapabilitiesChanged?.();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not remove this Plugin.');
    } finally {
      setActionLoading(null);
    }
  }

  function deploymentTarget(agent?: SkillAgent, fallback?: string): 'codex' | 'claude-code' | null {
    const identity = `${agent?.id ?? fallback ?? ''} ${agent?.name ?? ''}`.toLowerCase();
    if (identity.includes('claude')) return 'claude-code';
    if (identity.includes('codex')) return 'codex';
    return null;
  }

  async function deploySkill(skill: PodSkill, agentId: string, target: 'codex' | 'claude-code') {
    const key = `${skill.id}:${agentId}`;
    setDeploying(key);
    setActionError(null);
    try {
      const response = await fetch(`/pod/skills/${encodeURIComponent(skill.id)}/deployments`, {
        method: 'POST',
        headers: { ...authHeaders(props.authToken), 'content-type': 'application/json' },
        body: JSON.stringify({ actor_id: 'person-local', agent_id: agentId, target }),
      });
      const data = await response.json().catch(() => ({})) as { message?: string; preview?: { message?: string }; deployment?: PodSkillDeployment };
      if (!response.ok) throw new Error(data.message ?? `Deployment failed (${response.status})`);
      if (data.deployment?.status !== 'synced') throw new Error(data.preview?.message ?? 'Deployment requires attention.');
      props.onCapabilitiesChanged?.();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not deploy this Skill.');
    } finally {
      setDeploying(null);
    }
  }

  async function skillAction(skillId: string, action: 'approve' | 'disable' | 'delete') {
    setActionLoading(skillId);
    setActionError(null);
    try {
      const url = action === 'delete'
        ? `/pod/skills/${encodeURIComponent(skillId)}`
        : `/pod/skills/${encodeURIComponent(skillId)}/${action}`;
      const method = action === 'delete' ? 'DELETE' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { ...authHeaders(props.authToken), 'content-type': 'application/json' },
        body: JSON.stringify({ actor_id: 'person-local' }),
      });
      const data = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`);
      setSelectedSkill(null);
      props.onCapabilitiesChanged?.();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `Could not ${action} this skill.`);
    } finally {
      setActionLoading(null);
    }
  }

  function openAgentManager(skill: PodSkill) {
    const resolved = skill.equipped_to.map(value => {
      const agent = agents.find(candidate => candidate.id === value || candidate.name === value);
      return agent?.id;
    }).filter((id): id is string => Boolean(id));
    setManageSkill(skill);
    setManageAgentIds(new Set(resolved));
    setActionError(null);
  }

  async function saveAgentAssignments() {
    if (!manageSkill) return;
    setManageSaving(true);
    setActionError(null);
    try {
      const response = await fetch(`/pod/skills/${encodeURIComponent(manageSkill.id)}/agents`, {
        method: 'PUT',
        headers: { ...authHeaders(props.authToken), 'content-type': 'application/json' },
        body: JSON.stringify({ actor_id: 'person-local', agent_ids: [...manageAgentIds] }),
      });
      const data = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`);
      setManageSkill(null);
      setSelectedSkill(null);
      props.onCapabilitiesChanged?.();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not update agent assignments.');
    } finally {
      setManageSaving(false);
    }
  }

  function renderAgentAssignments(skill: PodSkill) {
    const assignments = skill.equipped_to.map(value => ({
      value,
      agent: agents.find(candidate => candidate.id === value || candidate.name === value),
      binding: skill.agent_bindings.find(candidate => candidate.agent_id === value),
    }));
    return (
      <div className="skill-detail-section">
        <div className="skill-detail-section-heading">
          <h4>Assigned agents</h4>
          <button className="skill-manage-agents-btn" onClick={() => openAgentManager(skill)}>Manage</button>
        </div>
        {assignments.length > 0 ? (
          <div className="skill-agent-chip-list">
            {assignments.map(({ value, agent, binding }) => {
              const assignmentState = !agent ? 'unconnected' : binding?.status ?? 'needs-save';
              return (
                <span key={value} className={`skill-agent-chip${agent ? '' : ' legacy'}`}>
                  {skillAgentLogo(agent?.id ?? value, 15)}
                  {agent?.name ?? value}
                  <span className={`skill-agent-chip-state ${assignmentState === 'needs-save' ? '' : assignmentState}`}>
                    {assignmentState.replace('-', ' ')}
                  </span>
                </span>
              );
            })}
          </div>
        ) : (
          <div className="skill-agent-unassigned">
            <AlertTriangle size={14} />
            <span>Unassigned. Choose an agent before enabling this skill.</span>
          </div>
        )}
      </div>
    );
  }

  function hasConnectedAssignment(skill: PodSkill): boolean {
    return skill.equipped_to.some(value => agents.some(agent => agent.id === value || agent.name === value));
  }

  function renderLocalFiles() {
    return (
      <div className="skill-detail-section">
        <h4>Local files</h4>
        {contentLoading ? (
          <div className="browse-loading-line" />
        ) : skillContent ? (
          <div className="skill-local-files-status found">
            <CheckCircle2 size={14} />
            <span><strong>Directory found</strong><code>{skillContent.directory}</code></span>
          </div>
        ) : (
          <div className="skill-local-files-status">
            <AlertTriangle size={14} />
            <span><strong>No local directory</strong>Pod manages review and agent access, but has not installed files for this skill.</span>
          </div>
        )}
      </div>
    );
  }

  function trustColor(score: number) {
    if (score >= 80) return 'var(--coffee-green)';
    if (score >= 50) return 'var(--coffee-amber)';
    if (score > 0) return 'var(--coffee-red)';
    return 'var(--fg-4)';
  }

  function statusBadge(status: PodSkill['status']) {
    const colors: Record<string, string> = {
      approved: 'var(--coffee-blue)', installed: 'var(--coffee-green)', review: 'var(--coffee-blue)',
      possible: 'var(--coffee-blue)', flagged: 'var(--coffee-red)', disabled: 'var(--fg-4)',
    };
    const labels: Record<PodSkill['status'], string> = {
      approved: 'In Library', installed: 'Enabled', review: 'In review', possible: 'Discovered',
      disabled: 'Disabled', flagged: 'Needs attention',
    };
    return <span className="skill-status-badge" style={{ color: colors[status], borderColor: colors[status] }}>{labels[status]}</span>;
  }

  function sourceBadge(source: PodSkill['source'] | PodPlugin['source']) {
    return <span className={`skill-source-badge source-${source}`}>{source}</span>;
  }

  function trustLevelChip(level: PodSkill['trust_level']) {
    const labels: Record<string, string> = { high: 'High confidence', medium: 'Medium', caution: 'Caution', blocked: 'Blocked' };
    return <span className={`trust-level-chip level-${level}`}>{labels[level]}</span>;
  }

  function severityIcon(severity: TelemetryEvent['severity']) {
    if (severity === 'error') return <AlertTriangle size={14} className="telem-icon-error" />;
    if (severity === 'warning') return <AlertTriangle size={14} className="telem-icon-warning" />;
    return <Activity size={14} className="telem-icon-info" />;
  }

  function renderSkillDetail(skill: PodSkill, context: 'inbox' | 'library') {
    const focusRevision = context === 'inbox' ? skill.pending_revision : skill.current_revision;
    return (
      <div className="skill-detail-panel">
        <div className="skill-detail-top">
          <button className="activity-detail-close" onClick={() => setSelectedSkill(null)}><X size={16} /></button>
        </div>
        <h3 className="skill-detail-name">{skill.name}</h3>
        <p className="skill-detail-desc">{focusRevision?.summary || skill.description}</p>
        <div className="skill-detail-section">
          <h4>{context === 'inbox' ? 'Incoming revision' : 'Canonical revision'}</h4>
          <div className="skill-detail-meta-grid">
            <div className="graph-detail-prop"><span>Revision</span><strong>{focusRevision ? `r${focusRevision.revision_number}` : 'Legacy record'}</strong></div>
            <div className="graph-detail-prop"><span>Version</span><strong>{focusRevision?.version ?? skill.version}</strong></div>
            <div className="graph-detail-prop"><span>Package</span><strong className="skill-mono-sm">{focusRevision ? focusRevision.content_hash.slice(0, 12) : 'Unavailable'}</strong></div>
            <div className="graph-detail-prop"><span>Origin</span>{sourceBadge(focusRevision?.origin ?? skill.source)}</div>
            <div className="graph-detail-prop"><span>Detected</span><strong>{focusRevision ? relativeTime(focusRevision.created_at) : relativeTime(skill.created_at)}</strong></div>
          </div>
        </div>
        {skill.revisions.length > 0 && (
          <div className="skill-detail-section">
            <h4>Revision history</h4>
            <div className="skill-revision-list">
              {skill.revisions.map(revision => (
                <div key={revision.id} className="skill-revision-row">
                  <span>r{revision.revision_number} · v{revision.version}</span>
                  <span className={`skill-revision-state ${revision.status}`}>{revision.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {renderAgentAssignments(skill)}
        {renderLocalFiles()}
        {skill.permissions.length > 0 && (
          <div className="skill-detail-section">
            <h4>Permissions</h4>
            <div className="review-perms">
              {skill.permissions.map(permission => (
                <span key={permission} className={`perm-badge ${permission.includes('write') || permission.includes('network') || permission.includes('shell') ? 'warn' : ''}`}>{permission}</span>
              ))}
            </div>
          </div>
        )}
        {skillContent && (
          <div className="skill-detail-section skill-content-section">
            <h4>Package content</h4>
            {Object.keys(skillContent.files).length > 1 && (
              <div className="skill-content-file-list">
                {Object.keys(skillContent.files).map(file => <span key={file} className="skill-content-file-chip">{file}</span>)}
              </div>
            )}
            <div className="skill-content-body" dangerouslySetInnerHTML={{ __html: simpleMarkdown(skillContent.content) }} />
          </div>
        )}
        <div className="skill-detail-actions">
          {context === 'inbox' && skill.pending_revision && (
            <>
              <button className="skill-action-btn primary" onClick={() => reviewRevision(skill, 'approve')} disabled={actionLoading === skill.id}>Approve to Library</button>
              <button className="skill-action-btn danger" onClick={() => reviewRevision(skill, 'reject')} disabled={actionLoading === skill.id}>Reject revision</button>
            </>
          )}
          {context === 'library' && skill.status === 'approved' && (
            <button className="skill-action-btn primary" onClick={() => skillAction(skill.id, 'approve')} disabled={actionLoading === skill.id || !hasConnectedAssignment(skill)}>Enable assigned agents</button>
          )}
          {context === 'library' && skill.status === 'installed' && (
            <button className="skill-action-btn" onClick={() => skillAction(skill.id, 'disable')} disabled={actionLoading === skill.id}>Disable access</button>
          )}
          {context === 'library' && skill.status === 'disabled' && (
            <button className="skill-action-btn primary" onClick={() => skillAction(skill.id, 'approve')} disabled={actionLoading === skill.id || !hasConnectedAssignment(skill)}>Re-enable access</button>
          )}
          {context === 'library' && <button className="skill-action-btn danger" onClick={() => skillAction(skill.id, 'delete')} disabled={actionLoading === skill.id}>Remove</button>}
        </div>
        {actionError && <div className="skill-action-error">{actionError}</div>}
      </div>
    );
  }

  function renderPluginDetail(plugin: PodPlugin, context: 'inbox' | 'library') {
    const revision = context === 'inbox' ? plugin.pending_revision : plugin.current_revision;
    const grouped = {
      skills: revision?.components.filter(component => component.component_type === 'skill') ?? [],
      mcp: revision?.components.filter(component => component.component_type === 'mcp_server') ?? [],
      extensions: revision?.components.filter(component => component.component_type === 'extension') ?? [],
    };
    return (
      <div className="skill-detail-panel">
        <div className="skill-detail-top">
          <button className="activity-detail-close" onClick={() => setSelectedPlugin(null)}><X size={16} /></button>
        </div>
        <div className="capability-detail-kind"><Layers size={13} /> Agent Plugin</div>
        <h3 className="skill-detail-name">{plugin.name}</h3>
        <p className="skill-detail-desc">{plugin.description || 'Portable bundle of agent capabilities.'}</p>
        <div className="skill-detail-section">
          <h4>{context === 'inbox' ? 'Incoming revision' : 'Canonical revision'}</h4>
          <div className="skill-detail-meta-grid">
            <div className="graph-detail-prop"><span>Revision</span><strong>{revision ? `r${revision.revision_number}` : 'Unavailable'}</strong></div>
            <div className="graph-detail-prop"><span>Version</span><strong>{revision?.version ?? plugin.version}</strong></div>
            <div className="graph-detail-prop"><span>Package</span><strong className="skill-mono-sm">{revision?.package_hash.slice(0, 12) ?? 'Unavailable'}</strong></div>
            <div className="graph-detail-prop"><span>Format</span><strong>Agent Plugins {plugin.schema_version}</strong></div>
            <div className="graph-detail-prop"><span>Origin</span>{sourceBadge(plugin.source)}</div>
            <div className="graph-detail-prop"><span>Author</span><strong>{plugin.author}</strong></div>
          </div>
        </div>
        {revision && (
          <>
            <div className="skill-detail-section">
              <h4>Capability diff</h4>
              <div className="plugin-capability-summary">
                <div><strong>{grouped.skills.length}</strong><span>Skills</span></div>
                <div><strong>{grouped.mcp.length}</strong><span>MCP servers</span></div>
                <div><strong>{grouped.extensions.length}</strong><span>Extensions</span></div>
              </div>
              <div className="plugin-component-list">
                {revision.components.map(component => (
                  <div key={`${component.component_type}:${component.component_key}`} className="plugin-component-row">
                    <span className="plugin-component-type">{component.component_type === 'mcp_server' ? 'MCP' : component.component_type}</span>
                    <strong>{component.component_key}</strong>
                    <span className={`plugin-component-state ${component.status}`}>{component.status}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="skill-detail-section">
              <h4>Runtime review</h4>
              <div className="plugin-risk-grid">
                <span className={revision.inspection.risk.local_executables > 0 ? 'warn' : ''}><Server size={13} /> {revision.inspection.risk.local_executables} local executables</span>
                <span className={revision.inspection.risk.remote_connections > 0 ? 'warn' : ''}><Globe size={13} /> {revision.inspection.risk.remote_connections} remote connections</span>
                <span><FileText size={13} /> {Object.keys(revision.files).length} package files</span>
                <span><HardDrive size={13} /> {formatBytes(revision.inspection.risk.total_bytes)}</span>
              </div>
              {revision.inspection.issues.length > 0 && (
                <div className="plugin-issue-list">
                  {revision.inspection.issues.map((issue, index) => (
                    <div key={`${issue.code}:${index}`} className={`plugin-issue ${issue.severity}`}>
                      <AlertTriangle size={13} />
                      <span>{issue.message}{issue.path ? <code>{issue.path}</code> : null}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="skill-detail-section">
              <h4>Package files</h4>
              <div className="skill-content-file-list">
                {Object.keys(revision.files).map(file => <span key={file} className="skill-content-file-chip">{file}</span>)}
              </div>
            </div>
          </>
        )}
        {context === 'library' && (
          <div className="plugin-deployment-note">
            <Info size={14} />
            <span>Approval retains the complete Plugin package. Agent compatibility, credentials and aggregate deployment remain separate.</span>
          </div>
        )}
        <div className="skill-detail-actions">
          {context === 'inbox' && plugin.pending_revision && (
            <>
              <button className="skill-action-btn primary" onClick={() => reviewPluginRevision(plugin, 'approve')} disabled={actionLoading === plugin.id}>Approve to Library</button>
              <button className="skill-action-btn danger" onClick={() => reviewPluginRevision(plugin, 'reject')} disabled={actionLoading === plugin.id}>Reject revision</button>
            </>
          )}
          {context === 'library' && <button className="skill-action-btn danger" onClick={() => removePlugin(plugin)} disabled={actionLoading === plugin.id}>Remove</button>}
        </div>
        {actionError && <div className="skill-action-error">{actionError}</div>}
      </div>
    );
  }

  return (
    <div className="skills-view">
      <div className="skills-topbar skill-estate-topbar">
        <div className="skills-mode-toggle">
          <button className={`skills-mode-btn ${section === 'inbox' ? 'active' : ''}`} onClick={() => { setSection('inbox'); setSelectedSkill(null); setSelectedPlugin(null); }}>
            <Inbox size={14} />
            Inbox
            {inboxSkills.length + inboxPlugins.length > 0 && <span className="skills-mode-count">{inboxSkills.length + inboxPlugins.length}</span>}
          </button>
          <button className={`skills-mode-btn ${section === 'library' ? 'active' : ''}`} onClick={() => { setSection('library'); setSelectedSkill(null); setSelectedPlugin(null); }}>
            <LibraryBig size={14} />
            Library
            {librarySkills.length + libraryPlugins.length > 0 && <span className="skills-mode-count">{librarySkills.length + libraryPlugins.length}</span>}
          </button>
          <button className={`skills-mode-btn ${section === 'deployments' ? 'active' : ''}`} onClick={() => { setSection('deployments'); setSelectedSkill(null); setSelectedPlugin(null); }}>
            <Network size={14} />
            Deployments
            {deploymentRows.length > 0 && <span className="skills-mode-count">{deploymentRows.length}</span>}
          </button>
          <button className={`skills-mode-btn ${section === 'discover' ? 'active' : ''}`} onClick={() => { setSection('discover'); setSelectedSkill(null); setSelectedPlugin(null); }}>
            <Compass size={14} />
            Discover
          </button>
        </div>
        <div className="capability-topbar-actions">
          <input
            ref={pluginFolderInputRef}
            type="file"
            className="capability-plugin-input"
            {...{ webkitdirectory: '', directory: '' } as any}
            onChange={event => event.target.files && void importPluginFolder(event.target.files)}
          />
          <button className="skill-scan-btn" onClick={() => pluginFolderInputRef.current?.click()} disabled={importingPlugin}>
            {importingPlugin ? <Loader2 size={13} className="spin-inline" /> : <FolderInput size={13} />}
            {importingPlugin ? 'Importing…' : 'Import Plugin'}
          </button>
          <button className="skill-scan-btn" onClick={scanNativeSkills} disabled={scanning}>
            {scanning ? <Loader2 size={13} className="spin-inline" /> : <Scan size={13} />}
            {scanning ? 'Scanning…' : 'Scan agents'}
          </button>
        </div>
      </div>

      {section !== 'discover' && section !== 'deployments' && (
        <div className="capability-kind-filter" aria-label="Capability type">
          {([['all', 'All'], ['skill', 'Skills'], ['plugin', 'Plugins']] as const).map(([value, label]) => (
            <button key={value} className={capabilityType === value ? 'active' : ''} onClick={() => { setCapabilityType(value); setSelectedSkill(null); setSelectedPlugin(null); }}>
              {label}
              {value === 'skill' && <span>{section === 'inbox' ? inboxSkills.length : librarySkills.length}</span>}
              {value === 'plugin' && <span>{section === 'inbox' ? inboxPlugins.length : libraryPlugins.length}</span>}
            </button>
          ))}
        </div>
      )}
      {actionError && !selectedSkill && !selectedPlugin && section !== 'deployments' && (
        <div className="skill-action-error capability-global-error">{actionError}</div>
      )}

      {section === 'discover' && (
        <SkillsBrowseTab
          registeredSkills={allSkills.map(skill => ({
            slug: skill.source_slug
              ?? (typeof skill.metadata?.source_slug === 'string' ? skill.metadata.source_slug : skill.name.toLowerCase().replace(/\s+/g, '-')),
            status: skill.status,
          }))}
          agents={agents}
          authToken={props.authToken}
          onSkillsChanged={props.onCapabilitiesChanged}
          initialSlug={browseSlug}
        />
      )}

      {section === 'inbox' && (
        <div className={`skills-body ${selectedSkill || selectedPlugin ? 'has-detail' : ''}`}>
          <div className="skills-list-scroll">
            {visibleInboxSkills.length + visibleInboxPlugins.length === 0 ? (
              <div className="activity-empty">
                <Inbox size={28} />
                <strong>Inbox clear</strong>
                <p>Scan connected agents for Skills or import an Agent Plugin package.</p>
                <div className="capability-empty-actions">
                  <button className="skill-action-btn primary" onClick={scanNativeSkills} disabled={scanning}>Scan agents</button>
                  <button className="skill-action-btn" onClick={() => pluginFolderInputRef.current?.click()} disabled={importingPlugin}>Import Plugin</button>
                </div>
              </div>
            ) : (
              <div className="skill-tile-grid">
                {visibleInboxPlugins.map(plugin => {
                  const revision = plugin.pending_revision;
                  return (
                    <button key={plugin.id} className={`skill-tile plugin-tile ${selectedPlugin?.id === plugin.id ? 'selected' : ''}`} onClick={() => { setSelectedPlugin(plugin); setSelectedSkill(null); }}>
                      <div className="skill-tile-header">
                        <div className="skill-tile-icon plugin"><Layers size={18} /></div>
                        <span className="capability-kind-chip">Plugin</span>
                        <span className="skill-revision-number">{revision ? `r${revision.revision_number}` : 'Detected'}</span>
                      </div>
                      <strong className="skill-tile-name">{plugin.name}</strong>
                      <span className="skill-tile-desc">{plugin.description || 'Portable bundle of Skills, MCP servers and client extensions.'}</span>
                      <div className="plugin-tile-components">
                        <span>{revision?.components.filter(component => component.component_type === 'skill').length ?? 0} Skills</span>
                        <span>{revision?.components.filter(component => component.component_type === 'mcp_server').length ?? 0} MCP</span>
                      </div>
                      <div className="skill-tile-footer">
                        {sourceBadge(plugin.source)}
                        {revision && <span className="skill-status-badge skill-draft-badge">Draft v{revision.version}</span>}
                      </div>
                    </button>
                  );
                })}
                {visibleInboxSkills.map(skill => {
                  const revision = skill.pending_revision;
                  return (
                    <button key={skill.id} className={`skill-tile ${selectedSkill?.id === skill.id ? 'selected' : ''}`} onClick={() => { setSelectedSkill(skill); setSelectedPlugin(null); }}>
                      <div className="skill-tile-header">
                        <div className="skill-tile-icon"><GitBranch size={18} /></div>
                        <span className="capability-kind-chip">Skill</span>
                        <span className="skill-revision-number">{revision ? `r${revision.revision_number}` : 'Detected'}</span>
                      </div>
                      <strong className="skill-tile-name">{skill.name}</strong>
                      <span className="skill-tile-desc">{revision?.summary || skill.description || 'Review this Skill package before adding it to your Library.'}</span>
                      <div className="skill-tile-footer">
                        {sourceBadge(revision?.origin ?? skill.source)}
                        {revision && <span className="skill-status-badge skill-draft-badge">Draft v{revision.version}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {selectedSkill && renderSkillDetail(selectedSkill, 'inbox')}
          {selectedPlugin && renderPluginDetail(selectedPlugin, 'inbox')}
        </div>
      )}

      {section === 'library' && (
        <div className={`skills-body ${selectedSkill || selectedPlugin ? 'has-detail' : ''}`}>
          <div className="skills-list-scroll">
            {visibleLibrarySkills.length + visibleLibraryPlugins.length === 0 ? (
              <div className="activity-empty">
                <LibraryBig size={28} />
                <strong>Your Capability Library is empty</strong>
                <p>Approve an Inbox revision, discover a Skill, or import an Agent Plugin.</p>
                <div className="capability-empty-actions">
                  <button className="skill-action-btn primary" onClick={() => setSection('discover')}>Discover Skills</button>
                  <button className="skill-action-btn" onClick={() => pluginFolderInputRef.current?.click()}>Import Plugin</button>
                </div>
              </div>
            ) : (
              <div className="skill-tile-grid">
                {visibleLibraryPlugins.map(plugin => (
                  <button key={plugin.id} className={`skill-tile plugin-tile ${selectedPlugin?.id === plugin.id ? 'selected' : ''}`} onClick={() => { setSelectedPlugin(plugin); setSelectedSkill(null); }}>
                    <div className="skill-tile-header">
                      <div className="skill-tile-icon plugin"><Layers size={18} /></div>
                      <span className="capability-kind-chip">Plugin</span>
                      <span className="skill-revision-number">{plugin.current_revision ? `r${plugin.current_revision.revision_number}` : 'Legacy'}</span>
                    </div>
                    <strong className="skill-tile-name">{plugin.name}</strong>
                    <span className="skill-tile-desc">{plugin.description || 'Portable bundle of agent capabilities.'}</span>
                    <div className="plugin-tile-components">
                      <span>{plugin.current_revision?.components.filter(component => component.component_type === 'skill').length ?? 0} Skills</span>
                      <span>{plugin.current_revision?.components.filter(component => component.component_type === 'mcp_server').length ?? 0} MCP</span>
                    </div>
                    <div className="skill-tile-footer">
                      {sourceBadge(plugin.source)}
                      {statusBadge(plugin.status)}
                      {plugin.pending_revision && <span className="skill-update-chip">Update waiting</span>}
                    </div>
                  </button>
                ))}
                {visibleLibrarySkills.map(skill => (
                  <button key={skill.id} className={`skill-tile ${selectedSkill?.id === skill.id ? 'selected' : ''}`} onClick={() => { setSelectedSkill(skill); setSelectedPlugin(null); }}>
                    <div className="skill-tile-header">
                      <div className="skill-tile-icon"><LibraryBig size={18} /></div>
                      <span className="capability-kind-chip">Skill</span>
                      <span className="skill-revision-number">{skill.current_revision ? `r${skill.current_revision.revision_number}` : 'Legacy'}</span>
                    </div>
                    <strong className="skill-tile-name">{skill.name}</strong>
                    <span className="skill-tile-desc">{skill.current_revision?.summary || skill.description}</span>
                    <div className="skill-tile-footer">
                      {sourceBadge(skill.current_revision?.origin ?? skill.source)}
                      {statusBadge(skill.status)}
                      {skill.pending_revision && <span className="skill-update-chip">Update waiting</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedSkill && renderSkillDetail(selectedSkill, 'library')}
          {selectedPlugin && renderPluginDetail(selectedPlugin, 'library')}
        </div>
      )}

      {section === 'deployments' && (
        <div className="skills-body">
          <div className="skills-list-scroll skill-deployments-wrap">
            <div className="skill-estate-intro">
              <div>
                <strong>Agent deployments</strong>
                <span>Authorization, package compatibility and synchronization are tracked separately.</span>
              </div>
            </div>
            {libraryPlugins.length > 0 && (
              <div className="plugin-deployment-summary">
                <Layers size={17} />
                <div>
                  <strong>{libraryPlugins.length} Agent Plugin{libraryPlugins.length === 1 ? '' : 's'} retained in the Library</strong>
                  <span>Plugin compatibility and credential binding must be resolved before aggregate deployment; nested Skills are not deployed independently.</span>
                </div>
              </div>
            )}
            {deploymentRows.length === 0 ? (
              <div className="activity-empty">
                <Network size={28} />
                <strong>No deployments yet</strong>
                <p>Assign a Library Skill to a connected agent, then deploy its approved package.</p>
              </div>
            ) : (
              <div className="skill-deployment-grid">
                {deploymentRows.map(({ skill, agentId, agent, deployment }) => {
                  const target = deploymentTarget(agent, agentId);
                  const key = `${skill.id}:${agentId}`;
                  const hasPackage = Boolean(skill.current_revision?.files || skill.current_revision?.content);
                  const state = deployment?.status ?? (hasPackage ? 'ready' : 'blocked');
                  return (
                    <div key={key} className="skill-deployment-card">
                      <div className="skill-deployment-main">
                        <div className="skill-deployment-icon">{skillAgentLogo(agent?.id ?? agentId, 20)}</div>
                        <div>
                          <strong>{skill.name}</strong>
                          <span>{agent?.name ?? agentId} · {skill.current_revision ? `r${skill.current_revision.revision_number}` : 'No approved revision'}</span>
                        </div>
                      </div>
                      <div className="skill-deployment-side">
                        <span className={`skill-deployment-state ${state}`}>{state === 'synced' ? 'Synchronized' : state === 'ready' ? 'Ready to deploy' : state === 'drifted' ? 'Drift detected' : state === 'blocked' ? 'Package required' : 'Pending'}</span>
                        {target && hasPackage && state !== 'synced' && (
                          <button className="skill-action-btn primary" onClick={() => deploySkill(skill, agent?.id ?? agentId, target)} disabled={deploying === key}>
                            {deploying === key ? <Loader2 size={12} className="spin-inline" /> : <CloudUpload size={12} />}
                            Deploy
                          </button>
                        )}
                      </div>
                      {deployment?.last_error && <div className="skill-deployment-error">{deployment.last_error}</div>}
                      {deployment?.target_path && <code className="skill-deployment-path">{deployment.target_path}</code>}
                    </div>
                  );
                })}
              </div>
            )}
            {actionError && <div className="skill-action-error skill-estate-error">{actionError}</div>}
          </div>
        </div>
      )}

      {manageSkill && (
        <div className="browse-agent-picker-overlay" onClick={() => setManageSkill(null)}>
          <div className="browse-agent-picker" onClick={event => event.stopPropagation()}>
            <div className="browse-agent-picker-header">
              <h3>Manage agents</h3>
              <button className="browse-agent-picker-close" onClick={() => setManageSkill(null)}><X size={14} /></button>
            </div>
            <p className="browse-agent-picker-sub">
              Choose which connected agents can use <strong>{manageSkill.name}</strong>.
              {manageSkill.status === 'installed' ? ' Changes take effect immediately.' : manageSkill.status === 'approved' ? ' Assignments can be enabled or deployed independently.' : ' Access begins after approval.'}
            </p>
            <div className="browse-agent-picker-list">
              {agents.length === 0 && (
                <div className="browse-agent-picker-empty">No connected agents. Add one from Connections first.</div>
              )}
              {agents.map(agent => {
                const selected = manageAgentIds.has(agent.id);
                return (
                  <button
                    key={agent.id}
                    className={`browse-agent-chip-btn ${selected ? 'selected' : ''}`}
                    onClick={() => setManageAgentIds(current => {
                      const next = new Set(current);
                      if (next.has(agent.id)) next.delete(agent.id); else next.add(agent.id);
                      return next;
                    })}
                  >
                    <span className="browse-agent-chip-icon">{skillAgentLogo(agent.id, 22)}</span>
                    <span>{agent.name}</span>
                    {selected && <CheckCircle2 size={13} className="browse-agent-chip-check" />}
                  </button>
                );
              })}
            </div>
            {actionError && <div className="skill-action-error modal">{actionError}</div>}
            <div className="browse-agent-picker-footer">
              <span className="browse-agent-picker-hint">
                {manageAgentIds.size === 0 ? 'No agents selected' : `${manageAgentIds.size} agent${manageAgentIds.size === 1 ? '' : 's'} selected`}
              </span>
              <div className="browse-agent-picker-actions">
                <button className="browse-agent-picker-cancel" onClick={() => setManageSkill(null)}>Cancel</button>
                <button
                  className="browse-install-btn primary"
                  onClick={saveAgentAssignments}
                  disabled={manageSaving || (manageSkill.status === 'installed' && manageAgentIds.size === 0)}
                >
                  {manageSaving ? <Loader2 size={13} className="spin-inline" /> : <Check size={13} />} Save changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   Connections View — Integration hub
   ═══════════════════════════════════════ */

interface IntegrationStatus {
  id: string; name: string; auth_type: string; status: string;
  availability?: 'ready' | 'config_only' | 'coming_soon';
  testing_note?: string;
  test_available?: boolean;
  products?: string[];
  is_ai_provider?: boolean;
  ai_default?: boolean;
  fields?: Array<{ key: string; label: string; placeholder?: string; secret?: boolean }>;
  connected_at?: string;
  email_providers?: {
    google?: { status: string; connected_at?: string };
    icloud?: { status: string; connected_at?: string; account_email?: string };
  };
}

/** Map integration IDs to the static display info */
const APP_DISPLAY: Record<string, { detail: string; icon: string }> = {
  'coffee':          { detail: 'First-party workspace sync', icon: 'coffee' },
  'local-folders':   { detail: 'Obsidian, Notion exports, files, and archive imports', icon: 'folder' },
  'google-drive':    { detail: 'Documents and source files', icon: 'drive' },
  'google-calendar': { detail: 'Meeting context, events and scheduling', icon: 'GCAL' },
  'github':          { detail: 'Repos, issues, pull requests, and release notes', icon: 'GH' },
  'gitlab':          { detail: 'Projects, merge requests, issues, and pipelines', icon: 'GL' },
  'gmail':           { detail: 'Conversations from your email accounts', icon: 'email' },
  'slack':           { detail: 'Team channels and message context', icon: 'SL' },
  'notion':          { detail: 'Pages, databases, and workspace notes', icon: 'NO' },
  'openai':          { detail: 'Model provider for Pod workflows', icon: 'AI' },
  'anthropic':       { detail: 'Claude models for bounded agents', icon: 'AN' },
  'openrouter':      { detail: 'Unified API for 200+ models', icon: 'OR' },
  'ollama':          { detail: 'Local model endpoint', icon: 'OL' },
  'linear':          { detail: 'Issues, roadmaps, and engineering status', icon: 'LN' },
  'microsoft-365':   { detail: 'Outlook, OneDrive, SharePoint, and Teams', icon: 'MS' },
  'dropbox':         { detail: 'Documents and folders', icon: 'DB' },
  'box':             { detail: 'Enterprise files and content', icon: 'BX' },
  'asana':           { detail: 'Projects, tasks, comments, and status', icon: 'AS' },
  'clickup':         { detail: 'Tasks, docs, projects, and comments', icon: 'CU' },
  'monday':          { detail: 'Boards, items, updates, and workdocs', icon: 'MO' },
  'perplexity':      { detail: 'Conversations and research', icon: 'PX' },
  'canva':           { detail: 'Designs, documents, and presentations', icon: 'CA' },
  'airtable':        { detail: 'Bases, tables, records, and comments', icon: 'AT' },
  'miro':            { detail: 'Boards, cards, notes, and diagrams', icon: 'MI' },
  'atlassian':       { detail: 'Jira, Confluence, and Trello', icon: 'AJ' },
  'hubspot':         { detail: 'Contacts, companies, deals, and activity', icon: 'HS' },
  'salesforce':      { detail: 'Accounts, contacts, opportunities, and activity', icon: 'SF' },
  'attio':           { detail: 'People, companies, lists, and notes', icon: 'AO' },
  'clay':            { detail: 'Enrichment and prospecting workflows', icon: 'CL' },
};

/* ── OpenRouter model picker with grouped, labelled options ── */
const OPENROUTER_MODELS: { value: string; label: string; provider: string; free?: boolean }[] = [
  // Free models first
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'Google', free: true },
  { value: 'deepseek/deepseek-chat-v3-0324:free', label: 'DeepSeek V3', provider: 'DeepSeek', free: true },
  { value: 'deepseek/deepseek-r1:free', label: 'DeepSeek R1', provider: 'DeepSeek', free: true },
  { value: 'meta-llama/llama-4-maverick:free', label: 'Llama 4 Maverick', provider: 'Meta', free: true },
  { value: 'meta-llama/llama-4-scout:free', label: 'Llama 4 Scout', provider: 'Meta', free: true },
  { value: 'qwen/qwen3-235b-a22b:free', label: 'Qwen3 235B', provider: 'Qwen', free: true },
  { value: 'mistralai/devstral-small:free', label: 'Devstral Small', provider: 'Mistral', free: true },
  // Paid models
  { value: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4', provider: 'Anthropic' },
  { value: 'anthropic/claude-haiku-4', label: 'Claude Haiku 4', provider: 'Anthropic' },
  { value: 'openai/gpt-4.1', label: 'GPT-4.1', provider: 'OpenAI' },
  { value: 'openai/gpt-4.1-mini', label: 'GPT-4.1 Mini', provider: 'OpenAI' },
  { value: 'openai/gpt-4.1-nano', label: 'GPT-4.1 Nano', provider: 'OpenAI' },
  { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'Google' },
  { value: 'deepseek/deepseek-r1', label: 'DeepSeek R1', provider: 'DeepSeek' },
  { value: 'mistralai/mistral-medium', label: 'Mistral Medium', provider: 'Mistral' },
];

function OpenRouterModelPicker({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = search.trim()
    ? OPENROUTER_MODELS.filter(m => `${m.value} ${m.label} ${m.provider}`.toLowerCase().includes(search.toLowerCase()))
    : OPENROUTER_MODELS;

  const freeModels = filtered.filter(m => m.free);
  const paidModels = filtered.filter(m => !m.free);
  const selectedModel = OPENROUTER_MODELS.find(m => m.value === value);

  return (
    <div className="or-model-picker" ref={ref}>
      <button
        type="button"
        className={`or-model-trigger${open ? ' open' : ''}${value ? ' has-value' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className="or-model-trigger-text">
          {selectedModel ? (
            <>{selectedModel.label}<span className="or-model-trigger-provider">{selectedModel.provider}</span>{selectedModel.free && <span className="or-model-free-tag">Free</span>}</>
          ) : value ? (
            value
          ) : (
            <span className="or-model-placeholder">{placeholder || 'Select a model'}</span>
          )}
        </span>
        <ChevronDown size={14} className={`or-model-chevron${open ? ' rotated' : ''}`} />
      </button>
      {open && (
        <div className="or-model-menu">
          <div className="or-model-search-wrap">
            <Search size={13} />
            <input
              type="text"
              className="or-model-search"
              placeholder="Search models..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="or-model-list">
            {freeModels.length > 0 && (
              <>
                <div className="or-model-group-label">Free</div>
                {freeModels.map(m => (
                  <button
                    key={m.value}
                    type="button"
                    className={`or-model-option${value === m.value ? ' selected' : ''}`}
                    onClick={() => { onChange(m.value); setOpen(false); setSearch(''); }}
                  >
                    <span className="or-model-option-name">{m.label}</span>
                    <span className="or-model-option-meta">
                      <span className="or-model-option-provider">{m.provider}</span>
                      <span className="or-model-free-tag">Free</span>
                    </span>
                  </button>
                ))}
              </>
            )}
            {paidModels.length > 0 && (
              <>
                <div className="or-model-group-label">Paid</div>
                {paidModels.map(m => (
                  <button
                    key={m.value}
                    type="button"
                    className={`or-model-option${value === m.value ? ' selected' : ''}`}
                    onClick={() => { onChange(m.value); setOpen(false); setSearch(''); }}
                  >
                    <span className="or-model-option-name">{m.label}</span>
                    <span className="or-model-option-meta">
                      <span className="or-model-option-provider">{m.provider}</span>
                    </span>
                  </button>
                ))}
              </>
            )}
            {filtered.length === 0 && (
              <div className="or-model-empty">No models match "{search}"</div>
            )}
          </div>
          <div className="or-model-custom">
            <input
              type="text"
              placeholder="Or type a custom model ID..."
              value={value}
              onChange={e => onChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { setOpen(false); setSearch(''); } }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ConnectionTile({ integration, token, onRefresh, onOpenWizard, onOpenImport }: {
  integration: IntegrationStatus; token: string; onRefresh: () => void; onOpenWizard?: (id: string) => void; onOpenImport?: () => void;
}) {
  const uploadHeaders = (): HeadersInit => (token ? { authorization: `Bearer ${token}` } : {});
  const [expanded, setExpanded] = React.useState(false);
  const [fields, setFields] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [testResult, setTestResult] = React.useState<{ ok: boolean; message?: string } | null>(null);
  const [savedOnce, setSavedOnce] = React.useState(integration.status === 'active');
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const display = APP_DISPLAY[integration.id] ?? {
    detail: integration.products?.join(', ') ?? '',
    icon: integration.id.substring(0, 2).toUpperCase(),
  };
  const isActive = integration.status === 'active' || (integration.auth_type === 'api_key' && savedOnce);
  const isBuiltin = integration.auth_type === 'builtin' || integration.auth_type === 'local';
  const availability = integration.availability ?? 'coming_soon';
  const isReady = availability === 'ready';
  const isConfigOnly = availability === 'config_only';
  const isUnavailable = !isReady;
  const isAIProvider = integration.is_ai_provider === true;
  const isAIDefault = integration.ai_default === true;
  const isAIFallback = isAIProvider && isActive && !isAIDefault;
  const isImportHub = integration.id === 'local-folders';
  const isEmail = integration.id === 'gmail';
  const isGoogleOAuth = integration.auth_type === 'oauth' && ['google-drive', 'google-calendar'].includes(integration.id);
  const [watchedFolders, setWatchedFolders] = React.useState<string[]>(() => {
    if (!isImportHub) return [];
    try { return JSON.parse(localStorage.getItem('pod:local-folders') ?? '[]'); } catch { return []; }
  });
  const localFolderInputRef = React.useRef<HTMLInputElement>(null);
  const tileRef = React.useRef<HTMLDivElement>(null);
  const wizardIds = new Set(['google-drive', 'google-calendar', 'github', 'gitlab', 'slack', 'gmail', 'notion', 'linear']);
  const opensWizard = wizardIds.has(integration.id) && (isActive || isEmail) && typeof onOpenWizard === 'function';
  const isActionable = !isUnavailable && (isImportHub || opensWizard || !isBuiltin);

  React.useEffect(() => {
    if (!expanded) return;
    function handleClickOutside(e: MouseEvent) {
      if (tileRef.current && !tileRef.current.contains(e.target as Node)) {
        setExpanded(false);
        setMessage('');
        setTestResult(null);
      }
    }
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [expanded]);

  function handleTileClick() {
    if (isUnavailable) return;
    if (opensWizard && onOpenWizard) {
      onOpenWizard(integration.id);
      return;
    }
    if (isImportHub && onOpenImport) { onOpenImport(); return; }
    if (isImportHub) { setExpanded(prev => !prev); return; }
    if (isBuiltin) return;
    setExpanded(prev => !prev);
    setMessage('');
    setTestResult(null);
  }

  /** Handle folder selection from native picker — import files and record the folder */
  async function handleLocalFolderSelect(files: FileList) {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;
    const firstPath = (fileArray[0] as any).webkitRelativePath ?? fileArray[0].name;
    const folderName = firstPath.split('/')[0] || 'Folder';
    setWatchedFolders(prev => {
      const next = prev.includes(folderName) ? prev : [...prev, folderName];
      localStorage.setItem('pod:local-folders', JSON.stringify(next));
      return next;
    });
    const supported = fileArray.filter(f => {
      const ext = '.' + (f.name.split('.').pop()?.toLowerCase() ?? '');
      return SUPPORTED_EXTENSIONS.includes(ext);
    });
    if (supported.length === 0) { setMessage(`No supported files in "${folderName}".`); return; }
    setBusy(true); setMessage(`Importing ${supported.length} file${supported.length !== 1 ? 's' : ''} from ${folderName}...`);
    const formData = new FormData();
    formData.append('actor_id', localStorage.getItem('coffee-pod-owner-id') ?? 'person-local');
    formData.append('collection_id', 'inbox');
    formData.append('processing_mode', 'extract');
    for (const f of supported) formData.append('files', f);
    try {
      const res = await fetch('/pod/upload', { method: 'POST', headers: uploadHeaders(), body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? `Import failed (HTTP ${res.status})`);
      setMessage(`Imported ${data.imported?.length ?? 0} files from ${folderName}.`);
      onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Could not import files from ${folderName}.`);
    }
    setBusy(false);
  }

  function removeWatchedFolder(name: string) {
    setWatchedFolders(prev => {
      const next = prev.filter(f => f !== name);
      localStorage.setItem('pod:local-folders', JSON.stringify(next));
      return next;
    });
  }

  async function responseError(res: Response, fallback: string): Promise<string> {
    const payload = await res.json().catch(() => null) as { message?: unknown; error?: unknown } | null;
    if (typeof payload?.message === 'string' && payload.message) return payload.message;
    if (typeof payload?.error === 'string' && payload.error) return payload.error.replace(/_/g, ' ');
    return `${fallback} (HTTP ${res.status})`;
  }

  async function handleSave() {
    setBusy(true); setMessage('');
    try {
      const res = await fetch(`/integrations/${integration.id}/configure`, {
        method: 'POST',
        headers: { ...authHeaders(token), 'content-type': 'application/json' },
        body: JSON.stringify(fields),
      });
      if (!res.ok) throw new Error(await responseError(res, 'Could not save this connection'));
      setMessage('Connected');
      setSavedOnce(true);
      onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save this connection');
    } finally {
      setBusy(false);
    }
  }

  async function handleOAuth() {
    setBusy(true); setMessage('');
    try {
      // Save credentials first if any fields filled
      const hasFields = Object.values(fields).some(v => v);
      if (hasFields) {
        const configured = await fetch(`/integrations/${integration.id}/configure`, {
          method: 'POST',
          headers: { ...authHeaders(token), 'content-type': 'application/json' },
          body: JSON.stringify(fields),
        });
        if (!configured.ok) throw new Error(await responseError(configured, 'Could not save OAuth credentials'));
      }
      const data = await getJson<{ url: string }>(`/integrations/${integration.id}/auth-url?actor_id=person-local`, token);
      window.open(data.url, '_blank', 'noopener,noreferrer');
      setMessage('Complete sign-in in the popup, then return here.');
      // Poll for connection
      const poll = setInterval(async () => {
        try {
          const status = await getJson<IntegrationStatus>(`/integrations/${integration.id}/status`, token);
          if (status.status === 'active') {
            clearInterval(poll);
            setMessage('Connected!');
            setExpanded(false);
            onRefresh();
            // Auto-open the configuration wizard after successful OAuth
            if (onOpenWizard && wizardIds.has(integration.id)) {
              setTimeout(() => onOpenWizard(integration.id), 400);
            }
          }
        } catch { /* ignore */ }
      }, 3000);
      setTimeout(() => clearInterval(poll), 120_000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Configure credentials first, then authorize.');
    } finally {
      setBusy(false);
    }
  }

  async function handleTest() {
    setTestResult(null); setBusy(true);
    try {
      const res = await fetch(`/integrations/${integration.id}/test`, {
        method: 'POST',
        headers: { ...authHeaders(token), 'content-type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) throw new Error(await responseError(res, 'Connection test failed'));
      const data = await res.json() as { ok: boolean; message?: string };
      setTestResult(data);
    } catch (error) {
      setTestResult({ ok: false, message: error instanceof Error ? error.message : 'Connection test failed' });
    } finally {
      setBusy(false);
    }
  }

  async function handleMakePrimary() {
    setBusy(true);
    try {
      await fetch(`/integrations/${integration.id}/make-primary`, {
        method: 'POST',
        headers: { ...authHeaders(token), 'content-type': 'application/json' },
        body: '{}',
      });
      onRefresh();
    } catch { setMessage('Failed to switch'); }
    setBusy(false);
  }

  function friendlyTestError(msg: string): string {
    if (msg.includes('429')) return 'Rate limited — check your billing/credits';
    if (msg.includes('401')) return 'Invalid API key';
    if (msg.includes('403')) return 'Key lacks permission — check API access';
    if (msg.includes('404')) return 'Model not found — check your plan access';
    if (msg.includes('500')) return 'Provider server error — try again later';
    return msg;
  }

  async function handleDisconnect() {
    setBusy(true);
    try {
      await fetch(`/integrations/${integration.id}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      });
      setMessage('Disconnected');
      setExpanded(false);
      onRefresh();
    } catch { setMessage('Failed'); }
    setBusy(false);
  }

  return (
    <div ref={tileRef} className={`connection-tile ${expanded ? 'expanded' : ''}`}>
      <button className="connection-tile-top" onClick={handleTileClick}>
        <ConnectionLogo value={display.icon} />
        {isUnavailable ? (
          <span className="connection-action">{isConfigOnly ? 'Setup only' : 'Soon'}</span>
        ) : isImportHub ? (
          <span className="connection-action">Import</span>
        ) : isAIDefault ? (
          <span className="connection-status-primary">Primary</span>
        ) : isAIFallback ? (
          <span className="connection-status-fallback">Fallback</span>
        ) : isActive ? (
          <span className="connection-status-active">Active</span>
        ) : isBuiltin ? (
          <span className="connection-status-active">Active</span>
        ) : (
          <span className="connection-action">{integration.status === 'configured' ? 'Authorize' : integration.auth_type === 'api_key' ? 'Setup' : 'Connect'}</span>
        )}
      </button>
      <div className="connection-tile-body" onClick={handleTileClick} style={{ cursor: isActionable ? 'pointer' : 'default' }}>
        <strong>{integration.name}</strong>
        <span className="connection-detail">{display.detail}</span>
        {isAIDefault && (
          <span className="connection-detail">Powers Ask Pod and reflection.</span>
        )}
        {isAIFallback && (
          <span className="connection-detail">Available as fallback provider.</span>
        )}
        {integration.testing_note && !isImportHub && (
          <span className="connection-detail">{integration.testing_note}</span>
        )}
      </div>
      {/* Local folders expanded panel */}
      {expanded && isImportHub && (
        <div className="connection-expand">
          <input
            ref={localFolderInputRef}
            type="file"
            {...{ webkitdirectory: '', directory: '' } as any}
            multiple
            style={{ display: 'none' }}
            onChange={(e) => { if (e.target.files?.length) handleLocalFolderSelect(e.target.files); e.target.value = ''; }}
          />
          {watchedFolders.length > 0 && (
            <div className="local-folders-list">
              {watchedFolders.map(name => (
                <div key={name} className="local-folder-row">
                  <FolderInput size={14} />
                  <span className="local-folder-name">{name}</span>
                  <button className="local-folder-remove" onClick={() => removeWatchedFolder(name)} title="Remove"><X size={12} /></button>
                </div>
              ))}
            </div>
          )}
          <div className="connection-expand-actions">
            <button className="connection-btn primary" onClick={() => localFolderInputRef.current?.click()} disabled={busy}>
              {busy ? 'Importing...' : 'Choose folder'}
            </button>
            {typeof onOpenImport === 'function' && (
              <button className="connection-btn" onClick={() => onOpenImport()}>
                Import files
              </button>
            )}
          </div>
          {message && <p className="connection-message">{message}</p>}
        </div>
      )}
      {/* Google OAuth expand panel — prominent sign-in button */}
      {expanded && isGoogleOAuth && !isBuiltin && !isUnavailable && (
        <div className="connection-expand">
          {isActive ? (
            <div className="connection-expand-actions">
              <span className="connection-status-active-label">Connected</span>
              <button className="connection-btn" onClick={handleTest} disabled={busy}>Test</button>
              <button className="connection-btn danger" onClick={handleDisconnect} disabled={busy}>Disconnect</button>
            </div>
          ) : (
            <>
              <button className="google-sign-in-btn" onClick={handleOAuth} disabled={busy}>
                <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/><path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 2.58 9 2.58Z" fill="#EA4335"/></svg>
                <span>{busy ? 'Connecting...' : `Sign in with Google`}</span>
              </button>
              <button className="connection-advanced-toggle" onClick={() => setShowAdvanced(p => !p)}>
                <ChevronRight size={12} style={{ transform: showAdvanced ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
                Own OAuth credentials
              </button>
              {showAdvanced && (
                <>
                  {(integration.fields ?? []).map(f => (
                    <div key={f.key} className="connection-field">
                      <label>{f.label}</label>
                      <input
                        type={f.secret ? 'password' : 'text'}
                        placeholder={f.placeholder}
                        value={fields[f.key] ?? ''}
                        onChange={(e) => setFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                      />
                    </div>
                  ))}
                  <div className="connection-expand-actions">
                    <button className="connection-btn primary" onClick={handleOAuth} disabled={busy}>
                      {busy ? 'Connecting...' : 'Save & Authorize'}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
          {message && <p className="connection-message">{message}</p>}
          {testResult && (
            <p className={`connection-message ${testResult.ok ? 'success' : 'error'}`}>
              {testResult.ok ? '✓ Connection successful' : `✗ ${testResult.message ?? 'Failed'}`}
            </p>
          )}
        </div>
      )}
      {/* Standard expand panel for non-Google, non-local integrations */}
      {expanded && !isGoogleOAuth && !isEmail && !isImportHub && !isBuiltin && !isUnavailable && (
        <div className="connection-expand">
          {/* OAuth integrations: show client_id + client_secret upfront */}
          {integration.auth_type === 'oauth' ? (
            <>
              {(integration.fields ?? []).filter(f => f.key === 'client_id' || f.secret).map(f => (
                <div key={f.key} className="connection-field">
                  <label>{f.label}</label>
                  <div className="connection-field-row">
                    <input
                      type={f.secret ? 'password' : 'text'}
                      placeholder={f.placeholder}
                      value={fields[f.key] ?? ''}
                      onChange={(e) => setFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                    />
                  </div>
                </div>
              ))}
              {(integration.fields ?? []).some(f => f.key !== 'client_id' && !f.secret) && (
                <>
                  <button className="connection-advanced-toggle" onClick={() => setShowAdvanced(v => !v)}>
                    <ChevronDown size={12} style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                    Advanced
                  </button>
                  {showAdvanced && (integration.fields ?? []).filter(f => f.key !== 'client_id' && !f.secret).map(f => (
                    <div key={f.key} className="connection-field">
                      <label>{f.label}</label>
                      <input
                        type="text"
                        placeholder={f.placeholder}
                        value={fields[f.key] ?? ''}
                        onChange={(e) => setFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                      />
                    </div>
                  ))}
                </>
              )}
            </>
          ) : (
            <>
              {(integration.fields ?? []).map(f => (
                <div key={f.key} className="connection-field">
                  <label>{f.label}</label>
                  <div className="connection-field-row">
                    {f.key === 'model' && integration.id === 'openrouter' ? (
                      <OpenRouterModelPicker
                        value={fields[f.key] ?? ''}
                        onChange={(v) => setFields(prev => ({ ...prev, [f.key]: v }))}
                        placeholder={f.placeholder}
                      />
                    ) : (
                      <input
                        type={f.secret ? 'password' : 'text'}
                        placeholder={f.placeholder}
                        value={fields[f.key] ?? ''}
                        onChange={(e) => setFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                      />
                    )}
                    {f.key === 'api_key' && isActive && integration.test_available && <button className="connection-btn" onClick={handleTest} disabled={busy}>Test</button>}
                  </div>
                </div>
              ))}
            </>
          )}
          <div className="connection-expand-actions">
            {integration.auth_type === 'oauth' ? (
              <>
                <button className="connection-btn primary" onClick={handleOAuth} disabled={busy}>
                  {busy ? 'Connecting...' : integration.status === 'configured' ? 'Authorize' : 'Save & Authorize'}
                </button>
                {isActive && integration.test_available && <button className="connection-btn" onClick={handleTest} disabled={busy}>Test</button>}
              </>
            ) : (
              <>
                <button className="connection-btn primary" onClick={handleSave} disabled={busy}>
                  {busy ? 'Saving...' : 'Save'}
                </button>
                {isAIFallback && <button className="connection-btn" onClick={handleMakePrimary} disabled={busy}>Make primary</button>}
              </>
            )}
          </div>
          {message && <p className="connection-message">{message}</p>}
          {testResult && (
            <p className={`connection-message ${testResult.ok ? 'success' : 'error'}`}>
              {testResult.ok ? '✓ Connection successful' : `✗ ${friendlyTestError(testResult.message ?? 'Failed')}`}
            </p>
          )}
          {isActive && (
            <button className="connection-link-danger" onClick={handleDisconnect} disabled={busy}>Disconnect</button>
          )}
        </div>
      )}
    </div>
  );
}

/** Fallback integrations shown when the backend isn't reachable */
const FALLBACK_INTEGRATIONS: IntegrationStatus[] = [
  { id: 'local-folders', name: 'Import documents', auth_type: 'local', status: 'active', availability: 'ready', testing_note: 'Ready for files, local folders, Obsidian vaults, and extracted Notion exports.', products: ['Files', 'Obsidian', 'Notion', 'Evernote', 'Apple Notes', 'ChatGPT', 'Claude'] },
  { id: 'google-drive', name: 'Google Drive', auth_type: 'oauth', status: 'disconnected', availability: 'ready', testing_note: 'Ready for OAuth, file listing, and Drive import.', fields: [{ key: 'client_id', label: 'Client ID' }, { key: 'client_secret', label: 'Client Secret', secret: true }] },
  { id: 'openai', name: 'OpenAI', auth_type: 'api_key', status: 'disconnected', availability: 'ready', testing_note: 'Ready for Ask Pod and reflection after you save an API key.', fields: [{ key: 'api_key', label: 'API Key', placeholder: 'sk-...', secret: true }] },
  { id: 'anthropic', name: 'Anthropic', auth_type: 'api_key', status: 'disconnected', availability: 'ready', testing_note: 'Ready for Ask Pod and reflection after you save an API key.', fields: [{ key: 'api_key', label: 'API Key', placeholder: 'sk-ant-...', secret: true }] },
  { id: 'github', name: 'GitHub', auth_type: 'oauth', status: 'disconnected', availability: 'ready', testing_note: 'Connect to observe repos, issues, PRs, and release notes. Webhook ingestion via /webhooks/github.', fields: [{ key: 'client_id', label: 'Client ID' }, { key: 'client_secret', label: 'Client Secret', secret: true }, { key: 'webhook_secret', label: 'Webhook Secret', secret: true }] },
  { id: 'gitlab', name: 'GitLab', auth_type: 'oauth', status: 'disconnected', availability: 'ready', testing_note: 'Connect to observe projects, merge requests, issues, and CI/CD pipelines from GitLab.', fields: [{ key: 'client_id', label: 'Application ID' }, { key: 'client_secret', label: 'Secret', secret: true }, { key: 'gitlab_url', label: 'GitLab URL (self-hosted)', placeholder: 'https://gitlab.com' }] },
  { id: 'google-calendar', name: 'Google Calendar', auth_type: 'oauth', status: 'disconnected', availability: 'ready', testing_note: 'Connect to import events, meeting context, and scheduling data.', fields: [{ key: 'client_id', label: 'Client ID' }, { key: 'client_secret', label: 'Client Secret', secret: true }] },
  { id: 'gmail', name: 'Email', auth_type: 'oauth', status: 'disconnected', availability: 'ready', testing_note: 'Google and iCloud accounts with thread-aware, signal-based memory.', fields: [{ key: 'client_id', label: 'Client ID' }, { key: 'client_secret', label: 'Client Secret', secret: true }] },
  { id: 'slack', name: 'Slack', auth_type: 'oauth', status: 'disconnected', availability: 'ready', testing_note: 'Connect to observe team channels and message context. Webhook ingestion via /webhooks/slack.', fields: [{ key: 'client_id', label: 'Client ID' }, { key: 'client_secret', label: 'Client Secret', secret: true }, { key: 'signing_secret', label: 'Signing Secret', secret: true }] },
  { id: 'notion', name: 'Notion', auth_type: 'oauth', status: 'disconnected', availability: 'ready', testing_note: 'Connect to observe pages, databases, and workspace notes.', fields: [{ key: 'client_id', label: 'Client ID' }, { key: 'client_secret', label: 'Client Secret', secret: true }] },
  { id: 'linear', name: 'Linear', auth_type: 'oauth', status: 'disconnected', availability: 'ready', testing_note: 'Connect to observe issues, roadmaps, and engineering status.', fields: [{ key: 'api_key', label: 'API Key', secret: true }] },
  { id: 'openrouter', name: 'OpenRouter', auth_type: 'api_key', status: 'disconnected', availability: 'ready', testing_note: 'Unified API for 200+ models. Connect to use as an LLM provider for reflection and Ask Pod.', fields: [{ key: 'api_key', label: 'API Key', placeholder: 'sk-or-...', secret: true }, { key: 'model', label: 'Model', placeholder: 'anthropic/claude-sonnet-4' }] },
  { id: 'ollama', name: 'Ollama', auth_type: 'api_key', status: 'disconnected', availability: 'ready', testing_note: 'Local model endpoint. Connect to use local models for reflection and extraction.', fields: [{ key: 'endpoint', label: 'Endpoint URL', placeholder: 'http://localhost:11434' }] },
  { id: 'microsoft-365', name: 'Microsoft 365', auth_type: 'oauth', status: 'disconnected', availability: 'ready', test_available: true, products: ['Outlook', 'OneDrive', 'SharePoint', 'Teams'], fields: [{ key: 'client_id', label: 'Application (client) ID' }, { key: 'client_secret', label: 'Client secret', secret: true }] },
  { id: 'dropbox', name: 'Dropbox', auth_type: 'oauth', status: 'disconnected', availability: 'ready', test_available: true, fields: [{ key: 'client_id', label: 'App key' }, { key: 'client_secret', label: 'App secret', secret: true }] },
  { id: 'box', name: 'Box', auth_type: 'oauth', status: 'disconnected', availability: 'ready', test_available: true, fields: [{ key: 'client_id', label: 'Client ID' }, { key: 'client_secret', label: 'Client secret', secret: true }] },
  { id: 'asana', name: 'Asana', auth_type: 'api_key', status: 'disconnected', availability: 'ready', test_available: true, fields: [{ key: 'api_key', label: 'Personal access token', secret: true }] },
  { id: 'clickup', name: 'ClickUp', auth_type: 'api_key', status: 'disconnected', availability: 'ready', test_available: true, fields: [{ key: 'api_key', label: 'Personal API token', secret: true }] },
  { id: 'monday', name: 'monday.com', auth_type: 'api_key', status: 'disconnected', availability: 'ready', test_available: true, fields: [{ key: 'api_key', label: 'API token', secret: true }] },
  { id: 'perplexity', name: 'Perplexity', auth_type: 'api_key', status: 'disconnected', availability: 'ready', test_available: true, fields: [{ key: 'api_key', label: 'API key', placeholder: 'pplx-...', secret: true }] },
  { id: 'canva', name: 'Canva', auth_type: 'oauth', status: 'disconnected', availability: 'ready', test_available: true, fields: [{ key: 'client_id', label: 'Client ID' }, { key: 'client_secret', label: 'Client secret', secret: true }] },
  { id: 'airtable', name: 'Airtable', auth_type: 'api_key', status: 'disconnected', availability: 'ready', test_available: true, fields: [{ key: 'api_key', label: 'Personal access token', placeholder: 'pat...', secret: true }] },
  { id: 'miro', name: 'Miro', auth_type: 'oauth', status: 'disconnected', availability: 'ready', test_available: true, fields: [{ key: 'client_id', label: 'Client ID' }, { key: 'client_secret', label: 'Client secret', secret: true }] },
  { id: 'atlassian', name: 'Atlassian', auth_type: 'oauth', status: 'disconnected', availability: 'ready', test_available: true, products: ['Jira', 'Confluence', 'Trello'], fields: [{ key: 'client_id', label: 'Client ID' }, { key: 'client_secret', label: 'Client secret', secret: true }] },
  { id: 'hubspot', name: 'HubSpot', auth_type: 'api_key', status: 'disconnected', availability: 'ready', test_available: true, fields: [{ key: 'api_key', label: 'Private app access token', placeholder: 'pat-...', secret: true }] },
  { id: 'salesforce', name: 'Salesforce', auth_type: 'oauth', status: 'disconnected', availability: 'ready', test_available: true, fields: [{ key: 'client_id', label: 'Consumer key' }, { key: 'client_secret', label: 'Consumer secret', secret: true }] },
  { id: 'attio', name: 'Attio', auth_type: 'api_key', status: 'disconnected', availability: 'ready', test_available: true, fields: [{ key: 'api_key', label: 'Access token', secret: true }] },
  { id: 'clay', name: 'Clay', auth_type: 'api_key', status: 'disconnected', availability: 'ready', test_available: false, fields: [{ key: 'api_key', label: 'API key', secret: true }] },
];

const MODEL_INTEGRATION_IDS = new Set(['openai', 'anthropic', 'openrouter', 'ollama']);

function ConnectionsView(props: { token: string; theme: 'dark' | 'light'; onToggleTheme: () => void; onOpenImport: () => void; collections: PodCollection[]; skills: PodSkill[]; onSkillsChanged?: () => void; initialTab?: ConnectionManagementTab; tabRequestId?: number }) {
  const [conTab, setConTab] = React.useState<ConnectionManagementTab>(props.initialTab ?? 'sources');
  const [integrations, setIntegrations] = React.useState<IntegrationStatus[]>(FALLBACK_INTEGRATIONS);
  const [showWizard, setShowWizard] = React.useState<'google-drive' | 'google-calendar' | 'github' | 'gitlab' | 'slack' | 'gmail' | 'notion' | 'linear' | null>(null);
  const [grants, setGrants] = React.useState<any[]>([]);
  const [selectedGrant, setSelectedGrant] = React.useState<any | null>(null);
  const [agentSearch, setAgentSearch] = React.useState('');
  const [appSearch, setAppSearch] = React.useState('');

  async function loadIntegrations() {
    try {
      const data = await getJson<{ integrations: IntegrationStatus[] }>('/integrations', props.token);
      if (data.integrations.length > 0) setIntegrations(data.integrations);
    } catch { /* keep fallback */ }
  }

  async function loadGrants() {
    try {
      const data = await getJson<{ grants: any[] }>('/pod/grants', props.token);
      setGrants(data.grants);
    } catch { setGrants([]); }
  }

  React.useEffect(() => {
    void loadIntegrations();
    void loadGrants();
    const onFocus = () => { void loadIntegrations(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [props.token]);

  React.useEffect(() => {
    if (props.initialTab) setConTab(props.initialTab);
  }, [props.initialTab, props.tabRequestId]);

  const filteredIntegrations = integrations.filter(integration => {
    const isModel = MODEL_INTEGRATION_IDS.has(integration.id) || integration.is_ai_provider === true;
    const belongsToTab = conTab === 'models' ? isModel : !isModel;
    const searchable = [integration.name, ...(integration.products ?? [])].join(' ').toLowerCase();
    return belongsToTab && (!appSearch || searchable.includes(appSearch.toLowerCase()));
  });
  const readyIntegrations = filteredIntegrations.filter(i => (i.availability ?? 'coming_soon') === 'ready');
  const laterIntegrations = filteredIntegrations.filter(i => (i.availability ?? 'coming_soon') !== 'ready');
  const activeGrants = grants.filter(g => g.status === 'active');
  const revokedGrants = grants.filter(g => g.status === 'revoked');

  const agentCatalog = [
    { name: 'Claude Code', detail: 'Anthropic agentic coding tool', icon: 'CC' },
    { name: 'Codex', detail: 'OpenAI cloud-based coding agent', icon: 'CDX' },
    { name: 'Cursor', detail: 'AI-first code editor', icon: 'CUR' },
    { name: 'n8n', detail: 'Visual workflow automation and AI agents', icon: 'N8N' },
    { name: 'Zapier', detail: 'No-code automation across 7,000+ apps', icon: 'ZAP' },
    { name: 'Make', detail: 'Visual automation platform for complex workflows', icon: 'MAKE' },
    { name: 'Agentforce', detail: 'Salesforce autonomous AI agents', icon: 'AF' },
    { name: 'LangChain', detail: 'Framework for LLM-powered applications', icon: 'LC' },
    { name: 'CrewAI', detail: 'Multi-agent orchestration framework', icon: 'CREW' },
    { name: 'AutoGen', detail: 'Microsoft multi-agent conversation framework', icon: 'AG' },
    { name: 'Hermes', detail: 'Autonomous agent runtime and messaging', icon: 'HRM' },
    { name: 'OpenClaw', detail: 'Open-source agent deployment platform', icon: 'OC' },
    { name: 'Rivet', detail: 'Visual AI agent builder and debugger', icon: 'RVT' },
  ];
  const filteredAgents = agentCatalog.filter(a => !agentSearch || a.name.toLowerCase().includes(agentSearch.toLowerCase()) || a.detail.toLowerCase().includes(agentSearch.toLowerCase()));
  const requestDetails = connectionRequestDetails(conTab);

  return (
    <div className="connections-view">
      <div className="connections-header">
        <div className="connections-header-copy">
          <h2>Connections</h2>
          <p>Manage what feeds Pod, what can use it, and which models are available.</p>
        </div>
        <a
          className="connections-request-link"
          href={requestDetails.mailto}
          aria-label={`${requestDetails.label} via email`}
          title="Opens your email app"
        >
          <Plus size={14} aria-hidden="true" />
          <span>{requestDetails.label}</span>
        </a>
      </div>

      <div className="skills-tabs management-tabs">
        <button className={`skills-tab ${conTab === 'sources' ? 'active' : ''}`} onClick={() => setConTab('sources')}>
          <span>Data</span>
          <span className="skills-tab-count">{integrations.filter(integration => !MODEL_INTEGRATION_IDS.has(integration.id) && !integration.is_ai_provider).length}</span>
        </button>
        <button className={`skills-tab ${conTab === 'agents' ? 'active' : ''}`} onClick={() => setConTab('agents')}>
          <span>Agents</span>
          {grants.length > 0 && <span className="skills-tab-count">{grants.length}</span>}
        </button>
        <button className={`skills-tab ${conTab === 'models' ? 'active' : ''}`} onClick={() => setConTab('models')}>
          <span>Models</span>
          <span className="skills-tab-count">{integrations.filter(integration => MODEL_INTEGRATION_IDS.has(integration.id) || integration.is_ai_provider).length}</span>
        </button>
      </div>

      {(conTab === 'sources' || conTab === 'models') && (
        <div className="connections-body">
          <div className="connections-search">
            <Search size={15} />
            <input placeholder={conTab === 'models' ? 'Search models…' : 'Search connections…'} value={appSearch} onChange={(e) => setAppSearch(e.target.value)} />
          </div>
          <div className="connections-section-label">
            <span>Available now</span>
            <span className="connections-section-count">{readyIntegrations.length}</span>
          </div>
          {readyIntegrations.length > 0 ? (
            <div className="connections-grid">
              {readyIntegrations.map(integration => (
                <ConnectionTile
                  key={integration.id}
                  integration={integration}
                  token={props.token}
                  onRefresh={loadIntegrations}
                  onOpenWizard={['google-drive', 'google-calendar', 'github', 'gitlab', 'slack', 'gmail', 'notion', 'linear'].includes(integration.id) ? (id: string) => setShowWizard(id as typeof showWizard) : undefined}
                  onOpenImport={integration.id === 'local-folders' ? props.onOpenImport : undefined}
                />
              ))}
            </div>
          ) : (
            <div className="connections-empty-state">
              <Plug size={28} />
              <strong>No available {conTab === 'models' ? 'models' : 'connections'}{appSearch ? ' match this search' : ''}</strong>
              <p>{appSearch
                ? (laterIntegrations.length > 0 ? 'Planned matches appear below.' : 'Try a different search.')
                : 'They will appear here once the server is reachable. Try refreshing this view.'}</p>
              {!appSearch && <button className="connections-empty-refresh" onClick={() => { void loadIntegrations(); }}><RefreshCw size={13} /> Refresh</button>}
            </div>
          )}
          {laterIntegrations.length > 0 && (
            <>
              <div className="connections-section-label" style={{ marginTop: 24 }}>
                <span>Not in this beta</span>
                <span className="connections-section-count">{laterIntegrations.length}</span>
              </div>
              <div className="connections-grid">
                {laterIntegrations.map(integration => (
                  <ConnectionTile
                    key={integration.id}
                    integration={integration}
                    token={props.token}
                    onRefresh={loadIntegrations}
                    onOpenWizard={['google-drive', 'google-calendar', 'github', 'gitlab', 'slack', 'gmail', 'notion', 'linear'].includes(integration.id) ? (id: string) => setShowWizard(id as typeof showWizard) : undefined}
                    onOpenImport={integration.id === 'local-folders' ? props.onOpenImport : undefined}
                  />
                ))}
              </div>
            </>
          )}
          {conTab === 'sources' && <ExternalMcpConnectors authToken={props.token} />}
        </div>
      )}

      {conTab === 'agents' && (
        <div className="connections-body">
          {/* MCP backend health + pre-warm action — drop-in component, self-managing. */}
          <McpHealthBanner token={props.token} />

          {/* Unified agent registry: named + discovered + install catalog.
             Replaces the older "Installed" grant list, which surfaced the
             same actor_ids but with no adoption affordance. */}
          <AgentsView collections={props.collections} authToken={props.token} />

          {/* Legacy grant-list block intentionally hidden — AgentsView's
             discovery path covers the same actors. Re-enable if we need to
             surface trust scores again. */}
          {false && (activeGrants.length > 0 || revokedGrants.length > 0) && (
            <div className="connections-section-label">
              <span>Installed</span>
              {revokedGrants.length > 0 && activeGrants.length === 0 && <span className="connections-section-count">{revokedGrants.length} revoked</span>}
            </div>
          )}
          {false && <div className={`grants-body ${selectedGrant ? 'has-detail' : ''}`}>
            <div className="grants-list-scroll">
              {activeGrants.length > 0 ? (
                <>
                  {activeGrants.map(grant => (
                    <button key={grant.id} className={`skill-row ${selectedGrant?.id === grant.id ? 'selected' : ''}`} onClick={() => setSelectedGrant(selectedGrant?.id === grant.id ? null : grant)}>
                      <div className="skill-icon" style={{ background: 'rgba(52,211,153,0.1)', color: 'var(--coffee-green)' }}><ShieldCheck size={16} /></div>
                      <div className="skill-info">
                        <div className="skill-name-row">
                          <strong>{grant.skill_name ?? grant.actor_id}</strong>
                          {grant.trust_level && <span className={`trust-level-chip level-${grant.trust_level}`}>{grant.trust_level}</span>}
                        </div>
                        <div className="skill-meta">
                          <span>{grant.actor_type}</span>
                          {grant.description && <><span>·</span><span>{grant.description}</span></>}
                        </div>
                      </div>
                      {grant.trust_score != null && (
                        <div className="skill-trust">
                          <span className="trust-score" style={{ color: grant.trust_score >= 80 ? 'var(--coffee-green)' : grant.trust_score >= 50 ? 'var(--coffee-amber)' : 'var(--coffee-red)' }}>{grant.trust_score}</span>
                        </div>
                      )}
                    </button>
                  ))}
                </>
              ) : revokedGrants.length > 0 ? (
                <div className="revoked-summary">
                  {revokedGrants.map(g => <span key={g.id} className="revoked-summary-name">{g.skill_name ?? g.actor_id}</span>)}
                </div>
              ) : null}
            </div>

            {selectedGrant && (
              <div className="skill-detail-panel">
                <div className="skill-detail-top">
                  <button className="activity-detail-close" onClick={() => setSelectedGrant(null)}><X size={14} /></button>
                </div>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>{selectedGrant.skill_name ?? selectedGrant.actor_id}</h3>

                <div className="skill-detail-section">
                  <h4>Grant</h4>
                  <div className="skill-detail-meta-grid">
                    <div className="graph-detail-prop"><span>ID</span><strong>{selectedGrant.id}</strong></div>
                    <div className="graph-detail-prop"><span>Actor</span><strong>{selectedGrant.actor_id}</strong></div>
                    <div className="graph-detail-prop"><span>Type</span><strong>{selectedGrant.actor_type}</strong></div>
                    <div className="graph-detail-prop"><span>Trusted</span><strong>{selectedGrant.trusted ? 'Yes' : 'No'}</strong></div>
                    <div className="graph-detail-prop"><span>Created</span><strong>{relativeTime(selectedGrant.created_at)}</strong></div>
                  </div>
                </div>

                <div className="skill-detail-section">
                  <h4>Capabilities</h4>
                  <div className="grant-capabilities-grid">
                    {Object.entries(selectedGrant.capabilities ?? {}).map(([cap, scopes]) => {
                      const scopeList = scopes as string[];
                      if (!scopeList || scopeList.length === 0) return null;
                      return (
                        <div key={cap} className="grant-capability-row">
                          <span className="grant-cap-name">{cap}</span>
                          <div className="grant-cap-scopes">
                            {scopeList.map((s: string) => <span key={s} className="perm-badge">{s.replace('pod/founder/', '')}</span>)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Connection-grant detail + recent audit for this actor. Lazy-loads on selection. */}
                <div className="skill-detail-section">
                  <h4>External connections</h4>
                  <AgentGrantsPanel token={props.token} actorId={selectedGrant.actor_id} onChange={loadGrants} />
                </div>
              </div>
            )}
          </div>}

          {false && <div className="connections-section-label" style={{ marginTop: 24 }}>
            <span>Available</span>
          </div>}
          {false && <div className="connections-search">
            <Search size={15} />
            <input placeholder="Search agents..." value={agentSearch ?? ''} onChange={(e) => setAgentSearch(e.target.value)} />
          </div>}
          {false && <div className="connections-grid">
            {filteredAgents.map((agent) => {
              const isInstalled = activeGrants.some(g => g.actor_id?.toLowerCase().includes(agent.name.toLowerCase()));
              return (
                <button
                  className="connection-tile"
                  key={agent.name}
                  onClick={async () => {
                    if (isInstalled) return;
                    const actorId = `agent:${agent.name.toLowerCase().replace(/\s+/g, '-')}`;
                    try {
                      await fetch('/pod/access', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', ...authHeaders(props.token) },
                        body: JSON.stringify({
                          actor_id: actorId,
                          actor_type: 'agent',
                          actor_display_name: agent.name,
                          operation: 'grant',
                          capabilities: { observe: ['*'], query: ['*'], compile: ['*'], read: ['*'], correct: [], forget: [] },
                          trusted: false,
                        }),
                      });
                      loadGrants();
                    } catch { /* best-effort */ }
                  }}
                >
                  <div className="connection-tile-top">
                    <ConnectionLogo value={agent.icon} />
                    <span className="connection-action">{isInstalled ? 'Connected' : 'Connect'}</span>
                  </div>
                  <div className="connection-tile-body">
                    <strong>{agent.name}</strong>
                    <span className="connection-detail">{agent.detail}</span>
                  </div>
                </button>
              );
            })}
          </div>}
        </div>
      )}

      {showWizard === 'google-drive' && (
        <DriveConnectionModal
          token={props.token}
          open
          startConnected={integrations.find(i => i.id === 'google-drive')?.status === 'active'}
          onClose={() => setShowWizard(null)}
          onCommitted={() => { setShowWizard(null); void loadIntegrations(); }}
        />
      )}
      {showWizard === 'google-calendar' && (
        <CalendarConnectionModal
          token={props.token}
          open
          startConnected={integrations.find(i => i.id === 'google-calendar')?.status === 'active'}
          onClose={() => setShowWizard(null)}
          onCommitted={() => { setShowWizard(null); void loadIntegrations(); }}
        />
      )}
      {showWizard === 'gmail' && (
        <EmailConnectionModal
          token={props.token}
          open
          providers={integrations.find(integration => integration.id === 'gmail')?.email_providers}
          onClose={() => setShowWizard(null)}
          onProvidersChanged={() => { void loadIntegrations(); }}
          onCommitted={() => { setShowWizard(null); void loadIntegrations(); }}
        />
      )}
      {showWizard && ['github', 'gitlab', 'slack', 'notion', 'linear'].includes(showWizard) && (
        <IntegrationConnectionModal
          token={props.token}
          integrationId={showWizard as 'github' | 'gitlab' | 'slack' | 'notion' | 'linear'}
          open
          onClose={() => setShowWizard(null)}
          onCommitted={() => { setShowWizard(null); void loadIntegrations(); }}
        />
      )}
    </div>
  );
}

/* ── Brand SVG logos ── */
function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" fill="#34A853"/>
      <path d="M5.84 14.09A6.97 6.97 0 0 1 5.47 12c0-.72.13-1.43.37-2.09V7.07H2.18A11.96 11.96 0 0 0 .96 12c0 1.94.46 3.77 1.22 5.03l3.66-2.94Z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z" fill="#EA4335"/>
    </svg>
  );
}

function AppleLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.52-3.23 0-1.44.64-2.2.45-3.06-.4C3.79 16.17 4.36 9.02 8.78 8.76c1.27.07 2.15.72 2.9.76.83-.15 1.62-.79 2.76-.73 1.62.1 2.78.87 3.37 2.25-3.02 1.82-2.3 5.52.47 6.62-.57 1.42-1.3 2.83-2.25 3.64l.02-.02ZM12.5 8.64c-.15-2.23 1.66-4.07 3.74-4.25.32 2.32-2.14 4.45-3.74 4.25Z"/>
    </svg>
  );
}

function GitHubLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z"/>
    </svg>
  );
}

function GitLabLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="m12 22.17-4.382-13.49h8.764L12 22.17Z" fill="#E24329"/>
      <path d="m12 22.17-4.382-13.49H1.455L12 22.17Z" fill="#FC6D26"/>
      <path d="M1.455 8.68.047 12.99a.96.96 0 0 0 .348 1.073L12 22.17 1.455 8.68Z" fill="#FCA326"/>
      <path d="M1.455 8.68h6.163L5.133 1.372a.478.478 0 0 0-.91 0L1.455 8.68Z" fill="#E24329"/>
      <path d="m12 22.17 4.382-13.49h6.163L12 22.17Z" fill="#FC6D26"/>
      <path d="m22.545 8.68.046.153 1.362 4.157a.96.96 0 0 1-.348 1.073L12 22.17l10.545-13.49Z" fill="#FCA326"/>
      <path d="M22.545 8.68h-6.163l2.485-7.308a.478.478 0 0 1 .91 0l2.768 7.309Z" fill="#E24329"/>
    </svg>
  );
}

function GmailLogo({ size = 20 }: { size?: number }) {
  const asset = brandImg('gmail', size, 'Gmail');
  if (asset) return <>{asset}</>;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M2 6c0-1.1.9-2 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6Z" fill="#fff"/>
      <path d="M2 6l10 7 10-7" fill="none"/>
      <path d="M2 4h20v4L12 15 2 8V4Z" fill="none"/>
      <path d="M22 6v-.5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2V6l10 7 10-7Z" fill="#EA4335" opacity="0.9"/>
      <path d="M2 6v12a2 2 0 0 0 2 2h2V8.3L2 6Z" fill="#4285F4"/>
      <path d="M22 6v12a2 2 0 0 1-2 2h-2V8.3L22 6Z" fill="#34A853"/>
      <path d="M6 20h12V8.3L12 13 6 8.3V20Z" fill="#C5221F" opacity="0.08"/>
      <path d="M18 20h2a2 2 0 0 0 2-2V6l-4 2.3V20ZM6 20H4a2 2 0 0 1-2-2V6l4 2.3V20Z" fill="none" stroke="#E8EAED" strokeWidth="0"/>
      <path d="M22 6.25V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v.25l10 6.875L22 6.25Z" fill="#EA4335"/>
    </svg>
  );
}

function SlackLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52Zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313Z" fill="#E01E5A"/>
      <path d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834Zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312Z" fill="#36C5F0"/>
      <path d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834Zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312Z" fill="#2EB67D"/>
      <path d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52Zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313Z" fill="#ECB22E"/>
    </svg>
  );
}

function NotionLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L18.09 2.17c-.466-.373-.98-.653-2.055-.56L3.01 2.636c-.466.046-.56.28-.373.466l1.822 1.106Zm.793 2.988v13.906c0 .746.373 1.026 1.213.98l14.523-.84c.84-.046.933-.56.933-1.166V6.196c0-.606-.233-.933-.746-.886l-15.177.886c-.56.047-.746.327-.746.886v.014Zm14.337.42c.093.42 0 .84-.42.886l-.7.14v10.264c-.606.326-1.166.513-1.633.513-.746 0-.933-.233-1.493-.933l-4.571-7.182v6.95l1.446.326s0 .84-1.166.84l-3.22.186c-.093-.186 0-.653.326-.746l.84-.233V9.854L7.822 9.76c-.093-.42.14-1.026.793-1.073l3.453-.233 4.758 7.276V9.2l-1.213-.14c-.093-.513.28-.886.746-.933l3.22-.186.014-.014Z"/>
    </svg>
  );
}

function LinearLogo({ size = 20 }: { size?: number }) {
  const asset = brandImg('linear', size, 'Linear');
  if (asset) return <>{asset}</>;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <path d="M1.22541 61.5228c-.18784-.9578.20836-2.1594.97687-2.9284L52.598 8.209c.7688-.7685 1.9707-1.1646 2.9286-.9768 4.5321.8892 8.8798 2.5084 12.8586 4.7648l-51.4446 51.4447c-2.2567-3.9793-3.8759-8.327-4.7156-12.8589z" fill="#5E6AD2"/>
      <path d="M8.65478 77.6141c1.02483 1.3686 2.14758 2.6693 3.36032 3.882 1.2127 1.2127 2.5134 2.3355 3.882 3.3603L77.6141 23.1391c-1.0248-1.3686-2.1476-2.6693-3.3603-3.882-1.2128-1.2127-2.5135-2.3355-3.882-3.3603L8.65478 77.6141z" fill="#5E6AD2"/>
      <path d="M22.1371 90.3752c4.5319 2.2566 9.5818 3.7122 14.8504 4.2374l53.1619-53.162c-.5252-5.2686-1.9808-10.3185-4.2374-14.8504L22.1371 90.3752z" fill="#5E6AD2"/>
      <path d="M62.4111 98.2052c6.3955-1.0057 12.3352-3.3063 17.5395-6.707L41.4981 53.0458c-3.4006 5.2043-5.7013 11.144-6.7069 17.5395l27.6199 27.6199z" fill="#5E6AD2"/>
      <path d="M91.5082 80.9533C96.932 73.3288 100 64.0267 100 54 100 26.3858 77.6142 4 50 4c-10.0267 0-19.3288 3.06804-26.9533 8.49175L91.5082 80.9533z" fill="#5E6AD2"/>
    </svg>
  );
}

function AnthropicLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#D97757">
      <path d="M13.827 3.52h3.603L24 20.48h-3.603l-6.57-16.96Zm-7.258 0L0 20.48h3.603l1.476-3.906h6.78l1.476 3.906h3.603L10.17 3.52H6.569Zm.839 10.2 2.23-5.905 2.23 5.906H7.408Z"/>
    </svg>
  );
}

function OpenAILogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.998 5.998 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073ZM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494ZM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646ZM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872v.024Zm16.597 3.855-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667Zm2.01-3.023-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66v.018Zm-12.64 4.135-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681l-.004 6.722Zm1.097-2.365 2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5-.005-2.999Z"/>
    </svg>
  );
}

function OllamaLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="10" r="6" fill="none" stroke="currentColor" strokeWidth="1.8"/>
      <circle cx="10" cy="9" r="1.2"/><circle cx="14" cy="9" r="1.2"/>
      <path d="M9.5 12.5a3.5 3.5 0 0 0 5 0" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M8 16c-2 1.5-3 3-3 4.5h14c0-1.5-1-3-3-4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function GoogleCalendarLogo({ size = 20 }: { size?: number }) {
  const asset = brandImg('google-calendar', size, 'Google Calendar');
  if (asset) return <>{asset}</>;
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <path d="M152.637 200H47.363C21.214 200 0 178.786 0 152.637V47.363C0 21.214 21.214 0 47.363 0h105.274C178.786 0 200 21.214 200 47.363v105.274C200 178.786 178.786 200 152.637 200z" fill="#fff"/>
      <path d="M152.637 200H47.363C21.214 200 0 178.786 0 152.637V47.363C0 21.214 21.214 0 47.363 0h105.274C178.786 0 200 21.214 200 47.363v105.274C200 178.786 178.786 200 152.637 200z" fill="#4285F4" opacity="0.12"/>
      <path d="M143.218 37.227l19.554 19.554V47.363c0-5.613-4.523-10.136-10.136-10.136h-9.418z" fill="#1A73E8"/>
      <path d="M37.227 56.781L56.781 37.227H47.363c-5.613 0-10.136 4.523-10.136 10.136v9.418z" fill="#EA4335"/>
      <path d="M143.218 162.773l19.554-19.554v9.418c0 5.613-4.523 10.136-10.136 10.136h-9.418z" fill="#34A853"/>
      <path d="M37.227 143.219l19.554 19.554H47.363c-5.613 0-10.136-4.523-10.136-10.136v-9.418z" fill="#188038"/>
      <path d="M162.772 56.781H56.781v106.446h106.446V56.781h-.455z" fill="#fff"/>
      <path d="M162.772 56.781H56.781v106.446h106.446V56.781h-.455z" fill="none" stroke="#DADCE0" strokeWidth="1"/>
      <path d="M79.5 130.5V82h10.8l1.2 6h.4c3.6-4.8 8.8-7.2 15.6-7.2 6.4 0 11.2 2.2 14.8 6.4 3.6 4.2 5.2 10 5.2 17.2 0 7.6-2 13.6-5.8 17.8-3.8 4.2-8.8 6.4-15 6.4-5.6 0-10-2-13.2-5.8h-.4v7.6H79.5zm26-17.2c0-4.8-1-8.6-3.2-11.2-2.2-2.8-5-4.2-8.6-4.2-3.8 0-6.8 1.4-9 4.4-2.2 2.8-3.2 6.6-3.2 11.2s1 8.4 3.2 11.2c2.2 2.8 5.2 4.2 9 4.2 3.6 0 6.4-1.4 8.6-4.2 2.2-2.8 3.2-6.6 3.2-11.4z" fill="#4285F4" opacity="0"/>
      <rect x="72" y="80" width="14" height="14" rx="2" fill="#4285F4"/>
      <rect x="93" y="80" width="14" height="14" rx="2" fill="#4285F4"/>
      <rect x="114" y="80" width="14" height="14" rx="2" fill="#4285F4"/>
      <rect x="72" y="101" width="14" height="14" rx="2" fill="#4285F4"/>
      <rect x="93" y="101" width="14" height="14" rx="2" fill="#4285F4"/>
      <rect x="114" y="101" width="14" height="14" rx="2" fill="#4285F4" opacity="0.4"/>
      <rect x="72" y="122" width="14" height="14" rx="2" fill="#4285F4"/>
      <rect x="93" y="122" width="14" height="14" rx="2" fill="#4285F4" opacity="0.4"/>
    </svg>
  );
}

function OpenRouterLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Z" fill="#6366F1" opacity="0.12"/>
      <path d="M7.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0Z" stroke="#6366F1" strokeWidth="1.5"/>
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M19.07 4.93l-2.12 2.12M7.05 16.95l-2.12 2.12" stroke="#6366F1" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function N8nLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4.5 7.5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-9Z" fill="#EA4B71"/>
      <path d="M13.5 7.5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-9Z" fill="#EA4B71"/>
      <path d="M10.5 10l3 2-3 2" stroke="#EA4B71" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ZapierLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M15.478 12.89l4.162-4.163a.75.75 0 0 0 0-1.06L17.333 5.36a.75.75 0 0 0-1.06 0l-4.163 4.162L7.948 5.36a.75.75 0 0 0-1.06 0L4.58 7.667a.75.75 0 0 0 0 1.06l4.162 4.163L4.58 17.053a.75.75 0 0 0 0 1.06l2.307 2.307a.75.75 0 0 0 1.06 0l4.163-4.162 4.163 4.162a.75.75 0 0 0 1.06 0l2.307-2.307a.75.75 0 0 0 0-1.06L15.478 12.89Z" fill="#FF4A00"/>
      <circle cx="12.11" cy="12.89" r="2.5" fill="#FF4A00"/>
    </svg>
  );
}

function MakeLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#6D00CC"/>
      <path d="M8 8l4 4-4 4M13 8l4 4-4 4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function AgentforceLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Z" fill="#00A1E0" opacity="0.12"/>
      <path d="M8.5 9.5c0-1.933 1.567-3.5 3.5-3.5s3.5 1.567 3.5 3.5" stroke="#00A1E0" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="12" cy="14" r="2.5" stroke="#00A1E0" strokeWidth="1.5"/>
      <path d="M12 16.5v2" stroke="#00A1E0" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M8 19c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="#00A1E0" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function LangChainLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M14.008 3.216l6.073 3.508v7.014l-6.073 3.508-6.073-3.508V6.724l6.073-3.508Z" stroke="#4ADE80" strokeWidth="1.2"/>
      <path d="M10 3.216l-6.073 3.508v7.014L10 17.246l6.073-3.508V6.724L10 3.216Z" stroke="#4ADE80" strokeWidth="1.2"/>
      <circle cx="12" cy="8.5" r="1.8" fill="#4ADE80"/>
      <path d="M12 10.3v2.2" stroke="#4ADE80" strokeWidth="1.2"/>
      <circle cx="9" cy="14.5" r="1.5" fill="#4ADE80"/>
      <circle cx="15" cy="14.5" r="1.5" fill="#4ADE80"/>
      <path d="M11 12.5l-1.5 2M13 12.5l1.5 2" stroke="#4ADE80" strokeWidth="1"/>
    </svg>
  );
}

function CrewAILogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="8" cy="7.5" r="2.5" fill="#F97316"/>
      <circle cx="16" cy="7.5" r="2.5" fill="#3B82F6"/>
      <circle cx="12" cy="15" r="2.5" fill="#10B981"/>
      <path d="M9.5 9.5L11 13M14.5 9.5L13 13" stroke="#94A3B8" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M8.5 10v2.5a3.5 3.5 0 0 0 7 0V10" stroke="#94A3B8" strokeWidth="1" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

function AutoGenLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="4" fill="#0078D4" opacity="0.12"/>
      <path d="M8 12h8" stroke="#0078D4" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M12 8v8" stroke="#0078D4" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="8" cy="12" r="2" fill="#0078D4"/>
      <circle cx="16" cy="12" r="2" fill="#0078D4"/>
      <circle cx="12" cy="8" r="2" fill="#0078D4"/>
      <circle cx="12" cy="16" r="2" fill="#0078D4"/>
    </svg>
  );
}

function HermesLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 3l-8 4v10l8 4 8-4V7l-8-4Z" fill="#8B5CF6" opacity="0.12" stroke="#8B5CF6" strokeWidth="1.2"/>
      <path d="M12 7v10" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M8 9h8" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M8 12h8" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M8 15h8" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function ClaudeCodeLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="5" fill="#D97757" opacity="0.15"/>
      <path d="M13.827 5.52h2.403L20 18.48h-2.403l-3.37-12.96Z" fill="#D97757"/>
      <path d="M7.569 5.52L4 18.48h2.403l.876-2.906h4.78l.876 2.906h2.403L10.17 5.52H7.569Zm.539 7.8l1.53-5.1 1.53 5.1H8.108Z" fill="#D97757"/>
    </svg>
  );
}

function CursorLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="5" fill="#000" opacity="0.12"/>
      <path d="M7 5l10 7-10 7V5Z" fill="currentColor" opacity="0.85"/>
    </svg>
  );
}

function CodexLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <defs><linearGradient id="cxg" x1="0.5" y1="0" x2="0.5" y2="1"><stop offset="0%" stopColor="#B5A8EE"/><stop offset="50%" stopColor="#8B8DF2"/><stop offset="100%" stopColor="#4F6AF5"/></linearGradient></defs>
      <circle cx="50" cy="38" r="24" fill="url(#cxg)"/><circle cx="30" cy="50" r="20" fill="url(#cxg)"/><circle cx="70" cy="50" r="20" fill="url(#cxg)"/><circle cx="36" cy="70" r="18" fill="url(#cxg)"/><circle cx="64" cy="70" r="18" fill="url(#cxg)"/>
      <rect x="16" y="38" width="68" height="40" fill="url(#cxg)"/><rect x="26" y="30" width="48" height="50" fill="url(#cxg)"/>
      <path d="M30 42l12 12-12 12" stroke="white" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="52" y="58" width="18" height="6" rx="3" fill="white"/>
    </svg>
  );
}

function OpenClawLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" fill="#EF4444" opacity="0.12" stroke="#EF4444" strokeWidth="1.2"/>
      <path d="M8 10c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M7 14l2.5-2 2.5 2 2.5-2 2.5 2" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 17h8" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function RivetLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="7" height="6" rx="1.5" stroke="#6366F1" strokeWidth="1.3" fill="#6366F1" opacity="0.12"/>
      <rect x="14" y="5" width="7" height="6" rx="1.5" stroke="#6366F1" strokeWidth="1.3" fill="#6366F1" opacity="0.12"/>
      <rect x="3" y="13" width="7" height="6" rx="1.5" stroke="#6366F1" strokeWidth="1.3" fill="#6366F1" opacity="0.12"/>
      <rect x="14" y="13" width="7" height="6" rx="1.5" stroke="#6366F1" strokeWidth="1.3" fill="#6366F1" opacity="0.12"/>
      <path d="M10 8h4M10 16h4" stroke="#6366F1" strokeWidth="1.3" strokeLinecap="round"/>
      <circle cx="6.5" cy="8" r="1" fill="#6366F1"/><circle cx="17.5" cy="8" r="1" fill="#6366F1"/>
      <circle cx="6.5" cy="16" r="1" fill="#6366F1"/><circle cx="17.5" cy="16" r="1" fill="#6366F1"/>
    </svg>
  );
}

function GoogleDriveLogo({ size = 20 }: { size?: number }) {
  const asset = brandImg('google-drive', size, 'Google Drive');
  if (asset) return <>{asset}</>;
  return (
    <svg width={size} height={size} viewBox="0 0 87.3 78" fill="none">
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5l5.4 9.35Z" fill="#0066DA"/>
      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3L1.2 46.2C.4 47.6 0 49.15 0 50.7h27.5L43.65 25Z" fill="#00AC47"/>
      <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.85L52 66.8l-4.65 10h22.9l3.3 0Z" fill="#EA4335"/>
      <path d="M43.65 25 57.4 1.2c-1.35-.8-2.9-1.2-4.5-1.2H34.4c-1.6 0-3.15.45-4.5 1.2L43.65 25Z" fill="#00832D"/>
      <path d="m59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h40.8c1.6 0 3.15-.45 4.5-1.2L59.8 53Z" fill="#2684FC"/>
      <path d="M73.4 26.5 60.35 3.5c-.8-1.4-1.95-2.5-3.3-3.3L43.3 24l16.5 28.5H87c0-1.55-.4-3.1-1.2-4.5L73.4 26.5Z" fill="#FFBA00"/>
    </svg>
  );
}

function ConnectionLogo(props: { value: string }) {
  if (props.value === 'coffee') return <span className="app-logo image-logo"><img src="/brand/coffee-logo.png" alt="" /></span>;
  if (props.value === 'folder') return <span className="app-logo icon-logo"><HardDrive size={24} /></span>;
  if (props.value === 'drive') return <span className="app-logo icon-logo"><GoogleDriveLogo size={24} /></span>;
  if (props.value === 'email') return <span className="app-logo icon-logo"><Mail size={23} /></span>;
  const logoMap: Record<string, React.ReactNode> = {
    GH: <GitHubLogo size={22} />, GL: <GitLabLogo size={22} />, GM: <GmailLogo size={22} />, SL: <SlackLogo size={22} />,
    NO: <NotionLogo size={22} />, AI: <OpenAILogo size={22} />, AN: <AnthropicLogo size={22} />,
    OL: <OllamaLogo size={22} />, LN: <LinearLogo size={22} />,
    GCAL: <GoogleCalendarLogo size={22} />, OR: <OpenRouterLogo size={22} />,
    N8N: <N8nLogo size={22} />, ZAP: <ZapierLogo size={22} />, MAKE: <MakeLogo size={22} />,
    AF: <AgentforceLogo size={22} />, LC: <LangChainLogo size={22} />, CREW: <CrewAILogo size={22} />,
    AG: <AutoGenLogo size={22} />, HRM: <HermesLogo size={22} />, OC: <OpenClawLogo size={22} />,
    RVT: <RivetLogo size={22} />, CC: <ClaudeCodeLogo size={22} />, CUR: <CursorLogo size={22} />,
    CDX: <CodexLogo size={22} />, POD: <PodLogo size={22} />,
  };
  if (logoMap[props.value]) return <span className={`app-logo letter-logo logo-${props.value.toLowerCase()}`}>{logoMap[props.value]}</span>;
  return <span className={`app-logo letter-logo logo-${props.value.toLowerCase()}`}>{props.value}</span>;
}

/* ═══════════════════════════════════════
   Settings Modal — Pod-by-Coffee preferences surface
   ═══════════════════════════════════════ */

type SettingsSectionKey =
  | 'general'
  | 'appearance'
  | 'memory'
  | 'privacy'
  | 'data'
  | 'help'
  | 'advanced';

interface SettingsSection {
  key: SettingsSectionKey;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
}

const SETTINGS_SECTIONS: SettingsSection[] = [
  { key: 'general',    label: 'General',            icon: User },
  { key: 'appearance', label: 'Appearance',         icon: Palette },
  { key: 'memory',     label: 'Memory',             icon: Brain },
  { key: 'privacy',    label: 'Privacy & security', icon: ShieldCheck },
  { key: 'data',       label: 'Data & backup',      icon: HardDrive },
  { key: 'help',       label: 'Help & diagnostics', icon: Wrench },
  { key: 'advanced',   label: 'Advanced',           icon: CodeXml },
];

interface SettingsModalProps {
  authToken: string;
  theme: 'dark' | 'light' | 'auto';
  onThemeChange: (t: 'dark' | 'light' | 'auto') => void;
  sidebarCollapsedDefault: boolean;
  onSidebarCollapsedDefaultChange: (v: boolean) => void;
  onLockPod: () => void;
  onPinChanged?: () => void;
  onOpenConnections: () => void;
  onRuntimeChanged?: (runtime: PodRuntime) => void;
  workspaces: PodWorkspace[];
  activeWorkspaceId: string;
  onWorkspaceCreate: (name: string, emoji: string) => Promise<PodWorkspace>;
  onWorkspaceUpdate: (workspaceId: string, values: { name?: string; emoji?: string }) => Promise<PodWorkspace>;
  onWorkspaceDelete: (workspaceId: string) => Promise<void>;
  onWorkspaceSwitch: (workspaceId: string) => void;
  initialSection?: string;
  onClose: () => void;
}

function SettingsModal(props: SettingsModalProps) {
  const initialAliases: Record<string, SettingsSectionKey> = {
    about: 'general',
    access: 'privacy',
    storage: 'data',
    support: 'help',
    developers: 'advanced',
  };
  const requestedSection = props.initialSection ?? 'general';
  const [active, setActive] = React.useState<SettingsSectionKey>(
    SETTINGS_SECTIONS.some(section => section.key === requestedSection)
      ? requestedSection as SettingsSectionKey
      : initialAliases[requestedSection] ?? 'general',
  );
  const [runtime, setRuntime] = React.useState<PodRuntime | null>(null);
  const [runtimeError, setRuntimeError] = React.useState<string | null>(null);

  const reloadRuntime = React.useCallback(async () => {
    try {
      const data = await getJson<PodRuntime>('/pod/runtime', props.authToken);
      setRuntime(data);
      setRuntimeError(null);
      props.onRuntimeChanged?.(data);
      if (data.owner_id) localStorage.setItem('coffee-pod-owner-id', data.owner_id);
      if (data.owner_display_name) localStorage.setItem('coffee-pod-owner-display-name', data.owner_display_name);
      else localStorage.removeItem('coffee-pod-owner-display-name');
    } catch {
      setRuntime(null);
      setRuntimeError('Pod details could not be loaded.');
    }
  }, [props.authToken, props.onRuntimeChanged]);

  React.useEffect(() => { void reloadRuntime(); }, [reloadRuntime]);

  const activeSection = SETTINGS_SECTIONS.find(s => s.key === active) ?? SETTINGS_SECTIONS[0];
  return (
    <Dialog open onOpenChange={(open) => { if (!open) props.onClose(); }}>
      <DialogContent showCloseButton={false} className="settings-modal max-w-5xl p-0 gap-0">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">Manage your name, appearance, memory, privacy, backups, diagnostics, and advanced Pod options.</DialogDescription>

        <div className="settings-shell">
          {/* Left rail */}
          <aside className="settings-nav">
            <div className="settings-nav-header">
              <h2 className="settings-nav-title">Settings</h2>
              {runtime && (
                <div className="settings-nav-account">
                  <OwnerAvatar src={runtime.owner_avatar_data_url} name={runtime.owner_display_name ?? 'Pod owner'} size={32} />
                  <div className="settings-nav-account-meta">
                    <span className="settings-nav-account-name">{runtime.pod_name_override ?? runtime.pod_name}</span>
                    <span className="settings-nav-account-id">{runtime.owner_display_name ?? 'Pod owner'}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="settings-nav-group">
              {SETTINGS_SECTIONS.map(section => (
                <SettingsNavItem key={section.key} section={section} active={active === section.key} onClick={() => setActive(section.key)} />
              ))}
            </div>
          </aside>

          {/* Right pane */}
          <div className="settings-pane">
            <button className="settings-close" onClick={props.onClose} aria-label="Close settings">
              <X size={18} />
            </button>
            <div className="settings-pane-scroll">
              <SettingsPaneContent
                section={activeSection}
                runtime={runtime}
                runtimeError={runtimeError}
                onRuntimeReload={reloadRuntime}
                theme={props.theme}
                onThemeChange={props.onThemeChange}
                sidebarCollapsedDefault={props.sidebarCollapsedDefault}
                onSidebarCollapsedDefaultChange={props.onSidebarCollapsedDefaultChange}
                onLockPod={props.onLockPod}
                onPinChanged={props.onPinChanged}
                onOpenConnections={props.onOpenConnections}
                authToken={props.authToken}
                workspaces={props.workspaces}
                activeWorkspaceId={props.activeWorkspaceId}
                onWorkspaceCreate={props.onWorkspaceCreate}
                onWorkspaceUpdate={props.onWorkspaceUpdate}
                onWorkspaceDelete={props.onWorkspaceDelete}
                onWorkspaceSwitch={props.onWorkspaceSwitch}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SettingsNavItem(props: { section: SettingsSection; active: boolean; onClick: () => void }) {
  const Icon = props.section.icon;
  return (
    <button
      className={`settings-nav-item ${props.active ? 'active' : ''}`}
      onClick={props.onClick}
      aria-current={props.active ? 'page' : undefined}
    >
      <Icon size={16} />
      <span>{props.section.label}</span>
    </button>
  );
}

interface SettingsPaneContentProps {
  section: SettingsSection;
  runtime: PodRuntime | null;
  runtimeError: string | null;
  onRuntimeReload: () => Promise<void> | void;
  theme: 'dark' | 'light' | 'auto';
  onThemeChange: (t: 'dark' | 'light' | 'auto') => void;
  sidebarCollapsedDefault: boolean;
  onSidebarCollapsedDefaultChange: (v: boolean) => void;
  onLockPod: () => void;
  onPinChanged?: () => void;
  onOpenConnections: () => void;
  authToken: string;
  workspaces: PodWorkspace[];
  activeWorkspaceId: string;
  onWorkspaceCreate: (name: string, emoji: string) => Promise<PodWorkspace>;
  onWorkspaceUpdate: (workspaceId: string, values: { name?: string; emoji?: string }) => Promise<PodWorkspace>;
  onWorkspaceDelete: (workspaceId: string) => Promise<void>;
  onWorkspaceSwitch: (workspaceId: string) => void;
}

function SettingsPaneContent(props: SettingsPaneContentProps) {
  switch (props.section.key) {
    case 'general':
      return (
        <SettingsAbout
          runtime={props.runtime}
          runtimeError={props.runtimeError}
          authToken={props.authToken}
          onRuntimeReload={props.onRuntimeReload}
          workspaces={props.workspaces}
          activeWorkspaceId={props.activeWorkspaceId}
          onWorkspaceCreate={props.onWorkspaceCreate}
          onWorkspaceUpdate={props.onWorkspaceUpdate}
          onWorkspaceDelete={props.onWorkspaceDelete}
          onWorkspaceSwitch={props.onWorkspaceSwitch}
        />
      );
    case 'appearance':
      return (
        <SettingsAppearance
          theme={props.theme}
          onThemeChange={props.onThemeChange}
          sidebarCollapsedDefault={props.sidebarCollapsedDefault}
          onSidebarCollapsedDefaultChange={props.onSidebarCollapsedDefaultChange}
        />
      );
    case 'privacy':
      return <SettingsAccess authToken={props.authToken} onLockPod={props.onLockPod} onPinChanged={props.onPinChanged} />;
    case 'memory':
      return <SettingsMemory runtime={props.runtime} authToken={props.authToken} onOpenConnections={props.onOpenConnections} />;
    case 'help':
      return <SettingsSupport authToken={props.authToken} />;
    case 'advanced':
      return <SettingsDevelopers runtime={props.runtime} authToken={props.authToken} onOpenConnections={props.onOpenConnections} />;
    case 'data':
      return <SettingsStorage authToken={props.authToken} runtime={props.runtime} />;
    default:
      return null;
  }
}

function SettingsPaneHeader(props: { title: string; subtitle?: string }) {
  return (
    <div className="settings-pane-header">
      <h1 className="settings-pane-title">{props.title}</h1>
      {props.subtitle && <p className="settings-pane-subtitle">{props.subtitle}</p>}
    </div>
  );
}

function SettingsComingSoon(props: { title: string; subtitle: string }) {
  return (
    <>
      <SettingsPaneHeader title={props.title} subtitle={props.subtitle} />
      <div className="settings-coming-soon">
        <Sparkles size={20} />
        <p>This section is being wired up. Check back after the next release.</p>
      </div>
    </>
  );
}

type MemoryVisibilitySetting = 'private' | 'scope' | 'workspace' | 'public';
type ReflectionCadenceSetting = 'manual_only' | 'every_15m' | 'hourly' | 'every_6h' | 'daily';

interface MemoryDefaultsSettings {
  default_visibility: MemoryVisibilitySetting;
  default_sensitive: boolean;
  default_use_llm: boolean;
}

interface ReflectionCadenceState {
  mode: ReflectionCadenceSetting;
  interval_seconds: number | null;
  last_reflected_at: string | null;
  next_reflect_after: string | null;
}

interface DreamCadenceState {
  mode: 'manual_only' | 'hourly' | 'every_6h' | 'daily';
  interval_seconds: number | null;
  last_dreamed_at: string | null;
  next_dream_after: string | null;
}

interface RetrievalSettingsState {
  semantic_mode: 'off' | 'shadow' | 'fallback';
  embedding_provider: 'active' | 'openai' | 'openrouter';
  embedding_model: string | null;
  lexical_min_results: number;
  lexical_min_score: number;
  semantic_min_similarity: number;
  semantic_limit: number;
  max_index_claims: number;
}

const REFLECTION_CADENCE_CHOICES: Array<{ value: ReflectionCadenceSetting; label: string }> = [
  { value: 'every_15m', label: 'Every 15 minutes · Very fresh' },
  { value: 'hourly', label: 'Hourly · Frequent' },
  { value: 'every_6h', label: 'Every 6 hours · Balanced' },
  { value: 'daily', label: 'Daily · Quiet' },
  { value: 'manual_only', label: 'Manual only' },
];

const REFLECTION_INTERVALS: Record<ReflectionCadenceSetting, number | null> = {
  every_15m: 15 * 60,
  hourly: 60 * 60,
  every_6h: 6 * 60 * 60,
  daily: 24 * 60 * 60,
  manual_only: null,
};

function settingsTimestamp(value: string | null): string {
  if (!value) return 'Not scheduled';
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return 'Unknown';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp);
}

function SettingsMemory(props: { runtime: PodRuntime | null; authToken: string; onOpenConnections: () => void }) {
  const [defaults, setDefaults] = React.useState<MemoryDefaultsSettings | null>(null);
  const [reflection, setReflection] = React.useState<ReflectionCadenceState | null>(null);
  const [dream, setDream] = React.useState<DreamCadenceState | null>(null);
  const [provider, setProvider] = React.useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [memoryResponse, reflectionResponse, dreamResponse, integrationsResponse] = await Promise.all([
        getJson<{ values: MemoryDefaultsSettings }>('/pod/settings/pod.memory_defaults', props.authToken),
        getJson<{ values: ReflectionCadenceState }>('/pod/settings/pod.reflect_cadence', props.authToken),
        getJson<{ values: DreamCadenceState }>('/pod/settings/pod.dream_cadence', props.authToken),
        getJson<{ integrations: IntegrationStatus[] }>('/integrations', props.authToken).catch(() => ({ integrations: [] })),
      ]);
      setDefaults(memoryResponse.values);
      setReflection(reflectionResponse.values);
      setDream(dreamResponse.values);
      const providers = integrationsResponse.integrations.filter(integration =>
        integration.is_ai_provider && (integration.status === 'active' || integration.status === 'configured'));
      setProvider(providers.find(integration => integration.ai_default) ?? providers[0] ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Memory settings could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [props.authToken]);

  React.useEffect(() => { void load(); }, [load]);

  async function patchNamespace<T>(namespace: string, values: Record<string, unknown>): Promise<T> {
    const response = await fetch(`/pod/settings/${namespace}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...authHeaders(props.authToken) },
      body: JSON.stringify({ values }),
    });
    const body = await response.json() as { values?: T; message?: string; error?: string | { message?: string } };
    if (!response.ok || !body.values) {
      const nestedMessage = typeof body.error === 'object' ? body.error.message : undefined;
      throw new Error(body.message ?? nestedMessage ?? `Pod returned ${response.status}`);
    }
    return body.values;
  }

  async function save<T>(key: string, action: () => Promise<T>, apply: (value: T) => void, message = 'Memory settings saved.') {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const value = await action();
      apply(value);
      setNotice(message);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Memory settings could not be saved.');
    } finally {
      setBusy(null);
    }
  }

  async function runReflection() {
    setBusy('reflect-now');
    setError(null);
    setNotice(null);
    try {
      await postJson('/pod/reflect-cycle', props.authToken, {
        actor_id: props.runtime?.owner_id ?? 'person-local',
      });
      await load();
      setNotice('Reflection completed. Pod memory is up to date.');
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Reflection could not run.');
    } finally {
      setBusy(null);
    }
  }

  async function runMaintenance() {
    setBusy('maintenance-now');
    setError(null);
    setNotice(null);
    try {
      await postJson('/pod/dream-cycle', props.authToken, {
        actor_id: props.runtime?.owner_id ?? 'person-local',
      });
      await load();
      setNotice('Dream completed. Memory health checks are up to date.');
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Dream could not run.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <SettingsPaneHeader title="Memory" subtitle="Choose when Pod Reflects and Dreams, and whether a model may help." />

      {error && <div className="settings-inline-error">{error}</div>}
      {notice && <div className="settings-inline-success">{notice}</div>}

      {loading || !defaults || !reflection || !dream ? (
        <div className="settings-empty">Loading memory settings…</div>
      ) : (
        <>
          <div className="settings-pane-section-title">Reflect</div>
          <div className="settings-section">
            <div className="settings-row">
              <div className="settings-row-label">
                <div className="settings-row-title">How often Pod Reflects</div>
                <div className="settings-row-desc">Reflect turns new evidence into organized knowledge: entities, claims, relationships, episodes, and summaries. More frequent reflection may use more model tokens.</div>
              </div>
              <div className="settings-row-control">
                <select
                  className="settings-select"
                  aria-label="Reflection schedule"
                  value={reflection.mode}
                  disabled={busy !== null}
                  onChange={event => {
                    const mode = event.target.value as ReflectionCadenceSetting;
                    void save(
                      'reflection-cadence',
                      () => patchNamespace<ReflectionCadenceState>('pod.reflect_cadence', {
                        mode,
                        interval_seconds: REFLECTION_INTERVALS[mode],
                      }),
                      setReflection,
                    );
                  }}
                >
                  {REFLECTION_CADENCE_CHOICES.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
                </select>
              </div>
            </div>
            <div className="settings-memory-status-grid">
              <div><span>Last Reflect</span><strong>{reflection.last_reflected_at ? settingsTimestamp(reflection.last_reflected_at) : 'Not yet'}</strong></div>
              <div><span>Next Reflect</span><strong>{reflection.mode === 'manual_only' ? 'Manual' : settingsTimestamp(reflection.next_reflect_after)}</strong></div>
            </div>
            <div className="settings-memory-actions">
              <Button size="sm" variant="outline" onClick={() => void runReflection()} disabled={busy !== null}>
                {busy === 'reflect-now' ? <><Loader2 size={14} className="spin" /> Reflecting…</> : <><Sparkles size={14} /> Reflect now</>}
              </Button>
            </div>
          </div>

          <div className="settings-pane-section-title">Model-assisted Reflect</div>
          <div className="settings-section">
            <div className="settings-row">
              <div className="settings-row-label">
                <div className="settings-row-title">Use a model when Pod Reflects</div>
                <div className="settings-row-desc">A model can understand free-form email and extract people, organizations, projects, events, decisions, and claims. Without one, Pod uses limited fixed rules locally.</div>
              </div>
              <div className="settings-row-control">
                <Switch
                  aria-label="Use a model when Pod Reflects"
                  checked={defaults.default_use_llm}
                  disabled={busy !== null || (!provider && !defaults.default_use_llm)}
                  onCheckedChange={checked => void save(
                    'model-reflection',
                    () => patchNamespace<MemoryDefaultsSettings>('pod.memory_defaults', { default_use_llm: checked }),
                    setDefaults,
                  )}
                />
              </div>
            </div>
            <div className="settings-memory-provider">
              <span className="settings-memory-provider-icon"><Cloud size={15} /></span>
              <span>
                <strong>{provider ? provider.name : 'No model connected'}</strong>
                <small>{provider ? `${provider.name} can assist Reflect and other model-powered workflows.` : 'Source records will still sync, but semantic knowledge extraction will be limited until a model is connected.'}</small>
              </span>
              <Button size="sm" variant="outline" onClick={props.onOpenConnections}>{provider ? 'Manage' : 'Connect model'}</Button>
            </div>
          </div>

          <div className="settings-pane-section-title">Dream</div>
          <div className="settings-section">
            <div className="settings-row">
              <div className="settings-row-label">
                <div className="settings-row-title">Let Pod Dream automatically</div>
                <div className="settings-row-desc">Dream checks relationships, conflicts, duplicates, and stale knowledge without changing original source records.</div>
              </div>
              <div className="settings-row-control">
                <Switch
                  aria-label="Let Pod Dream automatically"
                  checked={dream.mode !== 'manual_only'}
                  disabled={busy !== null}
                  onCheckedChange={checked => void save(
                    'maintenance-schedule',
                    () => patchNamespace<DreamCadenceState>('pod.dream_cadence', {
                      mode: checked ? 'daily' : 'manual_only',
                      interval_seconds: checked ? 24 * 60 * 60 : null,
                    }),
                    setDream,
                  )}
                />
              </div>
            </div>
            <div className="settings-memory-status-grid">
              <div><span>Last Dream</span><strong>{dream.last_dreamed_at ? settingsTimestamp(dream.last_dreamed_at) : 'Not yet'}</strong></div>
              <div><span>Next Dream</span><strong>{dream.mode === 'manual_only' ? 'Manual' : settingsTimestamp(dream.next_dream_after)}</strong></div>
            </div>
            <div className="settings-memory-actions">
              <Button size="sm" variant="outline" onClick={() => void runMaintenance()} disabled={busy !== null}>
                {busy === 'maintenance-now' ? <><Loader2 size={14} className="spin" /> Dreaming…</> : <><RefreshCw size={14} /> Dream now</>}
              </Button>
            </div>
          </div>

        </>
      )}
    </>
  );
}

interface SupportDiagnosticReport {
  schema_version: string;
  generated_at: string;
  privacy: {
    memory_content_included: boolean;
    user_identifiers_included: boolean;
    credentials_included: boolean;
    raw_logs_included: boolean;
    report_persisted_by_pod: boolean;
    automatic_upload: boolean;
  };
  runtime: {
    pod_version: string;
    smartware_version: string;
    platform: string;
    architecture: string;
    mode: string;
  };
  pod_database: { quick_check: string };
  operations: { total: number; intent_records: number; malformed_intent_records: number };
  recent_errors: { events: unknown[] };
  summary: { status: 'ok' | 'attention_required'; issue_codes: string[] };
}

function SettingsSupport(props: { authToken: string }) {
  const [preview, setPreview] = React.useState<SupportDiagnosticReport | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function createPreview() {
    setLoading(true);
    setError(null);
    try {
      setPreview(await getJson<SupportDiagnosticReport>('/pod/diagnostics', props.authToken));
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : 'Diagnostics could not be generated safely.');
    } finally {
      setLoading(false);
    }
  }

  function downloadPreview() {
    if (!preview) return;
    const timestamp = preview.generated_at.replace(/[:.]/g, '-');
    const blob = new Blob([`${JSON.stringify(preview, null, 2)}\n`], { type: 'application/json' });
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `coffee-pod-diagnostics-${timestamp}.json`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }

  return (
    <>
      <SettingsPaneHeader title="Help & diagnostics" subtitle="Check Pod’s health and create a report you can inspect before sharing." />

      <div className="settings-diagnostics-privacy">
        <ShieldCheck size={18} />
        <div>
          <strong>Content-free by design</strong>
          <span>No memories, documents, prompts, user identifiers, filesystem paths, credentials, or raw logs. Nothing is uploaded automatically.</span>
        </div>
      </div>

      {error && <div className="settings-inline-error">{error}</div>}

      <div className="settings-section">
        <div className="settings-row">
          <div className="settings-row-label">
            <div className="settings-row-title">Diagnostics report</div>
            <div className="settings-row-desc">Checks Pod and Smartware health, incomplete changes, connection states, and recent content-free error fingerprints.</div>
          </div>
          <div className="settings-row-control">
            <Button size="sm" onClick={createPreview} disabled={loading}>
              {loading ? <><Loader2 size={14} className="spin" /> Checking…</> : preview ? 'Refresh preview' : 'Create preview'}
            </Button>
          </div>
        </div>
      </div>

      {preview && (
        <div className="settings-diagnostics-result">
          <div className="settings-diagnostics-summary">
            <span className={`settings-diagnostics-status ${preview.summary.status}`}>
              {preview.summary.status === 'ok' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              {preview.summary.status === 'ok' ? 'Healthy' : 'Attention required'}
            </span>
            <span>Pod {preview.runtime.pod_version} · Smartware {preview.runtime.smartware_version}</span>
          </div>

          <div className="settings-diagnostics-grid">
            <SettingsReadonlyRow label="Database" value={preview.pod_database.quick_check} />
            <SettingsReadonlyRow label="Operations" value={String(preview.operations.total)} />
            <SettingsReadonlyRow label="Incomplete changes" value={String(preview.operations.intent_records)} />
            <SettingsReadonlyRow label="Recent errors" value={String(preview.recent_errors.events.length)} />
          </div>

          {preview.summary.issue_codes.length > 0 && (
            <div className="settings-diagnostics-issues">
              <strong>Reported issues</strong>
              <div>{preview.summary.issue_codes.map(code => <code key={code}>{code}</code>)}</div>
            </div>
          )}

          <details className="settings-diagnostics-preview">
            <summary>Review the exact JSON</summary>
            <div className="settings-code-block"><pre>{JSON.stringify(preview, null, 2)}</pre></div>
          </details>

          <Button size="sm" variant="outline" onClick={downloadPreview}>
            <Download size={14} /> Download diagnostics JSON
          </Button>
        </div>
      )}
    </>
  );
}

interface BackupExportResponse {
  output_path: string;
  size_bytes: number;
  file_count: number;
  warning: string;
}

interface BackupImportResponse {
  status: 'staged';
  restart_required: true;
  file_count: number;
  note: string;
}

function SettingsStorage(props: { authToken: string; runtime: PodRuntime | null }) {
  const [busy, setBusy] = React.useState<'backup' | 'restore' | null>(null);
  const [result, setResult] = React.useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [restoreStaged, setRestoreStaged] = React.useState(false);

  async function responseError(response: Response, fallback: string): Promise<Error> {
    try {
      const body = await response.json() as { error?: { message?: string } };
      return new Error(body.error?.message || fallback);
    } catch {
      return new Error(fallback);
    }
  }

  async function createBackup() {
    setBusy('backup');
    setResult(null);
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const suggestedName = `coffee-pod-${timestamp}.tar.gz`;
      const destination = window.coffeePod?.chooseBackupDestination
        ? await window.coffeePod.chooseBackupDestination(suggestedName)
        : undefined;
      if (destination === null) return;
      const response = await fetch('/pod/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders(props.authToken) },
        body: JSON.stringify(destination
          ? { output_dir: destination.outputDir, filename: destination.filename }
          : { filename: suggestedName }),
      });
      if (!response.ok) throw await responseError(response, `Backup failed (${response.status})`);
      const backup = await response.json() as BackupExportResponse;
      const size = backup.size_bytes < 1024 * 1024
        ? `${Math.max(1, Math.round(backup.size_bytes / 1024))} KB`
        : `${(backup.size_bytes / (1024 * 1024)).toFixed(1)} MB`;
      setResult({
        kind: 'success',
        message: `Backup verified: ${backup.file_count} files, ${size}. Saved to ${backup.output_path}`,
      });
    } catch (error) {
      setResult({ kind: 'error', message: error instanceof Error ? error.message : 'Backup failed.' });
    } finally {
      setBusy(null);
    }
  }

  async function stageRestore() {
    setResult(null);
    if (!window.coffeePod?.chooseBackupSource) {
      setResult({ kind: 'error', message: 'Restore file selection is available in the Pod desktop app.' });
      return;
    }
    const inputPath = await window.coffeePod.chooseBackupSource();
    if (!inputPath) return;
    if (!window.confirm('Restore this backup? Current Pod memory will be replaced on restart. A backup of the current Pod is recommended first.')) return;

    setBusy('restore');
    try {
      const response = await fetch('/pod/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders(props.authToken) },
        body: JSON.stringify({ input_path: inputPath, confirm: true }),
      });
      if (!response.ok) throw await responseError(response, `Restore validation failed (${response.status})`);
      const restored = await response.json() as BackupImportResponse;
      setRestoreStaged(true);
      setResult({
        kind: 'success',
        message: `Backup verified. ${restored.file_count} files are staged and no live data has changed yet.`,
      });
    } catch (error) {
      setResult({ kind: 'error', message: error instanceof Error ? error.message : 'Restore validation failed.' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <SettingsPaneHeader title="Data & backup" subtitle="See where your Pod lives and keep a recoverable copy." />

      <div className="settings-storage-warning">
        <ShieldCheck size={18} />
        <div>
          <strong>Private by design</strong>
          <span>Backups contain your memory, documents, access settings, and may include connector credentials. They are never uploaded by the Pod.</span>
        </div>
      </div>

      {result && (
        <div className={result.kind === 'success' ? 'settings-inline-success' : 'settings-inline-error'}>
          {result.message}
        </div>
      )}

      <div className="settings-section">
        {props.runtime && (
          <SettingsReadonlyRow label="Data folder" value={props.runtime.data_dir} mono copyable />
        )}
        <div className="settings-row">
          <div className="settings-row-label">
            <div className="settings-row-title">Back up this Pod</div>
            <div className="settings-row-desc">Creates a checksummed snapshot of memory, documents, attachments, settings, and the Pod database.</div>
          </div>
          <div className="settings-row-control">
            <Button size="sm" onClick={createBackup} disabled={busy !== null || restoreStaged}>
              {busy === 'backup' ? <><Loader2 size={14} className="spin" /> Verifying…</> : <><Download size={14} /> Create backup</>}
            </Button>
          </div>
        </div>

        <div className="settings-row">
          <div className="settings-row-label">
            <div className="settings-row-title">Restore from backup</div>
            <div className="settings-row-desc">Validates every file first. The restore is applied only after the Pod restarts, before its databases open.</div>
          </div>
          <div className="settings-row-control">
            {restoreStaged ? (
              <Button size="sm" onClick={() => window.coffeePod?.restart?.()}>
                <RotateCcw size={14} /> Restart and restore
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={stageRestore} disabled={busy !== null}>
                {busy === 'restore' ? <><Loader2 size={14} className="spin" /> Checking…</> : <><Upload size={14} /> Choose backup</>}
              </Button>
            )}
          </div>
        </div>
      </div>

      {restoreStaged && !window.coffeePod?.restart && (
        <div className="settings-coming-soon"><Info size={18} /><p>Quit and reopen Pod to apply the staged restore.</p></div>
      )}
    </>
  );
}

function SettingsAbout(props: {
  runtime: PodRuntime | null;
  runtimeError: string | null;
  authToken: string;
  onRuntimeReload: () => Promise<void> | void;
  workspaces: PodWorkspace[];
  activeWorkspaceId: string;
  onWorkspaceCreate: (name: string, emoji: string) => Promise<PodWorkspace>;
  onWorkspaceUpdate: (workspaceId: string, values: { name?: string; emoji?: string }) => Promise<PodWorkspace>;
  onWorkspaceDelete: (workspaceId: string) => Promise<void>;
  onWorkspaceSwitch: (workspaceId: string) => void;
}) {
  const { runtime } = props;
  const [draftPodName, setDraftPodName] = React.useState('');
  const [draftDisplayName, setDraftDisplayName] = React.useState('');
  const [saving, setSaving] = React.useState<'pod-name' | 'display-name' | 'avatar' | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const avatarInputRef = React.useRef<HTMLInputElement>(null);

  const currentPodName = runtime?.pod_name_override ?? runtime?.pod_name ?? '';
  const currentDisplayName = runtime?.owner_display_name ?? '';
  React.useEffect(() => { setDraftPodName(currentPodName); }, [currentPodName]);
  React.useEffect(() => { setDraftDisplayName(currentDisplayName); }, [currentDisplayName]);

  const podNameDirty = runtime ? draftPodName.trim() !== currentPodName : false;
  const displayNameDirty = runtime ? draftDisplayName.trim() !== currentDisplayName : false;

  async function saveIdentity(key: 'display_name' | 'pod_name_override' | 'avatar_data_url', value: string | null) {
    if (!runtime) return;
    setSaving(key === 'display_name' ? 'display-name' : key === 'avatar_data_url' ? 'avatar' : 'pod-name');
    setSaveError(null);
    try {
      const res = await fetch('/pod/settings/pod.identity', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', ...authHeaders(props.authToken) },
        body: JSON.stringify({ values: { [key]: value } }),
      });
      const body = await res.json().catch(() => ({})) as { message?: string };
      if (!res.ok) throw new Error(body.message ?? `Save failed (${res.status})`);
      await props.onRuntimeReload();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(null);
    }
  }

  async function chooseAvatar(file: File | undefined) {
    if (!file) return;
    setSaveError(null);
    try {
      const dataUrl = await profileImageDataUrl(file);
      await saveIdentity('avatar_data_url', dataUrl);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Profile picture could not be saved.');
    } finally {
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  }

  return (
    <>
      <SettingsPaneHeader title="General" subtitle="Choose how you and your Pod appear in the app." />
      {props.runtimeError && (
        <div className="settings-inline-error">
          {props.runtimeError} <button className="conn-link" onClick={() => void props.onRuntimeReload()}>Try again</button>
        </div>
      )}
      {saveError && <div className="settings-inline-error">{saveError}</div>}

      {runtime && (
        <div className="settings-section">
          <div className="settings-profile-card">
            <OwnerAvatar src={runtime.owner_avatar_data_url} name={runtime.owner_display_name ?? 'Pod owner'} size={72} className="settings-profile-avatar owner-avatar" />
            <div className="settings-profile-copy">
              <strong>Profile picture</strong>
              <span>Shown in the Pod menu and beside your identity.</span>
              <div className="settings-action-row">
                <Button size="sm" variant="outline" onClick={() => avatarInputRef.current?.click()} disabled={saving !== null}>
                  {saving === 'avatar' ? 'Saving…' : runtime.owner_avatar_data_url ? 'Change picture' : 'Choose picture'}
                </Button>
                {runtime.owner_avatar_data_url && (
                  <Button size="sm" variant="outline" onClick={() => void saveIdentity('avatar_data_url', null)} disabled={saving !== null}>
                    Remove
                  </Button>
                )}
              </div>
              <input
                ref={avatarInputRef}
                className="settings-hidden-file"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={event => void chooseAvatar(event.target.files?.[0])}
              />
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-label">
              <div className="settings-row-title">Your name</div>
              <div className="settings-row-desc">Shown in Pod and beside documents you change.</div>
            </div>
            <div className="settings-row-control">
              <input
                type="text"
                className="settings-input"
                value={draftDisplayName}
                onChange={(e) => setDraftDisplayName(e.target.value)}
                disabled={saving !== null}
                placeholder="Your name"
                autoComplete="name"
                maxLength={80}
              />
              {displayNameDirty && (
                <Button size="sm" onClick={() => void saveIdentity('display_name', draftDisplayName.trim())} disabled={saving !== null || !draftDisplayName.trim()}>
                  {saving === 'display-name' ? 'Saving…' : 'Save'}
                </Button>
              )}
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-label">
              <div className="settings-row-title">Pod name</div>
              <div className="settings-row-desc">Shown in the sidebar and to apps you connect. Default: {runtime.pod_name}</div>
            </div>
            <div className="settings-row-control">
              <input
                type="text"
                className="settings-input"
                value={draftPodName}
                onChange={(e) => setDraftPodName(e.target.value)}
                disabled={saving !== null}
                placeholder={runtime.pod_name}
                maxLength={80}
              />
              {podNameDirty ? (
                <Button size="sm" onClick={() => void saveIdentity('pod_name_override', draftPodName.trim() || null)} disabled={saving !== null}>
                  {saving === 'pod-name' ? 'Saving…' : 'Save'}
                </Button>
              ) : runtime.pod_name_override ? (
                <Button size="sm" variant="outline" onClick={() => void saveIdentity('pod_name_override', null)} disabled={saving !== null}>Use default</Button>
              ) : null}
            </div>
          </div>

          <details className="settings-diagnostics-preview">
            <summary>Technical identity details</summary>
            <SettingsReadonlyRow label="Pod ID" value={runtime.pod_id} mono copyable />
            <SettingsReadonlyRow label="Owner ID" value={runtime.owner_id} mono copyable />
            <SettingsReadonlyRow label="Pod address" value={runtime.pod_url} mono copyable />
          </details>
        </div>
      )}

      <SettingsWorkspaces
        workspaces={props.workspaces}
        activeWorkspaceId={props.activeWorkspaceId}
        onCreate={props.onWorkspaceCreate}
        onUpdate={props.onWorkspaceUpdate}
        onDelete={props.onWorkspaceDelete}
        onSwitch={props.onWorkspaceSwitch}
      />
    </>
  );
}

function SettingsWorkspaceRow(props: {
  workspace: PodWorkspace;
  active: boolean;
  onUpdate: (values: { name?: string; emoji?: string }) => Promise<PodWorkspace>;
  onDelete: () => Promise<void>;
  onSwitch: () => void;
}) {
  const [name, setName] = React.useState(props.workspace.name);
  const [emoji, setEmoji] = React.useState(props.workspace.emoji);
  const [busy, setBusy] = React.useState<'save' | 'delete' | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    setName(props.workspace.name);
    setEmoji(props.workspace.emoji);
  }, [props.workspace.name, props.workspace.emoji]);
  const dirty = name.trim() !== props.workspace.name || emoji.trim() !== props.workspace.emoji;

  async function save() {
    setBusy('save');
    setError(null);
    try {
      await props.onUpdate({ name: name.trim(), emoji: emoji.trim() || DEFAULT_WORKSPACE_EMOJI });
    } catch (saveError) {
      setError(workspaceRequestErrorMessage(saveError, 'Workspace could not be updated.'));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy('delete');
    setError(null);
    try {
      await props.onDelete();
    } catch (deleteError) {
      setError(workspaceRequestErrorMessage(deleteError, 'Workspace could not be deleted.'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={`settings-workspace-row${props.active ? ' active' : ''}`}>
      <WorkspaceEmojiPicker value={emoji} onChange={setEmoji} label={`Choose ${props.workspace.name} icon`} />
      <input className="settings-input settings-workspace-name" value={name} onChange={event => setName(event.target.value)} maxLength={60} aria-label={`${props.workspace.name} workspace name`} />
      <div className="settings-workspace-actions">
        {dirty && <Button size="sm" onClick={() => void save()} disabled={busy !== null || !name.trim()}>{busy === 'save' ? 'Saving…' : 'Save'}</Button>}
        {!props.active && <Button size="sm" variant="outline" onClick={props.onSwitch} disabled={busy !== null}>Switch</Button>}
        {props.active && <span className="settings-workspace-current">Current</span>}
        {!props.workspace.is_default && (
          <Button size="sm" variant="outline" onClick={() => void remove()} disabled={busy !== null}>
            {busy === 'delete' ? 'Deleting…' : 'Delete'}
          </Button>
        )}
      </div>
      {error && <div className="settings-inline-error settings-workspace-error">{error}</div>}
    </div>
  );
}

function SettingsWorkspaces(props: {
  workspaces: PodWorkspace[];
  activeWorkspaceId: string;
  onCreate: (name: string, emoji: string) => Promise<PodWorkspace>;
  onUpdate: (workspaceId: string, values: { name?: string; emoji?: string }) => Promise<PodWorkspace>;
  onDelete: (workspaceId: string) => Promise<void>;
  onSwitch: (workspaceId: string) => void;
}) {
  const [adding, setAdding] = React.useState(false);
  const [name, setName] = React.useState('');
  const [emoji, setEmoji] = React.useState(DEFAULT_WORKSPACE_EMOJI);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function create() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await props.onCreate(name.trim(), emoji.trim() || DEFAULT_WORKSPACE_EMOJI);
      setName('');
      setEmoji(DEFAULT_WORKSPACE_EMOJI);
      setAdding(false);
    } catch (createError) {
      setError(workspaceRequestErrorMessage(createError, 'Workspace could not be created.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="settings-pane-section-title settings-workspaces-title">
        <span>Workspaces</span>
        {!adding && <Button size="sm" variant="outline" onClick={() => setAdding(true)}><Plus size={14} /> Add workspace</Button>}
      </div>
      <p className="settings-row-desc settings-workspaces-description">Each workspace keeps its documents, memories, and activity separate.</p>
      <div className="settings-section settings-workspaces">
        {props.workspaces.map(workspace => (
          <SettingsWorkspaceRow
            key={workspace.id}
            workspace={workspace}
            active={workspace.id === props.activeWorkspaceId}
            onUpdate={values => props.onUpdate(workspace.id, values)}
            onDelete={() => props.onDelete(workspace.id)}
            onSwitch={() => props.onSwitch(workspace.id)}
          />
        ))}
        {adding && (
          <div className="settings-workspace-row">
            <WorkspaceEmojiPicker value={emoji} onChange={setEmoji} label="Choose new workspace icon" />
            <input
              className="settings-input settings-workspace-name"
              value={name}
              onChange={event => setName(event.target.value)}
              onKeyDown={event => { if (event.key === 'Enter') void create(); }}
              placeholder="Workspace name"
              maxLength={60}
              aria-label="New workspace name"
              autoFocus
            />
            <div className="settings-workspace-actions">
              <Button size="sm" variant="outline" onClick={() => { setAdding(false); setError(null); }} disabled={saving}>Cancel</Button>
              <Button size="sm" onClick={() => void create()} disabled={saving || !name.trim()}>{saving ? 'Creating…' : 'Create'}</Button>
            </div>
            {error && <div className="settings-inline-error settings-workspace-error">{error}</div>}
          </div>
        )}
      </div>
    </>
  );
}

function SettingsAppearance(props: { theme: 'dark' | 'light' | 'auto'; onThemeChange: (t: 'dark' | 'light' | 'auto') => void; sidebarCollapsedDefault: boolean; onSidebarCollapsedDefaultChange: (v: boolean) => void }) {
  return (
    <>
      <SettingsPaneHeader title="Appearance" subtitle="Choose how Pod looks when you use it." />
      <div className="settings-section">
        <div className="settings-row">
          <div className="settings-row-label">
            <div className="settings-row-title">Theme</div>
            <div className="settings-row-desc">Choose a theme or follow your system preference.</div>
          </div>
          <div className="settings-row-control">
            <div className="settings-segmented">
              <button aria-pressed={props.theme === 'light'} className={props.theme === 'light' ? 'active' : ''} onClick={() => props.onThemeChange('light')}>Light</button>
              <button aria-pressed={props.theme === 'auto'} className={props.theme === 'auto' ? 'active' : ''} onClick={() => props.onThemeChange('auto')}>System</button>
              <button aria-pressed={props.theme === 'dark'} className={props.theme === 'dark' ? 'active' : ''} onClick={() => props.onThemeChange('dark')}>Dark</button>
            </div>
          </div>
        </div>

        <div className="settings-row">
          <div className="settings-row-label">
            <div className="settings-row-title">Sidebar at launch</div>
            <div className="settings-row-desc">Choose how much navigation Pod shows when it opens.</div>
          </div>
          <div className="settings-row-control">
            <div className="settings-segmented">
              <button aria-pressed={!props.sidebarCollapsedDefault} className={!props.sidebarCollapsedDefault ? 'active' : ''} onClick={() => props.onSidebarCollapsedDefaultChange(false)}>Expanded</button>
              <button aria-pressed={props.sidebarCollapsedDefault} className={props.sidebarCollapsedDefault ? 'active' : ''} onClick={() => props.onSidebarCollapsedDefaultChange(true)}>Collapsed</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

interface ConnectedClient {
  client_id: string;
  client_name: string;
  pod_url: string;
  actor_id: string;
  grant_id: string;
  token_prefix: string;
  created_at: string;
  last_used_at?: string;
  revoked_at?: string;
}

function SettingsAccess(props: { authToken: string; onLockPod: () => void; onPinChanged?: () => void }) {
  const [pinEnabled, setPinEnabled] = React.useState(false);
  const [defaults, setDefaults] = React.useState<MemoryDefaultsSettings | null>(null);
  const [defaultsBusy, setDefaultsBusy] = React.useState(false);
  const [defaultsError, setDefaultsError] = React.useState<string | null>(null);
  React.useEffect(() => {
    fetch('/pod/pin/status').then(r => r.json()).then(d => setPinEnabled(d.has_pin)).catch(() => {});
  }, []);
  const handlePinChanged = () => {
    fetch('/pod/pin/status').then(r => r.json()).then(d => setPinEnabled(d.has_pin)).catch(() => {});
    props.onPinChanged?.();
  };
  const [clients, setClients] = React.useState<ConnectedClient[] | null>(null);
  const [clientsError, setClientsError] = React.useState<string | null>(null);
  const [revoking, setRevoking] = React.useState<string | null>(null);

  const loadClients = React.useCallback(async () => {
    try {
      const data = await getJson<{ clients: ConnectedClient[] }>('/coffee/clients', props.authToken);
      setClients(data.clients);
      setClientsError(null);
    } catch (err) {
      setClients([]);
      setClientsError(err instanceof Error ? err.message : 'Failed to load clients');
    }
  }, [props.authToken]);

  React.useEffect(() => { void loadClients(); }, [loadClients]);
  React.useEffect(() => {
    getJson<{ values: MemoryDefaultsSettings }>('/pod/settings/pod.memory_defaults', props.authToken)
      .then(response => { setDefaults(response.values); setDefaultsError(null); })
      .catch(error => setDefaultsError(error instanceof Error ? error.message : 'Privacy defaults could not be loaded.'));
  }, [props.authToken]);

  async function saveDefaults(values: Partial<MemoryDefaultsSettings>) {
    setDefaultsBusy(true);
    setDefaultsError(null);
    try {
      const response = await fetch('/pod/settings/pod.memory_defaults', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', ...authHeaders(props.authToken) },
        body: JSON.stringify({ values }),
      });
      const body = await response.json() as { values?: MemoryDefaultsSettings; message?: string };
      if (!response.ok || !body.values) throw new Error(body.message ?? `Pod returned ${response.status}`);
      setDefaults(body.values);
    } catch (error) {
      setDefaultsError(error instanceof Error ? error.message : 'Privacy defaults could not be saved.');
    } finally {
      setDefaultsBusy(false);
    }
  }

  async function revoke(clientId: string) {
    if (!window.confirm('Revoke this client? It will need to pair again to call the Pod.')) return;
    setRevoking(clientId);
    try {
      const res = await fetch(`/coffee/clients/${encodeURIComponent(clientId)}/revoke`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders(props.authToken) },
      });
      if (!res.ok) throw new Error(`Revoke failed (${res.status})`);
      await loadClients();
    } catch (err) {
      setClientsError(err instanceof Error ? err.message : 'Revoke failed');
    } finally {
      setRevoking(null);
    }
  }

  const activeClients = (clients ?? []).filter(c => !c.revoked_at);

  return (
    <>
      <SettingsPaneHeader title="Privacy & security" subtitle="Protect your Pod and choose how new memories can be used." />

      <div className="settings-pane-section-title">Device lock</div>
      <div className="settings-section">
        <PINSetup hasPin={pinEnabled} authToken={props.authToken} onChanged={handlePinChanged} />
        {pinEnabled && (
          <div className="settings-action-row">
            <Button size="sm" variant="outline" onClick={props.onLockPod}>
              <Lock size={14} /> Lock now
            </Button>
          </div>
        )}
      </div>

      <div className="settings-pane-section-title">New memories</div>
      {defaultsError && <div className="settings-inline-error">{defaultsError}</div>}
      <div className="settings-memory-privacy-note">
        <ShieldCheck size={18} />
        <div>
          <strong>Defaults for new memory</strong>
          <span>Changing these choices does not alter memories you already have.</span>
        </div>
      </div>
      <div className="settings-section">
        <div className="settings-row">
          <div className="settings-row-label">
            <div className="settings-row-title">Who can use new memories</div>
            <div className="settings-row-desc">Connections can still apply a more specific rule when they save something.</div>
          </div>
          <div className="settings-row-control">
            {defaults ? (
              <select
                className="settings-select"
                aria-label="Who can use new memories"
                value={defaults.default_visibility}
                disabled={defaultsBusy}
                onChange={event => void saveDefaults({ default_visibility: event.target.value as MemoryVisibilitySetting })}
              >
                <option value="private">Only this data space</option>
                <option value="scope">The source it came from · Recommended</option>
                <option value="workspace">Anywhere in this Pod</option>
                <option value="public">Across all data spaces · Advanced</option>
              </select>
            ) : <span className="settings-token-prefix">Loading…</span>}
          </div>
        </div>
        <div className="settings-row">
          <div className="settings-row-label">
            <div className="settings-row-title">Protect new memories by default</div>
            <div className="settings-row-desc">Protected memory stays out of ordinary search unless you explicitly include it.</div>
          </div>
          <div className="settings-row-control">
            <Switch
              aria-label="Protect new memories by default"
              checked={defaults?.default_sensitive ?? false}
              disabled={!defaults || defaultsBusy}
              onCheckedChange={checked => void saveDefaults({ default_sensitive: checked })}
            />
          </div>
        </div>
      </div>

      <div className="settings-pane-section-title">Paired Coffee apps</div>

      {clientsError && <div className="settings-inline-error">{clientsError}</div>}

      {clients === null ? (
        <div className="settings-empty">Loading…</div>
      ) : activeClients.length === 0 ? (
        <div className="settings-empty">No Coffee apps are paired with this Pod.</div>
      ) : (
        <div className="settings-client-list">
          {activeClients.map(client => (
            <div key={client.client_id} className="settings-client-row">
              <div className="settings-client-meta">
                <div className="settings-client-name">{client.client_name}</div>
                <div className="settings-client-detail">
                  <span title={client.created_at}>Paired {timeAgo(client.created_at)}</span>
                  {client.last_used_at && <><span>·</span><span title={client.last_used_at}>Last used {timeAgo(client.last_used_at)}</span></>}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => revoke(client.client_id)} disabled={revoking === client.client_id}>
                {revoking === client.client_id ? 'Revoking…' : 'Revoke'}
              </Button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function SettingsReadonlyRow(props: { label: string; value: string; mono?: boolean; copyable?: boolean }) {
  const [copied, setCopied] = React.useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(props.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  }
  return (
    <div className="settings-row">
      <div className="settings-row-label">
        <div className="settings-row-title">{props.label}</div>
      </div>
      <div className={`settings-row-control settings-row-readonly ${props.mono ? 'mono' : ''}`}>
        <span title={props.value}>{props.value}</span>
        {props.copyable && (
          <button className="settings-copy-btn" onClick={copy} title="Copy">
            {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
          </button>
        )}
      </div>
    </div>
  );
}

const MCP_TOOLS: Array<{ name: string; desc: string }> = [
  { name: 'pod_query', desc: 'Query memory with optional LLM synthesis' },
  { name: 'pod_observe', desc: 'Write an observation into Pod memory' },
  { name: 'pod_compile', desc: 'Compile memory into searchable pages' },
  { name: 'pod_read', desc: 'Read an entity page or browse a scope' },
  { name: 'pod_explain', desc: 'Trace provenance for a claim or entity' },
  { name: 'pod_correct', desc: 'Correct an existing claim' },
  { name: 'pod_forget', desc: 'Forget a claim, observation, or object' },
  { name: 'pod_activity', desc: 'List Pod activity events' },
  { name: 'pod_session_start', desc: 'Start a work session' },
  { name: 'pod_session_checkpoint', desc: 'Record a session checkpoint' },
  { name: 'pod_session_end', desc: 'Summarize and close a session' },
  { name: 'pod_approvals', desc: 'List actions awaiting review' },
  { name: 'pod_agent_action_propose', desc: 'Propose an action for review' },
  { name: 'pod_agent_action_approve', desc: 'Approve a proposed action' },
  { name: 'pod_agent_action_reject', desc: 'Reject a proposed action' },
];

interface ExternalMcpServer {
  id: string;
  name: string;
  enabled: boolean;
  transport: 'stdio' | 'http';
  command?: string;
  args?: string[];
  url?: string;
  allowed_tools?: string[];
  context_tools?: Array<{ name: string; query_arg?: string; arguments?: Record<string, unknown> }>;
  env_keys: string[];
  header_keys: string[];
  updated_at: string;
}

interface ExternalMcpTool {
  name: string;
  description?: string;
  read_only_allowed: boolean;
  annotations?: { readOnlyHint?: boolean; title?: string };
}

const EXTERNAL_MCP_TEMPLATE = {
  id: 'github-readonly',
  name: 'GitHub read-only',
  enabled: true,
  transport: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github'],
  env: {
    GITHUB_PERSONAL_ACCESS_TOKEN: 'replace-me',
  },
  context_tools: [
    { name: 'search_repositories', query_arg: 'query' },
  ],
  allowed_tools: [],
};

function ExternalMcpConnectors(props: { authToken: string }) {
  const [servers, setServers] = React.useState<ExternalMcpServer[]>([]);
  const [draft, setDraft] = React.useState(() => JSON.stringify(EXTERNAL_MCP_TEMPLATE, null, 2));
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [toolServerId, setToolServerId] = React.useState<string | null>(null);
  const [tools, setTools] = React.useState<Record<string, ExternalMcpTool[]>>({});

  const loadServers = React.useCallback(async () => {
    try {
      const data = await getJson<{ servers: ExternalMcpServer[] }>('/pod/mcp/servers', props.authToken);
      setServers(data.servers);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Live MCP connections could not be loaded.');
    }
  }, [props.authToken]);

  React.useEffect(() => { void loadServers(); }, [loadServers]);

  async function saveServer() {
    setSaving(true);
    setError(null);
    try {
      const body = JSON.parse(draft) as Record<string, unknown>;
      await postJson('/pod/mcp/servers', props.authToken, body);
      await loadServers();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Check the MCP source configuration and try again.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteServer(serverId: string) {
    if (!window.confirm('Remove this live MCP source?')) return;
    try {
      const response = await fetch(`/pod/mcp/servers/${encodeURIComponent(serverId)}`, {
        method: 'DELETE',
        headers: authHeaders(props.authToken),
      });
      if (!response.ok) throw new Error(`Remove failed (${response.status})`);
      await loadServers();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'The live MCP source could not be removed.');
    }
  }

  async function loadTools(serverId: string) {
    setToolServerId(serverId);
    setError(null);
    try {
      const data = await getJson<{ tools: ExternalMcpTool[] }>(`/pod/mcp/servers/${encodeURIComponent(serverId)}/tools`, props.authToken);
      setTools(previous => ({ ...previous, [serverId]: data.tools }));
    } catch (toolsError) {
      setError(toolsError instanceof Error ? toolsError.message : 'Tools could not be loaded.');
    } finally {
      setToolServerId(null);
    }
  }

  return (
    <div className="connections-external-mcp">
      <div className="connections-section-label">
        <span>Live MCP connections</span>
        {servers.length > 0 && <span className="connections-section-count">{servers.length}</span>}
      </div>
      <p className="connection-detail">Read-only MCP tools can give Ask Pod live context without copying everything into memory.</p>
      {error && <div className="settings-inline-error">{error}</div>}

      {servers.length === 0 ? (
        <div className="settings-empty">No live MCP connections configured.</div>
      ) : (
        <div className="settings-client-list">
          {servers.map(server => (
            <div key={server.id} className="settings-client-row settings-mcp-server-row">
              <div className="settings-client-meta">
                <div className="settings-client-name">{server.name}</div>
                <div className="settings-client-detail">
                  <span>{server.enabled ? 'Enabled' : 'Disabled'}</span>
                  <span>·</span>
                  <span>{server.transport.toUpperCase()}</span>
                  <span>·</span>
                  <span>{server.context_tools?.length ?? 0} context tools</span>
                </div>
                {(tools[server.id] ?? []).length > 0 && (
                  <div className="settings-tools-list compact">
                    {tools[server.id].map(tool => (
                      <div key={tool.name} className="settings-tool-row">
                        <code className="settings-tool-name">{tool.name}</code>
                        <span className="settings-tool-desc">{tool.read_only_allowed ? 'Available for read-only context' : 'Blocked'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="settings-mcp-row-actions">
                <Button size="sm" variant="outline" onClick={() => void loadTools(server.id)} disabled={toolServerId === server.id}>
                  {toolServerId === server.id ? 'Loading…' : 'View tools'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => void deleteServer(server.id)}>Remove</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <details className="settings-diagnostics-preview">
        <summary>Add an advanced MCP source</summary>
        <p className="settings-row-desc">Add a read-only MCP server using its JSON configuration. Tools must declare read-only access or be explicitly allowed.</p>
        <textarea className="settings-mcp-json" value={draft} onChange={event => setDraft(event.target.value)} spellCheck={false} />
        <div className="settings-action-row">
          <Button size="sm" variant="outline" onClick={() => void saveServer()} disabled={saving}>
            {saving ? 'Saving…' : 'Add source'}
          </Button>
        </div>
      </details>
    </div>
  );
}

/* First-run setup uses the same persisted settings as the main app. */

interface OnboardingPersistResult {
  field: string;
  ok: boolean;
  message: string;
}

async function loadOnboardingCurrentConfig(authToken: string): Promise<Partial<ExpandedConfig>> {
  const safe = async <T,>(path: string, fallback: T): Promise<T> => {
    try { return await getJson<T>(path, authToken); }
    catch { return fallback; }
  };

  type SettingsResp = { values: Record<string, unknown> };
  type StatusResp = { configured?: boolean; connected?: boolean };
  type RuntimeResp = { owner_display_name?: string | null };

  const [runtime, cadence, identity, anthropic, openai, codex] = await Promise.all([
    safe<RuntimeResp>('/pod/runtime', {}),
    safe<SettingsResp>('/pod/settings/pod.reflect_cadence', { values: {} }),
    safe<SettingsResp>('/pod/settings/pod.identity', { values: {} }),
    safe<{ anthropic?: StatusResp }>('/integrations/anthropic/status', {}),
    safe<{ openai?: StatusResp }>('/integrations/openai/status', {}),
    safe<{ connected?: boolean }>('/providers/codex/status', {}),
  ]);

  const cadenceMode = (cadence.values['mode'] as string | undefined);

  // Detect existing LLM provider from /integrations/*/status. We don't prefill
  // the API key field — the backend doesn't (and shouldn't) return it. The
  // persister treats an empty key as "leave existing as-is".
  let detectedProvider: ExpandedConfig['llm_provider'] = 'none';
  let providerConfigured = false;
  if (codex.connected) detectedProvider = 'codex';
  else if (anthropic.anthropic?.configured) detectedProvider = 'anthropic';
  else if (openai.openai?.configured) detectedProvider = 'openai';
  providerConfigured = detectedProvider !== 'none';

  const legacySlug = identity.values['user_slug'];
  const legacyName = typeof legacySlug === 'string'
    ? legacySlug.split(/[-_]+/).filter(Boolean).map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(' ')
    : '';

  return {
    display_name: (identity.values['display_name'] as string | undefined) ?? runtime.owner_display_name ?? legacyName,
    llm_provider: detectedProvider,
    llm_auth_method: providerConfigured ? detectedProvider === 'codex' ? 'account' : 'api_key' : undefined,
    llm_provider_configured: providerConfigured,
    reflect_cadence: normalizeReflectionCadence(cadenceMode),
  };
}

async function persistOnboardingConfig(cfg: ExpandedConfig, authToken: string): Promise<OnboardingPersistResult[]> {
  const results: OnboardingPersistResult[] = [];
  const patchSettings = async (namespace: string, values: Record<string, unknown>): Promise<void> => {
    const res = await fetch(`/pod/settings/${namespace}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...authHeaders(authToken) },
      body: JSON.stringify({ values }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  };

  // 1. LLM provider + API key
  if ((cfg.llm_provider === 'anthropic' || cfg.llm_provider === 'openai') && cfg.llm_api_key && cfg.llm_api_key.trim().length > 0) {
    try {
      await postJson(`/integrations/${cfg.llm_provider}/configure`, authToken, { api_key: cfg.llm_api_key.trim() });
      results.push({ field: 'LLM provider', ok: true, message: `${cfg.llm_provider} API key stored` });
    } catch (err) {
      results.push({ field: 'LLM provider', ok: false, message: err instanceof Error ? err.message : String(err) });
    }
  } else if (cfg.llm_provider === 'codex' && cfg.llm_provider_configured) {
    try {
      await postJson('/providers/codex/select', authToken, {});
      results.push({ field: 'LLM provider', ok: true, message: 'Codex connected with ChatGPT' });
    } catch (err) {
      results.push({ field: 'LLM provider', ok: false, message: err instanceof Error ? err.message : String(err) });
    }
  } else if (cfg.llm_provider === 'none') {
    results.push({ field: 'LLM provider', ok: true, message: 'not connected' });
  } else if (cfg.llm_provider_configured) {
    results.push({ field: 'LLM provider', ok: true, message: `${cfg.llm_provider} — existing key kept` });
  } else {
    results.push({ field: 'LLM provider', ok: true, message: `${cfg.llm_provider} — connect later` });
  }

  // 2. Reflect cadence
  try {
    await patchSettings('pod.reflect_cadence', { mode: cfg.reflect_cadence, interval_seconds: reflectionIntervalSeconds(cfg.reflect_cadence) });
    results.push({ field: 'Reflect cadence', ok: true, message: cfg.reflect_cadence });
  } catch (err) {
    results.push({ field: 'Reflect cadence', ok: false, message: err instanceof Error ? err.message : String(err) });
  }

  // 3. Display name
  if (cfg.display_name.trim()) {
    try {
      await patchSettings('pod.identity', { display_name: cfg.display_name.trim() });
      results.push({ field: 'Your name', ok: true, message: cfg.display_name.trim() });
    } catch (err) {
      results.push({ field: 'Your name', ok: false, message: err instanceof Error ? err.message : String(err) });
    }
  } else {
    results.push({ field: 'Your name', ok: false, message: 'A name is required' });
  }

  // Completion is the commit marker for the first-run gate. Only write it
  // after every persisted field above succeeded so a partial setup remains
  // resumable instead of disappearing behind the app shell.
  if (results.every(result => result.ok)) {
    try {
      await patchSettings('pod.onboarding', {
        completed: true,
        version: 1,
        skipped: false,
        completed_at: new Date().toISOString(),
      });
      results.push({ field: 'Onboarding', ok: true, message: 'complete' });
    } catch (err) {
      results.push({ field: 'Onboarding', ok: false, message: err instanceof Error ? err.message : String(err) });
    }
  }

  return results;
}

function SettingsSemanticSearch(props: { authToken: string; onOpenConnections: () => void }) {
  const [retrieval, setRetrieval] = React.useState<RetrievalSettingsState | null>(null);
  const [provider, setProvider] = React.useState<IntegrationStatus | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const [retrievalResponse, integrationsResponse] = await Promise.all([
        getJson<{ values: RetrievalSettingsState }>('/pod/settings/pod.retrieval', props.authToken),
        getJson<{ integrations: IntegrationStatus[] }>('/integrations', props.authToken).catch(() => ({ integrations: [] })),
      ]);
      setRetrieval(retrievalResponse.values);
      const capableProviders = integrationsResponse.integrations.filter(integration =>
        (integration.id === 'openai' || integration.id === 'openrouter')
        && (integration.status === 'active' || integration.status === 'configured'));
      setProvider(
        capableProviders.find(integration => integration.id === retrievalResponse.values.embedding_provider)
        ?? capableProviders.find(integration => integration.ai_default)
        ?? capableProviders[0]
        ?? null,
      );
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Search experiment settings could not be loaded.');
    }
  }, [props.authToken]);

  React.useEffect(() => { void load(); }, [load]);

  async function save(mode: RetrievalSettingsState['semantic_mode']) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/pod/settings/pod.retrieval', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', ...authHeaders(props.authToken) },
        body: JSON.stringify({
          values: {
            semantic_mode: mode,
            embedding_provider: mode === 'off' ? retrieval?.embedding_provider ?? 'active' : provider?.id,
          },
        }),
      });
      const body = await response.json() as { values?: RetrievalSettingsState; message?: string };
      if (!response.ok || !body.values) throw new Error(body.message ?? `Pod returned ${response.status}`);
      setRetrieval(body.values);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Search experiment settings could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="settings-pane-section-title">Experimental search</div>
      {error && <div className="settings-inline-error">{error}</div>}
      <div className="settings-section">
        <div className="settings-row">
          <div className="settings-row-label">
            <div className="settings-row-title">Meaning-based search</div>
            <div className="settings-row-desc">Uses an embedding model to find related ideas, not just matching words. Authorised, non-protected text may be sent to the selected provider.</div>
          </div>
          <div className="settings-row-control">
            {retrieval ? (
              <select
                className="settings-select"
                aria-label="Meaning-based search"
                value={retrieval.semantic_mode}
                disabled={busy}
                onChange={event => void save(event.target.value as RetrievalSettingsState['semantic_mode'])}
              >
                <option value="off">Off</option>
                <option value="shadow" disabled={!provider}>Compare in the background</option>
                <option value="fallback" disabled={!provider}>Use when exact search is weak</option>
              </select>
            ) : <span className="settings-token-prefix">Loading…</span>}
          </div>
        </div>
        <div className="settings-memory-provider">
          <span className="settings-memory-provider-icon"><Cloud size={15} /></span>
          <span>
            <strong>{provider?.name ?? 'No compatible model connected'}</strong>
            <small>{provider ? 'OpenAI or OpenRouter can provide meaning-based search.' : 'Connect OpenAI or OpenRouter to use this experiment.'}</small>
          </span>
          <Button size="sm" variant="outline" onClick={props.onOpenConnections}>{provider ? 'Manage' : 'Connect model'}</Button>
        </div>
      </div>
    </>
  );
}

function SettingsDevelopers(props: { runtime: PodRuntime | null; authToken: string; onOpenConnections: () => void }) {
  const [copiedConfig, setCopiedConfig] = React.useState(false);
  const [copiedUrl, setCopiedUrl] = React.useState(false);
  const [expandedTools, setExpandedTools] = React.useState(false);

  const podUrl = props.runtime?.pod_url || 'http://localhost:3577';

  const mcpConfig = JSON.stringify({
    mcpServers: {
      'coffee-pod': {
        type: 'http',
        url: `${podUrl.replace(/\/+$/, '')}/mcp`,
        headers: {
          Authorization: 'Bearer <agent token from Pod → Agents>',
        },
      },
    },
  }, null, 2);

  async function copyConfig() {
    try { await navigator.clipboard.writeText(mcpConfig); setCopiedConfig(true); setTimeout(() => setCopiedConfig(false), 1500); } catch {}
  }
  async function copyUrl() {
    try { await navigator.clipboard.writeText(podUrl); setCopiedUrl(true); setTimeout(() => setCopiedUrl(false), 1500); } catch {}
  }
  return (
    <>
      <SettingsPaneHeader title="Advanced" subtitle="Experiments and technical details for MCP clients." />

      <SettingsSemanticSearch authToken={props.authToken} onOpenConnections={props.onOpenConnections} />

      <div className="settings-pane-section-title">MCP clients</div>

      <div className="settings-section">
        <div className="settings-section-label">Connection template</div>
        <div className="settings-row-desc" style={{ padding: '0 0 12px' }}>
          Create an agent in <strong>Agents</strong> first, then use its revocable token in this HTTP MCP template.
        </div>
        <div className="settings-code-block">
          <pre>{mcpConfig}</pre>
          <button className="settings-code-copy" onClick={copyConfig}>
            {copiedConfig ? <><CheckCircle2 size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
          </button>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-label">Pod API</div>
        <div className="settings-row">
          <div className="settings-row-label">
            <div className="settings-row-title">Base URL</div>
          </div>
          <div className="settings-row-control settings-row-readonly mono">
            <span title={podUrl}>{podUrl}</span>
            <button className="settings-copy-btn" onClick={copyUrl} title="Copy">
              {copiedUrl ? <CheckCircle2 size={13} /> : <Copy size={13} />}
            </button>
          </div>
        </div>
        <div className="settings-row">
          <div className="settings-row-label">
            <div className="settings-row-title">Protocol</div>
          </div>
          <div className="settings-row-control settings-row-readonly">
            <span>Smartware v0.1 · MCP over HTTP</span>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Available tools</span>
          <span className="settings-tool-count">{MCP_TOOLS.length}</span>
        </div>
        <div className="settings-tools-list">
          {(expandedTools ? MCP_TOOLS : MCP_TOOLS.slice(0, 5)).map(tool => (
            <div key={tool.name} className="settings-tool-row">
              <code className="settings-tool-name">{tool.name}</code>
              <span className="settings-tool-desc">{tool.desc}</span>
            </div>
          ))}
          {MCP_TOOLS.length > 5 && (
            <button className="settings-tool-toggle" onClick={() => setExpandedTools(!expandedTools)}>
              {expandedTools ? 'Show less' : `Show all ${MCP_TOOLS.length} tools`}
            </button>
          )}
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-label">Quick start</div>
        <div className="settings-row-desc" style={{ padding: '4px 0 0', lineHeight: 1.8 }}>
          Open <strong>Agents</strong> to scan this Mac and connect Claude Code, Codex, Cursor, or Claude Desktop with a bounded key. Other HTTP MCP clients can use the template above.
        </div>
      </div>

    </>
  );
}

function DocumentViewsManager() {
  const ctl = useSmartViews();
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draftLabel, setDraftLabel] = React.useState('');
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = React.useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = React.useState<string | null>(null);

  function startEdit(view: SmartViewDefinition) {
    setEditingId(view.id);
    setDraftLabel(view.label);
    setMenuOpenId(null);
  }

  function commitEdit() {
    if (!editingId) return;
    const next = draftLabel.trim();
    if (next) ctl.updateCustom(editingId, { label: next });
    setEditingId(null);
    setDraftLabel('');
  }

  return (
    <>
      <div className="settings-smart-views-list">
        {ctl.views.map(view => {
          const Icon = view.icon;
          const isHidden = ctl.hiddenIds.has(view.id);
          const isEditing = editingId === view.id;
          const isDragOver = dropTargetId === view.id;
          const isCustom = Boolean(view.custom);

          return (
            <div
              key={view.id}
              className={`settings-smart-view-row ${isDragOver ? 'drop-target' : ''} ${isHidden ? 'is-hidden' : ''}`}
              draggable
              onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDragId(view.id); }}
              onDragEnd={() => { setDragId(null); setDropTargetId(null); }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTargetId(view.id); }}
              onDragLeave={() => setDropTargetId(null)}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId && dragId !== view.id) ctl.reorder(dragId, view.id);
                setDragId(null);
                setDropTargetId(null);
              }}
            >
              <span className="settings-smart-view-handle"><GripVertical size={14} /></span>
              <Icon size={15} />

              {isEditing ? (
                <input
                  autoFocus
                  className="settings-input settings-smart-view-edit-input"
                  value={draftLabel}
                  onChange={(e) => setDraftLabel(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit();
                    if (e.key === 'Escape') { setEditingId(null); setDraftLabel(''); }
                  }}
                />
              ) : (
                <span className="settings-smart-view-label">
                  {view.label}
                  {!isCustom && <span className="settings-smart-view-badge">Built-in</span>}
                </span>
              )}

              <button
                className="settings-smart-view-visibility"
                onClick={() => ctl.setHidden(view.id, !isHidden)}
                title={isHidden ? 'Show in Documents' : 'Hide from Documents'}
              >
                {isHidden ? 'Hidden' : 'Available'}
              </button>

              <DropdownMenu open={menuOpenId === view.id} onOpenChange={(o) => setMenuOpenId(o ? view.id : null)}>
                <DropdownMenuTrigger asChild>
                  <button className="settings-smart-view-menu" title="More">
                    <MoreVertical size={14} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isCustom && <DropdownMenuItem onClick={() => startEdit(view)}>Rename</DropdownMenuItem>}
                  <DropdownMenuItem onClick={() => { ctl.setHidden(view.id, !isHidden); setMenuOpenId(null); }}>
                    {isHidden ? 'Show in Documents' : 'Hide from Documents'}
                  </DropdownMenuItem>
                  {isCustom && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          if (window.confirm(`Delete "${view.label}"?`)) ctl.deleteCustom(view.id);
                          setMenuOpenId(null);
                        }}
                      >
                        Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </div>

      {ctl.views.length === 0 && (
        <div className="settings-empty">No saved filters yet. Apply filters in Documents, then choose “Save as view”.</div>
      )}
    </>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return iso;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/* ── Mount ── */
const container = document.getElementById('root')!;
const root = (container as any).__root ?? createRoot(container);
(container as any).__root = root;
root.render(<App />);
