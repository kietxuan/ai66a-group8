import test from 'node:test';
import assert from 'node:assert/strict';
const savedStorage = globalThis.localStorage;
globalThis.localStorage = { getItem: () => null };
const { validateStepTitle, stepProgress, TaskSteps } = await import('../js/todo/task-steps.js');
const { api } = await import('../js/api.js');
if (savedStorage === undefined) delete globalThis.localStorage;
else globalThis.localStorage = savedStorage;

test('step titles reject blanks and overlong text while retaining Unicode and literal markup', () => {
  for (const value of ['', '   ', 'x'.repeat(501)]) assert.throws(() => validateStepTitle(value));
  assert.equal(validateStepTitle('  Viết báo cáo  '), 'Viết báo cáo');
  assert.equal(validateStepTitle('🙂'.repeat(500)).length, 1000);
  assert.equal(validateStepTitle('<img src=x onerror=alert(1)>'), '<img src=x onerror=alert(1)>');
});

function controller() {
  return Object.assign(Object.create(TaskSteps.prototype), {
    task: { id: 10 }, steps: [], draft: 'Bước mới', editId: null,
    busy: false, loaded: true, mustReload: false, generation: 0,
    isLive: () => true, render() {}, focusDraft() {}, onChange() {}
  });
}

test('double submit only creates one step and clears the accepted draft', async () => {
  const original = api.post;
  let resolve, calls = 0;
  api.post = () => { calls++; return new Promise(done => { resolve = done; }); };
  try {
    const component = controller();
    const pending = component.mutate('add', { title: 'Bước mới' });
    assert.equal(component.isSaving, true);
    await component.mutate('add', { title: 'Bước mới' });
    assert.equal(calls, 1);
    resolve({ id: 5, title: 'Bước mới', is_completed: false, position: 0 });
    await pending;
    assert.equal(component.steps.length, 1);
    assert.equal(component.draft, '');
    assert.equal(component.isSaving, false);
  } finally { api.post = original; }
});

test('lost response preserves the draft and reload reconciles a successful server write', async () => {
  const oldPost = api.post, oldGet = api.get;
  api.post = async () => { throw new Error('Timeout'); };
  api.get = async () => ({ steps: [{ id: 8, title: 'Bước mới', is_completed: false }] });
  try {
    const component = controller();
    await component.mutate('add', { title: 'Bước mới' });
    assert.equal(component.draft, 'Bước mới');
    assert.equal(component.mustReload, true);
    assert.equal(component.steps.length, 0);
    await component.load();
    assert.equal(component.steps.length, 1);
    assert.equal(component.draft, '');
    assert.equal(component.mustReload, false);
  } finally { api.post = oldPost; api.get = oldGet; }
});

test('external updates do not overwrite an unsaved checklist draft', () => {
  const component = controller();
  assert.equal(component.setSteps([{ id: 2, title: 'AI đã thêm', is_completed: false }]), false);
  assert.equal(component.draft, 'Bước mới');
  component.draft = '';
  assert.equal(component.setSteps([{ id: 2, title: 'AI đã thêm', is_completed: false }]), true);
  assert.equal(component.steps[0].id, 2);
});

test('checklist progress handles empty, partial and complete lists without mutating task status', () => {
  assert.deepEqual(stepProgress(), { total: 0, completed: 0, percent: 0 });
  assert.deepEqual(stepProgress([{is_completed: true},{is_completed: false},{is_completed: false}]), { total: 3, completed: 1, percent: 33 });
  assert.deepEqual(stepProgress([{is_completed: true}]), { total: 1, completed: 1, percent: 100 });
});
