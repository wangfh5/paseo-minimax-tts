import test from "node:test";
import assert from "node:assert/strict";
import { firstVisit } from "../client/visit";
test("a jump request is acted on once, so going Back to the helper screen does not reopen the chat",()=>{
 assert.equal(firstVisit(undefined),false);
 assert.equal(firstVisit("1"),true);
 assert.equal(firstVisit("1"),false,"the same request is not repeated when the screen remounts");
 assert.equal(firstVisit("2"),true,"a new request works again");
 assert.equal(firstVisit(""),false);
});
