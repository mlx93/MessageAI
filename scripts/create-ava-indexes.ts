import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';

// Initialize Firebase
const firebaseConfig = {
  // Your Firebase config here - this will use the default project config
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function createAvaIndexes() {
  console.log('Creating Ava chat indexes...');
  
  try {
    // This query will trigger the creation of the avaChatSessions index
    console.log('Triggering avaChatSessions index creation...');
    const sessionsRef = collection(db, 'avaChatSessions');
    const sessionsQuery = query(
      sessionsRef,
      where('userId', '==', 'test-user'),
      orderBy('updatedAt', 'desc'),
      limit(1)
    );
    await getDocs(sessionsQuery);
    console.log('✅ avaChatSessions index triggered');
    
    // This query will trigger the creation of the avaChatMessages index
    console.log('Triggering avaChatMessages index creation...');
    const messagesRef = collection(db, 'avaChatMessages');
    const messagesQuery = query(
      messagesRef,
      where('sessionId', '==', 'test-session'),
      orderBy('timestamp', 'asc'),
      limit(1)
    );
    await getDocs(messagesQuery);
    console.log('✅ avaChatMessages index triggered');
    
    console.log('Index creation queries sent. Check Firebase Console for index status.');
    
  } catch (error: any) {
    if (error.code === 'failed-precondition') {
      console.log('✅ Index creation triggered! Check Firebase Console for status.');
    } else {
      console.error('Error creating indexes:', error);
    }
  }
}

createAvaIndexes();
