export const DEFAULT_WORKSPACE_EMOJI = '📁';

export const WORKSPACE_EMOJI_OPTIONS = [
  { emoji: '📁', label: 'Folder' },
  { emoji: '💼', label: 'Briefcase' },
  { emoji: '🎯', label: 'Target' },
  { emoji: '🚀', label: 'Rocket' },
  { emoji: '🧭', label: 'Compass' },
  { emoji: '🏠', label: 'Home' },
  { emoji: '🏢', label: 'Office' },
  { emoji: '🛠️', label: 'Tools' },
  { emoji: '🧪', label: 'Lab' },
  { emoji: '📊', label: 'Chart' },
  { emoji: '💡', label: 'Idea' },
  { emoji: '📚', label: 'Books' },
  { emoji: '✏️', label: 'Pencil' },
  { emoji: '🎨', label: 'Palette' },
  { emoji: '📷', label: 'Camera' },
  { emoji: '🎵', label: 'Music' },
  { emoji: '🌍', label: 'Globe' },
  { emoji: '🌱', label: 'Seedling' },
  { emoji: '🌿', label: 'Leaf' },
  { emoji: '☕', label: 'Coffee' },
  { emoji: '🤝', label: 'Handshake' },
  { emoji: '👥', label: 'Team' },
  { emoji: '💬', label: 'Conversation' },
  { emoji: '❤️', label: 'Heart' },
  { emoji: '⭐', label: 'Star' },
  { emoji: '✨', label: 'Sparkles' },
  { emoji: '⚡', label: 'Lightning' },
  { emoji: '🔥', label: 'Fire' },
  { emoji: '🏆', label: 'Trophy' },
  { emoji: '💰', label: 'Money' },
] as const;

export function workspaceEmojiLabel(emoji: string): string {
  return WORKSPACE_EMOJI_OPTIONS.find(option => option.emoji === emoji)?.label ?? 'Custom icon';
}

export function workspaceRequestErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : '';
  if (
    message === 'Failed to fetch'
    || /^Route (?:GET|POST|PATCH|DELETE):\/pod\/workspaces/.test(message)
    || /^\/pod\/workspaces(?:\/\S+)? 404$/.test(message)
  ) {
    return 'Workspaces are not available in the running Pod. Close and reopen Pod, then try again.';
  }
  return message || fallback;
}
