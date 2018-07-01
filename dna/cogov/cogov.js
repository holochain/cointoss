/*
    CoGov is the software implementation of The Digital Co-Governance Web (http://CoGov.tech) 
    
    For programming details, see: https://github.com/Holochain/mixins/wiki/CoGov
*/

/* Holocain API */ var _core_remove=remove;remove=function(a,b){return checkForError("remove",_core_remove(a,b))};var _core_makeHash=makeHash;makeHash=function(a,b){return checkForError("makeHash",_core_makeHash(a,b))};var _core_debug=debug;debug=function(a){return checkForError("debug",_core_debug(JSON.stringify(a)))};var _core_call=call;call=function(a,b,c){return __holochain_api_check_for_json(checkForError("call",_core_call(a,b,c)))};var _core_commit=commit;commit=function(a,b){return checkForError("commit",_core_commit(a,b))};var _core_get=get;get=function(a,b){return __holochain_api_check_for_json(checkForError("get",b===undefined?_core_get(a):_core_get(a,b)))};var _core_getLinks=getLinks;getLinks=function(a,b,c){return checkForError("getLinks",_core_getLinks(a,b,c))};var _core_send=send;send=function(a,b,c){return __holochain_api_check_for_json(checkForError("send",c===undefined?_core_send(a,b):_core_send(a,b,c)))};function __holochain_api_check_for_json(rtn){try{rtn=JSON.parse(rtn)}catch(err){}return rtn}function checkForError(func,rtn){if(typeof rtn==="object"&&rtn.name=="HolochainError"){var errsrc=new getErrorSource(4);var message='HOLOCHAIN ERROR! "'+rtn.message.toString()+'" on '+func+(errsrc.line===undefined?"":" in "+errsrc.functionName+" at line "+errsrc.line+", column "+errsrc.column+"\n\n"+errsrc.stack);throw{name:"HolochainError",function:func,message:message,holochainMessage:rtn.message,source:errsrc,toString:function(){return this.message}}}return rtn}function getErrorSource(depth){try{throw new Error}catch(e){var line=e.stack.split("\n")[depth];var reg=/at (.*) \(.*:(.*):(.*)\)/g.exec(line);if(reg){this.functionName=reg[1];this.line=reg[2];this.column=reg[3];this.stack=e.stack}}}

function genesis() {
    return true;
}

/************ Zome Public Interface ************/

function getCoGovVersion()
{
    return "0.0.0";
}

/*************
COLLECTIVE METHODS
**************/
function createCollective(parms)
{

    if (parms.name === undefined)
        throw("createCollective: Parameter 'name' is required!");

    var c;

    // make sure a Collective with this name doesn't already exist
    try { c = get(makeHash("cogov_collective", parms.name)); } 
    catch(err) { if (err.holochainMessage != "hash not found") throw err; }

    if (c !== undefined)
        throw("A Collective with of name '" + parms.name + "' already exists in this app!");

    // create the Collective's entry
    c = commit("cogov_collective", parms.name);

    // save some details about the collective
    commitItemDetails(c, "created", getNow());

    // add a link to the Collective on the app's DNA
    commit("cogov_collective_link", { Links: [{ Base: App.DNA.Hash, Link: c, Tag: "cogov_collective" }]});

    // create the Primary Ledger for this Collective
    l = commit("cogov_ledger", "Primary Ledger for " + parms.name);

    // save some details about the collective
    commitItemDetails(l, "created", getNow());

    // add a link to the Ledger on the Collective's entry
    commit("cogov_ledger_link", { Links: [{ Base: c, Link: l, Tag: "ledger_primary" }] })

    return c;
}

/*************
PROPOSAL METHODS
**************/
function createProposal(parms)
{
    var now = getNow();

    // if ledger is null, use the Collective's primary ledger
    if (parms.ledgerId === undefined)
        parms.ledgerId = getLinks(parms.collectiveId, "ledger_primary", {})[0].Hash;

    // create the proposal entry
    p = commit("cogov_proposal", { action: parms.action, timeStamp: now });

    // save some details about the member (timestamp repeated as a link for consistency)
    commitItemDetails(p, "created", now);

    // add a link to the Ledger's entry
    commit("cogov_proposal_link", { Links: [{ Base: parms.collectiveId, Link: p, Tag: "cogov_proposal" }]});

    return m;
}

function respondToProposal(parms)
{
    var now = getNow();

    r = commit("cogov_response", { proposalId: parms.proposalId, timeStamp: now });

    // save some details about the member (timestamp repeated as a link for consistency)
    commitItemDetails(r, "created", now);
    
    // add a link to the Proposal's entry
    commit("cogov_response_link", { Links: [{ Base: parms.proposalId, Link: r, Tag: "cogov_response" }]});

    return m;

}

/*************
MEMBER METHODS
**************/
function addMember(parms)
{
    return addAction("add_member", parms);
}

function performAddMember(action)
{
    debug(action)
    // create the member entry
    m = commit("cogov_member", action.parms.agentId);

    // save some details about the member
    commitItemDetails(m, "created", getNow());
    commitItemDetails(m, "actionId", action.id);

    // add a link to the Member on the Collective's entry
    commit("cogov_member_link", { Links: [{ Base: action.parms.collectiveId, Link: m, Tag: "cogov_member" }]});

    return m;
    
}

