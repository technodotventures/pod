export interface DocumentContentFields {
  text: string | null;
  body: string | null;
}

export function documentContentFields(content: unknown): DocumentContentFields {
  if (typeof content === 'string') {
    return { text: content, body: null };
  }
  const record = content as Record<string, unknown> | null | undefined;
  return {
    text: typeof record?.text === 'string' ? record.text : null,
    body: typeof record?.body === 'string' ? record.body : null,
  };
}
