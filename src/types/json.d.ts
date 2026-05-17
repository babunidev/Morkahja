declare module '*.json' {
  const value: Record<string, unknown>;
  export default value;
}

declare module '../morkahja-cbt-firebase-adminsdk-dinxd-7b9e95108c.json' {
  import type { ServiceAccount } from 'firebase-admin';
  const serviceAccount: ServiceAccount;
  export default serviceAccount;
}
