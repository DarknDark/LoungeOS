export type FirebaseEnvironment = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  storageBucket?: string;
  databaseURL?: string;
};

export type FirebaseEnvironmentVariable = {
  name:
    | 'FIREBASE_PROJECT_ID'
    | 'FIREBASE_CLIENT_EMAIL'
    | 'FIREBASE_PRIVATE_KEY'
    | 'FIREBASE_STORAGE_BUCKET'
    | 'FIREBASE_DATABASE_URL';
  required: boolean;
  usedFor: string;
};

export const FIREBASE_ENVIRONMENT_VARIABLES: readonly FirebaseEnvironmentVariable[] = [
  {
    name: 'FIREBASE_PROJECT_ID',
    required: true,
    usedFor: 'Firebase project identity for Admin SDK, Firestore, and Auth.',
  },
  {
    name: 'FIREBASE_CLIENT_EMAIL',
    required: true,
    usedFor: 'Service-account identity used by the server-side Admin SDK.',
  },
  {
    name: 'FIREBASE_PRIVATE_KEY',
    required: true,
    usedFor: 'Service-account signing key used by the server-side Admin SDK.',
  },
  {
    name: 'FIREBASE_STORAGE_BUCKET',
    required: false,
    usedFor: 'Optional Firebase Storage bucket for future media and receipts.',
  },
  {
    name: 'FIREBASE_DATABASE_URL',
    required: false,
    usedFor: 'Optional Realtime Database URL; not used by the Firestore foundation.',
  },
];

export class FirebaseConfigurationError extends Error {
  readonly missingVariables: readonly string[];

  constructor(missingVariables: readonly string[]) {
    super(
      [
        'Firebase Admin is not configured.',
        `Add the required Replit Secrets: ${missingVariables.join(', ')}.`,
        'The server will not use another database or an in-memory fallback.',
      ].join(' '),
    );
    this.name = 'FirebaseConfigurationError';
    this.missingVariables = missingVariables;
  }
}

function requireFirebaseValue(
  name: 'FIREBASE_PROJECT_ID' | 'FIREBASE_CLIENT_EMAIL' | 'FIREBASE_PRIVATE_KEY',
  value: string | undefined,
): string {
  if (!value) {
    throw new FirebaseConfigurationError([name]);
  }
  return value;
}

function readRequiredEnvironmentValue(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function readFirebaseEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): FirebaseEnvironment {
  const projectId = environment.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = environment.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = environment.FIREBASE_PRIVATE_KEY?.trim();
  const missingVariables = [
    !projectId ? 'FIREBASE_PROJECT_ID' : undefined,
    !clientEmail ? 'FIREBASE_CLIENT_EMAIL' : undefined,
    !privateKey ? 'FIREBASE_PRIVATE_KEY' : undefined,
  ].filter((name): name is string => Boolean(name));

  if (missingVariables.length > 0) {
    throw new FirebaseConfigurationError(missingVariables);
  }

  return {
    projectId: requireFirebaseValue('FIREBASE_PROJECT_ID', projectId),
    clientEmail: requireFirebaseValue('FIREBASE_CLIENT_EMAIL', clientEmail),
    privateKey: requireFirebaseValue('FIREBASE_PRIVATE_KEY', privateKey).replace(
      /\\n/g,
      '\n',
    ),
    storageBucket: readRequiredEnvironmentValue('FIREBASE_STORAGE_BUCKET'),
    databaseURL: readRequiredEnvironmentValue('FIREBASE_DATABASE_URL'),
  };
}

export function hasFirebaseEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(
    environment.FIREBASE_PROJECT_ID?.trim() &&
      environment.FIREBASE_CLIENT_EMAIL?.trim() &&
      environment.FIREBASE_PRIVATE_KEY?.trim(),
  );
}