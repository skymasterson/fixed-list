// Seeds the local emulator with the PM allow-list. Usage: npm run seed [email ...]
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
initializeApp({ projectId: 'demo-fixedlist' });
const emails = process.argv.slice(2);
if (emails.length === 0) emails.push('pm@example.com');
await getFirestore().doc('config/access').set({ pmEmails: emails });
console.log('Allowed property managers:', emails.join(', '));