function getMembers(parms)
{
    if (parms.collectiveId === undefined)
        throw("getMembers: Parameter 'collectiveId' is required!");

    confirmCollective(parms.collectiveId);

    var members = [];

    try { var members = getLinks(parms.collectiveId, "cogov_member", { Load: true }); }
    catch(err) { if (err.holochainMessage !== "No links for cogov_member") throw err; }

    debug(members)
    var rtn = [];

    for(var x=0; x < members.length; x++)
        rtn.push(members[x].Entry);

    return rtn;
    
}
function validateAddMember(parms)
{
    if (parms.collectiveId === undefined)
        throw("createCollective: Parameter 'collectiveId' is required!");

    if (parms.agentId === undefined)
        throw("createCollective: Parameter 'agentId' is required!");

    confirmCollective(parms.collectiveId);

    var m = makeHash("cogov_member", parms.agentId);
    var members = [];

    // make sure the agentId isn't aleady a member
    try { members = getLinks(parms.collectiveId, "cogov_member", { }) } 
    catch(err) { if (err.holochainMessage != "No links for cogov_member") throw err; }

    for(var x=0; x < members.length; x++)
        if (members[x].Hash == m)
            throw "AgentId '" + parms.agentId + "' is already a member of the Collective!";

}

/*************
ACTION METHODS
**************/
function performAction(action)
{

    var rtn;

    if (action.type == "add_member")
        rtn = performAddMember(action);

    commitItemDetails(action.id, "performed", getNow());

    if (rtn === undefined)
        throw("performAction: unknown type: '" + action.type + "'!")

}

function addAction(type, parms)
{
    if (parms.collectiveId === undefined)
        throw(type + ": Parameter 'collectiveId' is required!");

    var now = getNow();

    // if ledger is null, use the Collective's primary ledger
    if (parms.ledgerId === undefined)
        parms.ledgerId = getLinks(parms.collectiveId, "ledger_primary", {})[0].Hash;

    // instantiate the action
    var action = { type: type, parms: parms, timeStamp: now };

    validateAction(action);

    // commit the action
    var a = commit("cogov_action", action);

    // save some details about the action (timestamp repeated as a link for consistency)
    commitItemDetails(a, "created", now);

    // add a link to the Action on the Collective's Ledger
    commit("cogov_action_link", { Links: [{ Base: parms.ledgerId, Link: a, Tag: "action" }]});

    action.id = a;

    return performAction(action);

}

function validateAction(action)
{
    if (action.type == "add_member")
        validateAddMember(action.parms);

    if (getMembers(parms).length == 0 && action.type == "add_member")
        return true;

    // check if this is an authorized action


    // check if this was a positively resolved proposal


    throw("validateAction: unknown type: '" + type + "'!")
}


/*************
HELPER METHODS
**************/

function confirmCollective(collectiveId)
{
    // make sure the entry exists
    try { var entryType = get(collectiveId, { GetMask: HC.GetMask.EntryType }); } 
    catch(err)
    { 
        if (err.holochainMessage == "hash not found") 
            throw "Collective with Id '" + collectiveId + "' does not exist";
        else 
            throw err;
    }

    // make sure it is a cogov_collective entry type
    if (entryType != "cogov_collective")
        throw "Entry with hash '" + collectiveId + "' is not a cogov_collective entry!";
}

function commitItemDetails(base, name, value)
{
    commit("cogov_item_details_link", { Links: [{ Base: base, Link: commit("cogov_item_details", { name: name, value: value }), Tag: "cogov_item_details_" + name }]});

}

function getNow()
{
    return (new Date()).getUTCDate();
}

function getActionId(base)
{
    try { var actionIds = getLinks(base, "cogov_item_details_actionId", { Load: true }); }
    catch(err) { debug(err) }

    if (actionIds.length != 1)
        throw("More than one actionId entry linked off")

    return actionIds[0].Entry.value;
}

/*************
VALIDATION METHODS
**************/
function validatePut(entry_type, entry, header, pkg, sources) {
    return validate(entry_type, entry, header, sources);
}
function validateCommit(entry_type, entry, header, pkg, sources) {
    return validate(entry_type, entry, header, sources);
}
function validate(entry_type, entry, header, sources)
{
    debug("cogov validate:" + entry_type)

    if (entry_type == "cogov_collective")
        return true;

    if (entry_type == "cogov_collective_link")
        return true;

    if (entry_type == "cogov_item_details")
        return true;

    if (entry_type == "cogov_item_details_link")
        return true;

    if (entry_type == "cogov_member")
        return true;

    if (entry_type == "cogov_member_link")
        return true;

    if (entry_type == "cogov_ledger")
        return true;

    if (entry_type == "cogov_ledger_link")
        return true;

    if (entry_type == "cogov_proposal")
        return true;

    if (entry_type == "cogov_proposal_link")
        return true;

    if (entry_type == "cogov_action")
        return true;

    if (entry_type == "cogov_action_link")
        return true;

    return false;
}

function validateLink(linkingEntryType, baseHash, linksArray, tag, pkg, sources)
{
    debug("cogov validateLink:" + linkingEntryType)
    
    if (linkingEntryType == "cogov_item_details_link")
        return true;

    if (linkingEntryType == "cogov_collective_link")
        return true;

    if (linkingEntryType == "cogov_member_link")
    {
        var actionId = getActionId(linksArray[0].Link)
        var action = get(actionId);

        try { validateAction(action) }
        catch(err) { debug("FAILED!"); return false; }

        return true;
        
    }
    
    if (linkingEntryType == "cogov_action_link")
    {
        try { validateAction(get(linksArray[0].Link)) }
        catch(err) { debug("FAILED!"); return false; }

        return true;
    }

    if (linkingEntryType == "cogov_ledger_link")
        return true;

    if (linkingEntryType == "cogov_proposal_link")
        return true;

    return false;
}

function validateMod(entry_type, hash, newHash, pkg, sources) { return true }
function validateDel(entry_type, hash, pkg, sources) { return true }
function validatePutPkg(entry_type) { return null }
function validateModPkg(entry_type) { return null }
function validateDelPkg(entry_type) { return null }
function validateLinkPkg(entry_type) { return null }


