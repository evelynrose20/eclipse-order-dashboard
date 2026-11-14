// Imperium Noctis governance design prototype.
// PURE RULES ONLY: not connected to login, live accounts, MySQL or game actions.
// Safe to exercise with fabricated members before activating any governance feature.

export const FOUNDING_COUNCIL=[
 'domina','operations','commerce','faction_envoy','internal_affairs'
];
export const COUNCIL_POLICY=Object.freeze({
 seats:5,quorum:3,major_yes:4,ratification_days:7,
 term:'until_resignation_or_removal',appointment_authority:'domina',
 vacant_seats_reduce_threshold:false
});

const VOTES=new Set(['yes','no','abstain','pending']);
const TYPES=new Set(['ordinary','major','reserved']);
export function evaluateCouncilMotion({type,votes,ratification='pending',presentedAt=null,now=null}){
 if(!TYPES.has(type))throw new Error('invalid_motion_type');
 if(!Array.isArray(votes)||votes.length!==COUNCIL_POLICY.seats||
   votes.some(v=>!VOTES.has(v)))throw new Error('invalid_council_ballot');
 if(!['pending','approved','declined'].includes(ratification))throw new Error('invalid_ratification');
 const yes=votes.filter(v=>v==='yes').length;
 const no=votes.filter(v=>v==='no').length;
 const participated=votes.filter(v=>v!=='pending').length;
 const closed=!votes.includes('pending');
 const quorumMet=participated>=COUNCIL_POLICY.quorum;
 // A major/reserved motion needs four affirmative votes out of the original five.
 // Vacancy is represented as 'pending', never as a reduced-size electorate.
 const votePassed=type==='ordinary'
  ? closed&&quorumMet&&yes>no
  : quorumMet&&yes>=COUNCIL_POLICY.major_yes;
 let status=votePassed?'passed':'not_passed';
 if(type==='reserved'&&votePassed){
  if(ratification==='approved')status='ratified';
  else if(ratification==='declined')status='returned_for_review';
  else if(presentedAt!=null&&now!=null&&Number.isFinite(Date.parse(presentedAt))&&
   Number.isFinite(Date.parse(now))&&Date.parse(now)>=Date.parse(presentedAt)+COUNCIL_POLICY.ratification_days*86400000)
   status='returned_for_review';
  else status='awaiting_ratification';
 }
 return {type,yes,no,participated,quorumMet,votePassed,status,
  canEnact: type==='reserved'?status==='ratified':status==='passed'};
}

export const SENSITIVE_CAPABILITIES=new Set([
 'admin.roles.write','admin.permissions.write','admin.recovery',
 'finance.treasury.withdraw','consent.private.read'
]);
// Baseline permissions come from Discord mapping, not IC rank.
// A scoped appointment is required for scoped capabilities.
export function authorizeGovernanceAction({
 guildMember,discordCapabilities=[],appointments=[],capability,resourceId,
 accountId,subjectAccountId=null,roleStateFresh=true,siteOwnerRecovery=false
}){
 if(!capability||typeof capability!=='string')return {allowed:false,reason:'invalid_capability'};
 if(siteOwnerRecovery){
  // Owner recovery must be implemented separately with strong authentication.
  // This pure policy deliberately does not bypass ordinary user checks.
  return {allowed:false,reason:'recovery_requires_separate_flow'};
 }
 if(!guildMember)return {allowed:false,reason:'not_guild_member'};
 if(!roleStateFresh)return {allowed:false,reason:'role_verification_required'};
 if(!discordCapabilities.includes(capability))return {allowed:false,reason:'missing_discord_capability'};
 if(subjectAccountId&&accountId===subjectAccountId&&
   /(?:approve|review|ratify|discipline)$/.test(capability))
   return {allowed:false,reason:'self_approval_disallowed'};
 if(SENSITIVE_CAPABILITIES.has(capability))return {allowed:false,reason:'separate_protected_authorization_required'};
 const matches=appointments.some(a=>
  a.accountId===accountId&&a.capabilities?.includes(capability)&&a.active===true&&
  (a.scope==='all'||(resourceId!=null&&a.scope===resourceId)));
 return matches?{allowed:true,reason:'authorized'}:{allowed:false,reason:'missing_scoped_appointment'};
}

export const WORKFLOW_STATES=Object.freeze([
 'draft','submitted','in_review','changes_requested','approved','rejected',
 'withdrawn','suspended','superseded'
]);
const TRANSITIONS={
 draft:['submitted','withdrawn'],
 submitted:['in_review','withdrawn'],
 in_review:['approved','rejected','changes_requested','withdrawn'],
 changes_requested:['submitted','withdrawn'],
 approved:['suspended','superseded'],
 suspended:['approved','superseded'],
 rejected:[],withdrawn:[],superseded:[]
};
export function transitionRequest({state,to,actorId,applicantId,approvedStages=[],requiredStages=[]}){
 if(!WORKFLOW_STATES.includes(state)||!WORKFLOW_STATES.includes(to)||
   !TRANSITIONS[state].includes(to))return {allowed:false,reason:'invalid_transition'};
 if(state==='in_review'&&(to==='approved'||to==='rejected')&&actorId===applicantId)
  return {allowed:false,reason:'self_decision_disallowed'};
 if(to==='approved'&&(!Array.isArray(requiredStages)||
  requiredStages.some(stage=>!approvedStages.includes(stage))))
  return {allowed:false,reason:'required_approvals_missing'};
 return {allowed:true,reason:'allowed'};
}
