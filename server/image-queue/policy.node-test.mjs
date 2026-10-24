import test from "node:test";
import assert from "node:assert/strict";
import {
  DAILY_JOB_LIMIT,DEFAULT_IMAGE_MODEL,classifyImageError,retryDelayMs,
  parseRetryAfter,trustedReference,validateImageQueueRequest
} from "./policy.mjs";
const basic={
  appearanceId:"AP008",kind:"initial",slot:"fullBody",
  prompt:"A fictional adult Korean game character, preserving the locked canonical body profile.",
  profileSha256:"a".repeat(64),idempotencyKey:"AP008:fullBody:initial:v1"
};
test("application daily cap is absent",()=>{
  assert.equal(DAILY_JOB_LIMIT,null);
  assert.equal(DEFAULT_IMAGE_MODEL,"gpt-image-2.5-flare");
});
test("accept 100 distinct jobs, without a daily cap",()=>{
  for(let i=0;i<100;i++) {
    assert.equal(validateImageQueueRequest({...basic,idempotencyKey:"AP008:batch:"+i.toString().padStart(5,"0")}).appearanceId,"AP008");
  }
});
test("reject missing original approved anchor for variants",()=>{
  assert.throws(()=>validateImageQueueRequest({...basic,kind:"variant"},"https://ik.imagekit.io/nanal"));
  assert.throws(()=>validateImageQueueRequest({...basic,kind:"variant",referenceUrl:"https://ik.imagekit.io/nanal/anchor.png"},"https://ik.imagekit.io/nanal"));
});
test("reject untrusted original-image host/path",()=>{
  assert.equal(trustedReference("https://ik.imagekit.io/nanal/a.png","https://ik.imagekit.io/nanal"),true);
  assert.equal(trustedReference("https://ik.imagekit.io/nanal-evil/a.png","https://ik.imagekit.io/nanal"),false);
  assert.equal(trustedReference("https://ik.imagekit.io.evil.invalid/nanal/a.png","https://ik.imagekit.io/nanal"),false);
});
test("approve anchored variant request only with both SHA locks",()=>{
  const r=validateImageQueueRequest({...basic,kind:"variant",referenceUrl:"https://ik.imagekit.io/nanal/a.png",referenceSha256:"b".repeat(64)},"https://ik.imagekit.io/nanal");
  assert.equal(r.referenceSha256,"b".repeat(64));
});
test("quota, billing and permissions are non-retryable",()=>{
  for(const e of [{status:429,code:"insufficient_quota"},{status:429,message:"model access denied"},{status:401},{status:403}]) {
    assert.equal(classifyImageError(e).retryable,false);
  }
});
test("rate limit respects Retry-After",()=>{
  const result=classifyImageError({status:429,code:"rate_limit_exceeded",retryAfter:"120"});
  assert.equal(result.retryable,true);
  assert.equal(result.retryAfterMs,120000);
  assert.equal(retryDelayMs(1,result.retryAfterMs),120000);
});
test("5xx retries but image validation 422 blocks",()=>{
  assert.equal(classifyImageError({status:503}).retryable,true);
  assert.equal(classifyImageError({status:422}).retryable,false);
});
test("retry delay bounded and date Retry-After parsed",()=>{
  assert.ok(retryDelayMs(6)>retryDelayMs(1));
  assert.ok(retryDelayMs(50)<=3600000);
  assert.equal(parseRetryAfter("Thu, 01 Jan 1970 00:03:00 GMT",0),180000);
});
