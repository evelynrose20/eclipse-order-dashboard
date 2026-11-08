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
 database_unavailable:'Cannot reach the Order API. Check that the Windows API service is running, your frontend API URL is correct, and the website origin is permitted.',
 world_setup_required:'World Administration database update is missing. On the Windows API server, back up MySQL, run npm run setup:local from the server folder, then restart the API.',
 invalid_zone:'Check the zone name, territory state, faction selections and background image URL.',
 zone_not_in_region:'That zone does not belong to the selected region. Choose another zone and try again.',
 zone_has_map_content:'This zone still contains locations, routes, junctions or mountain ranges. Move or remove them before deleting the zone.',
 overview_zone_cannot_be_deleted:'The original overview zone cannot be deleted. You can rename or edit it.',
 zone_cannot_change_region:'An existing zone cannot be transferred to another region.',
 nodes_must_share_zone:'Road and railway connections must stay inside the same zone. Choose two endpoints on this zone map.',
 route_requires_two_settlements_in_zone:'Both locations must belong to the selected zone before you can connect them.',
 settlement_outside_zone:'This settlement belongs to another zone. Change zones or choose a settlement on this map.',
 settlement_has_routes_move_requires_detaching:'This settlement has connected routes. Remove or relocate those connections before moving it to another zone.',
 invalid_faction_reference:'Select a valid faction from the available Government, Control and Support options.',
 invalid_rail_station:'Choose a connected railway location, enter a station name and check its freight settings.',
 station_requires_connected_rail_node:'A station must be placed at a junction or settlement connected to a railway. Create a rail track first.',
 station_node_change_not_allowed:'The station is attached to a saved rail node. Create a new station to use a different location.',
 station_has_platforms:'Remove this station’s platforms before deleting the station.',
 invalid_rail_platform:'Check the platform code, station, track length, capacity and status.',
 platform_code_already_exists:'This station already has a platform using that code. Choose another, such as F2.',
 invalid_rail_link:'Choose two different stations on separate zone maps, and check the connection settings.',
 rail_link_not_found:'That railway connection no longer exists. Refresh the map.',
 rail_link_station_missing:'One of these railway stations no longer exists.',
 rail_link_requires_distinct_zones:'A regional link connects stations on different zone maps. Use regular tracks within one zone.',
 rail_link_already_exists:'A connection between these stations already exists; edit the existing link.',
 invalid_freight_preview:'Choose both an origin and destination station to check this route.',
 platform_station_change_not_allowed:'A platform cannot be transferred between stations. Create a new platform at the destination.',
 invalid_rail_switch:'Select two different railway tracks and a shared junction.',
 switch_requires_rail_junction:'A switch must be placed on a saved rail junction.',
 switch_tracks_must_meet_at_node:'Both selected railway tracks must meet at this junction in the same zone.',
 invalid_rail_crossing:'Select a railway and road, then place the crossing on both routes.',
 crossing_requires_rail_and_road_in_zone:'Crossings require a railway and a road or trail within the same zone.',
 crossing_location_not_on_both_routes:'Click near where the road and railway meet on the map.',
 route_has_rail_infrastructure:'This track has a station, switch or crossing dependency. Remove or adjust the railway infrastructure before changing its connections.',
 node_has_rail_infrastructure:'This junction supports a railway station or switch. Remove those records before deleting the junction.',

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
