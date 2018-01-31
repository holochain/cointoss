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

    var collective = { type: "Collective", name: parms.name };

    var c;
    try { c = get(makeHash(collective)); } catch(err) {}

    if (c !== undefined)
        throw("A Collective with id '" + parms.id + "' already exists!");

    c = commit("cogov_collective", collective);

    commit("cogov_collective_link", { Links: [{ Base: App.DNA.Hash, Link: c, Tag: "cogov_collective" }]});

    return c;
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
function validate(entry_type, entry, header, sources) {
    if (entry_type == "cogov_collective" || entry_type == "cogov_collective_link") {
        return true;
    }

    return false;
}

function validateLink(linkingEntryType, baseHash, linkHash, tag, pkg, sources) {
    if (linkingEntryType == "fork-gov_governor_link")
        return true;
    return false;
}

function validateMod(entry_type, hash, newHash, pkg, sources) { return true; }
function validateDel(entry_type, hash, pkg, sources) { return true; }
function validatePutPkg(entry_type) { return null }
function validateModPkg(entry_type) { return null }
function validateDelPkg(entry_type) { return null }
function validateLinkPkg(entry_type) { return null }


