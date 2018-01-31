/*
    Fork-Gov provides some basic means of governing the evolution of your application
    
    For details, see: https://github.com/Holochain/mixins/wiki/Fork-Gov
*/

/* Holocain API */ var _core_remove=remove;remove=function(a,b){return checkForError("remove",_core_remove(a,b))};var _core_makeHash=makeHash;makeHash=function(a,b){return checkForError("makeHash",_core_makeHash(a,b))};var _core_debug=debug;debug=function(a){return checkForError("debug",_core_debug(JSON.stringify(a)))};var _core_call=call;call=function(a,b,c){return __holochain_api_check_for_json(checkForError("call",_core_call(a,b,c)))};var _core_commit=commit;commit=function(a,b){return checkForError("commit",_core_commit(a,b))};var _core_get=get;get=function(a,b){return __holochain_api_check_for_json(checkForError("get",b===undefined?_core_get(a):_core_get(a,b)))};var _core_getLinks=getLinks;getLinks=function(a,b,c){return checkForError("getLinks",_core_getLinks(a,b,c))};var _core_send=send;send=function(a,b,c){return __holochain_api_check_for_json(checkForError("send",c===undefined?_core_send(a,b):_core_send(a,b,c)))};function __holochain_api_check_for_json(rtn){try{rtn=JSON.parse(rtn)}catch(err){}return rtn}function checkForError(func,rtn){if(typeof rtn==="object"&&rtn.name=="HolochainError"){var errsrc=new getErrorSource(4);var message='HOLOCHAIN ERROR! "'+rtn.message.toString()+'" on '+func+(errsrc.line===undefined?"":" in "+errsrc.functionName+" at line "+errsrc.line+", column "+errsrc.column);throw{name:"HolochainError",function:func,message:message,holochainMessage:rtn.message,source:errsrc,toString:function(){return this.message}}}return rtn}function getErrorSource(depth){try{throw new Error}catch(e){var line=e.stack.split("\n")[depth];var reg=/at (.*) \(.*:(.*):(.*)\)/g.exec(line);if(reg){this.functionName=reg[1];this.line=reg[2];this.column=reg[3]}}}
/* Anchors API */ function __anchors_api_postCallProcess(rtn){return JSON.parse(rtn)}function __anchors_api_isObject(item){return item===Object(item)}function setAnchor(anchor,value,entryType,preserveOldValueEntry,anchorHash,valueHash){if(__anchors_api_isObject(anchor))return __anchors_api_postCallProcess(call("anchors","set",anchors));var parms={anchor:anchor,value:value};if(entryType!==undefined)parms.entryType=entryType;if(preserveOldValueEntry!==undefined)parms.preserveOldValueEntry=preserveOldValueEntry;if(anchorHash!==undefined)parms.anchorHash=anchorHash;if(valueHash!==undefined)parms.valueHash=valueHash;return __anchors_api_postCallProcess(call("anchors","set",parms))}function getAnchor(anchor,anchorHash){if(__anchors_api_isObject(anchor))return __anchors_api_postCallProcess(call("anchors","get",anchors));var parms={anchor:anchor};if(anchorHash!==undefined)parms.anchorHash=anchorHash;return __anchors_api_postCallProcess(call("anchors","get",parms))}function addToListAnchor(anchor,value,entryType,preserveOldValueEntry,anchorHash,valueHash){if(__anchors_api_isObject(anchor))return __anchors_api_postCallProcess(call("anchors","addToList",anchors));var parms={anchor:anchor,value:value};if(entryType!==undefined)parms.entryType=entryType;if(preserveOldValueEntry!==undefined)parms.preserveOldValueEntry=preserveOldValueEntry;if(anchorHash!==undefined)parms.anchorHash=anchorHash;if(valueHash!==undefined)parms.valueHash=valueHash;return __anchors_api_postCallProcess(call("anchors","addToList",parms))}function getListAnchorItems(anchor,anchorHash){if(__anchors_api_isObject(anchor))return __anchors_api_postCallProcess(call("anchors","getListItems",anchors));var parms={anchor:anchor};if(anchorHash!==undefined)parms.anchorHash=anchorHash;if(withLinkHash!==undefined)parms.withLinkHash=withLinkHash;return __anchors_api_postCallProcess(call("anchors","getListItems",parms))}function removeFromListAnchor(anchor,value,entryType,preserveOldValueEntry,anchorHash,valueHash){if(__anchors_api_isObject(anchor))return __anchors_api_postCallProcess(call("anchors","removeFromList",anchors));var parms={anchor:anchor};if(value!==undefined)parms.value=value;if(entryType!==undefined)parms.entryType=entryType;if(preserveOldValueEntry!==undefined)parms.preserveOldValueEntry=preserveOldValueEntry;if(anchorHash!==undefined)parms.anchorHash=anchorHash;if(valueHash!==undefined)parms.valueHash=valueHash;return __anchors_api_postCallProcess(call("anchors","removeFromList",parms))}function initializeAnchor(anchor){return __anchors_api_postCallProcess(call("anchors","initializeAnchor",{anchor:anchor}))}function makeAnchorValueHash(value,entryType){var parms={value:value};if(entryType!==undefined)parms.entryType=entryType;return __anchors_api_postCallProcess(call("anchors","makeAnchorValueHash",parms))}
/* CoGov API */ function createCollective(name){var parms={name:name};return call("cogov","createCollective",parms)}

