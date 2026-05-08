import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface EmailOptions {
    to: string | string[];
    message: {
        subject: string;
        text?: string;
        html?: string;
    };
    cc?: string | string[];
    bcc?: string | string[];
    replyTo?: string | string[];
}

/**
 * Triggers an email using the Firebase "Trigger Email from Firestore" extension.
 * Make sure the extension is installed and listening to the 'mail' collection.
 */
export const triggerEmail = async (options: EmailOptions) => {
    try {
        const mailCollection = collection(db, 'mail');
        const docRef = await addDoc(mailCollection, {
            ...options,
            createdAt: serverTimestamp(),
        });
        console.log('Email queued successfully with ID:', docRef.id);
        return docRef.id;
    } catch (error) {
        console.error('Error queuing email:', error);
        throw error;
    }
};
