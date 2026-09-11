import assert from 'node:assert/strict';
import test from 'node:test';
import { DraftSaveController } from '../src/admin/draftSave';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('slow save retains newer edits and rejects a parallel save', async () => {
  const controller = new DraftSaveController();
  const response = deferred<string>();
  let draft = 'first edit';
  let saved = 'original';
  let requests = 0;
  const pending = controller.save(draft, async () => { requests += 1; return response.promise; }, (result, newer) => {
    saved = result;
    if (!newer) draft = result;
  });
  draft = 'second edit';
  controller.markChanged();
  assert.equal(await controller.save(draft, async () => { requests += 1; return draft; }, () => {}), false);
  response.resolve('first edit');
  await pending;
  assert.equal(requests, 1);
  assert.equal(saved, 'first edit');
  assert.equal(draft, 'second edit');
  assert.equal(controller.isSaving, false);
  await controller.save(draft, async (snapshot) => snapshot, (result) => { saved = result; });
  assert.equal(saved, 'second edit');
});

test('failed request releases the save lock for retry', async () => {
  const controller = new DraftSaveController();
  await assert.rejects(controller.save('draft', async () => { throw new Error('offline'); }, () => {}), /offline/);
  assert.equal(controller.isSaving, false);
  assert.equal(await controller.save('draft', async (value) => value, () => {}), true);
});

test('logout invalidates an old response without overwriting the next session', async () => {
  const controller = new DraftSaveController();
  const response = deferred<string>();
  let updates = 0;
  const pending = controller.save('old session', () => response.promise, () => { updates += 1; });
  controller.invalidate();
  response.resolve('old response');
  assert.equal(await pending, false);
  assert.equal(updates, 0);
});

test('an old session failure does not affect a new session save', async () => {
  const controller = new DraftSaveController();
  const oldResponse = deferred<string>();
  const newResponse = deferred<string>();
  const oldSave = controller.save('old session', () => oldResponse.promise, () => {});
  controller.invalidate();
  let saved = '';
  const newSave = controller.save('new session', () => newResponse.promise, (result) => { saved = result; });
  oldResponse.reject(new Error('expired session'));
  assert.equal(await oldSave, false);
  assert.equal(controller.isSaving, true);
  newResponse.resolve('new session');
  assert.equal(await newSave, true);
  assert.equal(saved, 'new session');
});
