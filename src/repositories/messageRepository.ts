import crypto from 'crypto';
import { getFieldValue, getFirestoreDb } from '../firestore/client';
import { FirestoreMessage } from '../firestore/types';

export class MessageRepository {
  private get db(): any {
    return getFirestoreDb();
  }

  private get FieldValue(): any {
    return getFieldValue();
  }

  private formatTimestamp(ts: any): string {
    if (!ts) return new Date().toISOString();
    if (typeof ts === 'string') return ts;
    if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
    if (typeof ts === 'number') return new Date(ts).toISOString();
    if (ts instanceof Date) return ts.toISOString();
    return new Date().toISOString();
  }

  async sendMessage(chatId: string, senderId: string, text: string): Promise<FirestoreMessage> {
    const messageId = `msg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const nowIso = new Date().toISOString();

    const messageRef = this.db
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .doc(messageId);

    const messageData = {
      id: messageId,
      chatId,
      senderId,
      text,
      timestamp: this.FieldValue.serverTimestamp(),
      readBy: [senderId],
      readReceipts: {
        [senderId]: nowIso,
      },
      isDeleted: false,
    };

    await messageRef.set(messageData);

    return {
      id: messageId,
      chatId,
      senderId,
      text,
      timestamp: nowIso,
      readBy: [senderId],
      readReceipts: {
        [senderId]: nowIso,
      },
      isDeleted: false,
    };
  }

  async getMessages(chatId: string, limit = 50): Promise<FirestoreMessage[]> {
    const safeLimit = Math.max(1, Math.min(limit, 200));

    const messagesQuery = this.db
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .limit(safeLimit);

    const snapshot = await messagesQuery.get();

    const messages: FirestoreMessage[] = [];
    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (data) {
        messages.push({
          id: data.id || doc.id,
          chatId: data.chatId || chatId,
          senderId: data.senderId,
          text: data.isDeleted ? 'This message was deleted' : data.text,
          timestamp: this.formatTimestamp(data.timestamp),
          readBy: Array.isArray(data.readBy) ? data.readBy : [],
          readReceipts: data.readReceipts || {},
          isDeleted: !!data.isDeleted,
          editedAt: data.editedAt ? this.formatTimestamp(data.editedAt) : null,
        });
      }
    }

    return messages;
  }

  async getMessageById(chatId: string, messageId: string): Promise<FirestoreMessage | null> {
    const docRef = this.db
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .doc(messageId);

    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data();
    return {
      id: data.id || snapshot.id,
      chatId: data.chatId || chatId,
      senderId: data.senderId,
      text: data.text,
      timestamp: this.formatTimestamp(data.timestamp),
      readBy: Array.isArray(data.readBy) ? data.readBy : [],
      readReceipts: data.readReceipts || {},
      isDeleted: !!data.isDeleted,
      editedAt: data.editedAt ? this.formatTimestamp(data.editedAt) : null,
    };
  }

  async markMessageRead(
    chatId: string,
    messageId: string,
    userId: string
  ): Promise<{ success: boolean; messageId: string; userId: string; readAt: string }> {
    const docRef = this.db
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .doc(messageId);

    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      throw new Error(`Message ${messageId} not found in chat ${chatId}`);
    }

    const readAtIso = new Date().toISOString();

    await docRef.update({
      readBy: this.FieldValue.arrayUnion(userId),
      [`readReceipts.${userId}`]: readAtIso,
    });

    return {
      success: true,
      messageId,
      userId,
      readAt: readAtIso,
    };
  }

  async updateLastSeen(
    chatId: string,
    userId: string,
    messageId: string
  ): Promise<{ success: boolean; chatId: string; userId: string; messageId: string; updatedAt: string }> {
    const lastSeenRef = this.db
      .collection('chats')
      .doc(chatId)
      .collection('lastSeen')
      .doc(userId);

    const nowIso = new Date().toISOString();

    await lastSeenRef.set(
      {
        userId,
        messageId,
        updatedAt: this.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return {
      success: true,
      chatId,
      userId,
      messageId,
      updatedAt: nowIso,
    };
  }

  async getLastSeen(
    chatId: string,
    userId: string
  ): Promise<{ userId: string; messageId: string; updatedAt: string } | null> {
    const docRef = this.db
      .collection('chats')
      .doc(chatId)
      .collection('lastSeen')
      .doc(userId);

    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data();
    return {
      userId: data.userId,
      messageId: data.messageId,
      updatedAt: this.formatTimestamp(data.updatedAt),
    };
  }

  async editMessage(chatId: string, messageId: string, senderId: string, newText: string): Promise<FirestoreMessage> {
    const docRef = this.db
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .doc(messageId);

    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      throw new Error(`Message ${messageId} not found in chat ${chatId}`);
    }

    const data = snapshot.data();
    if (data.senderId !== senderId) {
      throw new Error('Unauthorized: only message sender can edit this message');
    }

    const nowIso = new Date().toISOString();
    await docRef.update({
      text: newText,
      editedAt: nowIso,
    });

    return {
      id: messageId,
      chatId,
      senderId,
      text: newText,
      timestamp: this.formatTimestamp(data.timestamp),
      readBy: data.readBy || [],
      readReceipts: data.readReceipts || {},
      isDeleted: false,
      editedAt: nowIso,
    };
  }

  async deleteMessage(chatId: string, messageId: string, senderId: string): Promise<{ success: boolean }> {
    const docRef = this.db
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .doc(messageId);

    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      throw new Error(`Message ${messageId} not found in chat ${chatId}`);
    }

    const data = snapshot.data();
    if (data.senderId !== senderId) {
      throw new Error('Unauthorized: only message sender can delete this message');
    }

    await docRef.update({
      isDeleted: true,
      text: '',
    });

    return { success: true };
  }
}
