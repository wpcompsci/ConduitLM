// Shared Normalization
(function (scope) {
  function normalizeSelection(raw) {
    const title = raw.title || 'Selected Text';
    const content = raw.selection || '';
    return {
      title,
      url: raw.url || '',
      sourceType: 'selection',
      content,
      metadata: { selectionLength: content.length },
    };
  }

  function normalizeWebPage(raw) {
    const title = raw.title || 'Web Page';
    const content = raw.content || '';
    return {
      title,
      url: raw.url || '',
      sourceType: 'web',
      content,
      metadata: raw.metadata || {},
    };
  }

  function formatConversation(messages) {
    const lines = [];
    for (const message of messages) {
      const role = message.role ? message.role.toUpperCase() : 'UNKNOWN';
      const content = message.content || '';
      lines.push(`${role}:\n${content}`);
    }
    return lines.join('\n\n');
  }

  function normalizeConversation(raw, platformName) {
    const title = raw.title || `${platformName} Conversation`;
    const content = formatConversation(raw.messages || []);
    return {
      title,
      url: raw.url || '',
      sourceType: platformName,
      content,
      metadata: { messageCount: raw.messages ? raw.messages.length : 0 },
    };
  }

  function normalizeGDoc(raw) {
    const title = raw.title || 'Google Doc';
    return {
      title,
      url: raw.url || '',
      sourceType: 'gdoc',
      content: '',
      metadata: { docId: raw.docId },
    };
  }

  scope.ConduitNormalize = {
    normalizeSelection,
    normalizeWebPage,
    normalizeConversation,
    normalizeGDoc,
  };
})(globalThis);
