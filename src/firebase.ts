import admin from 'firebase-admin';

import serviceAccount from '../morkahja-cbt-firebase-adminsdk-dinxd-7b9e95108c.json' with { type: 'json' };

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

export const db = admin.firestore();
