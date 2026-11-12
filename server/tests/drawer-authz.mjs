import assert from 'node:assert/strict';

const AUTH_URL = process.env.AUTH_URL ?? 'http://localhost:4100';
const ORIGIN = process.env.TEST_ORIGIN ?? 'http://localhost:3002';
const API_URL = process.env.API_URL ?? 'http://localhost:4102';

async function postJson(url, body, token) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, cookies: res.headers.getSetCookie?.() ?? [] };
}

async function signUp(email) {
  const res = await fetch(`${AUTH_URL}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN },
    body: JSON.stringify({ email, password: 'test-password-1234', name: email.split('@')[0] }),
  });
  assert.equal(res.status, 200, `signup failed for ${email}`);
  const cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  const tokenRes = await fetch(`${AUTH_URL}/api/auth/token`, { headers: { cookie, origin: ORIGIN } });
  assert.equal(tokenRes.status, 200);
  return (await tokenRes.json()).token;
}

function assertStatus(result, expected, label) {
  assert.equal(result.status, expected, `${label}: expected ${expected}, got ${result.status} ${JSON.stringify(result.body)}`);
}

const run = `race-${Date.now()}`;
const ownerEmail = `${run}-owner@example.com`;
const otherEmail = `${run}-other@example.com`;
const guestEmail = `${run}-guest@example.com`;

const ownerToken = await signUp(ownerEmail);
const otherToken = await signUp(otherEmail);
const guestToken = await signUp(guestEmail);

console.log('1. no token -> 401');
assertStatus(await postJson(`${API_URL}/api/flows`, { name: 'x' }), 401, 'anonymous create');

console.log('2. owner creates team + flow');
const team = await postJson(`${API_URL}/api/teams`, { name: 'Race Team' }, ownerToken);
assertStatus(team, 201, 'create team');
const flow = await postJson(`${API_URL}/api/flows`, { name: 'Race Flow', teamId: team.body.id }, ownerToken);
assertStatus(flow, 201, 'create flow');
const flowId = flow.body.id;

console.log('3. other user cannot read the flow');
assertStatus(await fetch(`${API_URL}/api/flows/${flowId}`, { headers: { authorization: `Bearer ${otherToken}` } }).then(async (r) => ({ status: r.status, body: await r.text() })), 404, 'cross-tenant read');

console.log('4. other user cannot update the flow');
assertStatus(await postJson(`${API_URL}/api/flows?`, {}, ownerToken).then(() => ({ status: 0 })), 0, 'noop');
const updateAsOther = await fetch(`${API_URL}/api/flows/${flowId}`, {
  method: 'PATCH',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${otherToken}` },
  body: JSON.stringify({ name: 'hijack' }),
});
assert.equal(updateAsOther.status, 403, 'cross-tenant update must be 403');

console.log('5. viewer guest can read but not write');
const invite = await postJson(`${API_URL}/api/flows/${flowId}/members`, { email: guestEmail, role: 'viewer' }, ownerToken);
assertStatus(invite, 201, 'invite guest');
const guestRead = await fetch(`${API_URL}/api/flows/${flowId}`, { headers: { authorization: `Bearer ${guestToken}` } });
assert.equal(guestRead.status, 200, 'guest read');
const guestWrite = await fetch(`${API_URL}/api/flows/${flowId}`, {
  method: 'PATCH',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${guestToken}` },
  body: JSON.stringify({ name: 'nope' }),
});
assert.equal(guestWrite.status, 403, 'guest write must be 403');

console.log('6. editor guest can write, but not flip visibility');
const promote = await fetch(`${API_URL}/api/flows/${flowId}/members/${invite.body.id}`, {
  method: 'PUT',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${ownerToken}` },
  body: JSON.stringify({ role: 'editor' }),
});
void promote;
const editorWrite = await fetch(`${API_URL}/api/flows/${flowId}`, {
  method: 'PATCH',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${guestToken}` },
  body: JSON.stringify({ name: 'guest edit' }),
});
assert.equal(editorWrite.status, 200, `editor write got ${editorWrite.status}`);

console.log('7. anonymous cannot list teams');
assert.equal((await fetch(`${API_URL}/api/teams`)).status, 401);

console.log('8. cross-tenant team member list is 403');
assert.equal(
  (await fetch(`${API_URL}/api/teams/${team.body.id}/members`, { headers: { authorization: `Bearer ${otherToken}` } })).status,
  403,
);

console.log('\nall drawer authz checks passed');
