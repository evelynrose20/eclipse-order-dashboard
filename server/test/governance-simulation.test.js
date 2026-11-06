import test from 'node:test';
import assert from 'node:assert/strict';
import {
 COUNCIL_POLICY,evaluateCouncilMotion,authorizeGovernanceAction,transitionRequest
} from '../src/governance-policy.js';

const alice='synthetic-alice',bob='synthetic-bob',front='synthetic-moonveil-front';
test('the founding council has five seats, 3 quorum and a fixed 4/5 major threshold',()=>{
 assert.equal(COUNCIL_POLICY.seats,5);
 assert.equal(COUNCIL_POLICY.major_yes,4);
 assert.equal(COUNCIL_POLICY.quorum,3);
 assert.equal(evaluateCouncilMotion({type:'major',votes:['yes','yes','yes','pending','pending']}).canEnact,false);
 assert.equal(evaluateCouncilMotion({type:'major',votes:['yes','yes','yes','yes','pending']}).canEnact,true);
});
test('vacancies never lower the major vote threshold',()=>{
 const vote=evaluateCouncilMotion({type:'major',votes:['yes','yes','yes','pending','pending']});
 assert.equal(vote.votePassed,false);
});
test('ordinary motion needs quorum, finished voting, and more yes than no',()=>{
 assert.equal(evaluateCouncilMotion({type:'ordinary',votes:['yes','yes','abstain','no','no']}).canEnact,false);
 assert.equal(evaluateCouncilMotion({type:'ordinary',votes:['yes','yes','abstain','no','abstain']}).canEnact,true);
 assert.equal(evaluateCouncilMotion({type:'ordinary',votes:['yes','yes','pending','pending','pending']}).canEnact,false);
});
test('reserved motions never enact before Domina ratification',()=>{
 const votes=['yes','yes','yes','yes','no'];
 assert.equal(evaluateCouncilMotion({type:'reserved',votes}).status,'awaiting_ratification');
 assert.equal(evaluateCouncilMotion({type:'reserved',votes,ratification:'approved'}).canEnact,true);
 assert.equal(evaluateCouncilMotion({type:'reserved',votes,ratification:'declined'}).canEnact,false);
});
test('ratification returns to review after seven calendar days, never auto-approves',()=>{
 const input={type:'reserved',votes:['yes','yes','yes','yes','no'],presentedAt:'2026-11-01T12:00:00.000Z'};
 assert.equal(evaluateCouncilMotion({...input,now:'2026-11-08T11:59:59.999Z'}).status,'awaiting_ratification');
 assert.equal(evaluateCouncilMotion({...input,now:'2026-11-08T12:00:00.000Z'}).status,'returned_for_review');
});
test('Discord role alone does not grant a scoped business approval',()=>{
 const shared={guildMember:true,discordCapabilities:['business.approve'],capability:'business.approve',
 accountId:bob,resourceId:front,subjectAccountId:alice};
 assert.equal(authorizeGovernanceAction({...shared,appointments:[]}).reason,'missing_scoped_appointment');
 assert.equal(authorizeGovernanceAction({...shared,appointments:[{accountId:bob,active:true,
  capabilities:['business.approve'],scope:'another-district'}]}).allowed,false);
 assert.equal(authorizeGovernanceAction({...shared,appointments:[{accountId:bob,active:true,
  capabilities:['business.approve'],scope:front}]}).allowed,true);
});
test('role revocation and guild departure remove access even with active appointment',()=>{
 const args={guildMember:true,roleStateFresh:true,discordCapabilities:['business.approve'],
 appointments:[{accountId:bob,scope:front,capabilities:['business.approve'],active:true}],
 capability:'business.approve',accountId:bob,resourceId:front};
 assert.equal(authorizeGovernanceAction({...args,guildMember:false}).allowed,false);
 assert.equal(authorizeGovernanceAction({...args,roleStateFresh:false}).allowed,false);
 assert.equal(authorizeGovernanceAction({...args,discordCapabilities:[]}).allowed,false);
});
test('applicant may not approve their own license, and sensitive authority needs separate checks',()=>{
 const args={guildMember:true,discordCapabilities:['business.approve'],
 appointments:[{accountId:alice,active:true,scope:front,capabilities:['business.approve']}],
 capability:'business.approve',accountId:alice,subjectAccountId:alice,resourceId:front};
 assert.equal(authorizeGovernanceAction(args).reason,'self_approval_disallowed');
 assert.equal(authorizeGovernanceAction({...args,capability:'finance.treasury.withdraw',
  discordCapabilities:['finance.treasury.withdraw']}).allowed,false);
});
test('two-stage business approval cannot be skipped and revisions require resubmission',()=>{
 const input={state:'in_review',to:'approved',actorId:bob,applicantId:alice,
 requiredStages:['ic_authorization','website_review']};
 assert.equal(transitionRequest({...input,approvedStages:['ic_authorization']}).reason,'required_approvals_missing');
 assert.equal(transitionRequest({...input,approvedStages:['ic_authorization','website_review']}).allowed,true);
 assert.equal(transitionRequest({...input,actorId:alice,approvedStages:['ic_authorization','website_review']}).allowed,false);
 assert.equal(transitionRequest({state:'changes_requested',to:'submitted'}).allowed,true);
 assert.equal(transitionRequest({state:'rejected',to:'approved'}).allowed,false);
});
test('synthetic members and actions are test-only and never change real accounts',()=>{
 assert.match(alice,/synthetic-/);
 assert.match(bob,/synthetic-/);
 assert.match(front,/synthetic-/);
});