function genesis() {

    // create the application developer collective which will control this app
    var adc = createCollective("App Developer Collective for " + App.DNA.Hash);

    // link it on the DNA entry
    commit("fork-gov_app_dev_collective_link", { Links: [{ Base: App.DNA.Hash, Link: adc, Tag: "fork-gov_app_dev_collective" }] });

    var governors = [];
    
    try { governors = getLinks(App.DNA.Hash, "governor", {}); }
    catch(err) { }

    if (governors.length == 0)
        addGovernor({ agent: App.Agent.Hash });

    return true;
}

/************ Zome Public Interface ************/

function getForkGovVersion()
{
    return "0.0.0";
}

function addGovernor(parms)
{
    var new_gov = commit("fork-gov_governor", { AgentHash: parms.agent });
    commit("fork-gov_governor_link", { Links: [ { Base: App.DNA.Hash, Link: new_gov, Tag: "governor" }]});
    return new_gov;
}

function getGovernors()
{
    var govs = [];
    
    try { govs = getLinks(App.DNA.Hash, "governor", { Load: true }) }
    catch(err) { }

    var rtn = [];

    for (var x=0; x < govs.length; x++)
        rtn.push(govs[x].Entry);

    return rtn;
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
    debug("validate:" + entry_type)

    if (entry_type == "fork-gov_governor_link")
        return true;

    if (entry_type == "fork-gov_governor")
        return true;

    if (entry_type == "fork-gov_app_dev_collective_link")
        return true;

    return false;
}

function validateLink(linkingEntryType, baseHash, linkHash, tag, pkg, sources) {
    debug("validateLink:" + linkingEntryType)
    if (linkingEntryType == "fork-gov_governor_link")
        return true;
    
    if (linkingEntryType == "fork-gov_app_dev_collective_link")
    {
        try {
            debug(getLinks(App.DNA.Hash, "fork-gov_app_dev_collective"))
        }
        catch(err)
        {
            return true; // got error because a no link exists- then good
        }

        return false; // otherwise fail
    }

    return false;
}

function validateMod(entry_type, hash, newHash, pkg, sources) { return true; }
function validateDel(entry_type, hash, pkg, sources) { return true; }
function validatePutPkg(entry_type) { return null }
function validateModPkg(entry_type) { return null }
function validateDelPkg(entry_type) { return null }
function validateLinkPkg(entry_type) { return null }


