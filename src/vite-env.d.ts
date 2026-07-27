/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'firebase/firestore' {
  export const collection: any;
  export const addDoc: any;
  export const query: any;
  export const where: any;
  export const getDocs: any;
  export const orderBy: any;
  export const doc: any;
  export const getDoc: any;
  export const updateDoc: any;
  export const deleteDoc: any;
  export const setDoc: any;
  export const onSnapshot: any;
  export const serverTimestamp: any;
  export const runTransaction: any;
}
declare module 'firebase/storage' {
  export const ref: any;
  export const uploadBytes: any;
  export const getDownloadURL: any;
}
declare module 'firebase/functions' {
  export const httpsCallable: any;
}
declare module 'firebase/auth' {
  export const signOut: any;
}

