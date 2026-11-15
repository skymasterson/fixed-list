import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { ApiError, getMyJobs, getTask, respondToTask } from './publicApi';

initializeApp();
const db = getFirestore();

/** Wraps a public handler so expected failures reach the contractor as readable messages. */
function publicCall<Req, Res>(handler: (data: Req) => Promise<Res>) {
  return onCall<Req, Promise<Res>>({ cors: true, maxInstances: 10 }, async (request) => {
    try {
      return await handler(request.data);
    } catch (err) {
      if (err instanceof ApiError) throw new HttpsError(err.code, err.message);
      logger.error(err);
      throw new HttpsError('internal', 'Something went wrong. Please try again.');
    }
  });
}

export const getTaskByToken = publicCall((data: { token: string }) => getTask(db, data?.token));
export const respondToTaskByToken = publicCall(respondToTask.bind(null, db));
export const getMyJobsByToken = publicCall((data: { listToken: string }) => getMyJobs(db, data?.listToken));
