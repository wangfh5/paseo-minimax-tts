import test from "node:test";
import assert from "node:assert/strict";
import { goneAgentId } from "../client/gone";
test("an agent update marks a chat as gone only when it is archived or removed",()=>{
 assert.equal(goneAgentId({kind:"remove",agentId:"a"}),"a");
 assert.equal(goneAgentId({kind:"upsert",agent:{id:"a",archivedAt:"2026-10-18T12:00:00Z"}}),"a");
 assert.equal(goneAgentId({kind:"upsert",agent:{id:"a",archivedAt:null}}),null);
 assert.equal(goneAgentId({kind:"upsert",agent:{id:"a"}}),null);
 assert.equal(goneAgentId({kind:"remove"}),null);
 assert.equal(goneAgentId({kind:"something-else",agentId:"a"}),null);
});
