import { getDbClient } from '../db';
import { getFirestoreDb } from '../firestore/client';

async function viewDatabase(): Promise<void> {
  console.log('\n========================================');
  console.log('       RELATIONAL DATABASE (POSTGRES)   ');
  console.log('========================================\n');

  const db = getDbClient();

  try {
    const users = await db.query('SELECT * FROM users');
    console.log('--- USERS TABLE ---');
    console.table(users.rows);

    const chats = await db.query('SELECT * FROM chats');
    console.log('\n--- CHATS TABLE ---');
    console.table(chats.rows);

    const members = await db.query('SELECT * FROM chat_members');
    console.log('\n--- CHAT_MEMBERS TABLE ---');
    console.table(members.rows);
  } catch (err: any) {
    console.error('Error reading relational DB:', err.message);
  }

  console.log('\n========================================');
  console.log('       FIREBASE FIRESTORE DATA          ');
  console.log('========================================\n');

  try {
    const firestore = getFirestoreDb();
    const chatsSnap = await firestore.collection('chats').get();

    if (!chatsSnap.docs || chatsSnap.docs.length === 0) {
      console.log('No documents in Firestore root yet (messages are stored under chats/:chatId/messages).');
    } else {
      for (const doc of chatsSnap.docs) {
        console.log(`Chat Document ID: ${doc.id}`);
        console.log(doc.data());
      }
    }
  } catch (err: any) {
    console.error('Error reading Firestore:', err.message);
  }

  console.log('\n========================================\n');
}

viewDatabase().then(() => process.exit(0));
