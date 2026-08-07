import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { readFirebaseEnvironment, type FirebaseEnvironment } from './config';

export type FirebaseAdminClients = {
  app: App;
  auth: Auth;
  firestore: Firestore;
  environment: FirebaseEnvironment;
};

let clients: FirebaseAdminClients | undefined;

export function getFirebaseAdmin(): FirebaseAdminClients {
  if (clients) {
    return clients;
  }

  const environment = readFirebaseEnvironment();
  const app =
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId: environment.projectId,
        clientEmail: environment.clientEmail,
        privateKey: environment.privateKey,
      }),
      ...(environment.storageBucket
        ? { storageBucket: environment.storageBucket }
        : {}),
      ...(environment.databaseURL ? { databaseURL: environment.databaseURL } : {}),
    });

  clients = {
    app,
    auth: getAuth(app),
    firestore: getFirestore(app),
    environment,
  };
  return clients;
}

export function resetFirebaseAdminForTests(): void {
  clients = undefined;
}