// Actionable client messages for API errors. Unknown errors retain a short code for support.
const MESSAGES={
 encounter_not_active:'This encounter has not started, or it has already ended. Open a live encounter before rolling.',
 encounter_not_active_or_paused:'The roll was blocked. Check the encounter status, character participation and RP preferences.',
 encounter_participation_paused:'Participation in this encounter is paused. Resume it before rolling.',
 encounter_archived:'This scene is archived. Restore it before making changes or rolling.',
 not_in_encounter_party:'Your character is not in this encounter’s party. Ask the DM to add them.',
 rp_declaration_required:'Confirm your RP participation declaration in My RP preferences before rolling.',
 event_themes_not_enabled:'This event includes themes that are not enabled in your RP preferences.',
 gm_only_roll:'Private rolls are available only to the encounter DM.',
 invalid_dice_formula:'That dice formula is invalid. Try 1d20+5 or 2d6+3.',
 invalid_target_dc:'Choose a target difficulty between 0 and 99.',
 director_required:'Only an authorized DM can change this encounter.',
 active_director_required:'Start the encounter before sending a roll request.',
 participant_required:'Your character must be in the encounter to use this control.',
 encounter_not_found:'This encounter is unavailable or you no longer have access to it.',
 no_combatants:'Add a combatant before starting this encounter.',
 already_started:'This encounter has already been started.',
 already_archived:'This scene is already archived.',
 scene_not_archived:'This scene is not archived.',
 archive_before_delete:'Archive this scene before deleting it permanently.',
 finish_encounter_before_archive:'Finish the encounter before archiving it. Active or paused battles cannot be archived.',
 scene_changed_retry:'This scene changed while you were working. Refresh the list and try again.',
 invalid_event_details:'Check the event title, capacity and themes, then save again.',
 invalid_event_story:'Review the event chapters and difficulty/impact ratings before saving.',
 not_authenticated:'Your session has expired. Sign in again.',
 database_unavailable:'The Order ledger is unavailable. Try again when the server is connected.',
 method_not_allowed:'That action is not supported here.',
 linked_character_required:'Add a linked player character before performing this action.',
 invalid_roll_request:'Check the requested roll’s character, formula and target difficulty.',
 access_denied:'You do not have permission to perform that action.'
};
export function readableApiError(code,status){
 if(typeof code!=='string'||!code)return 'The request could not be completed'+(status?' ('+status+').':'.');
 if(MESSAGES[code])return MESSAGES[code];
 const cleaned=code.replace(/[^a-z0-9_-]/gi,'').slice(0,80);
 return 'Unable to complete the action'+(status?' ('+status+')':'')+(cleaned?' · '+cleaned:'')+'.';
}
export function contextualApiError(code,{status,path,method}={}){
 const error=new Error(readableApiError(code,status));
 error.code=code;
 error.status=status;
 error.action=method&&path?method+' '+path:null;
 return error;
}
