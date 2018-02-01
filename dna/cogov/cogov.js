/*
    Fork-Gov provides some basic means of governing the evolution of your application
    
    For details, see: https://github.com/Holochain/mixins/wiki/CoGov
*/

/* Holocain API */ var _core_remove=remove;remove=function(a,b){return checkForError("remove",_core_remove(a,b))};var _core_makeHash=makeHash;makeHash=function(a,b){return checkForError("makeHash",_core_makeHash(a,b))};var _core_debug=debug;debug=function(a){return checkForError("debug",_core_debug(JSON.stringify(a)))};var _core_call=call;call=function(a,b,c){return __holochain_api_check_for_json(checkForError("call",_core_call(a,b,c)))};var _core_commit=commit;commit=function(a,b){return checkForError("commit",_core_commit(a,b))};var _core_get=get;get=function(a,b){return __holochain_api_check_for_json(checkForError("get",b===undefined?_core_get(a):_core_get(a,b)))};var _core_getLinks=getLinks;getLinks=function(a,b,c){return checkForError("getLinks",_core_getLinks(a,b,c))};var _core_send=send;send=function(a,b,c){return __holochain_api_check_for_json(checkForError("send",c===undefined?_core_send(a,b):_core_send(a,b,c)))};function __holochain_api_check_for_json(rtn){try{rtn=JSON.parse(rtn)}catch(err){}return rtn}function checkForError(func,rtn){if(typeof rtn==="object"&&rtn.name=="HolochainError"){var errsrc=new getErrorSource(4);var message='HOLOCHAIN ERROR! "'+rtn.message.toString()+'" on '+func+(errsrc.line===undefined?"":" in "+errsrc.functionName+" at line "+errsrc.line+", column "+errsrc.column);throw{name:"HolochainError",function:func,message:message,holochainMessage:rtn.message,source:errsrc,toString:function(){return this.message}}}return rtn}function getErrorSource(depth){try{throw new Error}catch(e){var line=e.stack.split("\n")[depth];var reg=/at (.*) \(.*:(.*):(.*)\)/g.exec(line);if(reg){this.functionName=reg[1];this.line=reg[2];this.column=reg[3]}}}

function genesis() {
    return true;
}

/************ Zome Public Interface ************/

function getCoGovVersion()
{
    return "0.0.0";
}

function createCollective(parms)
{

    if (parms.name === undefined)
        throw("createCollective: Parameter 'name' is required!");

    var c;

    // make sure a Collective with this name doesn't already exist
    try { c = get(makeHash("cogov_collective", parms.name)); } 
    catch(err) { if (err.holochainMessage != "hash not found") throw err; }

    if (c !== undefined)
        throw("A Collective with of name '" + parms.name + "' already exists!");

    // create the Collective's entry
    c = commit("cogov_collective", parms.name);

    // save some details about the collective
    commit("cogov_item_details_link", { Links: [{ Base: c, Link: commit("cogov_item_details", (new Date()).getUTCDate()), Tag: "cogov_item_details_collective_created" }]});

    // add a link to the Collective on the app's DNA
    commit("cogov_collective_link", { Links: [{ Base: App.DNA.Hash, Link: c, Tag: "cogov_collective" }]});

    return c;
}

function addMember(parms)
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

    // create the member entry
    m = commit("cogov_member", parms.agentId);

    // save some details about the member
    commit("cogov_item_details_link", { Links: [{ Base: m, Link: commit("cogov_item_details", (new Date()).getUTCDate()), Tag: "cogov_item_details_collective_created" }]});

    // add a link to the Member on the Collective's entry
    commit("cogov_member_link", { Links: [{ Base: parms.collectiveId, Link: m, Tag: "cogov_member" }]});

    return m;
        
}

function getMembers(parms)
{
    if (parms.collectiveId === undefined)
        throw("getMembers: Parameter 'collectiveId' is required!");

    confirmCollective(parms.collectiveId);

    var rtn = [];

    try { var members = getLinks(parms.collectiveId, "cogov_member", { Load: true }); }
    catch(err) { debug(err); throw err; }

    for(var x=0; x < members.length; x++)
        rtn.push(members[x].Entry);

    return rtn;
    
}

/*************
HELPEFR METHODS
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

    return false;
}

function validateLink(linkingEntryType, baseHash, linkHash, tag, pkg, sources)
{
    debug("cogov validateLink:" + linkingEntryType)
    
    if (linkingEntryType == "cogov_item_details_link")
        return true;

    if (linkingEntryType == "cogov_collective_link")
        return true;

    if (linkingEntryType == "cogov_member_link")
        return true;

    return false;
}

function validateMod(entry_type, hash, newHash, pkg, sources) { return true; }
function validateDel(entry_type, hash, pkg, sources) { return true; }
function validatePutPkg(entry_type) { return null }
function validateModPkg(entry_type) { return null }
function validateDelPkg(entry_type) { return null }
function validateLinkPkg(entry_type) { return null }


