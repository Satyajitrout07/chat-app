export interface FirestoreMessage {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  timestamp: any; // Firestore Timestamp, ISO string, or number
  readBy: string[];
  readReceipts: Record<string, string>;
  isDeleted?: boolean;
  editedAt?: string | null;
}

export interface FirestoreLastSeen {
  userId: string;
  messageId: string;
  updatedAt: any;
}
