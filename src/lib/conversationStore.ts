export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  proposal?: any;
  isError?: boolean;
  model?: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
}

const STORAGE_KEY = 'cu_assistant_v1';

// In-memory fallback
let memoryStorage: Conversation[] = [];
let useMemory = false;

export const ConversationStore = {
  getAll(): Conversation[] {
    if (useMemory) return memoryStorage;
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      useMemory = true;
      return memoryStorage;
    }
  },
  
  saveAll(conversations: Conversation[]) {
    if (useMemory) {
      memoryStorage = conversations;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch (e) {
      useMemory = true;
      memoryStorage = conversations;
    }
  },

  get(id: string): Conversation | undefined {
    return this.getAll().find(c => c.id === id);
  },

  create(): Conversation {
    const newConv: Conversation = {
      id: "conv_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      title: 'New Conversation',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: []
    };
    const all = this.getAll();
    all.unshift(newConv);
    this.saveAll(all);
    return newConv;
  },

  rename(id: string, newTitle: string) {
    const all = this.getAll();
    const conv = all.find(c => c.id === id);
    if (conv) {
      conv.title = newTitle;
      conv.updatedAt = Date.now();
      this.saveAll(all);
    }
  },

  delete(id: string) {
    const all = this.getAll();
    this.saveAll(all.filter(c => c.id !== id));
  },

  appendMessage(conversationId: string, message: Omit<Message, 'id' | 'createdAt'> & { id?: string }): Message {
    const all = this.getAll();
    const conv = all.find(c => c.id === conversationId);
    if (!conv) throw new Error("Conversation not found");

    const newMessage: Message = {
      ...message,
      id: message.id || "msg_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      createdAt: Date.now()
    };

    conv.messages.push(newMessage);
    conv.updatedAt = Date.now();

    // Auto-title
    if (message.role === 'user' && conv.messages.filter(m => m.role === 'user').length === 1 && conv.title === 'New Conversation') {
      const words = message.content.split(/\s+/);
      conv.title = words.slice(0, 6).join(' ') + (words.length > 6 ? '...' : '');
    }

    this.saveAll(all);
    return newMessage;
  },

  updateMessage(conversationId: string, messageId: string, updates: Partial<Message>) {
    const all = this.getAll();
    const conv = all.find(c => c.id === conversationId);
    if (conv) {
      const msg = conv.messages.find(m => m.id === messageId);
      if (msg) {
        Object.assign(msg, updates);
        conv.updatedAt = Date.now();
        this.saveAll(all);
      }
    }
  }
};
