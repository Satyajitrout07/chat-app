
import {
  initializeApp,
  cert,
  getApps,
  App,
} from 'firebase-admin/app';

import {
  getFirestore,
  FieldValue,
  Firestore,
} from 'firebase-admin/firestore';

import fs from 'fs';
import path from 'path';

import { config } from '../config/env';
import { MockFieldValue, MockFirestore } from './mockClient';

let firestoreInstance: Firestore | any = null;
let fieldValueInstance: any = null;
let firebaseApp: App | null = null;

export function initializeFirestore(): {
  db: Firestore | any;
  FieldValue: any;
} {
  // Reuse existing instance
  if (firestoreInstance && fieldValueInstance) {
    return {
      db: firestoreInstance,
      FieldValue: fieldValueInstance,
    };
  }

  // Use mock only when explicitly enabled
  if (config.useMockServices) {
    console.log('Firestore: Using MockFirestore');

    firestoreInstance = new MockFirestore();
    fieldValueInstance = MockFieldValue;

    return {
      db: firestoreInstance,
      FieldValue: fieldValueInstance,
    };
  }

  console.log('Firestore: Initializing real Firebase');

  const apps = getApps();

  if (apps.length > 0) {
    firebaseApp = apps[0];
  } else {
    const serviceAccountPath = config.firebase.serviceAccountPath
      ? path.resolve(process.cwd(), config.firebase.serviceAccountPath)
      : undefined;

    if (serviceAccountPath) {
      if (!fs.existsSync(serviceAccountPath)) {
        throw new Error(
          `Firebase service account file not found: ${serviceAccountPath}`,
        );
      }

      const serviceAccount = JSON.parse(
        fs.readFileSync(serviceAccountPath, 'utf8'),
      );

      firebaseApp = initializeApp({
        credential: cert(serviceAccount),
        projectId:
          config.firebase.projectId || serviceAccount.project_id,
      });
    } else if (
      config.firebase.clientEmail &&
      config.firebase.privateKey &&
      config.firebase.projectId
    ) {
      firebaseApp = initializeApp({
        credential: cert({
          projectId: config.firebase.projectId,
          clientEmail: config.firebase.clientEmail,
          privateKey: config.firebase.privateKey,
        }),
        projectId: config.firebase.projectId,
      });
    } else if (
      config.firebase.emulatorHost &&
      config.firebase.projectId
    ) {
      firebaseApp = initializeApp({
        projectId: config.firebase.projectId,
      });
    } else {
      throw new Error(
        'Firebase credentials are missing. Configure FIREBASE_SERVICE_ACCOUNT_PATH or Firebase environment credentials.',
      );
    }
  }

  firestoreInstance = getFirestore(firebaseApp);
  fieldValueInstance = FieldValue;

  if (config.firebase.emulatorHost) {
    firestoreInstance.settings({
      host: config.firebase.emulatorHost,
      ssl: false,
    });

    console.log(
      'Firestore Emulator:',
      config.firebase.emulatorHost,
    );
  }

  console.log(
    'Firebase project:',
    firebaseApp.options.projectId,
  );

  console.log('Firestore: Real Firebase initialized');

  return {
    db: firestoreInstance,
    FieldValue: fieldValueInstance,
  };
}

export function getFirestoreDb(): Firestore | any {
  return initializeFirestore().db;
}

export function getFieldValue(): any {
  return initializeFirestore().FieldValue;
}

export function setFirestoreDb(
  customDb: any,
  customFieldValue?: any,
): void {
  firestoreInstance = customDb;

  if (customFieldValue) {
    fieldValueInstance = customFieldValue;
  }
}
